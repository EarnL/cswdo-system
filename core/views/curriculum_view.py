from django.utils import timezone
from django.http import HttpResponse
from html import escape
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import CDC, ChildAssessmentRecord, CurriculumDistribution, CurriculumGuide, CurriculumPlan, StaffSchedule
from core.serializers import (
    ChildAssessmentRecordSerializer,
    CurriculumDistributionSerializer,
    CurriculumGuideSerializer,
    CurriculumPlanSerializer,
    StaffScheduleSerializer,
)
from core.services.activity_log_service import ActivityLogService
from core.services.grant_to_operate_service import GrantToOperateService
from core.services.notification_service import NotificationService


class CurriculumGuideViewSet(viewsets.ModelViewSet):
    queryset = CurriculumGuide.objects.select_related('created_by').all()
    serializer_class = CurriculumGuideSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.role == 'cdw':
            return queryset.filter(status='active')
        if self.request.user.role in ['staff', 'admin']:
            return queryset
        return queryset.none()

    def _staff_only(self, request):
        if request.user.role != 'staff':
            return Response({'error': 'Only CSWDO Staff can define or update curriculum guides.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def create(self, request, *args, **kwargs):
        error = self._staff_only(request)
        if error:
            return error
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        error = self._staff_only(request)
        if error:
            return error
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        error = self._staff_only(request)
        if error:
            return error
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        error = self._staff_only(request)
        if error:
            return error
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CurriculumDistributionViewSet(viewsets.ModelViewSet):
    queryset = CurriculumDistribution.objects.select_related('cdc', 'cdc__barangay', 'cdc__assigned_cdw', 'sent_by').all()
    serializer_class = CurriculumDistributionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        cdc_id = self.request.query_params.get('cdc')
        if user.role == 'cdw':
            queryset = queryset.filter(cdc__assigned_cdw=user)
        elif user.role not in ['staff', 'admin']:
            queryset = queryset.none()
        if cdc_id:
            queryset = queryset.filter(cdc_id=cdc_id)
        return queryset

    def create(self, request, *args, **kwargs):
        if request.user.role != 'staff':
            return Response({'error': 'Only CSWDO Staff can send Curriculum Guides / LRPs to CDCs.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cdc = serializer.validated_data['cdc']
        if not GrantToOperateService.has_valid_grant(cdc):
            return Response({'error': 'Curriculum Guides / LRPs can only be sent after the CDC has an active Grant to Operate.'}, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(serializer.instance).data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        return Response({'error': 'Curriculum Guide / LRP distribution records cannot be edited.'}, status=status.HTTP_403_FORBIDDEN)

    def partial_update(self, request, *args, **kwargs):
        return Response({'error': 'Curriculum Guide / LRP distribution records cannot be edited.'}, status=status.HTTP_403_FORBIDDEN)

    def destroy(self, request, *args, **kwargs):
        return Response({'error': 'Curriculum Guide / LRP distribution records cannot be deleted.'}, status=status.HTTP_403_FORBIDDEN)

    def perform_create(self, serializer):
        serializer.save(sent_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='bulk-send')
    def bulk_send(self, request):
        if request.user.role != 'staff':
            return Response({'error': 'Only CSWDO Staff can send Curriculum Guides / LRPs to CDCs.'}, status=status.HTTP_403_FORBIDDEN)

        cdc_ids = request.data.get('cdc_ids') or []
        if not isinstance(cdc_ids, list) or not cdc_ids:
            return Response({'error': 'Select at least one accredited CDC.'}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        skipped = []
        for cdc_id in cdc_ids:
            try:
                cdc = CDC.objects.get(pk=cdc_id)
            except CDC.DoesNotExist:
                skipped.append({'cdc_id': cdc_id, 'reason': 'CDC not found.'})
                continue

            if not GrantToOperateService.has_valid_grant(cdc):
                skipped.append({'cdc_id': cdc_id, 'cdc_name': cdc.name, 'reason': 'No active Grant to Operate.'})
                continue

            distribution, was_created = CurriculumDistribution.objects.get_or_create(
                cdc=cdc,
                defaults={'sent_by': request.user, 'notes': request.data.get('notes', '')},
            )
            if not was_created:
                skipped.append({'cdc_id': cdc.id, 'cdc_name': cdc.name, 'reason': 'LRPs already sent.'})
                continue

            created.append(distribution)
            ActivityLogService.log(request.user, 'curriculum_sent', f'Official LRPs sent to {cdc.name}.', 'curriculum_distribution', distribution.id)
            if cdc.assigned_cdw:
                NotificationService.upsert_notification(
                    cdc.assigned_cdw,
                    f'curriculum_distribution_{distribution.id}_available',
                    'Curriculum Guides Available',
                    f'Official Learning Resource Packages were provided to {cdc.name}.',
                    'medium',
                    'curriculum',
                    '/cdw/curriculum-assessment',
                )

        return Response({
            'created': self.get_serializer(created, many=True).data,
            'created_count': len(created),
            'skipped': skipped,
        })


class CurriculumBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def _can_access_cdc(self, user, cdc):
        if user.role in ['admin', 'staff']:
            return True
        if user.role == 'cdw' and cdc.assigned_cdw_id == user.id:
            return True
        return False

    def _can_manage(self, user):
        return user.role == 'cdw'

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        cdc_id = self.request.query_params.get('cdc')
        if user.role == 'cdw':
            queryset = queryset.filter(
                cdc__assigned_cdw=user,
                cdc__is_accredited=True,
                cdc__accreditation_status='accredited',
                cdc__license_expiry_date__gte=timezone.localdate(),
            )
        if cdc_id:
            queryset = queryset.filter(cdc_id=cdc_id)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cdc = serializer.validated_data['cdc']
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, cdc):
            return Response({'error': 'You are not allowed to create curriculum records for this CDC.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(cdc)}, status=status.HTTP_403_FORBIDDEN)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(serializer.instance).data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this curriculum record.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(instance.cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(instance.cdc)}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this curriculum record.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(instance.cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(instance.cdc)}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role != 'admin' or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'Only administrators can delete this curriculum record.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class CurriculumPlanViewSet(CurriculumBaseViewSet):
    queryset = CurriculumPlan.objects.select_related('cdc', 'cdc__barangay', 'guide', 'recorded_by', 'reviewed_by').all()
    serializer_class = CurriculumPlanSerializer

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    def create(self, request, *args, **kwargs):
        if request.user.role != 'cdw':
            return Response({'error': 'Only CDW users can encode curriculum implementation records.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role == 'staff':
            return Response({'error': 'Use review actions to update submitted implementation records.'}, status=status.HTTP_403_FORBIDDEN)
        if instance.status not in ['draft', 'returned']:
            return Response({'error': 'Only draft or returned records can be edited by CDW.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role == 'staff':
            return Response({'error': 'Use review actions to update submitted implementation records.'}, status=status.HTTP_403_FORBIDDEN)
        if instance.status not in ['draft', 'returned']:
            return Response({'error': 'Only draft or returned records can be edited by CDW.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        item = self.get_object()
        if request.user.role != 'cdw' or item.cdc.assigned_cdw_id != request.user.id:
            return Response({'error': 'Only the assigned CDW can submit this implementation record.'}, status=status.HTTP_403_FORBIDDEN)
        if not GrantToOperateService.has_valid_grant(item.cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(item.cdc)}, status=status.HTTP_403_FORBIDDEN)
        item.status = 'submitted'
        item.submitted_on = timezone.now()
        item.save(update_fields=['status', 'submitted_on', 'updated_at'])
        ActivityLogService.log(request.user, 'curriculum_submitted', f'Curriculum implementation submitted for {item.cdc.name}.', 'curriculum_plan', item.id)
        return Response(self.get_serializer(item).data)

    def _staff_review(self, request, next_status):
        return Response({
            'error': 'Curriculum implementation records are view-only for CSWDO review. Staff uploads the official guide; CDWs create the teaching curriculum.',
        }, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=['post'], url_path='start-review')
    def start_review(self, request, pk=None):
        return self._staff_review(request, 'under_review')

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        return self._staff_review(request, 'verified')

    @action(detail=True, methods=['post'])
    def return_for_correction(self, request, pk=None):
        return self._staff_review(request, 'returned')

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        item = self.get_object()
        domains = ', '.join(item.learning_domains or []) or 'Not specified'
        html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Curriculum Implementation Report</title>
  <style>
    body {{ font-family: Segoe UI, Arial, sans-serif; background:#f1f5f9; color:#0f172a; margin:0; padding:28px; }}
    main {{ max-width: 980px; margin:auto; background:white; border-radius:20px; padding:30px; box-shadow:0 18px 45px #0001; }}
    h1 {{ color:#0f4b94; margin:0; }}
    h2 {{ color:#0f4b94; margin-top:26px; border-bottom:1px solid #dbe4f0; padding-bottom:8px; }}
    .meta {{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-top:18px; }}
    .box {{ border:1px solid #dbe4f0; border-radius:14px; padding:12px; background:#f8fafc; }}
    .label {{ font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:.08em; }}
    .value {{ margin-top:6px; font-weight:700; white-space:pre-wrap; }}
    table {{ width:100%; border-collapse:collapse; margin-top:12px; }}
    th, td {{ border:1px solid #dbe4f0; padding:10px; text-align:left; vertical-align:top; }}
    th {{ background:#f8fafc; width:32%; }}
    @media print {{ body {{ background:white; padding:0; }} main {{ box-shadow:none; }} }}
  </style>
</head>
<body>
  <main>
    <h1>Curriculum Implementation Report</h1>
    <div class="meta">
      <div class="box"><div class="label">CDC</div><div class="value">{escape(item.cdc.name)}</div></div>
      <div class="box"><div class="label">Barangay</div><div class="value">{escape(item.cdc.barangay.name)}</div></div>
      <div class="box"><div class="label">Guide</div><div class="value">{escape(item.guide.title if item.guide else 'No guide selected')}</div></div>
      <div class="box"><div class="label">Period</div><div class="value">{escape(item.implementation_period or item.school_year)}</div></div>
      <div class="box"><div class="label">CDW</div><div class="value">{escape(item.recorded_by.username if item.recorded_by else '')}</div></div>
      <div class="box"><div class="label">Status</div><div class="value">{escape(item.get_status_display())}</div></div>
    </div>
    <h2>Implementation Details</h2>
    <table>
      <tr><th>Learning Domains Covered</th><td>{escape(domains)}</td></tr>
      <tr><th>Daily / Weekly Schedule</th><td>{escape(item.daily_schedule)}</td></tr>
      <tr><th>Activities Implemented</th><td>{escape(item.activity_areas_description)}</td></tr>
      <tr><th>Materials Used</th><td>{escape(item.materials_used)}</td></tr>
      <tr><th>Child Participation / Observations</th><td>{escape(item.child_participation)}</td></tr>
      <tr><th>Adaptations / Inclusive Support</th><td>{escape(item.special_needs_adaptations)}</td></tr>
      <tr><th>Evidence / Remarks</th><td>{escape(item.evidence_notes or item.notes)}</td></tr>
    </table>
    <h2>Review</h2>
    <table>
      <tr><th>Reviewed By</th><td>{escape(item.reviewed_by.username if item.reviewed_by else 'Pending')}</td></tr>
      <tr><th>Review Date</th><td>{escape(item.reviewed_on.strftime('%Y-%m-%d %H:%M') if item.reviewed_on else 'Pending')}</td></tr>
      <tr><th>Remarks</th><td>{escape(item.review_remarks)}</td></tr>
    </table>
  </main>
</body>
</html>"""
        response = HttpResponse(html, content_type='text/html; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="curriculum-implementation-{item.id}.html"'
        return response


class ChildAssessmentRecordViewSet(CurriculumBaseViewSet):
    queryset = ChildAssessmentRecord.objects.select_related('cdc', 'cdc__barangay', 'child', 'assessed_by').all()
    serializer_class = ChildAssessmentRecordSerializer

    def perform_create(self, serializer):
        serializer.save(assessed_by=self.request.user)


class StaffScheduleViewSet(CurriculumBaseViewSet):
    queryset = StaffSchedule.objects.select_related('cdc', 'cdc__barangay', 'recorded_by').all()
    serializer_class = StaffScheduleSerializer

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)
