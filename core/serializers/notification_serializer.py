from rest_framework import serializers

from core.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            'id',
            'source_key',
            'title',
            'message',
            'priority',
            'category',
            'link',
            'is_read',
            'is_active',
            'read_at',
            'created_at',
            'last_seen_at',
        )
