from django.conf import settings
from django.db import models
from django.utils import timezone
from zoneinfo import ZoneInfo


def request_today():
    return timezone.now().astimezone(ZoneInfo('Asia/Manila')).date()


class PopulationRequestSchedule(models.Model):
    title = models.CharField(max_length=255)
    purpose = models.TextField()
    instructions = models.TextField(blank=True)
    coverage = models.CharField(max_length=255, default='All Lucena City barangays; children aged 0-5')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name='population_request_schedules')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_population_schedules')
    frequency = models.CharField(max_length=12, choices=[('monthly', 'Monthly'), ('quarterly', 'Quarterly'), ('annually', 'Annually')])
    next_period_start = models.DateField()
    due_days = models.PositiveSmallIntegerField(default=14)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class PopulationDataRequest(models.Model):
    correction_of = models.ForeignKey('self', null=True, blank=True, on_delete=models.PROTECT, related_name='corrections')
    overlap_reason = models.TextField(blank=True)
    STATUS_CHOICES = [('awaiting_submission', 'Awaiting submission'), ('under_review', 'Under review'), ('needs_revision', 'Needs correction'), ('completed', 'Completed'), ('cancelled', 'Cancelled')]
    title = models.CharField(max_length=255)
    purpose = models.TextField()
    instructions = models.TextField(blank=True)
    coverage = models.CharField(max_length=255, default='All Lucena City barangays; children aged 0-5')
    period_start = models.DateField()
    period_end = models.DateField()
    due_date = models.DateField()
    revision_due_date = models.DateField(null=True, blank=True)
    academic_year = models.ForeignKey('AcademicYear', on_delete=models.PROTECT)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name='population_data_requests')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_population_requests')
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='awaiting_submission')
    cancellation_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    schedule = models.ForeignKey(PopulationRequestSchedule, null=True, blank=True, on_delete=models.PROTECT, related_name='requests')

    @property
    def deadline_status(self):
        if self.status not in ['awaiting_submission', 'needs_revision']:
            return None
        days = ((self.revision_due_date or self.due_date) - request_today()).days
        return 'overdue' if days < 0 else 'due_soon' if days <= 7 else 'on_track'

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(condition=models.Q(period_end__gte=models.F('period_start')), name='population_request_period_order'),
            models.UniqueConstraint(fields=['schedule', 'period_start'], name='unique_population_schedule_period'),
        ]
