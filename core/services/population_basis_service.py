"""Versioned population planning and explicit CDC adoption; never deletes children."""
import json
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from core.models import (AcademicYear, CDC, Child, PopulationDataSubmission, PopulationMembership,
                         PopulationBasisSnapshot, CDCPopulationBasis, CDCBasisHistory,
                         BarangayPopulationMetrics, EnrollmentData, ChildrenGapAnalysis,
                         SNPPlanningRecommendation, Notification)


def capture_basis(submission):
    if PopulationBasisSnapshot.objects.filter(submission=submission).exists():
        return
    rows = {}
    for metric in BarangayPopulationMetrics.objects.filter(source_submission=submission):
        bid = metric.barangay_id
        entry = {'population': metric.children_3_4 or 0, 'total': metric.total_population}
        for key, model in [('metrics', BarangayPopulationMetrics), ('enrollment', EnrollmentData),
                           ('gap', ChildrenGapAnalysis), ('recommendation', SNPPlanningRecommendation)]:
            entry[key] = list(model.objects.filter(barangay_id=bid, academic_year=submission.academic_year).values())
        rows[str(bid)] = entry
    PopulationBasisSnapshot.objects.create(submission=submission, barangays=json.loads(json.dumps(rows, cls=DjangoJSONEncoder)))


def working_year(cdc):
    basis = CDCPopulationBasis.objects.filter(cdc=cdc).select_related('academic_year').order_by('-academic_year__start_year').first()
    return basis.academic_year if basis else AcademicYear.get_current()


def basis_for(cdc, year):
    return CDCPopulationBasis.objects.filter(cdc=cdc, academic_year=year).select_related('submission').first()


def basis_info(submission, cdc):
    if not submission:
        return None
    snapshot = PopulationBasisSnapshot.objects.filter(submission=submission).first()
    figures = (snapshot.barangays.get(str(cdc.barangay_id), {}) if snapshot else {})
    approval = submission.history.filter(action='accepted_by_cswdo').select_related('acted_by').first()
    return {'id': submission.pk, 'title': submission.title, 'academic_year': submission.academic_year_id,
            'year': submission.academic_year.name, 'population': figures.get('population'),
            'approved_at': submission.received_by_cswdo_on,
            'approved_by': ((approval.acted_by.get_full_name() or approval.acted_by.username)
                            if approval and approval.acted_by else 'CSWDO Admin')}


def review(cdc, submission):
    current = basis_for(cdc, submission.academic_year)
    previous = current.submission if current else None
    old_ids = set(PopulationMembership.objects.filter(submission=previous, child__barangay_id=cdc.barangay_id).values_list('child_id', flat=True)) if previous else set()
    new_ids = set(PopulationMembership.objects.filter(submission=submission, child__barangay_id=cdc.barangay_id).values_list('child_id', flat=True))
    missing = old_ids - new_ids
    # Enrolled children remain enrolled even when absent from a new upload.
    missing.update(Child.objects.filter(cdc=cdc, academic_year=submission.academic_year).exclude(pk__in=new_ids).values_list('pk', flat=True))
    year = working_year(cdc)
    continuing = []
    if submission.academic_year_id != year.pk:
        continuing = [{'id': child.pk, 'name': child.name, 'eligible': child.is_daycare_eligible(submission.academic_year)}
                      for child in Child.objects.filter(cdc=cdc, academic_year=year, current_status='enrolled').order_by('name')]
    return {'current': basis_info(previous, cdc), 'available': basis_info(submission, cdc),
            'is_applied': bool(current and current.submission_id == submission.pk),
            'new_year': submission.academic_year_id != year.pk, 'year_review': continuing,
            'added': len(new_ids - old_ids), 'needs_review': len(missing),
            'review_children': list(Child.objects.filter(pk__in=missing).order_by('name').values('id', 'name', 'current_status')),
            'enrolled': Child.objects.filter(cdc=cdc, academic_year=submission.academic_year, current_status='enrolled').count()}


def notify_available(submission):
    for cdc in CDC.objects.exclude(assigned_cdw=None):
        key = f'population_basis_{cdc.pk}_{submission.pk}'
        Notification.objects.filter(source_key__startswith=f'population_basis_{cdc.pk}_', is_active=True).update(is_active=False)
        current = basis_for(cdc, submission.academic_year)
        if current and current.submission_id == submission.pk:
            continue
        Notification.objects.update_or_create(user_id=cdc.assigned_cdw_id, source_key=key, defaults={
            'title': f'Population update · {submission.academic_year.name}',
            'message': f'{cdc.name}: new population data is ready to review. Your records are retained.',
            'category': 'population', 'priority': 'medium', 'link': '/cdw#population-update', 'is_active': True,
        })


@transaction.atomic
def apply_basis(cdc_id, submission_id, user):
    cdc = CDC.objects.get(pk=cdc_id)
    if user.role != 'cdw' or cdc.assigned_cdw_id != user.pk:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Only the assigned CDW can apply this update.')
    submission = PopulationDataSubmission.objects.filter(pk=submission_id).select_related('academic_year').first()
    if not submission or not submission.academic_year_id:
        raise ValidationError('Population update not found.')
    AcademicYear.objects.select_for_update().get(pk=submission.academic_year_id)
    # Publication takes the year lock before updating CDC counters. Keep the
    # same lock order so simultaneous approval/adoption cannot deadlock.
    cdc = CDC.objects.select_for_update().get(pk=cdc_id)
    if cdc.assigned_cdw_id != user.pk:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Your CDC assignment changed. Refresh this page.')
    submission.refresh_from_db()
    if submission.status != 'current_basis':
        raise ValidationError('A newer update is available. Refresh and review it first.')
    if submission.academic_year.start_year < working_year(cdc).start_year:
        raise ValidationError('Previous academic years are available in history.')
    summary = review(cdc, submission)
    if summary['is_applied']:
        return summary
    if summary['available']['population'] is None:
        raise ValidationError('This update has no population figures for your barangay. Contact CSWDO.')
    prior = basis_for(cdc, submission.academic_year)
    CDCBasisHistory.objects.create(cdc=cdc, submission=submission,
        previous_submission=prior.submission if prior else None, applied_by=user,
        summary=json.loads(json.dumps(summary, cls=DjangoJSONEncoder)))
    CDCPopulationBasis.objects.update_or_create(cdc=cdc, academic_year=submission.academic_year,
        defaults={'submission': submission, 'applied_by': user})
    cdc.current_enrollment = sum(child.is_daycare_eligible(submission.academic_year) for child in
        Child.objects.filter(cdc=cdc, academic_year=submission.academic_year, current_status='enrolled'))
    cdc.save(update_fields=['current_enrollment'])
    Notification.objects.filter(source_key=f'population_basis_{cdc.pk}_{submission.pk}').update(is_active=False, is_read=True, read_at=timezone.now())
    return review(cdc, submission)
