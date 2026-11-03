from django.conf import settings
from django.db import models
from django.utils import timezone

from .cdc import CDC
from .child import Child


class SpecialNeedsAssessment(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('submitted', 'Submitted for Review'),
    )

    RESULT_CHOICES = (
        ('needs_monitoring', 'Re-test after 3 to 6 months'),
        ('no_concern', 'Average development'),
        ('for_referral', 'Suggests advanced development'),
        ('needs_further_assessment', 'For further review'),
    )

    ASSESSMENT_CHOICES = (
        ('first', '1st assessment'),
        ('second', '2nd assessment'),
        ('third', '3rd assessment'),
    )

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='special_needs_assessments')
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name='special_needs_assessments')
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='special_needs_assessments',
    )
    assessment_type = models.CharField(max_length=20, choices=ASSESSMENT_CHOICES, default='first')
    assessment_date = models.DateField(default=timezone.localdate)
    examiner_name = models.CharField(max_length=150, blank=True)
    place_administered = models.CharField(max_length=255, blank=True)
    child_profile = models.JSONField(default=dict, blank=True)
    checklist = models.JSONField(default=dict, blank=True)
    domain_scores = models.JSONField(default=dict, blank=True)
    result = models.CharField(max_length=40, choices=RESULT_CHOICES, default='no_concern')
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_on = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-assessment_date', '-updated_at']

    def __str__(self):
        return f'{self.child.name} - {self.get_result_display()}'
