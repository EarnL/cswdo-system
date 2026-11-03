from rest_framework import viewsets
from core.models import Performance
from core.serializers import PerformanceSerializer
from core.permissions import AuthenticatedReadManagerWrite

class PerformanceViewSet(viewsets.ModelViewSet):
    queryset = Performance.objects.all()
    serializer_class = PerformanceSerializer
    permission_classes = [AuthenticatedReadManagerWrite]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.role == 'cdw':
            if not self.request.user.pk:
                return queryset.none()
            queryset = queryset.filter(cdc__assigned_cdw=self.request.user)
        return queryset

