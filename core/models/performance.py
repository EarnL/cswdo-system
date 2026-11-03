from django.conf import settings
from django.db import models
from .cdc import CDC

class Performance(models.Model):
    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE)

    # ✅ who evaluated
    evaluated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    submission_score = models.FloatField()
    completeness_score = models.FloatField()
    performance_score = models.FloatField()

    overall_score = models.FloatField()
    rating = models.CharField(max_length=50)
    reward = models.CharField(max_length=100, blank=True)

    evaluated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.cdc.name} - {self.rating}"