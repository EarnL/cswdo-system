from django.conf import settings
from django.db import models
from django.utils import timezone

from .cdc import CDC


class StaffProfile(models.Model):
    ROLE_TYPE_CHOICES = [
        ('cdw', 'Child Development Worker'),
        ('teacher', 'Teacher or Caregiver'),
        ('assistant', 'Teacher Aide or Assistant'),
        ('health', 'Health or Nutrition Personnel'),
        ('volunteer', 'Volunteer'),
        ('admin_support', 'Administrative or Support Staff'),
        ('other', 'Other'),
    ]

    EMPLOYMENT_STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('on_leave', 'On Leave'),
    ]

    EDUCATION_LEVEL_CHOICES = [
        ('unspecified', 'Unspecified'),
        ('high_school', 'High School'),
        ('vocational', 'Vocational or Technical'),
        ('college_level', 'College Level'),
        ('bachelors', "Bachelor's Degree"),
        ('masters', "Master's Degree or Higher"),
        ('other', 'Other'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='staff_profiles')
    linked_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_staff_profiles',
    )
    full_name = models.CharField(max_length=150)
    role_type = models.CharField(max_length=30, choices=ROLE_TYPE_CHOICES, default='teacher')
    employment_status = models.CharField(max_length=20, choices=EMPLOYMENT_STATUS_CHOICES, default='active')
    hire_date = models.DateField(null=True, blank=True)
    highest_education = models.CharField(
        max_length=20,
        choices=EDUCATION_LEVEL_CHOICES,
        default='unspecified',
    )
    has_eccd_training = models.BooleanField(default=False)
    is_qualified = models.BooleanField(default=False)
    is_primary_caregiver = models.BooleanField(default=False)
    first_aid_certified = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_staff_profiles',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.cdc.name} - {self.full_name}'


class StaffTrainingRecord(models.Model):
    TRAINING_TYPE_CHOICES = [
        ('eccd', 'ECCD or Early Childhood'),
        ('first_aid_cpr', 'First Aid or CPR'),
        ('child_protection', 'Child Protection'),
        ('inclusive_education', 'Inclusive Education'),
        ('health_nutrition', 'Health or Nutrition'),
        ('emergency_preparedness', 'Emergency Preparedness'),
        ('curriculum_assessment', 'Curriculum or Assessment'),
        ('other', 'Other'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='staff_training_records')
    staff_profile = models.ForeignKey(
        StaffProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='training_records',
    )
    title = models.CharField(max_length=255)
    training_type = models.CharField(max_length=30, choices=TRAINING_TYPE_CHOICES, default='eccd')
    provider = models.CharField(max_length=255, blank=True)
    completed_on = models.DateField(default=timezone.localdate)
    valid_until = models.DateField(null=True, blank=True)
    hours = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    certificate_number = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_staff_training_records',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-completed_on', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - {self.title}'

    @property
    def is_current(self):
        if not self.valid_until:
            return True
        return self.valid_until >= timezone.localdate()
