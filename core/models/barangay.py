from django.conf import settings
from django.db import models

class Barangay(models.Model):
    name = models.CharField(max_length=100)
    population_children_3_4 = models.IntegerField()

    def __str__(self):
        return self.name