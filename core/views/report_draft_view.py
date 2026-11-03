from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from core.models import AcademicYear, CDC, ReportDraft
from core.services.population_basis_service import working_year
from core.serializers import ReportDraftSerializer
from core.services.activity_log_service import ActivityLogService
from core.services.grant_to_operate_service import GrantToOperateService


class ReportDraftViewSet(viewsets.ModelViewSet):
    serializer_class = ReportDraftSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ReportDraft.objects.select_related('cdc', 'cdc__barangay')
        if self.request.user.role == 'cdw':
            queryset = queryset.filter(
                cdc__assigned_cdw=self.request.user,
                cdc__is_accredited=True,
                cdc__accreditation_status='accredited',
                cdc__license_expiry_date__gte=timezone.localdate(),
            )

        elif self.request.user.role not in ('admin', 'staff'):
            queryset = queryset.filter(user=self.request.user)

        academic_year_id = self.request.query_params.get('academic_year')
        include_history = self.request.query_params.get('include_history') == 'true' or bool(self.kwargs.get('pk'))
        if academic_year_id:
            queryset = queryset.filter(academic_year_id=academic_year_id)
        elif not include_history:
            cdc = CDC.objects.filter(assigned_cdw=self.request.user).first() if self.request.user.role == 'cdw' else None
            queryset = queryset.filter(academic_year=working_year(cdc) if cdc else AcademicYear.get_current())

        report_type = self.request.query_params.get('report_type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)

        cdc = self.request.query_params.get('cdc')
        if cdc:
            queryset = queryset.filter(cdc_id=cdc)

        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(year=year)

        period_type = self.request.query_params.get('period_type')
        if period_type:
            queryset = queryset.filter(period_type=period_type)

        month = self.request.query_params.get('month')
        if month:
            queryset = queryset.filter(month=month)

        quarter = self.request.query_params.get('quarter')
        if quarter:
            queryset = queryset.filter(quarter=quarter)

        return queryset.order_by('-updated_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        cdc = validated['cdc']
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(cdc)}, status=status.HTTP_403_FORBIDDEN)
        academic_year = validated.get('academic_year') or working_year(cdc)

        draft, created = ReportDraft.objects.update_or_create(
            user=request.user,
            cdc=validated['cdc'],
            academic_year=academic_year,
            report_type=validated['report_type'],
            period_type=validated.get('period_type', 'quarterly'),
            month=validated.get('month', 0),
            quarter=validated['quarter'],
            year=validated['year'],
            defaults={
                'title': validated.get('title', ''),
                'payload': validated.get('payload', {}),
            },
        )

        ActivityLogService.log(
            request.user,
            'draft_saved',
            f"Saved a draft for {draft.get_report_type_display()} ({draft.cdc.name}, Q{draft.quarter} {draft.year}).",
            target_type='report_draft',
            target_id=draft.id,
            metadata={
                'report_type': draft.report_type,
                'cdc_name': draft.cdc.name,
                'period_type': draft.period_type,
                'month': draft.month,
                'quarter': draft.quarter,
                'year': draft.year,
                'academic_year': draft.academic_year.name if draft.academic_year else '',
                'created': created,
            },
        )

        response_serializer = self.get_serializer(draft)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def perform_destroy(self, instance):
        ActivityLogService.log(
            self.request.user,
            'draft_deleted',
            f"Deleted a draft for {instance.get_report_type_display()} ({instance.cdc.name}, Q{instance.quarter} {instance.year}).",
            target_type='report_draft',
            target_id=instance.id,
            metadata={
                'report_type': instance.report_type,
                'cdc_name': instance.cdc.name,
                'quarter': instance.quarter,
                'year': instance.year,
            },
        )
        instance.delete()
