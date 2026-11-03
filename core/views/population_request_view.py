from django.db import transaction
from django.http import HttpResponse
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.models import PopulationDataRequest, PopulationRequestSchedule
from core.models.population_request import request_today
from core.serializers.population_request_serializer import PopulationRequestSerializer, PopulationScheduleSerializer
from core.serializers.population_data_serializer import PopulationDataSubmissionSerializer
from core.services.population_request_service import notify_request, submit_response, process_schedules, process_reminders, next_period

CSWDO_ROLES = ['admin', 'staff']
WORKFLOW_ROLES = CSWDO_ROLES + ['cho', 'planning', 'city_planning']


class PopulationRequestViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PopulationRequestSerializer
    queryset = PopulationDataRequest.objects.all()

    def get_queryset(self):
        user = self.request.user
        if user.role not in WORKFLOW_ROLES:
            raise PermissionDenied('This workspace is for population data requests.')
        queryset = super().get_queryset().select_related('assigned_to', 'created_by', 'academic_year', 'submission').prefetch_related('submission__history')
        return queryset

    def list(self, request, *args, **kwargs):
        self.get_queryset()
        process_schedules()
        process_reminders()
        return super().list(request, *args, **kwargs)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if request.user.role not in CSWDO_ROLES:
            raise PermissionDenied('Only CSWDO can create population data requests.')
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def perform_create(self, serializer):
        if self.request.user.role not in CSWDO_ROLES:
            raise PermissionDenied('Only CSWDO can create population data requests.')
        item = serializer.save(created_by=self.request.user)
        notify_request(item)

    @action(detail=False, methods=['get'])
    def template(self, request):
        if request.user.role not in WORKFLOW_ROLES:
            raise PermissionDenied()
        response = HttpResponse('child_full_name,date_of_birth,sex,barangay,guardian_name\r\n', content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="population-data-template.csv"'
        return response

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        item = self.get_object()
        submission = submit_response(item.pk, request.user, request.FILES.get('data_file'), str(request.data.get('notes') or '').strip())
        return Response(PopulationDataSubmissionSerializer(submission, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancel(self, request, pk=None):
        item = self.get_queryset().select_for_update(of=('self',)).get(pk=self.get_object().pk)
        if request.user.role not in CSWDO_ROLES or (request.user.role != 'admin' and item.created_by_id != request.user.id):
            raise PermissionDenied('Only the requester or an administrator can cancel this request.')
        if item.status not in ['awaiting_submission', 'needs_revision']:
            raise ValidationError('Only requests awaiting a CHO response can be cancelled.')
        reason = str(request.data.get('reason') or '').strip()
        if not reason:
            raise ValidationError({'reason': 'Explain why this request is being cancelled.'})
        item.status = 'cancelled'
        item.cancellation_reason = reason
        item.save()
        notify_request(item)
        return Response(self.get_serializer(item).data)


class PopulationScheduleViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = PopulationScheduleSerializer
    permission_classes = [IsAuthenticated]
    queryset = PopulationRequestSchedule.objects.all()

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.user.role not in CSWDO_ROLES:
            raise PermissionDenied('Only CSWDO can manage recurring data requests.')

    def get_queryset(self):
        return super().get_queryset().select_related('assigned_to')

    @transaction.atomic
    def perform_create(self, serializer):
        schedule = serializer.save(created_by=self.request.user)
        process_schedules()
        schedule.refresh_from_db()

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def toggle(self, request, pk=None):
        schedule = self.get_queryset().select_for_update(of=('self',)).get(pk=self.get_object().pk)
        if request.user.role != 'admin' and schedule.created_by_id != request.user.id:
            raise PermissionDenied('Only the schedule creator or an administrator can change this schedule.')
        schedule.is_active = not schedule.is_active
        if schedule.is_active:
            # Paused periods are skipped; resume with the current or next period.
            while next_period(schedule.next_period_start, schedule.frequency) <= request_today():
                schedule.next_period_start = next_period(schedule.next_period_start, schedule.frequency)
        schedule.save()
        process_schedules()
        schedule.refresh_from_db()
        return Response(self.get_serializer(schedule).data)
