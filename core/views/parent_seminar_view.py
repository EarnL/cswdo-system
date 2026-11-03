from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import ParentSeminar
from core.serializers.parent_seminar_serializer import ParentSeminarSerializer


class ParentSeminarViewSet(viewsets.ModelViewSet):
    queryset = ParentSeminar.objects.select_related('cdc', 'cdc__barangay', 'recorded_by').all()
    serializer_class = ParentSeminarSerializer
    permission_classes = [IsAuthenticated]

    def _can_access_cdc(self, user, cdc):
        if user.role in ['admin', 'staff', 'cho']:
            return True
        if user.role == 'cdw' and cdc.assigned_cdw_id == user.id:
            return True
        return False

    def get_queryset(self):
        queryset = self.queryset.order_by('-date_conducted', '-created_at')
        user = self.request.user
        cdc_id = self.request.query_params.get('cdc')
        status_value = self.request.query_params.get('status')

        if user.role == 'cdw':
            queryset = queryset.filter(cdc__assigned_cdw=user)
        if cdc_id:
            queryset = queryset.filter(cdc_id=cdc_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cdc = serializer.validated_data['cdc']
        if not self._can_access_cdc(request.user, cdc):
            return Response({'error': 'You are not allowed to create parent seminar records for this CDC.'}, status=status.HTTP_403_FORBIDDEN)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(serializer.instance).data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this parent seminar record.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this parent seminar record.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role not in ['admin', 'staff'] or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'Only administrators or staff can delete parent seminar records.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
