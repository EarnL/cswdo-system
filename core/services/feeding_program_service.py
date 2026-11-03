from datetime import date, timedelta
from typing import Any, Dict, List

from django.db.models import Sum
from django.utils import timezone

from core.models import FeedingDay, FeedingProgram


class FeedingProgramService:
    SCHEDULE_MAP = {
        'daily': [0, 1, 2, 3, 4],
        'mwf': [0, 2, 4],
        'tth': [1, 3],
    }

    ALERT_COMPLETION_THRESHOLD = 100

    def resolve_weekdays(self, program: FeedingProgram) -> List[int]:
        if program.schedule_type == 'custom':
            weekdays = sorted({int(day) for day in (program.custom_schedule_days or []) if 0 <= int(day) <= 6})
            return weekdays or self.SCHEDULE_MAP['daily']
        return self.SCHEDULE_MAP.get(program.schedule_type, self.SCHEDULE_MAP['daily'])

    def build_schedule_dates(self, program: FeedingProgram) -> List[date]:
        weekdays = self.resolve_weekdays(program)
        current_date = program.start_date
        schedule_dates = []

        while len(schedule_dates) < program.target_feeding_days:
            if current_date.weekday() in weekdays:
                schedule_dates.append(current_date)
            current_date += timedelta(days=1)

        return schedule_dates

    def sync_program_days(self, program: FeedingProgram) -> None:
        planned_dates = self.build_schedule_dates(program)
        planned_date_set = set(planned_dates)
        existing_days = {day.feeding_date: day for day in program.feeding_days.all()}

        days_to_create = [
            FeedingDay(program=program, feeding_date=feeding_date)
            for feeding_date in planned_dates
            if feeding_date not in existing_days
        ]
        if days_to_create:
            FeedingDay.objects.bulk_create(days_to_create)

        for feeding_date, feeding_day in existing_days.items():
            if feeding_date not in planned_date_set and feeding_day.status == 'scheduled':
                feeding_day.status = 'cancelled'
                if not feeding_day.notes:
                    feeding_day.notes = 'Removed from active schedule after schedule update.'
                feeding_day.save(update_fields=['status', 'notes'])

        completed_days = program.feeding_days.filter(status='completed').count()
        if program.status not in ['cancelled', 'on_hold']:
            next_status = 'completed' if completed_days >= program.target_feeding_days else 'active'
            if program.status != next_status:
                program.status = next_status
                program.save(update_fields=['status', 'updated_at'])

    def mark_missed_days(self, program: FeedingProgram) -> int:
        today = timezone.localdate()
        queryset = program.feeding_days.filter(status='scheduled', feeding_date__lt=today)
        updated = queryset.update(status='missed')
        return updated

    def get_program_metrics(self, program: FeedingProgram) -> Dict[str, Any]:
        self.mark_missed_days(program)

        feeding_days = list(program.feeding_days.order_by('feeding_date'))
        completed_days = [day for day in feeding_days if day.status == 'completed']
        missed_days = [day for day in feeding_days if day.status == 'missed']
        scheduled_days = [day for day in feeding_days if day.status == 'scheduled']

        completed_count = len(completed_days)
        remaining_count = max(0, program.target_feeding_days - completed_count)
        completion_percentage = (
            completed_count / program.target_feeding_days * 100
        ) if program.target_feeding_days else 0

        estimated_completion_day = feeding_days[program.target_feeding_days - 1] if feeding_days and len(feeding_days) >= program.target_feeding_days else None
        next_scheduled_day = next((day for day in scheduled_days if day.feeding_date >= timezone.localdate()), None)

        total_beneficiaries_served = sum(day.beneficiaries_served for day in completed_days)
        total_attendance = sum(day.attendance_count for day in completed_days)
        total_meals_served = sum(day.meals_served for day in completed_days)

        alerts = self._build_alerts(program, completed_count, missed_days, next_scheduled_day, remaining_count)

        return {
            'completed_feeding_days': completed_count,
            'remaining_feeding_days': remaining_count,
            'completion_percentage': round(completion_percentage, 1),
            'estimated_completion_date': estimated_completion_day.feeding_date if estimated_completion_day else None,
            'next_scheduled_feeding_day': next_scheduled_day.feeding_date if next_scheduled_day else None,
            'missed_feeding_days': len(missed_days),
            'scheduled_feeding_days': len(scheduled_days),
            'total_beneficiaries_served': total_beneficiaries_served,
            'total_attendance': total_attendance,
            'total_meals_served': total_meals_served,
            'compliance_status': 'Compliant' if completed_count >= program.target_feeding_days else 'In Progress',
            'alerts': alerts,
        }

    def _build_alerts(
        self,
        program: FeedingProgram,
        completed_count: int,
        missed_days: List[FeedingDay],
        next_scheduled_day: FeedingDay | None,
        remaining_count: int,
    ) -> List[Dict[str, Any]]:
        alerts = []
        today = timezone.localdate()

        if next_scheduled_day:
            days_until_next = (next_scheduled_day.feeding_date - today).days
            if 0 <= days_until_next <= 2:
                alerts.append({
                    'type': 'upcoming_feeding_day',
                    'severity': 'medium',
                    'message': f"Upcoming feeding day on {next_scheduled_day.feeding_date.isoformat()} for {program.cdc.name}.",
                })

        if completed_count >= self.ALERT_COMPLETION_THRESHOLD and remaining_count > 0:
            alerts.append({
                'type': 'nearing_completion',
                'severity': 'medium',
                'message': f"Program has completed {completed_count} of {program.target_feeding_days} feeding days.",
            })

        if missed_days:
            latest_missed = max(missed_days, key=lambda item: item.feeding_date)
            alerts.append({
                'type': 'missed_feeding_day',
                'severity': 'high',
                'message': f"{len(missed_days)} scheduled feeding day(s) were missed. Latest missed day: {latest_missed.feeding_date.isoformat()}.",
            })

        if remaining_count == 0:
            alerts.append({
                'type': 'program_completed',
                'severity': 'low',
                'message': 'The feeding program has completed all required feeding days.',
            })

        return alerts

    def get_monitoring_summary(self, programs=None) -> Dict[str, Any]:
        if programs is None:
            programs = FeedingProgram.objects.select_related('cdc', 'cdc__barangay').all()
        summary_rows = []
        totals = {
            'total_programs': programs.count(),
            'active_programs': 0,
            'completed_programs': 0,
            'total_completed_days': 0,
            'total_remaining_days': 0,
            'total_beneficiaries_served': 0,
            'total_missed_days': 0,
        }

        for program in programs:
            metrics = self.get_program_metrics(program)
            summary_rows.append({
                'id': program.id,
                'title': program.title,
                'cdc_name': program.cdc.name,
                'barangay_name': program.cdc.barangay.name,
                'status': program.status,
                'start_date': program.start_date,
                'schedule_type': program.schedule_type,
                'completed_feeding_days': metrics['completed_feeding_days'],
                'remaining_feeding_days': metrics['remaining_feeding_days'],
                'estimated_completion_date': metrics['estimated_completion_date'],
                'missed_feeding_days': metrics['missed_feeding_days'],
                'alerts': metrics['alerts'],
            })

            if program.status == 'active':
                totals['active_programs'] += 1
            if program.status == 'completed':
                totals['completed_programs'] += 1
            totals['total_completed_days'] += metrics['completed_feeding_days']
            totals['total_remaining_days'] += metrics['remaining_feeding_days']
            totals['total_beneficiaries_served'] += metrics['total_beneficiaries_served']
            totals['total_missed_days'] += metrics['missed_feeding_days']

        watchlist = [
            row for row in summary_rows
            if row['missed_feeding_days'] > 0 or row['remaining_feeding_days'] <= 20
        ]

        return {
            'summary': totals,
            'programs': summary_rows,
            'watchlist': watchlist[:10],
        }
