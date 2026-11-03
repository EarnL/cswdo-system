from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import InteractionObservation
from core.serializers import InteractionObservationSerializer


class InteractionObservationViewSet(viewsets.ModelViewSet):
    queryset = InteractionObservation.objects.select_related('cdc', 'cdc__barangay', 'observed_by').all()
    serializer_class = InteractionObservationSerializer
    permission_classes = [IsAuthenticated]

    def _can_access_cdc(self, user, cdc):
        if user.role in ['admin', 'staff', 'cho', 'planning', 'city_planning']:
            return True
        if user.role == 'cdw' and cdc.assigned_cdw_id == user.id:
            return True
        return False

    def _can_manage(self, user):
        return user.role in ['admin', 'staff', 'cho'] or user.role == 'cdw'

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        cdc_id = self.request.query_params.get('cdc')
        if user.role == 'cdw':
            queryset = queryset.filter(cdc__assigned_cdw=user)
        if cdc_id:
            queryset = queryset.filter(cdc_id=cdc_id)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cdc = serializer.validated_data['cdc']
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, cdc):
            return Response(
                {'error': 'You are not allowed to create interaction observations for this CDC.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(serializer.instance).data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, instance.cdc):
            return Response(
                {'error': 'You are not allowed to update this interaction observation.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, instance.cdc):
            return Response(
                {'error': 'You are not allowed to update this interaction observation.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role != 'admin' or not self._can_access_cdc(request.user, instance.cdc):
            return Response(
                {'error': 'Only administrators can delete this interaction observation.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(observed_by=self.request.user)
