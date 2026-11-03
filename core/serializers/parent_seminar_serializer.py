from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import ParentSeminar


class ParentSeminarSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    barangay_name = serializers.CharField(source='cdc.barangay.name', read_only=True, allow_null=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ParentSeminar
        fields = '__all__'
        read_only_fields = ('recorded_by', 'created_at', 'updated_at')
