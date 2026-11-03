from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Notification
from core.serializers.notification_serializer import NotificationSerializer
from core.services.notification_service import NotificationService


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_summary(request):
    return Response(NotificationService.get_notification_summary(request.user))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_list(request):
    status_filter = request.query_params.get('status', 'all')
    category = request.query_params.get('category', '')
    queryset = NotificationService.get_notification_list(request.user, status_filter=status_filter, category=category)
    return Response({
        'total': queryset.count(),
        'unread_count': queryset.filter(is_read=False).count(),
        'notifications': NotificationSerializer(queryset, many=True).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_mark_read(request, notification_id):
    notification = get_object_or_404(NotificationService.visible_notifications(request.user), id=notification_id)
    NotificationService.mark_read(notification)
    return Response({'status': 'success', 'notification': NotificationSerializer(notification).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_mark_unread(request, notification_id):
    notification = get_object_or_404(NotificationService.visible_notifications(request.user), id=notification_id)
    NotificationService.mark_unread(notification)
    return Response({'status': 'success', 'notification': NotificationSerializer(notification).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_mark_all_read(request):
    updated = NotificationService.mark_all_read(request.user)
    return Response({'status': 'success', 'updated': updated})
