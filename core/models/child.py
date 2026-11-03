from django.db import models
import uuid
from django.utils import timezone
from .cdc import CDC
from .barangay import Barangay
from .academic_year import AcademicYear
from .population_data import PopulationDataSubmission
from core.daycare_policy import is_daycare_age

class Child(models.Model):
    person_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    STATUS_CHOICES = [
        ('enrolled', 'Enrolled'),
        ('graduated', 'Graduated'),
        ('not_enrolled', 'Not Enrolled'),
        ('transferred', 'Transferred'),
        ('dropped', 'Dropped'),
        ('aged_out', 'Aged Out'),
    ]

    SEX_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('unspecified', 'Unspecified'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, null=True, blank=True)
    barangay = models.ForeignKey(Barangay, on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, null=True, blank=True, related_name='children')
    population_source_submission = models.ForeignKey(
        PopulationDataSubmission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='synced_children',
        help_text='CHO population submission that created or refreshed this child record.'
    )

    student_id = models.CharField(max_length=40, unique=True, blank=True, null=True)

    name = models.CharField(max_length=150)
    photo = models.ImageField(upload_to='children/photos/%Y/%m/', blank=True, null=True)
    first_name = models.CharField(max_length=80, blank=True)
    middle_name = models.CharField(max_length=80, blank=True)
    last_name = models.CharField(max_length=80, blank=True)
    sex = models.CharField(max_length=20, choices=SEX_CHOICES, default='unspecified')
    date_of_birth = models.DateField(null=True, blank=True)
    age = models.IntegerField(default=0)
    place_of_birth = models.CharField(max_length=150, blank=True)
    complete_address = models.TextField(blank=True)
    enrollment_date = models.DateField(null=True, blank=True)
    current_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='enrolled')

    father_name = models.CharField(max_length=150, blank=True)
    mother_name = models.CharField(max_length=150, blank=True)
    guardian_name = models.CharField(max_length=150, blank=True)
    guardian_relationship = models.CharField(max_length=80, blank=True)
    contact_number = models.CharField(max_length=30, blank=True)
    alternate_contact_number = models.CharField(max_length=30, blank=True)
    occupation = models.CharField(max_length=120, blank=True)
    emergency_contact_person = models.CharField(max_length=150, blank=True)
    emergency_contact_number = models.CharField(max_length=30, blank=True)

    height = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Height in centimeters")
    weight = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Weight in kilograms")
    bmi = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    blood_type = models.CharField(max_length=10, blank=True)
    allergies = models.TextField(blank=True)
    medical_conditions = models.TextField(blank=True)
    immunization_status = models.CharField(max_length=120, blank=True)
    nutritional_status = models.CharField(max_length=120, blank=True)
    health_remarks = models.TextField(blank=True)

    is_special_needs = models.BooleanField(default=False)
    type_of_special_need = models.CharField(max_length=150, blank=True)
    special_needs_assessment_date = models.DateField(null=True, blank=True)
    special_needs_assessed_by = models.CharField(max_length=150, blank=True)
    areas_needing_support = models.TextField(blank=True)
    recommended_intervention = models.TextField(blank=True)
    follow_up_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.academic_year_id:
            self.academic_year = AcademicYear.get_current()
        if not self.barangay_id and self.cdc_id:
            self.barangay = self.cdc.barangay
        if not self.pk and self.date_of_birth and self.barangay_id:
            previous = Child.objects.filter(name__iexact=self.name.strip(), date_of_birth=self.date_of_birth,
                barangay_id=self.barangay_id).exclude(academic_year=self.academic_year).first()
            if previous:
                self.person_id = previous.person_id
        if self.first_name or self.middle_name or self.last_name:
            self.name = ' '.join(part for part in [self.first_name, self.middle_name, self.last_name] if part).strip()
        if self.date_of_birth:
            self.age = self.age_for_academic_year(self.academic_year)
            if self.age >= 5 and self.current_status == 'enrolled':
                self.current_status = 'aged_out'
        if self.current_status == 'enrolled' and not self.is_daycare_eligible():
            self.current_status = 'aged_out' if self.age >= 5 else 'not_enrolled'
        if self.height and self.weight:
            meters = float(self.height) / 100
            self.bmi = round(float(self.weight) / (meters * meters), 2) if meters else None
        super().save(*args, **kwargs)
        if not self.student_id:
            year = self.academic_year.start_year if self.academic_year else timezone.localdate().year
            self.student_id = f"CSWDO-{year}-{self.pk:06d}"
            super().save(update_fields=['student_id'])

    def age_for_academic_year(self, academic_year=None):
        if not self.date_of_birth:
            return self.age or 0
        year = academic_year or self.academic_year or AcademicYear.get_current()
        reference_date = year.start_date
        years = reference_date.year - self.date_of_birth.year
        if (reference_date.month, reference_date.day) < (self.date_of_birth.month, self.date_of_birth.day):
            years -= 1
        return max(0, years)

    @property
    def is_population_0_5(self):
        return self.age_for_academic_year(self.academic_year) <= 5

    @property
    def is_active_enrollee(self):
        return self.current_status == 'enrolled' and self.is_daycare_eligible()

    def is_daycare_eligible(self, academic_year=None):
        return is_daycare_age(self.age_for_academic_year(academic_year))
