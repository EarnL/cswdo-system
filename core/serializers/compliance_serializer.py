from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import AnnualEvaluation, AuthorityDocument, PermitRecord, SupervisoryVisit


class AuthorityDocumentSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    verified_by_name = serializers.CharField(source='verified_by.username', read_only=True)
    is_current = serializers.ReadOnlyField()

    class Meta:
        model = AuthorityDocument
        fields = '__all__'
        read_only_fields = ('verified_by', 'created_at', 'updated_at', 'is_current')


class PermitRecordSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.username', read_only=True)
    is_active = serializers.ReadOnlyField()
    days_until_expiry = serializers.ReadOnlyField()

    class Meta:
        model = PermitRecord
        fields = '__all__'
        read_only_fields = ('issued_by', 'created_at', 'updated_at', 'is_active', 'days_until_expiry')


class AnnualEvaluationSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    evaluated_by_name = serializers.CharField(source='evaluated_by.username', read_only=True)

    class Meta:
        model = AnnualEvaluation
        fields = '__all__'
        read_only_fields = ('evaluated_by', 'created_at', 'updated_at')


class SupervisoryVisitSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    supervisor_name = serializers.CharField(source='supervisor.username', read_only=True)

    class Meta:
        model = SupervisoryVisit
        fields = '__all__'
        read_only_fields = ('supervisor', 'created_at', 'updated_at')
