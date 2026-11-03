from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import ChildHealthRecord, ChildProtectionRecord, EmergencyReadiness, SafetyIncident


class ChildHealthRecordSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    barangay_name = serializers.CharField(source='cdc.barangay.name', read_only=True, allow_null=True)
    child_name = serializers.CharField(source='child.name', read_only=True)
    student_id = serializers.CharField(source='child.student_id', read_only=True)
    child_age = serializers.IntegerField(source='child.age', read_only=True)
    child_sex = serializers.CharField(source='child.sex', read_only=True)
    guardian_name = serializers.SerializerMethodField()
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    verified_by_name = serializers.CharField(source='verified_by.username', read_only=True)
    checkup_type_label = serializers.CharField(source='get_checkup_type_display', read_only=True)
    conducted_by_label = serializers.CharField(source='get_conducted_by_display', read_only=True)
    nutritional_status_label = serializers.CharField(source='get_nutritional_status_display', read_only=True)
    referred_to_label = serializers.CharField(source='get_referred_to_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    def get_guardian_name(self, obj):
        if not obj.child:
            return ''
        return obj.child.guardian_name or obj.child.mother_name or obj.child.father_name or ''

    def validate(self, attrs):
        child = attrs.get('child') or getattr(self.instance, 'child', None)
        cdc = attrs.get('cdc') or getattr(self.instance, 'cdc', None)
        if child and cdc:
            if child.cdc_id != cdc.id or child.current_status != 'enrolled':
                raise serializers.ValidationError({
                    'child': 'Select a child who is officially enrolled in this CDC.'
                })
        return attrs

    class Meta:
        model = ChildHealthRecord
        fields = '__all__'
        read_only_fields = ('recorded_by', 'created_at', 'updated_at', 'verified_by', 'verified_on')


class EmergencyReadinessSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    assessed_by_name = serializers.CharField(source='assessed_by.username', read_only=True)

    class Meta:
        model = EmergencyReadiness
        fields = '__all__'
        read_only_fields = ('assessed_by', 'created_at', 'updated_at')


class SafetyIncidentSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    child_name = serializers.CharField(source='child.name', read_only=True)
    reported_by_name = serializers.CharField(source='reported_by.username', read_only=True)

    class Meta:
        model = SafetyIncident
        fields = '__all__'
        read_only_fields = ('reported_by', 'created_at', 'updated_at')


class ChildProtectionRecordSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)

    class Meta:
        model = ChildProtectionRecord
        fields = '__all__'
        read_only_fields = ('reviewed_by', 'created_at', 'updated_at')
