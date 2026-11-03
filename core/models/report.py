from django.conf import settings
from django.db import models
from .cdc import CDC
from .academic_year import AcademicYear
from core.report_definitions import REPORT_TYPE_CHOICES

class Report(models.Model):
    PERIOD_TYPE_CHOICES = (
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('annual', 'Annual'),
    )

    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('needs_revision', 'Revise / Return'),
        ('verified_by_staff', 'Approved by Staff (Legacy)'),
        ('forwarded_to_admin', 'Forwarded to Admin (Legacy)'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE)
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='reports',
    )

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES, default='form6')
    title = models.CharField(max_length=255, blank=True)
    summary = models.TextField(blank=True)
    attachment = models.FileField(upload_to='reports/%Y/%m/', blank=True, null=True)
    pdf_attachment = models.FileField(upload_to='reports/%Y/%m/', blank=True, null=True)
    payload = models.JSONField(default=dict, blank=True)

    period_type = models.CharField(max_length=20, choices=PERIOD_TYPE_CHOICES, default='quarterly')
    month = models.IntegerField(default=0)
    quarter = models.IntegerField()
    year = models.IntegerField()

    submitted_on = models.DateTimeField(auto_now_add=True)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='under_review')
    review_remarks = models.TextField(blank=True)
    staff_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='staff_reviewed_reports'
    )
    staff_reviewed_on = models.DateTimeField(blank=True, null=True)
    admin_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='admin_reviewed_reports'
    )
    admin_reviewed_on = models.DateTimeField(blank=True, null=True)

    is_complete = models.BooleanField(default=False)
    is_on_time = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.academic_year_id:
            from core.services.population_basis_service import working_year
            self.academic_year = working_year(self.cdc)
        if self._state.adding:
            self.payload = {**(self.payload or {}), 'daycare_age_range': [3, 4]}
            from core.services.population_basis_service import basis_for, basis_info
            basis = basis_for(self.cdc, self.academic_year)
            info = basis_info(basis.submission, self.cdc) if basis else None
            if info:
                info['approved_at'] = str(info['approved_at']) if info['approved_at'] else None
            self.payload['cdc_population_basis'] = info
        super().save(*args, **kwargs)

    def __str__(self):
        if self.period_type == 'monthly' and self.month:
            period = f"M{self.month} {self.year}"
        elif self.period_type == 'annual':
            period = f"Annual {self.year}"
        else:
            period = f"Q{self.quarter} {self.year}"
        return f"{self.get_report_type_display()} - {self.cdc.name} - {period}"
