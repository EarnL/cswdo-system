from datetime import date
from collections import defaultdict

from django.utils import timezone

from core.models import CDC, Report
from core.report_definitions import QUARTERLY_REPORT_DEFINITIONS


class ReminderService:
    REQUIRED_REPORT_TYPES = ['form6', *QUARTERLY_REPORT_DEFINITIONS.keys()]

    @classmethod
    def get_due_date(cls, year, quarter):
        due_month = quarter * 3 + 1
        due_year = year
        if due_month > 12:
            due_month = 1
            due_year += 1
        return date(due_year, due_month, 15)

    @classmethod
    def get_previous_period(cls, reference_date=None):
        reference_date = reference_date or timezone.localdate()
        current_quarter = ((reference_date.month - 1) // 3) + 1
        if current_quarter == 1:
            return 4, reference_date.year - 1
        return current_quarter - 1, reference_date.year

    @classmethod
    def get_reminders(cls, user, limit=None):
        today = timezone.localdate()
        if user.role in ['admin', 'staff']:
            reminders = cls._get_cswdo_reminders(today)
        elif user.role == 'cdw':
            reminders = cls._get_cdw_reminders(user, today)
        else:
            reminders = []

        reminders = sorted(
            reminders,
            key=lambda item: (
                {'high': 0, 'medium': 1, 'low': 2}.get(item['priority'], 3),
                item['due_on'],
            ),
        )
        return reminders[:limit] if limit else reminders

    @classmethod
    def get_pending_report_count(cls, user):
        reminders = cls.get_reminders(user)
        return sum(item.get('count', 1) for item in reminders if item['category'] == 'reports')

    @classmethod
    def _build_reminder(cls, title, message, due_on, priority, category, link, status, count=1):
        return {
            'title': title,
            'message': message,
            'due_on': due_on.isoformat(),
            'priority': priority,
            'category': category,
            'link': link,
            'status': status,
            'count': count,
        }

    @classmethod
    def _get_cdw_reminders(cls, user, today):
        reminders = []
        previous_quarter, previous_year = cls.get_previous_period(today)
        due_date = cls.get_due_date(previous_year, previous_quarter)

        assigned_cdcs = CDC.objects.filter(assigned_cdw=user).select_related('barangay')
        submitted_by_cdc = defaultdict(set)
        report_rows = Report.objects.filter(
            cdc__in=assigned_cdcs,
            quarter=previous_quarter,
            year=previous_year,
        ).values_list('cdc_id', 'report_type')
        for cdc_id, report_type in report_rows:
            submitted_by_cdc[cdc_id].add(report_type)

        for cdc in assigned_cdcs:
            submitted_types = submitted_by_cdc[cdc.id]
            missing_types = [item for item in cls.REQUIRED_REPORT_TYPES if item not in submitted_types]
            if missing_types:
                reminders.append(cls._build_reminder(
                    title=f'Missing Q{previous_quarter} {previous_year} submissions',
                    message=f'{cdc.name} still has {len(missing_types)} report type(s) not yet submitted.',
                    due_on=due_date,
                    priority='high' if due_date < today else 'medium',
                    category='reports',
                    link='/cdw/reports',
                    status='overdue' if due_date < today else 'due_soon',
                    count=len(missing_types),
                ))

            if cdc.license_expiry_date:
                days_remaining = (cdc.license_expiry_date - today).days
                if days_remaining < 0:
                    reminders.append(cls._build_reminder(
                        title='CDC license expired',
                        message=f'{cdc.name} license already expired on {cdc.license_expiry_date.isoformat()}.',
                        due_on=cdc.license_expiry_date,
                        priority='high',
                        category='accreditation',
                        link='/cdw/accreditation',
                        status='overdue',
                    ))
                elif days_remaining <= 30:
                    reminders.append(cls._build_reminder(
                        title='CDC license expiring soon',
                        message=f'{cdc.name} license expires in {days_remaining} day(s).',
                        due_on=cdc.license_expiry_date,
                        priority='medium',
                        category='accreditation',
                        link='/cdw/accreditation',
                        status='due_soon',
                    ))

        return reminders

    @classmethod
    def _get_cswdo_reminders(cls, today):
        reminders = []
        previous_quarter, previous_year = cls.get_previous_period(today)
        due_date = cls.get_due_date(previous_year, previous_quarter)

        expected_cdcs = CDC.objects.filter(assigned_cdw__isnull=False)
        submitted_by_cdc = defaultdict(set)
        report_rows = Report.objects.filter(
            cdc__in=expected_cdcs,
            quarter=previous_quarter,
            year=previous_year,
        ).values_list('cdc_id', 'report_type')
        for cdc_id, report_type in report_rows:
            submitted_by_cdc[cdc_id].add(report_type)

        missing_total = 0
        affected_centers = 0
        for cdc_id in expected_cdcs.values_list('id', flat=True):
            submitted_types = submitted_by_cdc[cdc_id]
            missing = len([item for item in cls.REQUIRED_REPORT_TYPES if item not in submitted_types])
            if missing:
                missing_total += missing
                affected_centers += 1

        if missing_total:
            reminders.append(cls._build_reminder(
                title='Pending quarterly report submissions',
                message=f'{missing_total} expected report file(s) across {affected_centers} center(s) are still missing for Q{previous_quarter} {previous_year}.',
                due_on=due_date,
                priority='high' if due_date < today else 'medium',
                category='reports',
                link='/admin/reports',
                status='overdue' if due_date < today else 'due_soon',
                count=missing_total,
            ))

        expiring_cdcs = CDC.objects.filter(
            license_expiry_date__isnull=False,
            license_expiry_date__gte=today,
            license_expiry_date__lte=today + timezone.timedelta(days=30),
        ).count()
        if expiring_cdcs:
            reminders.append(cls._build_reminder(
                title='Accreditation renewals coming up',
                message=f'{expiring_cdcs} CDC license(s) will expire within 30 days.',
                due_on=today + timezone.timedelta(days=30),
                priority='medium',
                category='accreditation',
                link='/admin/accreditation',
                status='due_soon',
                count=expiring_cdcs,
            ))

        expired_cdcs = CDC.objects.filter(
            license_expiry_date__isnull=False,
            license_expiry_date__lt=today,
        ).count()
        if expired_cdcs:
            reminders.append(cls._build_reminder(
                title='Expired CDC licenses need review',
                message=f'{expired_cdcs} CDC license(s) are already expired and need follow-up.',
                due_on=today,
                priority='high',
                category='accreditation',
                link='/admin/accreditation',
                status='overdue',
                count=expired_cdcs,
            ))

        return reminders
