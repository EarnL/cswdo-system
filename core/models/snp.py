from django.conf import settings
from django.db import models
from .barangay import Barangay

class SNP(models.Model):
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE)

    # ✅ optional: who managed SNP
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    is_active = models.BooleanField(default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    total_children = models.IntegerField(help_text='Total children served by this SNP program')
    target_children = models.IntegerField(default=10, help_text='Target number of children per barangay')
    sessions_per_week = models.IntegerField(default=2)
    hours_per_session = models.IntegerField(default=2)
    orientation_date = models.DateField(null=True, blank=True)
    participants_identified = models.IntegerField(default=0)
    volunteers_involved = models.IntegerField(default=0)
    parent_orientation_count = models.IntegerField(default=0)
    estimated_unenrolled_children = models.IntegerField(null=True, blank=True)
    certificate_issued = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"SNP - {self.barangay.name}"