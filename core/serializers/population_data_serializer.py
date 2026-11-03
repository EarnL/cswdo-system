from rest_framework import serializers
from core.models import AcademicYear, PopulationDataHistory, PopulationDataSubmission
import json

class PopulationDataHistorySerializer(serializers.ModelSerializer):
    acted_by_name = serializers.CharField(source='acted_by.get_full_name', read_only=True, allow_null=True)
    acted_by_role = serializers.CharField(source='acted_by.role', read_only=True, allow_null=True)

    class Meta:
        model = PopulationDataHistory
        fields = [
            'id', 'action', 'status', 'message', 'remarks', 'revision_reason',
            'file_snapshot', 'current_location', 'acted_by', 'acted_by_name', 'acted_by_role', 'created_at'
        ]
        read_only_fields = fields

class PopulationDataSubmissionSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.CharField(source='submitted_by.get_full_name', read_only=True)
    submitted_by_role = serializers.CharField(source='submitted_by.role', read_only=True)
    processed_by_planning_name = serializers.CharField(source='processed_by_planning.get_full_name', read_only=True, allow_null=True)
    sent_to_cswdo_by_name = serializers.CharField(source='sent_to_cswdo_by.get_full_name', read_only=True, allow_null=True)
    returned_to_cho_by_name = serializers.CharField(source='returned_to_cho_by.get_full_name', read_only=True, allow_null=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    history = PopulationDataHistorySerializer(many=True, read_only=True)

    class Meta:
        model = PopulationDataSubmission
        fields = [
            'id', 'submitted_by', 'submitted_by_name', 'submitted_by_role',
            'data_request', 'academic_year', 'academic_year_name',
            'submitted_on', 'title', 'description', 'data_file', 'data_payload',
            'status', 'status_display', 'status_updated_on', 'processed_by_planning',
            'processed_by_planning_name', 'processed_on', 'sent_to_cswdo_by',
            'sent_to_cswdo_by_name', 'sent_to_cswdo_on', 'received_by_cswdo_on',
            'returned_to_cho_by', 'returned_to_cho_by_name', 'returned_to_cho_on',
            'revision_reason', 'revision_remarks', 'revised_by_cho_on',
            'analysis_results', 'total_population', 'age_distribution',
            'gender_distribution', 'barangay_breakdown', 'total_records', 'data_sources',
            'history',
        ]
        read_only_fields = [
            'data_request', 'status', 'processed_by_planning', 'processed_on', 'sent_to_cswdo_by', 'sent_to_cswdo_on', 'analysis_results', 'total_population', 'age_distribution', 'gender_distribution', 'barangay_breakdown', 'total_records', 'data_sources', 'submitted_by', 'submitted_on', 'status_updated_on', 'received_by_cswdo_on',
            'returned_to_cho_by', 'returned_to_cho_on', 'revision_reason',
            'revision_remarks', 'revised_by_cho_on',
        ]

    def validate_academic_year(self, value):
        if not value:
            raise serializers.ValidationError('Academic year is required for population submissions.')
        return value

    def validate_data_file(self, value):
        if not value:
            raise serializers.ValidationError('A population data file is required.')

        allowed_extensions = ('.csv', '.xlsx', '.xls')
        lower_name = value.name.lower()
        if not lower_name.endswith(allowed_extensions):
            raise serializers.ValidationError('Only CSV or Excel files are allowed.')

        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError('File size must not exceed 10MB.')

        return value

    def validate_data_payload(self, value):
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError('Invalid upload metadata format.') from exc

        if not isinstance(value, dict):
            raise serializers.ValidationError('Upload metadata must be a valid object.')

        return value

    def create(self, validated_data):
        validated_data['submitted_by'] = self.context['request'].user
        if not validated_data.get('academic_year'):
            validated_data['academic_year'] = AcademicYear.get_current()
        instance = super().create(validated_data)
        PopulationDataHistory.objects.create(
            submission=instance,
            file_snapshot=instance.data_file.name if instance.data_file else '',
            action='submitted',
            status=instance.status,
            message='CHO submitted this population data to City Planning for review.',
            current_location='City Planning',
            acted_by=instance.submitted_by,
        )
        return instance
