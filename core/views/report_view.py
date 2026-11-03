from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q
from core.models import AcademicYear, CDC, Report
from core.report_definitions import get_cdc_periodic_report_definition, get_quarterly_report_definition
from core.serializers import ReportSerializer
from core.services.activity_log_service import ActivityLogService
from core.services.center_summary_service import CenterSummaryService
from core.services.grant_to_operate_service import GrantToOperateService
from core.services.notification_service import NotificationService
from core.services.report_file_service import ReportFileService
from core.services.population_basis_service import working_year

class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    CDC_REPORT_TYPES = ['cdc_monthly_report', 'cdc_quarterly_report', 'cdc_annual_report']

    def _ensure_role_allowed(self, allowed_roles, message):
        if self.request.user.role not in allowed_roles:
            raise PermissionDenied(message)

    def get_queryset(self):
        queryset = Report.objects.select_related(
            'cdc',
            'cdc__barangay',
            'submitted_by',
            'staff_reviewed_by',
            'admin_reviewed_by',
        ).order_by('-submitted_on')
        user = self.request.user

        if user.role == 'cdw':
            queryset = queryset.filter(
                cdc__assigned_cdw=user,
                cdc__is_accredited=True,
                cdc__accreditation_status='accredited',
                cdc__license_expiry_date__gte=timezone.localdate(),
            )
        elif user.role == 'admin':
            queryset = queryset.filter(Q(status='approved') | Q(report_type__in=self.CDC_REPORT_TYPES))

        academic_year_id = self.request.query_params.get('academic_year')
        include_history = self.request.query_params.get('include_history') == 'true' or bool(self.kwargs.get('pk'))
        if academic_year_id:
            queryset = queryset.filter(academic_year_id=academic_year_id)
        elif not include_history:
            cdc = CDC.objects.filter(assigned_cdw=self.request.user).first() if self.request.user.role == 'cdw' else None
            queryset = queryset.filter(academic_year=working_year(cdc) if cdc else AcademicYear.get_current())

        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(summary__icontains=search)
                | Q(cdc__name__icontains=search)
                | Q(cdc__barangay__name__icontains=search)
                | Q(submitted_by__username__icontains=search)
            )

        report_type = self.request.query_params.get('report_type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)

        cdc = self.request.query_params.get('cdc')
        if cdc:
            if str(cdc).isdigit():
                queryset = queryset.filter(cdc_id=cdc)
            else:
                queryset = queryset.filter(cdc__name__icontains=cdc)

        barangay = self.request.query_params.get('barangay')
        if barangay:
            if str(barangay).isdigit():
                queryset = queryset.filter(cdc__barangay_id=barangay)
            else:
                queryset = queryset.filter(cdc__barangay__name__icontains=barangay)

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

        status_filter = self.request.query_params.get('status')
        workflow_statuses = [choice[0] for choice in Report.STATUS_CHOICES]
        if status_filter in workflow_statuses:
            queryset = queryset.filter(status=status_filter)
        elif status_filter == 'complete':
            queryset = queryset.filter(is_complete=True)
        elif status_filter == 'incomplete':
            queryset = queryset.filter(is_complete=False)
        elif status_filter == 'on_time':
            queryset = queryset.filter(is_on_time=True)
        elif status_filter == 'late':
            queryset = queryset.filter(is_on_time=False)

        return queryset

    def _log_report_activity(self, action, report):
        ActivityLogService.log(
            self.request.user,
            action,
            f"{report.get_report_type_display()} for {report.cdc.name} ({self._format_period(report)}) was {action.replace('_', ' ')}.",
            target_type='report',
            target_id=report.id,
            metadata={
                'report_type': report.report_type,
                'cdc_name': report.cdc.name,
                'period_type': report.period_type,
                'month': report.month,
                'quarter': report.quarter,
                'year': report.year,
                'status': report.status,
            },
        )

    def _format_period(self, report):
        if report.period_type == 'monthly' and report.month:
            return f'M{report.month} {report.year}'
        if report.period_type == 'annual':
            return f'Annual {report.year}'
        return f'Q{report.quarter} {report.year}'

    def _is_generated_summary_report(self, report):
        payload = report.payload or {}
        return report.report_type == 'cdc_annual_report' and payload.get('generated_summary_report') is True

    def _generated_summary_workflow_response(self, report):
        if not self._is_generated_summary_report(report):
            return None
        return Response(
            {'error': 'Generated CDC annual reports are summary records and do not use approve, reject, or revision workflow.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _notify_cdw_decision(self, report):
        if not report.submitted_by:
            return
        messages = {
            'approved': (
                'Monitoring Report Approved',
                'Your submitted monitoring report has been approved.',
                'low',
            ),
            'needs_revision': (
                'Monitoring Report Needs Revision',
                'Your submitted monitoring report has been returned for revision. Please review the Staff remarks and resubmit the corrected report.',
                'high',
            ),
            'rejected': (
                'Monitoring Report Rejected',
                'Your submitted monitoring report has been rejected. Please review the Staff remarks for details.',
                'high',
            ),
        }
        if report.status not in messages:
            return
        title, message, priority = messages[report.status]
        NotificationService.upsert_notification(
            report.submitted_by,
            f'report_{report.id}_{report.status}',
            title,
            message,
            priority,
            'reports',
            '/cdw/reports',
        )

    def _update_report_status(self, report, next_status, remarks=''):
        blocked_response = self._generated_summary_workflow_response(report)
        if blocked_response:
            return blocked_response

        user = self.request.user
        update_fields = ['status', 'is_complete', 'review_remarks']

        report.status = next_status
        if remarks:
            report.review_remarks = remarks

        if next_status == 'under_review':
            report.staff_reviewed_by = user
            report.staff_reviewed_on = timezone.now()
            update_fields.extend(['staff_reviewed_by', 'staff_reviewed_on'])
        elif next_status in ['needs_revision', 'approved', 'rejected']:
            report.staff_reviewed_by = user
            report.staff_reviewed_on = timezone.now()
            report.is_complete = next_status == 'approved'
            update_fields.extend(['staff_reviewed_by', 'staff_reviewed_on'])

        report.save(update_fields=update_fields)
        self._log_report_activity(f'report_{next_status}', report)
        self._notify_cdw_decision(report)
        return Response(self.get_serializer(report).data)

    @action(detail=False, methods=['get'], url_path='center-summary-preview')
    def center_summary_preview(self, request):
        self._ensure_role_allowed(['cdw'], 'Only assigned CDWs can prepare Center Reports.')
        try:
            cdc = CDC.objects.select_related('barangay', 'assigned_cdw').get(pk=int(request.query_params.get('cdc', 0)))
        except (ValueError, TypeError, CDC.DoesNotExist):
            raise ValidationError({'error': 'Select a valid assigned CDC.'})
        if cdc.assigned_cdw_id != request.user.id:
            raise PermissionDenied('You can only prepare reports for your assigned CDC.')
        if not GrantToOperateService.has_valid_grant(cdc):
            raise PermissionDenied(GrantToOperateService.cdw_operating_error(cdc))
        params = request.query_params
        payload = CenterSummaryService.build(cdc, params.get('period_type'), params.get('year'),
            params.get('month', 0), params.get('quarter', 0))
        return Response(payload)

    def _center_report_values(self, data, instance=None):
        report_type = data.get('report_type', getattr(instance, 'report_type', None))
        if report_type not in self.CDC_REPORT_TYPES:
            return {}
        mode = {'cdc_monthly_report': 'monthly', 'cdc_quarterly_report': 'quarterly', 'cdc_annual_report': 'annual'}[report_type]
        def value(key, default=None):
            return data.get(key, getattr(instance, key, default))
        cdc = value('cdc')
        if self.request.user.role == 'cdw':
            if cdc.assigned_cdw_id != self.request.user.id:
                raise PermissionDenied('You can only prepare reports for your assigned CDC.')
            if not GrantToOperateService.has_valid_grant(cdc):
                raise PermissionDenied(GrantToOperateService.cdw_operating_error(cdc))
        previous = getattr(instance, 'payload', {}) or {}
        incoming = value('payload', {}) or {}
        supplied = {**previous, **incoming}
        for key in ['narratives', 'evidence']:
            supplied[key] = {**previous.get(key, {}), **incoming.get(key, {})}
        payload = CenterSummaryService.build(cdc, mode, value('year'), value('month', 0), value('quarter', 0),
            academic_year=value('academic_year'), supplied=supplied)
        return {'payload': payload, 'summary': payload['summary'], 'period_type': mode,
                'month': payload['period']['month'], 'quarter': payload['period']['quarter']}

    def perform_create(self, serializer):
        user = self.request.user
        self._ensure_role_allowed(
            ['cdw', 'admin'],
            'Only assigned CDWs or administrators can submit reports.',
        )
        cdc = serializer.validated_data['cdc']
        academic_year = serializer.validated_data.get('academic_year') or working_year(cdc)

        if user.role == 'cdw' and cdc.assigned_cdw_id != user.id:
            raise PermissionDenied('You can only submit reports for your assigned CDC.')
        if user.role == 'cdw' and not GrantToOperateService.has_valid_grant(cdc):
            raise PermissionDenied(GrantToOperateService.cdw_operating_error(cdc))

        report_type = serializer.validated_data.get('report_type', 'form6')
        if report_type in self.CDC_REPORT_TYPES and user.role != 'cdw':
            raise PermissionDenied('Only the assigned CDW can generate and submit CDC Reports.')

        title = serializer.validated_data.get('title')
        summary = serializer.validated_data.get('summary')

        if not title:
            quarterly_definition = get_quarterly_report_definition(report_type)
            if report_type == 'form6':
                title = 'CDW Profile Report'
            elif report_type == 'form7':
                title = 'CDC Profile Form'
            elif quarterly_definition:
                title = quarterly_definition['label']
            else:
                title = 'Submitted Report'

        period_type = serializer.validated_data.get('period_type', 'quarterly')
        month = serializer.validated_data.get('month', 0)
        quarter = serializer.validated_data.get('quarter')
        year = serializer.validated_data.get('year')
        if not summary:
            if get_quarterly_report_definition(report_type):
                summary = f'{title} was submitted to CSWDO for Q{quarter} {year}.'
            elif report_type in ['cdc_monthly_report', 'cdc_quarterly_report', 'cdc_annual_report']:
                if period_type == 'monthly' and month:
                    period_label = f'M{month} {year}'
                elif period_type == 'annual':
                    period_label = f'Annual {year}'
                else:
                    period_label = f'Q{quarter} {year}'
                summary = f'{title} was submitted to CSWDO for {period_label}.'

        values = {'summary': summary or '', **self._center_report_values(serializer.validated_data)}
        if report_type in self.CDC_REPORT_TYPES and not serializer.validated_data.get('title'):
            title = f"{values['period_type'].title()} Center Report - {cdc.name} - {values['payload']['period']['label']}"
        report = serializer.save(submitted_by=user, academic_year=academic_year, title=title, status='under_review', **values)

        if get_quarterly_report_definition(report.report_type) or get_cdc_periodic_report_definition(report.report_type):
            ReportFileService.attach_generated_report_file(report)
            report.save(update_fields=['attachment', 'pdf_attachment'])
        self._log_report_activity('report_submitted', report)

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        if user.role == 'cdw':
            if instance.cdc.assigned_cdw_id != user.id or instance.status != 'needs_revision':
                raise PermissionDenied('Only the currently assigned CDW can edit reports returned for revision.')
            report = serializer.save(status='under_review', review_remarks='', **self._center_report_values(serializer.validated_data, instance))
            report.staff_reviewed_by = None
            report.staff_reviewed_on = None
            report.is_complete = False
            report.save(update_fields=['status', 'review_remarks', 'staff_reviewed_by', 'staff_reviewed_on', 'is_complete'])
        else:
            self._ensure_role_allowed(
                ['admin', 'staff'],
                'Only CSWDO staff or administrators can edit submitted reports.',
            )
            report = serializer.save(**self._center_report_values(serializer.validated_data, instance))
        if get_quarterly_report_definition(report.report_type) or get_cdc_periodic_report_definition(report.report_type):
            ReportFileService.attach_generated_report_file(report)
            report.save(update_fields=['attachment', 'pdf_attachment'])
        self._log_report_activity('report_updated', report)

    @action(detail=False, methods=['post'], url_path='generate-cdc-annual')
    def generate_cdc_annual(self, request):
        self._ensure_role_allowed(
            ['cdw'],
            'Only the assigned CDW can generate and submit CDC Reports.',
        )

        cdc_id = request.data.get('cdc')
        if not cdc_id:
            return Response({'error': 'CDC is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cdc = CDC.objects.select_related('barangay', 'assigned_cdw').get(pk=cdc_id)
        except CDC.DoesNotExist:
            return Response({'error': 'CDC was not found.'}, status=status.HTTP_404_NOT_FOUND)

        if cdc.assigned_cdw_id != request.user.id:
            return Response({'error': 'You can only generate CDC Reports for your assigned CDC.'}, status=status.HTTP_403_FORBIDDEN)
        if not GrantToOperateService.has_valid_grant(cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(cdc)}, status=status.HTTP_403_FORBIDDEN)

        academic_year = None
        academic_year_id = request.data.get('academic_year')
        if academic_year_id:
            try:
                academic_year = AcademicYear.objects.get(pk=academic_year_id)
            except AcademicYear.DoesNotExist:
                return Response({'error': 'Academic year was not found.'}, status=status.HTTP_404_NOT_FOUND)
        academic_year = academic_year or working_year(cdc)

        try:
            year = int(request.data.get('year') or timezone.localdate().year)
        except (TypeError, ValueError):
            return Response({'error': 'Year must be a valid number.'}, status=status.HTTP_400_BAD_REQUEST)

        payload = CenterSummaryService.build(cdc, 'annual', year, academic_year=academic_year)
        period_label = payload['period']['label']
        title = f'CDC Annual Report - {cdc.name} - {period_label}'
        summary = payload['summary']

        report = Report.objects.create(
            cdc=cdc, academic_year=academic_year, report_type='cdc_annual_report',
            period_type='annual', month=0, quarter=4, year=year,
            submitted_by=request.user, title=title, summary=summary, payload=payload,
            status='under_review', is_complete=True, is_on_time=True, review_remarks='',
        )
        created = True
        ReportFileService.attach_generated_report_file(report)
        report.save(update_fields=['attachment', 'pdf_attachment'])
        self._log_report_activity('report_generated_summary', report)
        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def perform_destroy(self, instance):
        self._ensure_role_allowed(
            ['admin'],
            'Only administrators can delete submitted reports.',
        )
        self._log_report_activity('report_deleted', instance)
        instance.delete()

    @action(detail=True, methods=['post'], url_path='start-review')
    def start_review(self, request, pk=None):
        self._ensure_role_allowed(
            ['staff'],
            'Only CSWDO Staff can place reports under review.',
        )
        return self._update_report_status(self.get_object(), 'under_review', request.data.get('remarks', '').strip())

    @action(detail=True, methods=['post'], url_path='needs-revision')
    def needs_revision(self, request, pk=None):
        self._ensure_role_allowed(
            ['staff'],
            'Only CSWDO Staff can return reports for revision.',
        )
        remarks = request.data.get('remarks', '').strip()
        if not remarks:
            return Response({'error': 'Remarks are required when returning a report for revision.'}, status=status.HTTP_400_BAD_REQUEST)
        return self._update_report_status(self.get_object(), 'needs_revision', remarks)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        self._ensure_role_allowed(
            ['staff'],
            'Only CSWDO Staff can approve reports.',
        )
        return self._update_report_status(self.get_object(), 'approved', request.data.get('remarks', '').strip())

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        self._ensure_role_allowed(
            ['staff'],
            'Only CSWDO Staff can approve monitoring reports.',
        )
        return self._update_report_status(self.get_object(), 'approved', request.data.get('remarks', '').strip())

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        self._ensure_role_allowed(
            ['staff'],
            'Only CSWDO Staff can reject monitoring reports.',
        )
        remarks = request.data.get('remarks', '').strip()
        if not remarks:
            return Response({'error': 'Remarks are required when rejecting a report.'}, status=status.HTTP_400_BAD_REQUEST)
        return self._update_report_status(self.get_object(), 'rejected', remarks)
