from django.conf import settings
from django.db import models
from django.utils import timezone

from .cdc import CDC


class AuthorityDocument(models.Model):
    DOCUMENT_TYPE_CHOICES = [
        ('authority_to_operate', 'Authority to Operate'),
        ('business_permit', 'Business Permit'),
        ('ownership_document', 'Ownership or Organization Document'),
        ('barangay_resolution', 'Barangay or LGU Resolution'),
        ('inspection_report', 'Inspection Report'),
        ('other', 'Other'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='authority_documents')
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    title = models.CharField(max_length=255, blank=True)
    document_number = models.CharField(max_length=100, blank=True)
    issued_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    file = models.FileField(upload_to='compliance/authority/%Y/%m/', blank=True, null=True)
    notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_authority_documents',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issued_on', '-created_at']

    def __str__(self):
        label = self.title or self.get_document_type_display()
        return f'{self.cdc.name} - {label}'

    @property
    def is_current(self):
        if not self.expires_on:
            return True
        return self.expires_on >= timezone.localdate()


class PermitRecord(models.Model):
    PERMIT_TYPE_CHOICES = [
        ('initial', 'Initial Permit'),
        ('renewal', 'Renewal Permit'),
        ('temporary', 'Temporary Permit'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('issued', 'Issued'),
        ('temporary', 'Temporary Permit'),
        ('expired', 'Expired'),
        ('rejected', 'Rejected'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='permit_records')
    application_date = models.DateField(default=timezone.localdate)
    permit_type = models.CharField(max_length=20, choices=PERMIT_TYPE_CHOICES, default='initial')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    issued_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    is_temporary = models.BooleanField(default=False)
    inspection_report_file = models.FileField(upload_to='compliance/permits/%Y/%m/', blank=True, null=True)
    notes = models.TextField(blank=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='issued_permit_records',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-application_date', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - {self.get_status_display()}'

    @property
    def is_active(self):
        if self.status not in ['issued', 'temporary']:
            return False
        if not self.expires_on:
            return True
        return self.expires_on >= timezone.localdate()

    @property
    def days_until_expiry(self):
        if not self.expires_on:
            return None
        return (self.expires_on - timezone.localdate()).days


class AnnualEvaluation(models.Model):
    READINESS_CHOICES = [
        ('ready', 'Ready for Recognition'),
        ('progressing', 'Progressing'),
        ('needs_support', 'Needs Support'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='annual_evaluations')
    school_year = models.CharField(max_length=20)
    evaluation_date = models.DateField(default=timezone.localdate)
    stakeholder_inputs_summary = models.TextField(blank=True)
    strengths = models.TextField(blank=True)
    areas_for_improvement = models.TextField(blank=True)
    readiness_status = models.CharField(max_length=20, choices=READINESS_CHOICES, default='progressing')
    document_file = models.FileField(upload_to='compliance/evaluations/%Y/%m/', blank=True, null=True)
    evaluated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='annual_evaluations_completed',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-evaluation_date', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - {self.school_year} annual evaluation'


class SupervisoryVisit(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('follow_up_needed', 'Follow-up Needed'),
        ('closed', 'Closed'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='supervisory_visits')
    visit_date = models.DateField(default=timezone.localdate)
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supervisory_visits_completed',
    )
    findings = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)
    follow_up_due = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-visit_date', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - supervisory visit {self.visit_date}'
