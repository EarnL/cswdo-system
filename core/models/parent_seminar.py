from django.conf import settings
from django.db import models

from .cdc import CDC


class ParentSeminar(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('rescheduled', 'Rescheduled'),
        ('cancelled', 'Cancelled'),
    ]

    seminar_title = models.CharField(max_length=255)
    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='parent_seminars')
    date_conducted = models.DateField()
    time_conducted = models.TimeField(null=True, blank=True)
    venue = models.CharField(max_length=255, blank=True)
    facilitator = models.CharField(max_length=255, blank=True)
    participants_count = models.PositiveIntegerField(default=0)
    topics = models.TextField(blank=True)
    materials = models.TextField(blank=True)
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_parent_seminars',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_conducted', '-created_at']

    def __str__(self):
        return f'{self.seminar_title} - {self.cdc.name}'
