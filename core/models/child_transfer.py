from django.conf import settings
from django.db import models


class ChildTransfer(models.Model):
    child = models.ForeignKey('Child', on_delete=models.PROTECT, related_name='transfers')
    academic_year = models.ForeignKey('AcademicYear', on_delete=models.PROTECT)
    from_cdc = models.ForeignKey('CDC', on_delete=models.PROTECT, related_name='outgoing_child_transfers')
    to_cdc = models.ForeignKey('CDC', on_delete=models.PROTECT, related_name='incoming_child_transfers')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name='+')
    status = models.CharField(max_length=12, default='pending', choices=[('pending', 'Pending'), ('approved', 'Approved'), ('declined', 'Declined')])
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['child'], condition=models.Q(status='pending'), name='one_pending_child_transfer')]
