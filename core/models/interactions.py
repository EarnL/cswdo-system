from django.conf import settings
from django.db import models
from django.utils import timezone

from .cdc import CDC


class InteractionObservation(models.Model):
    INTERACTION_RATING_CHOICES = [
        ('supportive', 'Supportive and Positive'),
        ('developing', 'Developing or Inconsistent'),
        ('needs_support', 'Needs Support'),
    ]

    cdc = models.ForeignKey(CDC, on_delete=models.CASCADE, related_name='interaction_observations')
    observation_date = models.DateField(default=timezone.localdate)
    staff_child_interaction_rating = models.CharField(
        max_length=20,
        choices=INTERACTION_RATING_CHOICES,
        default='developing',
    )
    child_child_interaction_rating = models.CharField(
        max_length=20,
        choices=INTERACTION_RATING_CHOICES,
        default='developing',
    )
    fairness_and_inclusion_observed = models.BooleanField(default=False)
    independence_support_observed = models.BooleanField(default=False)
    positive_behavior_guidance_observed = models.BooleanField(default=False)
    routines_and_transitions_supportive = models.BooleanField(default=False)
    strengths = models.TextField(blank=True)
    concerns = models.TextField(blank=True)
    follow_up_actions = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    observed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_interaction_observations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-observation_date', '-created_at']

    def __str__(self):
        return f'{self.cdc.name} - interaction observation {self.observation_date}'
