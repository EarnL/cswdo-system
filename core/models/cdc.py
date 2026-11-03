from django.conf import settings
from django.db import models
from .barangay import Barangay

class CDC(models.Model):
    class Meta:
        constraints = [models.UniqueConstraint(fields=['assigned_cdw'], name='one_cdc_per_cdw')]

    name = models.CharField(max_length=150)
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE)

    # Contact Information
    address = models.TextField(blank=True)
    contact_person = models.CharField(max_length=100, blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    # Operations
    operating_days = models.CharField(max_length=100, blank=True)
    operating_hours = models.CharField(max_length=50, blank=True)

    # Facilities
    has_water_supply = models.BooleanField(default=False)
    has_sanitation = models.BooleanField(default=False)
    has_electricity = models.BooleanField(default=False)
    building_type = models.CharField(
        max_length=20,
        choices=[
            ('owned', 'Owned Building'),
            ('rented', 'Rented Building'),
            ('barangay', 'Barangay Hall'),
            ('school', 'School Facility'),
            ('other', 'Other'),
        ],
        blank=True
    )
    total_area = models.FloatField(null=True, blank=True)  # in square meters

    # Programs Offered
    offers_infant_care = models.BooleanField(default=False)
    offers_toddler_care = models.BooleanField(default=False)
    offers_preschool = models.BooleanField(default=False)
    has_feeding_program = models.BooleanField(default=False)
    has_health_services = models.BooleanField(default=False)

    # Staff Information
    total_staff = models.IntegerField(default=0)
    qualified_caregivers = models.IntegerField(default=0)
    volunteers = models.IntegerField(default=0)

    # Additional Information
    establishment_date = models.DateField(null=True, blank=True)
    registration_purpose = models.TextField(blank=True)
    special_notes = models.TextField(blank=True)

    assigned_cdw = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_cdcs'   # ✅ FIX
    )

    latitude = models.FloatField()
    longitude = models.FloatField()

    max_capacity = models.IntegerField()
    current_enrollment = models.IntegerField(default=0)
    
    # Session-based capacity management
    capacity_per_session = models.IntegerField(
        default=30,
        help_text="Maximum children per session (e.g., 30 for morning session)"
    )
    sessions_per_day = models.IntegerField(
        default=1,
        help_text="Number of sessions per day (e.g., 1=morning, 2=morning+midday, 3=morning+midday+afternoon)"
    )

    # Accreditation fields
    license_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    license_expiry_date = models.DateField(null=True, blank=True)
    is_accredited = models.BooleanField(default=False)
    accreditation_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Accreditation'),
            ('under_review', 'Under Review'),
            ('accredited', 'Accredited'),
            ('rejected', 'Rejected'),
            ('expired', 'License Expired'),
        ],
        default='pending'
    )
    accreditation_date = models.DateField(null=True, blank=True)
    accredited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accredited_cdcs'
    )
    accreditation_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    @property
    def is_license_valid(self):
        """Check if the license is still valid"""
        if not self.license_expiry_date:
            return False
        from django.utils import timezone
        return self.license_expiry_date >= timezone.now().date()

    def check_accreditation_status(self):
        """Update accreditation status based on license validity"""
        if not self.is_license_valid and self.accreditation_status == 'accredited':
            self.accreditation_status = 'expired'
            self.is_accredited = False
    
    @property
    def effective_capacity(self):
        """
        Calculate total capacity considering multiple sessions per day.
        Example: 30 capacity per session × 3 sessions = 90 total capacity
        """
        return self.capacity_per_session * self.sessions_per_day
    
    @property
    def sessions_needed(self):
        """
        Calculate number of sessions needed to accommodate current enrollment.
        Example: 70 enrolled ÷ 30 per session = 3 sessions needed
        Returns 0 if no enrollment.
        """
        if self.current_enrollment == 0:
            return 0
        import math
        return math.ceil(self.current_enrollment / self.capacity_per_session)
    
    @property
    def can_accommodate_all(self):
        """
        Check if current enrollment can be accommodated with available sessions.
        True if enrollment fits within (capacity_per_session × sessions_per_day)
        """
        return self.current_enrollment <= self.effective_capacity
    
    @property
    def service_gap_exists(self):
        """
        Service gap exists only if enrollment exceeds what sessions can handle.
        Not a gap if enrollment exceeds capacity but can be served via multiple sessions.
        Returns True only if sessions needed exceed available sessions.
        """
        return self.sessions_needed > self.sessions_per_day
