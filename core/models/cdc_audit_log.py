from django.conf import settings
from django.db import models


class CDCAuditLog(models.Model):
    ACTION_CHOICES = [
        ('created', 'Created'),
        ('updated', 'Updated'),
        ('accreditation_requested', 'Accreditation Requested'),
        ('accredited', 'Accredited'),
        ('rejected', 'Rejected'),
    ]

    cdc = models.ForeignKey(
        'core.CDC',
        on_delete=models.CASCADE,
        related_name='audit_logs',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cdc_audit_logs',
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    summary = models.CharField(max_length=255)
    field_changes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.cdc.name} - {self.action} - {self.created_at:%Y-%m-%d %H:%M}"
