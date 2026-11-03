from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'CSWDO Admin'),
        ('staff', 'CSWDO Staff'),
        ('cdw', 'CDW'),
        ('cho', 'CHO'),
        ('planning', 'City Planning'),
    )
    OFFICE_SOURCE_CHOICES = (
        ('cswdo', 'CSWDO'),
        ('cho', 'City Health Office'),
        ('city_planning', 'City Planning Office'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, null=True, blank=True)
    office_source = models.CharField(max_length=30, choices=OFFICE_SOURCE_CHOICES, null=True, blank=True)
    created_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_user_accounts',
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    
    # Profile fields
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    bio = models.TextField(max_length=500, null=True, blank=True)
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(max_length=200, null=True, blank=True)
    emergency_contact_name = models.CharField(max_length=100, null=True, blank=True)
    emergency_contact_number = models.CharField(max_length=15, null=True, blank=True)
    department = models.CharField(max_length=100, null=True, blank=True)
    position = models.CharField(max_length=100, null=True, blank=True)
    employee_id = models.CharField(max_length=20, null=True, blank=True)
