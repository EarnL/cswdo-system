from rest_framework import serializers
from core.models import PopulationDataRequest, PopulationRequestSchedule
from core.models.population_request import request_today
from core.serializers.population_data_serializer import PopulationDataSubmissionSerializer


class RequestFieldsMixin:
    def validate(self, attrs):
        if 'period_start' in attrs:
            if attrs['period_end'] < attrs['period_start']:
                raise serializers.ValidationError({'period_end': 'The end date must be on or after the start date.'})
            if attrs['due_date'] < request_today():
                raise serializers.ValidationError({'due_date': 'Choose today or a later deadline.'})
        return attrs


class PopulationRequestSerializer(RequestFieldsMixin, serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    deadline_status = serializers.CharField(read_only=True, allow_null=True)
    submission = serializers.SerializerMethodField()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        from core.services.population_request_service import validate_request_scope
        validate_request_scope(attrs)
        return attrs

    def get_assigned_to_name(self, obj):
        return 'City Health Office (CHO)'

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_submission(self, obj):
        submission = getattr(obj, 'submission', None)
        if self.context.get('request') and self.context['request'].user.role in ['admin', 'staff'] and obj.status != 'completed':
            return None
        if not submission:
            return None
        return PopulationDataSubmissionSerializer(submission, context=self.context).data

    class Meta:
        model = PopulationDataRequest
        fields = ['id', 'correction_of', 'overlap_reason', 'title', 'purpose', 'instructions', 'coverage', 'period_start', 'period_end', 'due_date', 'revision_due_date', 'academic_year', 'academic_year_name', 'assigned_to', 'assigned_to_name', 'created_by', 'created_by_name', 'status', 'status_label', 'deadline_status', 'cancellation_reason', 'created_at', 'updated_at', 'completed_at', 'schedule', 'submission']
        read_only_fields = ['assigned_to', 'created_by', 'status', 'revision_due_date', 'cancellation_reason', 'created_at', 'updated_at', 'completed_at', 'schedule']


class PopulationScheduleSerializer(RequestFieldsMixin, serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()

    def get_assigned_to_name(self, obj):
        return 'City Health Office (CHO)'

    def validate(self, attrs):
        start = attrs['next_period_start']
        frequency = attrs['frequency']
        if start.day != 1 or (frequency == 'quarterly' and start.month not in [1, 4, 7, 10]) or (frequency == 'annually' and start.month != 1):
            raise serializers.ValidationError({'next_period_start': 'Choose the first day of a calendar month, quarter, or year for this schedule.'})
        if start.year < request_today().year - 1:
            raise serializers.ValidationError({'next_period_start': 'Choose a period from last year onward.'})
        if not 1 <= attrs.get('due_days', 14) <= 366:
            raise serializers.ValidationError({'due_days': 'Choose between 1 and 366 days.'})
        return attrs

    class Meta:
        model = PopulationRequestSchedule
        fields = ['id', 'title', 'purpose', 'instructions', 'coverage', 'assigned_to', 'assigned_to_name', 'created_by', 'frequency', 'next_period_start', 'due_days', 'is_active', 'created_at']
        read_only_fields = ['assigned_to', 'created_by', 'is_active', 'created_at']
