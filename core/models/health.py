from django.conf import settings
from django.db import models
from .report import Report

class HealthNutrition(models.Model):
    report = models.OneToOneField(Report, on_delete=models.CASCADE)

    total_children = models.IntegerField()
    malnourished = models.IntegerField()
    normal = models.IntegerField()

    def __str__(self):
        return f"Health Data - {self.report}"