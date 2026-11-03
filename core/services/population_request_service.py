from datetime import date, timedelta
from django.db import transaction
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from core.models import AcademicYear, Notification, PopulationDataRequest, PopulationRequestSchedule, PopulationDataSubmission, PopulationDataHistory
from core.models.population_request import request_today
from core.services.population_analytics_service import PopulationAnalyticsService


def notify_request(item):
    prefix = f'population_request_{item.id}_'
    Notification.objects.filter(source_key__startswith=prefix, is_active=True).update(is_active=False)
    recipients = list(get_user_model().objects.filter(role='cho', is_active=True))
    if item.status == 'under_review':
        recipients += list(get_user_model().objects.filter(role__in=['planning', 'city_planning'], is_active=True))
    if item.status in ['completed', 'cancelled']:
        recipients += list(get_user_model().objects.filter(role__in=['admin', 'staff'], is_active=True))
    titles = {'awaiting_submission': 'Population data requested', 'under_review': 'Population data ready for review', 'needs_revision': 'Population data needs correction', 'completed': 'Validated population data available', 'cancelled': 'Population data request cancelled'}
    message = f'{item.title}. {item.get_status_display()}.'
    if item.status in ['awaiting_submission', 'needs_revision']:
        message += f' Submit by {item.revision_due_date or item.due_date:%b %d, %Y}.'
    if item.status == 'needs_revision':
        message += f' {item.submission.revision_remarks}'
    for user in recipients:
        base = 'planning' if user.role == 'city_planning' else user.role
        Notification.objects.get_or_create(user=user, source_key=f'{prefix}{item.status}_{item.updated_at.strftime("%Y%m%d%H%M%S%f")}', defaults={
            'title': titles[item.status], 'message': message, 'category': 'population',
            'priority': 'high' if item.status == 'needs_revision' else 'medium',
            'link': f'/{base}/data-requests/{item.id}',
        })


def change_request_state(submission, state):
    if not submission.data_request_id:
        return
    item = PopulationDataRequest.objects.select_for_update().get(pk=submission.data_request_id)
    item.status = state
    item.completed_at = timezone.now() if state == 'completed' else None
    item.save()
    notify_request(item)


def normalize_coverage(value):
    return ' '.join(str(value).casefold().split())


def validate_request_scope(attrs):
    year = attrs['academic_year']
    # Serialize creation for the same academic year, including scheduled requests.
    from core.models import AcademicYear
    AcademicYear.objects.select_for_update().get(pk=year.pk)
    candidates = PopulationDataRequest.objects.filter(academic_year=year, period_start__lte=attrs['period_end'], period_end__gte=attrs['period_start']).exclude(status='cancelled')
    matches = [item for item in candidates if normalize_coverage(item.coverage) == normalize_coverage(attrs.get('coverage', 'All Lucena City barangays; children aged 0-5'))]
    correction = attrs.get('correction_of')
    reason = str(attrs.get('overlap_reason') or '').strip()
    if correction:
        if correction.status != 'completed' or correction.academic_year_id != year.pk or correction.period_start != attrs['period_start'] or correction.period_end != attrs['period_end'] or normalize_coverage(correction.coverage) != normalize_coverage(attrs.get('coverage', '')):
            raise ValidationError({'correction_of': 'Choose a completed request with the same year, period, and coverage.'})
        if not reason:
            raise ValidationError({'overlap_reason': 'Explain the correction.'})
        if correction.corrections.exclude(status__in=['completed','cancelled']).exists():
            raise ValidationError({'correction_of': 'A correction is already pending for this request.'})
    for item in matches:
        exact = item.period_start == attrs['period_start'] and item.period_end == attrs['period_end']
        if exact and not (correction and item.status == 'completed'):
            raise ValidationError({'period_start': f'Request #{item.pk} already covers this period. Open the existing request.', 'existing_request_id': item.pk})
    if matches and not reason:
        raise ValidationError({'overlap_reason': f'Overlaps request #{matches[0].pk}. Explain why another request is needed.', 'existing_request_id': matches[0].pk})


