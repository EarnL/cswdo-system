from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import FeedingDay, FeedingProgram
from core.services.feeding_program_service import FeedingProgramService


class FeedingDaySerializer(AssignedCDCSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = FeedingDay
        fields = '__all__'
        read_only_fields = ('program', 'recorded_by', 'recorded_at', 'auto_generated')


class FeedingProgramSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    barangay_name = serializers.CharField(source='cdc.barangay.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    feeding_days = serializers.SerializerMethodField()
    schedule_days_display = serializers.SerializerMethodField()
    metrics = serializers.SerializerMethodField()

    class Meta:
        model = FeedingProgram
        fields = '__all__'
        read_only_fields = ('created_by',)

    def get_feeding_days(self, obj):
        days = obj.feeding_days.order_by('feeding_date')
        return FeedingDaySerializer(days, many=True).data

    def get_schedule_days_display(self, obj):
        service = FeedingProgramService()
        labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        return [labels[index] for index in service.resolve_weekdays(obj)]

    def get_metrics(self, obj):
        service = FeedingProgramService()
        return service.get_program_metrics(obj)

    def validate(self, attrs):
        schedule_type = attrs.get('schedule_type', getattr(self.instance, 'schedule_type', 'daily'))
        custom_schedule_days = attrs.get('custom_schedule_days', getattr(self.instance, 'custom_schedule_days', []))

        if schedule_type == 'custom' and not custom_schedule_days:
            raise serializers.ValidationError({'custom_schedule_days': 'Select at least one day for a custom schedule.'})

        return attrs
