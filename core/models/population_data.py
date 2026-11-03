from django.conf import settings
from django.db import models
from .academic_year import AcademicYear

class PopulationDataSubmission(models.Model):
    STATUS_CHOICES = (
        ('submitted', 'Submitted by CHO'),
        ('received', 'Received from CHO'),
        ('under_planning_review', 'Under City Planning Review'),
        ('returned_to_cho', 'Returned to CHO for Revision'),
        ('revised_by_cho', 'Revised by CHO'),
        ('sent_to_cswdo', 'Forwarded to CSWDO'),
        ('received_by_cswdo', 'Accepted by CSWDO'),
        ('rejected_by_admin', 'Rejected by CSWDO Admin'),
        ('current_basis', 'Current Population Basis'),
        ('archived', 'Archived / Outdated'),
    )

    data_request = models.OneToOneField('PopulationDataRequest', null=True, blank=True, on_delete=models.PROTECT, related_name='submission')

    # Submission metadata
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='population_submissions'
    )
    submitted_on = models.DateTimeField(auto_now_add=True)
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        related_name='population_submissions',
        null=True,
        blank=True,
        help_text='Academic year covered by this population submission.'
    )

    # Data content
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    data_file = models.FileField(upload_to='population_data/%Y/%m/', blank=True, null=True)
    data_payload = models.JSONField(default=dict, blank=True)  # Store the actual population data

    # Status tracking
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='submitted')
    status_updated_on = models.DateTimeField(auto_now=True)

    # Processing info
    processed_by_planning = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_population_data'
    )
    processed_on = models.DateTimeField(null=True, blank=True)

    sent_to_cswdo_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_population_data'
    )
    sent_to_cswdo_on = models.DateTimeField(null=True, blank=True)

    received_by_cswdo_on = models.DateTimeField(null=True, blank=True)

    returned_to_cho_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='returned_population_data'
    )
    returned_to_cho_on = models.DateTimeField(null=True, blank=True)
    revision_reason = models.CharField(max_length=120, blank=True)
    revision_remarks = models.TextField(blank=True)
    revised_by_cho_on = models.DateTimeField(null=True, blank=True)

    # Analysis results
    analysis_results = models.JSONField(default=dict, blank=True)  # Store analysis data
    total_population = models.IntegerField(default=0)
    age_distribution = models.JSONField(default=dict, blank=True)
    gender_distribution = models.JSONField(default=dict, blank=True)
    barangay_breakdown = models.JSONField(default=dict, blank=True)

    # Data statistics (for display)
    total_records = models.IntegerField(default=0)
    data_sources = models.IntegerField(default=0)  # Number of CHO offices that contributed

    def __str__(self):
        year = self.academic_year.name if self.academic_year else 'No AY'
        return f"{self.title} - {year} - {self.get_status_display()} ({self.submitted_on.date()})"

    class Meta:
        ordering = ['-submitted_on']


class PopulationDataHistory(models.Model):
    submission = models.ForeignKey(
        PopulationDataSubmission,
        on_delete=models.CASCADE,
        related_name='history'
    )
    file_snapshot = models.FileField(upload_to='population_data/history/', blank=True)
    action = models.CharField(max_length=80)
    status = models.CharField(max_length=30, blank=True)
    message = models.TextField()
    remarks = models.TextField(blank=True)
    revision_reason = models.CharField(max_length=120, blank=True)
    current_location = models.CharField(max_length=120, blank=True)
    acted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='population_data_history_entries'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Population data history'

    def __str__(self):
        return f"{self.submission.title} - {self.action} - {self.created_at:%Y-%m-%d %H:%M}"
