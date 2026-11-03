from django.conf import settings
from django.db import models


class PopulationBasisSnapshot(models.Model):
    """Immutable planning figures retained when a published basis is replaced."""
    submission = models.OneToOneField('PopulationDataSubmission', on_delete=models.PROTECT, related_name='basis_snapshot')
    barangays = models.JSONField(default=dict)
    captured_at = models.DateTimeField(auto_now_add=True)


class PopulationMembership(models.Model):
    """A child can appear in multiple uploads without losing its identity/history."""
    submission = models.ForeignKey('PopulationDataSubmission', on_delete=models.PROTECT, related_name='memberships')
    child = models.ForeignKey('Child', on_delete=models.PROTECT, related_name='population_memberships')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['submission', 'child'], name='unique_population_membership')]


class CDCPopulationBasis(models.Model):
    cdc = models.ForeignKey('CDC', on_delete=models.CASCADE, related_name='population_bases')
    academic_year = models.ForeignKey('AcademicYear', on_delete=models.PROTECT)
    submission = models.ForeignKey('PopulationDataSubmission', on_delete=models.PROTECT)
    applied_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    applied_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['cdc', 'academic_year'], name='unique_cdc_population_year')]


class CDCBasisHistory(models.Model):
    cdc = models.ForeignKey('CDC', on_delete=models.CASCADE, related_name='population_basis_history')
    submission = models.ForeignKey('PopulationDataSubmission', on_delete=models.PROTECT)
    previous_submission = models.ForeignKey('PopulationDataSubmission', on_delete=models.PROTECT, null=True, related_name='+')
    applied_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    applied_at = models.DateTimeField(auto_now_add=True)
    summary = models.JSONField(default=dict)
