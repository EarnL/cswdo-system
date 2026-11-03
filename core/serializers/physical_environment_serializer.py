from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import PhysicalEnvironmentAssessment


class PhysicalEnvironmentAssessmentSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    assessed_by_name = serializers.CharField(source='assessed_by.username', read_only=True)

    class Meta:
        model = PhysicalEnvironmentAssessment
        fields = '__all__'
        read_only_fields = ('assessed_by', 'created_at', 'updated_at')
