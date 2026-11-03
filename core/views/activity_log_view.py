from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from core.serializers import ActivityLogSerializer
from core.services.activity_log_service import ActivityLogService


class ActivityLogListView(generics.ListAPIView):
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ActivityLogService.get_queryset_for_user(self.request.user)

        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)

        target_type = self.request.query_params.get('target_type')
        if target_type:
            queryset = queryset.filter(target_type=target_type)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(summary__icontains=search)

        limit = self.request.query_params.get('limit')
        if limit and str(limit).isdigit():
            return queryset[:int(limit)]

        return queryset
