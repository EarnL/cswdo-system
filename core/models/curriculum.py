from django.conf import settings
from django.db import models
from django.utils import timezone

from .cdc import CDC
from .child import Child


class CurriculumGuide(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('archived', 'Archived'),
    ]

    title = models.CharField(max_length=255)
    school_year = models.CharField(max_length=30, blank=True)
    learning_framework = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    learning_domains = models.JSONField(default=list, blank=True)
    weekly_focus = models.TextField(blank=True)
    required_activities = models.TextField(blank=True)
    materials_guidance = models.TextField(blank=True)
    assessment_guidance = models.TextField(blank=True)
    adaptation_guidance = models.TextField(blank=True)
    attachment = models.FileField(upload_to='curriculum_guides/%Y/%m/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_curriculum_guides',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class CurriculumDistribution(models.Model):
    cdc = models.OneToOneField(CDC, on_delete=models.CASCADE, related_name='curriculum_distribution')
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_curriculum_distributions',
    )
    sent_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f'{self.cdc.name} - LRPs sent'


class CurriculumPlan(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted for Review'),
        ('under_review', 'Under Review'),
        ('verified', 'Verified / Approved'),
        ('returned', 'Returned for Correction'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='curriculum_plans')
    guide = models.ForeignKey(CurriculumGuide, on_delete=models.SET_NULL, null=True, blank=True, related_name='implementation_records')
    school_year = models.CharField(max_length=30)
    curriculum_title = models.CharField(max_length=255, blank=True)
    implementation_period = models.CharField(max_length=80, blank=True)
    nelf_aligned = models.BooleanField(default=False)
    elds_aligned = models.BooleanField(default=False)
    play_based = models.BooleanField(default=False)
    learning_domains = models.JSONField(default=list, blank=True)
    daily_schedule = models.TextField(blank=True)
    activity_areas_description = models.TextField(blank=True)
    materials_used = models.TextField(blank=True)
    child_participation = models.TextField(blank=True)
    special_needs_adaptations = models.TextField(blank=True)
    evidence_notes = models.TextField(blank=True)
    evidence_attachment = models.FileField(upload_to='curriculum_implementation/%Y/%m/', blank=True, null=True)
    parent_shared = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    review_remarks = models.TextField(blank=True)
    submitted_on = models.DateTimeField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_curriculum_plans',
    )
    reviewed_on = models.DateTimeField(blank=True, null=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_curriculum_plans',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        label = self.curriculum_title or 'Curriculum plan'
        return f'{self.cdc.name} - {label} ({self.school_year})'


class ChildAssessmentRecord(models.Model):
    ASSESSMENT_METHOD_CHOICES = [
        ('observation', 'Observation'),
        ('checklist', 'Checklist'),
        ('portfolio', 'Portfolio'),
        ('conference', 'Parent Conference'),
        ('screening', 'Developmental Screening'),
        ('other', 'Other'),
    ]

    DOMAIN_CHOICES = [
        ('holistic', 'Holistic Development'),
        ('physical', 'Physical Development'),
        ('cognitive', 'Cognitive Development'),
        ('language', 'Language and Literacy'),
        ('socio_emotional', 'Socio-Emotional Development'),
        ('self_help', 'Self-Help and Independence'),
        ('creative', 'Creative Expression'),
        ('other', 'Other'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='child_assessment_records')
    child = models.ForeignKey(
        Child,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assessment_records',
    )
    assessment_date = models.DateField(default=timezone.localdate)
    assessment_method = models.CharField(
        max_length=20,
        choices=ASSESSMENT_METHOD_CHOICES,
        default='observation',
    )
    domain = models.CharField(max_length=20, choices=DOMAIN_CHOICES, default='holistic')
    observation_notes = models.TextField(blank=True)
    checklist_result = models.CharField(max_length=255, blank=True)
    portfolio_entry_reference = models.CharField(max_length=255, blank=True)
    follow_up_actions = models.TextField(blank=True)
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_child_assessment_records',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-assessment_date', '-created_at']

    def __str__(self):
        child_name = self.child.name if self.child else 'Center-wide assessment'
        return f'{self.cdc.name} - {child_name} {self.assessment_date}'


class StaffSchedule(models.Model):
    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='staff_schedules')
    effective_from = models.DateField(default=timezone.localdate)
    effective_to = models.DateField(null=True, blank=True)
    teacher_count = models.PositiveIntegerField(default=0)
    assistant_count = models.PositiveIntegerField(default=0)
    trained_adult_count = models.PositiveIntegerField(default=0)
    two_trained_adults_available = models.BooleanField(default=False)
    schedule_payload = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_staff_schedules',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-effective_from', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - staff schedule {self.effective_from}'
