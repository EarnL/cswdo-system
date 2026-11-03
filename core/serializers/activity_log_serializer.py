from rest_framework import serializers

from core.models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = ActivityLog
        fields = (
            'id',
            'actor',
            'actor_username',
            'actor_role',
            'action',
            'summary',
            'target_type',
            'target_id',
            'metadata',
            'created_at',
        )
