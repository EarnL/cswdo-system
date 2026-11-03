from django.conf import settings
from django.db import models
from django.utils import timezone

from .cdc import CDC


class AccreditationRequest(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('under_evaluation', 'Under Evaluation'),
        ('needs_revision', 'Needs Revision'),
        ('evaluated_by_staff', 'Evaluated by Staff'),
        ('forwarded_to_admin', 'Forwarded to Admin'),
        ('approved', 'Approved / Accredited'),
        ('rejected', 'Rejected'),
        ('not_yet_eligible', 'Not Yet Eligible'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='accreditation_requests')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_accreditation_requests',
    )
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='draft')

    checklist_snapshot = models.JSONField(default=dict, blank=True)
    checklist_answers = models.JSONField(default=dict, blank=True)
    header_answers = models.JSONField(default=dict, blank=True)
    closing_answers = models.JSONField(default=dict, blank=True)

    total_score = models.FloatField(default=0)
    max_score = models.FloatField(default=0)
    percentage = models.FloatField(default=0)
    passing_percentage = models.FloatField(default=75)
    eligibility_result = models.CharField(max_length=80, blank=True)
    sections_needing_improvement = models.JSONField(default=list, blank=True)

    staff_evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='evaluated_accreditation_requests',
    )
    staff_remarks = models.TextField(blank=True)
    staff_evaluated_at = models.DateTimeField(null=True, blank=True)

    admin_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_accreditation_requests',
    )
    admin_remarks = models.TextField(blank=True)
    final_decision_at = models.DateTimeField(null=True, blank=True)

    requested_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-requested_at']

    def __str__(self):
        return f'{self.cdc.name} - {self.get_status_display()}'
