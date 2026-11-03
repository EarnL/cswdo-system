from datetime import date

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import FeedingDay, FeedingProgram
from core.serializers.feeding_program_serializer import FeedingDaySerializer, FeedingProgramSerializer
from core.services.feeding_program_service import FeedingProgramService
from core.services.grant_to_operate_service import GrantToOperateService


class FeedingProgramViewSet(viewsets.ModelViewSet):
    queryset = FeedingProgram.objects.select_related('cdc', 'cdc__barangay', 'created_by').prefetch_related('feeding_days')
    serializer_class = FeedingProgramSerializer
    permission_classes = [IsAuthenticated]

    def _can_manage_program(self, user, cdc):
        if user.role in ['admin', 'staff', 'cho']:
            return True
        if user.role == 'cdw' and cdc.assigned_cdw_id == user.id:
            return True
        return False

    def get_queryset(self):
        queryset = self.queryset.order_by('-created_at')
        user = self.request.user

        if user.role == 'cdw':
            return queryset.filter(
                cdc__assigned_cdw=user,
                cdc__is_accredited=True,
                cdc__accreditation_status='accredited',
                cdc__license_expiry_date__gte=timezone.localdate(),
            )

        cdc_id = self.request.query_params.get('cdc')
        status_value = self.request.query_params.get('status')
        if cdc_id:
            queryset = queryset.filter(cdc_id=cdc_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def perform_create(self, serializer):
        cdc = serializer.validated_data['cdc']
        if not self._can_manage_program(self.request.user, cdc):
            raise PermissionDenied('You are not allowed to create a feeding program for this CDC.')
        if self.request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(cdc):
            raise PermissionDenied(GrantToOperateService.cdw_operating_error(cdc))

        program = serializer.save(created_by=self.request.user)
        FeedingProgramService().sync_program_days(program)
        program.refresh_from_db()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cdc = serializer.validated_data['cdc']
        if not self._can_manage_program(request.user, cdc):
            return Response({'error': 'You are not allowed to create a feeding program for this CDC.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(cdc)}, status=status.HTTP_403_FORBIDDEN)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        refreshed_serializer = self.get_serializer(serializer.instance)
        return Response(refreshed_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage_program(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this feeding program.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(instance.cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(instance.cdc)}, status=status.HTTP_403_FORBIDDEN)
        response = super().update(request, *args, **kwargs)
        program = self.get_object()
        FeedingProgramService().sync_program_days(program)
        program.refresh_from_db()
        return Response(self.get_serializer(program).data, status=response.status_code)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage_program(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this feeding program.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(instance.cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(instance.cdc)}, status=status.HTTP_403_FORBIDDEN)
        response = super().partial_update(request, *args, **kwargs)
        program = self.get_object()
        FeedingProgramService().sync_program_days(program)
        program.refresh_from_db()
        return Response(self.get_serializer(program).data, status=response.status_code)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role not in ['admin', 'staff']:
            return Response({'error': 'Only administrators or staff can delete feeding programs.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def record_day(self, request, pk=None):
        program = self.get_object()
        if not self._can_manage_program(request.user, program.cdc):
            return Response({'error': 'You are not allowed to record feeding days for this program.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(program.cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(program.cdc)}, status=status.HTTP_403_FORBIDDEN)

        feeding_date = request.data.get('feeding_date')
        if not feeding_date:
            return Response({'error': 'feeding_date is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            feeding_date = date.fromisoformat(feeding_date)
        except ValueError:
            return Response({'error': 'feeding_date must be in YYYY-MM-DD format.'}, status=status.HTTP_400_BAD_REQUEST)

        status_value = request.data.get('status', 'completed')
        if status_value not in ['completed', 'missed', 'cancelled']:
            return Response({'error': 'Invalid status for feeding day.'}, status=status.HTTP_400_BAD_REQUEST)

        feeding_day, _ = FeedingDay.objects.get_or_create(program=program, feeding_date=feeding_date)
        feeding_day.status = status_value
        feeding_day.beneficiaries_served = int(request.data.get('beneficiaries_served') or 0)
        feeding_day.attendance_count = int(request.data.get('attendance_count') or 0)
        feeding_day.meals_served = int(request.data.get('meals_served') or 0)
        feeding_day.notes = request.data.get('notes', '')
        feeding_day.recorded_by = request.user
        feeding_day.recorded_at = timezone.now()
        feeding_day.auto_generated = False
        feeding_day.save()

        FeedingProgramService().sync_program_days(program)
        program.refresh_from_db()
        return Response({
            'status': 'success',
            'feeding_day': FeedingDaySerializer(feeding_day).data,
            'program': self.get_serializer(program).data,
        })

    @action(detail=True, methods=['post'])
    def sync_schedule(self, request, pk=None):
        program = self.get_object()
        if not self._can_manage_program(request.user, program.cdc):
            return Response({'error': 'You are not allowed to sync this feeding program.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(program.cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(program.cdc)}, status=status.HTTP_403_FORBIDDEN)

        FeedingProgramService().sync_program_days(program)
        program.refresh_from_db()
        return Response({
            'status': 'success',
            'program': self.get_serializer(program).data,
        })

    @action(detail=False, methods=['get'])
    def monitoring_summary(self, request):
        summary = FeedingProgramService().get_monitoring_summary(programs=self.get_queryset())
        return Response(summary)
