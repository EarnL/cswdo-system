from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied
from core.services.special_needs_summary import build_summary, completion
from html import escape

from django.core.files.base import ContentFile
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import CDC, Report, SpecialNeedsAssessment
from core.serializers import SpecialNeedsAssessmentSerializer
from core.services.activity_log_service import ActivityLogService
from core.services.grant_to_operate_service import GrantToOperateService


class SpecialNeedsAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = SpecialNeedsAssessmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = SpecialNeedsAssessment.objects.select_related(
            'cdc',
            'cdc__barangay',
            'child',
            'assessed_by',
        )
        user = self.request.user
        if user.role == 'cdw':
            queryset = queryset.filter(
                cdc__assigned_cdw=user,
                cdc__is_accredited=True,
                cdc__accreditation_status='accredited',
                cdc__license_expiry_date__gte=timezone.localdate(),
            )
        elif user.role not in ['admin', 'staff']:
            queryset = queryset.none()

        cdc_id = self.request.query_params.get('cdc')
        child_id = self.request.query_params.get('child')
        status_filter = self.request.query_params.get('status')
        if cdc_id:
            queryset = queryset.filter(cdc_id=cdc_id)
        if child_id:
            queryset = queryset.filter(child_id=child_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def _ensure_cdw_can_encode(self, cdc):
        user = self.request.user
        if user.role != 'cdw':
            return Response({'error': 'Only CDW users can encode Special Needs Assessments.'}, status=status.HTTP_403_FORBIDDEN)
        if cdc.assigned_cdw_id != user.id:
            return Response({'error': 'You can only assess children from your assigned CDC.'}, status=status.HTTP_403_FORBIDDEN)
        if not GrantToOperateService.has_valid_grant(cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(cdc)}, status=status.HTTP_403_FORBIDDEN)
        return None

    def perform_create(self, serializer):
        serializer.save(assessed_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        permission_error = self._ensure_cdw_can_encode(serializer.validated_data['cdc'])
        if permission_error:
            return permission_error
        self.perform_create(serializer)
        ActivityLogService.log(request.user, 'special_needs_saved', f'Special needs assessment saved for {serializer.instance.child.name}.', 'special_needs_assessment', serializer.instance.id)
        return Response(self.get_serializer(serializer.instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        permission_error = self._ensure_cdw_can_encode(instance.cdc)
        if permission_error:
            return permission_error
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        permission_error = self._ensure_cdw_can_encode(instance.cdc)
        if permission_error:
            return permission_error
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        assessment = self.get_object()
        permission_error = self._ensure_cdw_can_encode(assessment.cdc)
        if permission_error:
            return permission_error
        duplicate = SpecialNeedsAssessment.objects.filter(
            child=assessment.child,
            assessment_type=assessment.assessment_type,
            status='submitted',
        ).exclude(pk=assessment.pk).exists()
        if duplicate:
            return Response(
                {'error': 'This child already has a submitted record for the selected assessment.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not completion(assessment.checklist)['complete']:
            return Response({'error': 'Answer every checklist item before submitting. You can save an unfinished assessment as a draft.'}, status=400)
        assessment.status = 'submitted'
        assessment.submitted_on = timezone.now()
        assessment.save(update_fields=['status', 'submitted_on', 'updated_at'])
        ActivityLogService.log(request.user, 'special_needs_submitted', f'Special needs assessment submitted for {assessment.child.name}.', 'special_needs_assessment', assessment.id)
        return Response(self.get_serializer(assessment).data)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        assessment = self.get_object()
        html = self._render_assessment_html(assessment)
        filename = f'special-needs-assessment-{assessment.id}.html'
        response = HttpResponse(html, content_type='text/html; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def _summary_context(self, params):
        if self.request.user.role != 'cdw':
            raise PermissionDenied('Only CDW users can prepare assessment summaries.')
        cdcs = CDC.objects.filter(assigned_cdw=self.request.user)
        cdc_id = params.get('cdc')
        if cdc_id:
            try:
                cdc = cdcs.filter(pk=int(cdc_id)).first()
            except (ValueError, TypeError):
                raise ValidationError({'error': 'Select a valid assigned CDC.'})
        else:
            cdc = cdcs.first() if cdcs.count() == 1 else None
        if not cdc:
            raise ValidationError({'error': 'Select an assigned CDC.'})
        permission_error = self._ensure_cdw_can_encode(cdc)
        if permission_error is not None:
            raise PermissionDenied(permission_error.data['error'])
        try:
            quarter, year = int(params.get('quarter', 0)), int(params.get('year', 0))
        except (TypeError, ValueError):
            raise ValidationError({'error': 'Enter a valid quarter and year.'})
        if quarter not in range(1, 5) or not 1900 <= year <= 9999:
            raise ValidationError({'error': 'Enter a quarter from 1 to 4 and a valid year.'})
        return cdc, quarter, year

    @action(detail=False, methods=['get'], url_path='summary-preview')
    def summary_preview(self, request):
        cdc, quarter, year = self._summary_context(request.query_params)
        payload, _ = build_summary(cdc, quarter, year)
        revision = Report.objects.filter(cdc=cdc, submitted_by=request.user, report_type='special_needs',
                                         quarter=quarter, year=year, status='needs_revision').order_by('-pk').first()
        if revision:
            payload['revision_report'] = revision.pk
            payload['review_remarks'] = revision.review_remarks
        return Response(payload)

    @action(detail=False, methods=['post'], url_path='submit-summary')
    @transaction.atomic
    def submit_summary(self, request):
        user = request.user
        assigned_cdc, quarter, year = self._summary_context(request.data)
        # Serialize simultaneous submissions for the same CDC.
        CDC.objects.select_for_update().get(pk=assigned_cdc.pk)
        payload, assessments = build_summary(assigned_cdc, quarter, year)
        if request.data.get('fingerprint') != payload['fingerprint']:
            return Response({'error': 'Assessment records changed or have not been reviewed. Refresh the preview before submitting.'}, status=409)
        if not assessments:
            return Response({'error': 'No complete, submitted assessments were found for this period.'}, status=400)
        if Report.objects.filter(cdc=assigned_cdc, report_type='special_needs', quarter=quarter,
                                 year=year, payload__fingerprint=payload['fingerprint']).exclude(status__in=['rejected', 'needs_revision']).exists():
            return Response({'error': 'This assessment summary has already been submitted.'}, status=409)
        counts = payload['counts']
        remarks = str(request.data.get('remarks') or '').strip()
        payload['remarks'] = remarks
        summary = (
            f'{len(assessments)} child assessment(s) submitted. '
            f'{counts["no_concern"]} average development, {counts["needs_monitoring"]} for re-test after 3 to 6 months, '
            f'{counts["for_referral"]} suggests advanced development. '
            f'{remarks}'
        ).strip()
        report_values = dict(
            cdc=assigned_cdc,
            submitted_by=user,
            report_type='special_needs',
            title=f'Special Needs Assessment Summary - Q{quarter} {year}',
            summary=summary,
            payload=payload,
            quarter=quarter,
            year=year,
            status='under_review',
            is_complete=False,
        )
        revision_id = request.data.get('revision_report')
        if revision_id:
            report = Report.objects.filter(pk=revision_id, cdc=assigned_cdc, submitted_by=user,
                report_type='special_needs', quarter=quarter, year=year, status='needs_revision').first()
            if not report:
                return Response({'error': 'This report is no longer awaiting revision. Refresh the preview.'}, status=409)
            for key, value in report_values.items():
                setattr(report, key, value)
            report.review_remarks = ''
            report.staff_reviewed_by = None
            report.staff_reviewed_on = None
            report.save()
        else:
            report = Report.objects.create(**report_values)
        html = self._render_summary_html(report, assigned_cdc, assessments, counts, remarks)
        report.attachment.save(f'special_needs_summary_q{quarter}_{year}_{assigned_cdc.id}_{report.id}.html', ContentFile(html.encode('utf-8')), save=True)
        ActivityLogService.log(user, 'special_needs_summary_submitted', f'Special needs summary submitted for {assigned_cdc.name}.', 'report', report.id)
        return Response({'report': report.id, 'summary': payload}, status=status.HTTP_201_CREATED)

    def _render_assessment_html(self, assessment):
        serializer = self.get_serializer(assessment)
        data = serializer.data
        domain_scores = assessment.domain_scores or {}
        scaled_scores = domain_scores.get('scaled_scores') or {}
        rows = []
        for domain, items in (assessment.checklist or {}).items():
            rows.append(f'<h2>{escape(str(domain).replace("_", " ").title())}</h2>')
            rows.append('<table><tr><th>Item</th><th>Present</th><th>Comments</th></tr>')
            for item in items:
                rows.append(
                    '<tr>'
                    f'<td>{escape(item.get("label", ""))}</td>'
                    f'<td>{escape(item.get("present", ""))}</td>'
                    f'<td>{escape(item.get("comments", ""))}</td>'
                    '</tr>'
                )
            rows.append('</table>')
        score_rows = ''.join(
            f'<tr><td>{escape(str(domain).replace("_", " ").title())}</td><td>{values.get("raw_score", "")}</td><td>{escape(str(scaled_scores.get(domain, "")))}</td></tr>'
            for domain, values in domain_scores.items()
            if isinstance(values, dict) and domain != 'scaled_scores'
        )
        return f"""<!doctype html><html><head><meta charset="utf-8"><title>Special Needs Assessment</title>{self._print_styles()}</head>
<body><main><h1>Early Childhood Care and Development (ECCD) Checklist, Child's Record 2</h1>
<p><strong>Child:</strong> {escape(data['child_name'])} | <strong>CDC:</strong> {escape(data['cdc_name'])} | <strong>Result:</strong> {escape(data['result_label'])}</p>
<p><strong>Assessment Date:</strong> {escape(str(data['assessment_date']))} | <strong>Examiner:</strong> {escape(data.get('examiner_name') or data.get('assessed_by_name') or '')}</p>
{''.join(rows)}
<h2>Raw Scores, Scaled Scores, Standard Score, and Interpretation</h2>
<table><tr><th>Domain</th><th>Raw Score</th><th>Scaled Score</th></tr>{score_rows}<tr><th>Standard Score</th><td colspan="2">{escape(str(domain_scores.get('standard_score', '')))}</td></tr><tr><th>Interpretation</th><td colspan="2">{escape(data['result_label'])}</td></tr></table>
<h2>Examiner Notes</h2><p>{escape(assessment.remarks or '')}</p></main></body></html>"""

    def _render_summary_html(self, report, cdc, assessments, counts, remarks):
        rows = ''.join(
            f'<tr><td>{escape(item.child.name)}</td><td>{item.child.age}</td><td>{escape(item.assessment_date.isoformat())}</td><td>{escape(item.get_result_display())}</td><td>{escape(item.remarks or "")}</td></tr>'
            for item in assessments
        )
        excluded = ''.join(
            f'<tr><td>{escape(row["name"])}</td><td>#{row["assessment_id"]}</td>'
            f'<td>{escape(row["reason"])}</td><td>{row["answered"]}/{row["total"]}</td></tr>'
            for row in report.payload.get('excluded', [])
        )
        return f"""<!doctype html><html><head><meta charset="utf-8"><title>{escape(report.title)}</title>{self._print_styles()}</head>
<body><main><h1>{escape(report.title)}</h1><p><strong>CDC:</strong> {escape(cdc.name)} | <strong>Barangay:</strong> {escape(cdc.barangay.name)}</p>
<section><h2>Summary</h2><p>Total assessed: {len(assessments)}</p><p>Average development: {counts['no_concern']} | Re-test after 3 to 6 months: {counts['needs_monitoring']} | Suggests advanced development: {counts['for_referral']}</p><p>{escape(remarks)}</p></section>
<p>{escape(report.payload.get('selection_rule', ''))}</p>
<table><tr><th>Child</th><th>Age</th><th>Date</th><th>Result</th><th>Remarks</th></tr>{rows}</table>
<h2>Excluded assessments</h2><table><tr><th>Child</th><th>Assessment</th><th>Reason</th><th>Answered</th></tr>{excluded}</table></main></body></html>"""

    def _print_styles(self):
        return """<style>body{font-family:Segoe UI,Arial,sans-serif;background:#f1f5f9;margin:0;padding:28px;color:#0f172a}main{max-width:980px;margin:auto;background:white;border-radius:20px;padding:28px;box-shadow:0 18px 45px #0001}h1{color:#0f4b94}h2{margin-top:28px;color:#0f4b94}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #dbe4f0;padding:10px;text-align:left;vertical-align:top}th{background:#f8fafc}@media print{body{background:white;padding:0}main{box-shadow:none}}</style>"""
