from django.conf import settings
from django.db import models

from .cdc import CDC
from .academic_year import AcademicYear
from core.report_definitions import REPORT_TYPE_CHOICES


class ReportDraft(models.Model):
    PERIOD_TYPE_CHOICES = (
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('annual', 'Annual'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='report_drafts',
    )
    cdc = models.ForeignKey(
        CDC,
        on_delete=models.CASCADE,
        related_name='report_drafts',
    )
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='report_drafts',
    )
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES, default='form6')
    title = models.CharField(max_length=255, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    period_type = models.CharField(max_length=20, choices=PERIOD_TYPE_CHOICES, default='quarterly')
    month = models.IntegerField(default=0)
    quarter = models.IntegerField(default=1)
    year = models.IntegerField(default=2026)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'cdc', 'report_type', 'period_type', 'month', 'quarter', 'year', 'academic_year'],
                name='unique_report_draft_per_period',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.academic_year_id:
            from core.services.population_basis_service import working_year
            self.academic_year = working_year(self.cdc)
        super().save(*args, **kwargs)

    def __str__(self):
        if self.period_type == 'monthly' and self.month:
            period = f"M{self.month} {self.year}"
        elif self.period_type == 'annual':
            period = f"Annual {self.year}"
        else:
            period = f"Q{self.quarter} {self.year}"
        return f"Draft {self.get_report_type_display()} - {self.cdc.name} - {period}"
