from django.conf import settings
from django.db import models
from .report import Report

class Sanitation(models.Model):
    report = models.OneToOneField(Report, on_delete=models.CASCADE)

    has_clean_water = models.BooleanField()
    has_toilet = models.BooleanField()
    waste_disposal = models.BooleanField()

    def __str__(self):
        return f"Sanitation - {self.report}"