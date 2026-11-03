from django.conf import settings
from django.db import models

from .cdc import CDC


class FeedingProgram(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('on_hold', 'On Hold'),
        ('cancelled', 'Cancelled'),
    ]

    SCHEDULE_TYPE_CHOICES = [
        ('daily', 'Daily Feeding (Monday-Friday)'),
        ('mwf', 'Monday-Wednesday-Friday'),
        ('tth', 'Tuesday-Thursday'),
        ('custom', 'Custom Schedule'),
    ]

    title = models.CharField(max_length=255, default='120-Day Feeding Program')
    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='feeding_programs')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_feeding_programs',
    )

    start_date = models.DateField()
    target_feeding_days = models.PositiveIntegerField(default=120)
    schedule_type = models.CharField(max_length=20, choices=SCHEDULE_TYPE_CHOICES, default='daily')
    custom_schedule_days = models.JSONField(default=list, blank=True)

    budget_allocation = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    target_beneficiaries = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.cdc.name}"


class FeedingDay(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('missed', 'Missed'),
        ('cancelled', 'Cancelled'),
    ]

    program = models.ForeignKey(FeedingProgram, on_delete=models.CASCADE, related_name='feeding_days')
    feeding_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')

    beneficiaries_served = models.PositiveIntegerField(default=0)
    attendance_count = models.PositiveIntegerField(default=0)
    meals_served = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_feeding_days',
    )
    recorded_at = models.DateTimeField(null=True, blank=True)
    auto_generated = models.BooleanField(default=True)

    class Meta:
        ordering = ['feeding_date']
        constraints = [
            models.UniqueConstraint(fields=['program', 'feeding_date'], name='unique_program_feeding_date'),
        ]

    def __str__(self):
        return f"{self.program.cdc.name} - {self.feeding_date} ({self.status})"
