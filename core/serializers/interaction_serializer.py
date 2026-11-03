from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import InteractionObservation


class InteractionObservationSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    observed_by_name = serializers.CharField(source='observed_by.username', read_only=True)

    class Meta:
        model = InteractionObservation
        fields = '__all__'
        read_only_fields = ('observed_by', 'created_at', 'updated_at')
