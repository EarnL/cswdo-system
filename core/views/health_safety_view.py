from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import ChildHealthRecord, ChildProtectionRecord, EmergencyReadiness, SafetyIncident
from core.serializers import (
    ChildHealthRecordSerializer,
    ChildProtectionRecordSerializer,
    EmergencyReadinessSerializer,
    SafetyIncidentSerializer,
)


class HealthSafetyBaseViewSet(viewsets.ModelViewSet):
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
            return Response({'error': 'You are not allowed to create health and safety records for this CDC.'}, status=status.HTTP_403_FORBIDDEN)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(serializer.instance).data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this health and safety record.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this health and safety record.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role != 'admin' or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'Only administrators can delete this health and safety record.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ChildHealthRecordViewSet(HealthSafetyBaseViewSet):
    queryset = ChildHealthRecord.objects.select_related('cdc', 'cdc__barangay', 'child', 'recorded_by', 'verified_by').all()
    serializer_class = ChildHealthRecordSerializer

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    def _can_review(self, user):
        return user.role in ['admin', 'staff', 'cho']

    @action(detail=True, methods=['post'])
    def start_review(self, request, pk=None):
        record = self.get_object()
        if not self._can_review(request.user) or not self._can_access_cdc(request.user, record.cdc):
            return Response({'error': 'You are not allowed to review this health record.'}, status=status.HTTP_403_FORBIDDEN)
        record.status = 'under_review'
        record.review_remarks = request.data.get('review_remarks', record.review_remarks)
        record.save(update_fields=['status', 'review_remarks', 'updated_at'])
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        record = self.get_object()
        if not self._can_review(request.user) or not self._can_access_cdc(request.user, record.cdc):
            return Response({'error': 'You are not allowed to verify this health record.'}, status=status.HTTP_403_FORBIDDEN)
        record.status = 'verified'
        record.review_remarks = request.data.get('review_remarks', record.review_remarks)
        record.verified_by = request.user
        record.verified_on = timezone.now()
        record.save(update_fields=['status', 'review_remarks', 'verified_by', 'verified_on', 'updated_at'])
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=['post'])
    def return_for_revision(self, request, pk=None):
        record = self.get_object()
        if not self._can_review(request.user) or not self._can_access_cdc(request.user, record.cdc):
            return Response({'error': 'You are not allowed to return this health record.'}, status=status.HTTP_403_FORBIDDEN)
        record.status = 'returned'
        record.review_remarks = request.data.get('review_remarks', record.review_remarks)
        record.save(update_fields=['status', 'review_remarks', 'updated_at'])
        return Response(self.get_serializer(record).data)


class EmergencyReadinessViewSet(HealthSafetyBaseViewSet):
    queryset = EmergencyReadiness.objects.select_related('cdc', 'cdc__barangay', 'assessed_by').all()
    serializer_class = EmergencyReadinessSerializer

    def perform_create(self, serializer):
        serializer.save(assessed_by=self.request.user)


class SafetyIncidentViewSet(HealthSafetyBaseViewSet):
    queryset = SafetyIncident.objects.select_related('cdc', 'cdc__barangay', 'child', 'reported_by').all()
    serializer_class = SafetyIncidentSerializer

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)


class ChildProtectionRecordViewSet(HealthSafetyBaseViewSet):
    queryset = ChildProtectionRecord.objects.select_related('cdc', 'cdc__barangay', 'reviewed_by').all()
    serializer_class = ChildProtectionRecordSerializer

    def perform_create(self, serializer):
        serializer.save(reviewed_by=self.request.user)
