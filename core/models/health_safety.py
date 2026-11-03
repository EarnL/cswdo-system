from django.conf import settings
from django.db import models
from django.utils import timezone

from .cdc import CDC
from .child import Child


class ChildHealthRecord(models.Model):
    CHECKUP_TYPE_CHOICES = [
        ('general', 'General health check-up'),
        ('dental', 'Dental check-up'),
        ('vision', 'Eye / Vision check-up'),
        ('hearing', 'Hearing check-up'),
        ('nutrition', 'Nutrition check-up'),
        ('other', 'Other'),
    ]

    CONDUCTED_BY_CHOICES = [
        ('barangay_health_worker', 'Barangay Health Worker'),
        ('nurse', 'Nurse'),
        ('midwife', 'Midwife'),
        ('doctor', 'Doctor'),
        ('dentist', 'Dentist'),
        ('nutrition_worker', 'Nutrition Worker'),
        ('cho_rhu_personnel', 'CHO / RHU Personnel'),
        ('other', 'Other'),
    ]

    REFERRAL_TO_CHOICES = [
        ('', 'Not referred'),
        ('barangay_health_center', 'Barangay Health Center'),
        ('rural_health_unit', 'Rural Health Unit'),
        ('cho', 'CHO'),
        ('doctor', 'Doctor'),
        ('dentist', 'Dentist'),
        ('nutrition_worker', 'Nutrition Worker'),
        ('specialist', 'Specialist'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('verified', 'Verified'),
        ('returned', 'Returned for Revision'),
    ]

    IMMUNIZATION_STATUS_CHOICES = [
        ('complete', 'Complete'),
        ('partial', 'Partial'),
        ('not_started', 'Not Started'),
        ('unknown', 'Unknown'),
    ]

    NUTRITIONAL_STATUS_CHOICES = [
        ('normal', 'Normal'),
        ('underweight', 'Underweight'),
        ('severely_underweight', 'Severely Underweight'),
        ('overweight', 'Overweight'),
        ('unknown', 'Unknown'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='child_health_records')
    child = models.ForeignKey(
        Child,
        on_delete=models.SET_NULL,
        null=True,
        blank=False,
        related_name='health_records',
    )
    screening_date = models.DateField(default=timezone.localdate)
    checkup_type = models.CharField(max_length=20, choices=CHECKUP_TYPE_CHOICES, default='general')
    conducted_by = models.CharField(max_length=40, choices=CONDUCTED_BY_CHOICES, default='barangay_health_worker')
    conducted_by_name = models.CharField(max_length=150, blank=True)
    immunization_status = models.CharField(max_length=20, choices=IMMUNIZATION_STATUS_CHOICES, default='unknown')
    height = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    weight = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    nutritional_status = models.CharField(max_length=30, choices=NUTRITIONAL_STATUS_CHOICES, default='unknown')
    health_findings = models.TextField(blank=True)
    symptoms_observed = models.TextField(blank=True)
    medicine_given = models.TextField(blank=True)
    advice_given = models.TextField(blank=True)
    vision_screening_result = models.CharField(max_length=255, blank=True)
    hearing_screening_result = models.CharField(max_length=255, blank=True)
    oral_health_result = models.CharField(max_length=255, blank=True)
    allergies = models.TextField(blank=True)
    dietary_restrictions = models.TextField(blank=True)
    medical_notes = models.TextField(blank=True)
    medical_clearance_date = models.DateField(null=True, blank=True)
    needs_referral = models.BooleanField(default=False)
    referral_reason = models.TextField(blank=True)
    referred_to = models.CharField(max_length=40, choices=REFERRAL_TO_CHOICES, blank=True)
    follow_up_needed = models.BooleanField(default=False)
    follow_up_date = models.DateField(null=True, blank=True)
    follow_up_instruction = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    review_remarks = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_child_health_records',
    )
    verified_on = models.DateTimeField(null=True, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_child_health_records',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-screening_date', '-created_at']

    def __str__(self):
        child_name = self.child.name if self.child else 'Unlinked child'
        return f'{self.cdc.name} - {child_name} health record'


class EmergencyReadiness(models.Model):
    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='emergency_readiness_records')
    assessment_date = models.DateField(default=timezone.localdate)
    has_first_aid_kit = models.BooleanField(default=False)
    first_aid_kit_checked_on = models.DateField(null=True, blank=True)
    fire_safety_equipment_available = models.BooleanField(default=False)
    last_drill_date = models.DateField(null=True, blank=True)
    drills_this_year = models.PositiveIntegerField(default=0)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_number = models.CharField(max_length=30, blank=True)
    notes = models.TextField(blank=True)
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assessed_emergency_readiness_records',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-assessment_date', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - emergency readiness {self.assessment_date}'


class SafetyIncident(models.Model):
    INCIDENT_TYPE_CHOICES = [
        ('injury', 'Injury'),
        ('illness', 'Illness'),
        ('behavior', 'Behavior Concern'),
        ('hazard', 'Hazard Exposure'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('monitoring', 'Monitoring'),
        ('closed', 'Closed'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='safety_incidents')
    child = models.ForeignKey(
        Child,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='safety_incidents',
    )
    incident_type = models.CharField(max_length=20, choices=INCIDENT_TYPE_CHOICES, default='injury')
    incident_date = models.DateField(default=timezone.localdate)
    description = models.TextField()
    action_taken = models.TextField(blank=True)
    referred_to = models.CharField(max_length=255, blank=True)
    resolved_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reported_safety_incidents',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-incident_date', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - {self.get_incident_type_display()}'


class ChildProtectionRecord(models.Model):
    CASE_STATUS_CHOICES = [
        ('none', 'No Active Case'),
        ('monitoring', 'Monitoring'),
        ('referred', 'Referred'),
        ('closed', 'Closed'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='child_protection_records')
    review_date = models.DateField(default=timezone.localdate)
    written_policy_available = models.BooleanField(default=False)
    staff_training_last_date = models.DateField(null=True, blank=True)
    parent_orientation_last_date = models.DateField(null=True, blank=True)
    case_opened = models.BooleanField(default=False)
    case_status = models.CharField(max_length=20, choices=CASE_STATUS_CHOICES, default='none')
    external_referral_agency = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_child_protection_records',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-review_date', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - child protection {self.review_date}'
