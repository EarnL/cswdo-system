from django.conf import settings
from django.db import models
from .cdc import CDC

class Analytics(models.Model):
    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE)

    enrollment_rate = models.FloatField()
    attendance_rate = models.FloatField()
    coverage_rate = models.FloatField()
    service_gap = models.FloatField()

    overcrowded = models.BooleanField()

    def __str__(self):
        return f"Analytics - {self.cdc.name}"