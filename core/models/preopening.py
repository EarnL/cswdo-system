from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models


def preopening_storage():
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT)


class PreOpeningRequirement(models.Model):
    cdc = models.ForeignKey('CDC', on_delete=models.CASCADE, related_name='preopening_requirements')
    section = models.CharField(max_length=30)
    data = models.JSONField(default=dict)
    evidence = models.FileField(
        storage=preopening_storage,
        upload_to='preopening/%Y/%m/', blank=True,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['cdc', 'section'], name='unique_preopening_section')]
