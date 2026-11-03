from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import StaffProfile, StaffTrainingRecord


class StaffProfileSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    linked_user_name = serializers.CharField(source='linked_user.username', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = StaffProfile
        fields = '__all__'
        read_only_fields = ('recorded_by', 'created_at', 'updated_at')


class StaffTrainingRecordSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    staff_profile_name = serializers.CharField(source='staff_profile.full_name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    is_current = serializers.ReadOnlyField()

    class Meta:
        model = StaffTrainingRecord
        fields = '__all__'
        read_only_fields = ('recorded_by', 'created_at', 'updated_at', 'is_current')

    def validate(self, attrs):
        staff_profile = attrs.get('staff_profile') or getattr(self.instance, 'staff_profile', None)
        cdc = attrs.get('cdc') or getattr(self.instance, 'cdc', None)

        if staff_profile and cdc and staff_profile.cdc_id != cdc.id:
            raise serializers.ValidationError({
                'staff_profile': 'Selected staff profile does not belong to this CDC.',
            })

        return attrs
