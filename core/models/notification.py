from django.conf import settings
from django.db import models


class Notification(models.Model):
    PRIORITY_CHOICES = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    source_key = models.CharField(max_length=120)
    title = models.CharField(max_length=255)
    message = models.TextField()
    category = models.CharField(max_length=50, default='general')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='low')
    link = models.CharField(max_length=255, blank=True)

    is_read = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    read_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['is_read', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'source_key'], name='unique_user_notification_source'),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.title}"
