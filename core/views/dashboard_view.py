from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.models import CDC, Barangay, ReportDraft
from core.services.activity_log_service import ActivityLogService
from core.services.notification_service import NotificationService
from core.services.reminder_service import ReminderService

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    centers = CDC.objects.all()
    drafts = ReportDraft.objects.filter(user=request.user)
    if request.user.role == 'cdw':
        centers = centers.filter(assigned_cdw=request.user)
        drafts = ReportDraft.objects.filter(cdc__assigned_cdw=request.user)
    total_cdcs = centers.count()
    total_barangays = Barangay.objects.count()
    total_enrollment = centers.aggregate(total=Sum('current_enrollment')).get('total') or 0
    active_drafts = drafts.count()
    unread_notifications = NotificationService.get_notification_summary(request.user)['unread_count']
    all_reminders = ReminderService.get_reminders(request.user)
    reminders = all_reminders[:5]
    pending_report_count = sum(
        item.get('count', 1) for item in all_reminders if item['category'] == 'reports'
    )
    recent_activity = ActivityLogService.get_queryset_for_user(request.user)[:5]

    return Response({
        "total_cdcs": total_cdcs,
        "total_barangays": total_barangays,
        "total_enrollment": total_enrollment,
        "pending_reports_count": pending_report_count,
        "active_drafts_count": active_drafts,
        "unread_notifications_count": unread_notifications,
        "reminders": [
            {
                'title': item['title'],
                'message': item['message'],
                'priority': item['priority'],
                'category': item['category'],
                'status': item['status'],
                'due_on': item['due_on'],
                'link': item['link'],
                'count': item['count'],
            }
            for item in reminders
        ],
        "recent_activity": [
            {
                'id': item.id,
                'summary': item.summary,
                'action': item.action,
                'actor_username': item.actor.username if item.actor else 'System',
                'actor_role': item.actor_role,
                'created_at': item.created_at,
            }
            for item in recent_activity
        ],
    })
