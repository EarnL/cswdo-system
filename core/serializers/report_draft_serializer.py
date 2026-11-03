from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import ReportDraft


class ReportDraftSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    barangay_name = serializers.CharField(source='cdc.barangay.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, allow_null=True)
    report_type_label = serializers.CharField(source='get_report_type_display', read_only=True)

    class Meta:
        model = ReportDraft
        fields = (
            'id',
            'user',
            'cdc',
            'cdc_name',
            'barangay_name',
            'academic_year',
            'academic_year_name',
            'report_type',
            'report_type_label',
            'title',
            'payload',
            'period_type',
            'month',
            'quarter',
            'year',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('user', 'created_at', 'updated_at')
