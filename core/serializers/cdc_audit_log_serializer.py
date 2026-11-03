from rest_framework import serializers
from core.models import CDCAuditLog


class CDCAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = CDCAuditLog
        fields = '__all__'