@transaction.atomic
def submit_response(item_id, user, uploaded_file, notes=''):
    item = PopulationDataRequest.objects.select_for_update().get(pk=item_id)
    if user.role != 'cho' or not user.is_active:
        raise PermissionDenied('Only CHO users can respond to this request.')
    if item.status not in ['awaiting_submission', 'needs_revision']:
        raise ValidationError('This request is not awaiting a response.')
    from core.serializers.population_data_serializer import PopulationDataSubmissionSerializer
    PopulationDataSubmissionSerializer().validate_data_file(uploaded_file)
    preview = PopulationAnalyticsService.preview_upload_file(uploaded_file)
    uploaded_file.seek(0)
    if not preview.get('valid') or preview.get('missing_required_columns'):
        raise ValidationError({'data_file': preview.get('error') or 'Missing required columns: ' + ', '.join(preview.get('missing_required_columns', []))})
    payload = {'age_range': '0-5', 'age_coverage_label': 'Children aged 0-5', 'reporting_period_start': str(item.period_start), 'reporting_period_end': str(item.period_end), 'academic_year': item.academic_year.name}
    submission = PopulationDataSubmission.objects.filter(data_request=item).first()
    revised = submission is not None
    if revised:
        if submission.status != 'returned_to_cho':
            raise ValidationError('The existing submission is not awaiting corrections.')
        submission.data_file = uploaded_file
        submission.data_payload = payload
        submission.total_records = preview.get('row_count', 0)
        submission.status = 'revised_by_cho'
        submission.revised_by_cho_on = timezone.now()
        submission.save()
    else:
        submission = PopulationDataSubmission.objects.create(data_request=item, submitted_by=user, title=item.title, description=item.purpose, academic_year=item.academic_year, data_file=uploaded_file, data_payload=payload, total_records=preview.get('row_count', 0))
    PopulationDataHistory.objects.create(submission=submission, file_snapshot=submission.data_file.name, action='revised_by_cho' if revised else 'submitted', status=submission.status, message='Corrected file submitted for review.' if revised else 'Population data submitted to City Planning.', remarks=notes, acted_by=user, current_location='City Planning')
    change_request_state(submission, 'under_review')
    return submission


def next_period(start, frequency):
    months = {'monthly': 1, 'quarterly': 3, 'annually': 12}[frequency]
    number = start.year * 12 + start.month - 1 + months
    return date(number // 12, number % 12 + 1, 1)


@transaction.atomic
def process_schedules():
    today = request_today()
    count = 0
    for schedule in PopulationRequestSchedule.objects.select_for_update().filter(is_active=True, next_period_start__lte=today):
        while schedule.next_period_start <= today:
            start = schedule.next_period_start
            end = next_period(start, schedule.frequency) - timedelta(days=1)
            year = start.year if start.month >= 6 else start.year - 1
            academic_year, _ = AcademicYear.objects.get_or_create(name=f'{year}-{year+1}', defaults={'start_year': year, 'end_year': year+1, 'start_date': date(year, 6, 1), 'end_date': date(year+1, 5, 31)})
            AcademicYear.objects.select_for_update().get(pk=academic_year.pk)
            conflicts = PopulationDataRequest.objects.filter(academic_year=academic_year, period_start__lte=end, period_end__gte=start).exclude(status='cancelled')
            if any(normalize_coverage(item.coverage) == normalize_coverage(schedule.coverage) for item in conflicts):
                schedule.next_period_start = next_period(start, schedule.frequency)
                continue
            item, created = PopulationDataRequest.objects.get_or_create(schedule=schedule, period_start=start, defaults={
                'period_end': end, 'title': schedule.title, 'purpose': schedule.purpose,
                'instructions': schedule.instructions, 'coverage': schedule.coverage,
                'due_date': start + timedelta(days=schedule.due_days), 'academic_year': academic_year,
                'created_by': schedule.created_by,
            })
            if created:
                notify_request(item)
                count += 1
            schedule.next_period_start = next_period(start, schedule.frequency)
        schedule.save(update_fields=['next_period_start'])
    return count


def process_reminders():
    today = request_today()
    active_keys = []
    for item in PopulationDataRequest.objects.filter(status__in=['awaiting_submission', 'needs_revision', 'under_review']).select_related('assigned_to'):
        recipients = list(get_user_model().objects.filter(role='cho', is_active=True))
        phase = item.deadline_status
        if item.status == 'under_review':
            if (today - item.updated_at.astimezone(timezone.get_fixed_timezone(480)).date()).days < 3:
                continue
            phase = 'review_pending'
            recipients = list(get_user_model().objects.filter(role__in=['planning', 'city_planning'], is_active=True))
        if phase not in ['due_soon', 'overdue', 'review_pending']:
            continue
        key = f'population_request_{item.id}_reminder_{item.status}_{item.updated_at.strftime("%Y%m%d%H%M%S%f")}_{phase}'
        active_keys.append(key)
        for user in recipients:
            base = 'planning' if user.role == 'city_planning' else user.role
            title = {'due_soon': 'Population data due soon', 'overdue': 'Population data overdue', 'review_pending': 'Population data awaiting review'}[phase]
            message = f'{item.title}: please review this submission.' if phase == 'review_pending' else f'{item.title}: submit by {item.revision_due_date or item.due_date:%b %d, %Y}.'
            Notification.objects.get_or_create(user=user, source_key=key, defaults={'title': title, 'message': message, 'category': 'population', 'priority': 'high' if phase == 'overdue' else 'medium', 'link': f'/{base}/data-requests/{item.id}'})
    Notification.objects.filter(source_key__startswith='population_request_', source_key__contains='_reminder_', is_active=True).exclude(source_key__in=active_keys).update(is_active=False)
