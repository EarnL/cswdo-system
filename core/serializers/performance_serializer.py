from rest_framework import serializers
from core.models import Performance

class PerformanceSerializer(serializers.ModelSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)

    class Meta:
        model = Performance
        fields = '__all__'