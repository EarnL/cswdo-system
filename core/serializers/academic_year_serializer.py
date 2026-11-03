from rest_framework import serializers
from core.models import AcademicYear


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ['id', 'name', 'start_year', 'end_year', 'start_date', 'end_date', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']
