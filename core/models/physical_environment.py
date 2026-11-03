from django.conf import settings
from django.db import models
from django.utils import timezone

from .cdc import CDC


class PhysicalEnvironmentAssessment(models.Model):
    BUILDING_CONDITION_CHOICES = [
        ('safe', 'Safe and Sound'),
        ('minor_repairs', 'Needs Minor Repairs'),
        ('major_repairs', 'Needs Major Repairs'),
        ('unsafe', 'Unsafe'),
    ]

    BUILDING_TYPE_CHOICES = [
        ('owned', 'Owned Building'),
        ('rented', 'Rented Building'),
        ('barangay', 'Barangay Hall'),
        ('school', 'School Facility'),
        ('other', 'Other'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='physical_environment_assessments')
    assessment_date = models.DateField(default=timezone.localdate)
    has_safe_water_supply = models.BooleanField(default=False)
    has_functional_sanitation = models.BooleanField(default=False)
    has_stable_electricity = models.BooleanField(default=False)
    classroom_area = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    building_type_observed = models.CharField(max_length=20, choices=BUILDING_TYPE_CHOICES, blank=True)
    building_condition = models.CharField(
        max_length=20,
        choices=BUILDING_CONDITION_CHOICES,
        default='safe',
    )
    handwashing_station_available = models.BooleanField(default=False)
    outdoor_play_area_available = models.BooleanField(default=False)
    outdoor_area_fenced = models.BooleanField(default=False)
    proper_drainage = models.BooleanField(default=False)
    fire_safety_equipment_available = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assessed_physical_environment_records',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-assessment_date', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - physical environment {self.assessment_date}'
