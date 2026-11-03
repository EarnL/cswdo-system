from django.conf import settings
from django.db import models
from .cdc import CDC

class Budget(models.Model):
    SOURCE_CHOICES = [
        ('LGU', 'LGU'),
        ('NGO', 'NGO'),
        ('NGA', 'NGA'),
        ('PRIVATE', 'Private'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE)

    # ✅ who recorded this budget
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    source = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    amount = models.FloatField()
    year = models.IntegerField()

    def __str__(self):
        return f"{self.cdc.name} - {self.amount}"