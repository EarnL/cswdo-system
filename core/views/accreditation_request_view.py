from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.accreditation_checklist import get_accreditation_checklist, PASSING_PERCENTAGE
from core.models import AccreditationRequest, AuthorityDocument, CDC, PermitRecord
from core.serializers.accreditation_serializer import AccreditationRequestSerializer, compute_checklist_scores
from core.services.activity_log_service import ActivityLogService
from core.services.notification_service import NotificationService
from core.services.report_file_service import ReportFileService


User = get_user_model()


def build_grant_to_operate_number(cdc, issued_on):
    return f'GTO-LCN-{issued_on:%Y}-{cdc.id:04d}'


def add_years(value, years):
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        return value.replace(month=2, day=28, year=value.year + years)


def build_grant_to_operate_pdf(request_obj, certificate_number, issued_on):
    cdc = request_obj.cdc
    mayor_name = 'MARK DON VICTOR B. ALCALA'
    address = cdc.address or f'{cdc.barangay.name}, Lucena City, Quezon'
    lines = [
        'Republic of the Philippines',
        'CITY GOVERNMENT OF LUCENA',
        "Office of the City Mayor",
        'Lucena City, Quezon, Philippines',
        '',
        f'Certificate No. {certificate_number}',
        '',
        'GRANT TO OPERATE',
        '',
        'is hereby issued to',
        '',
        cdc.name.upper(),
        address,
        '',
        'for compliance to requirements set by the ECCD Council for Center-Based Programs',
        'for 0 to 4 Years Old Children.',
        '',
        f'Given this {issued_on.day} day of {issued_on.month}, {issued_on.year}',
        'in Lucena City, Quezon, Philippines.',
        '',
        '',
        mayor_name,
        'City/Municipal Mayor',
    ]
    return ReportFileService._build_pdf_from_pages([lines])


def checklist_is_complete(answers, checklist):
    items = [
        checklist_item
        for section in (checklist or {}).get('sections', [])
        for checklist_item in section.get('items', [])
    ]
    if not items:
        return False, 0, 0

    answered = sum(1 for checklist_item in items if (answers or {}).get(checklist_item.get('id'), {}).get('compliance'))
    return answered == len(items), answered, len(items)


class AccreditationRequestViewSet(viewsets.ModelViewSet):
    serializer_class = AccreditationRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AccreditationRequest.objects.select_related(
            'cdc',
            'cdc__barangay',
            'requested_by',
            'staff_evaluator',
            'admin_approver',
        )
        user = self.request.user
        if user.role == 'cdw':
            return queryset.filter(cdc__assigned_cdw=user)
        if user.role in ['staff', 'admin']:
            return queryset
        return queryset.none()

    def create(self, request, *args, **kwargs):
        if request.user.role != 'cdw':
            return Response({'error': 'Only CDWs can submit accreditation requests.'}, status=status.HTTP_403_FORBIDDEN)

        cdc_id = request.data.get('cdc')
        cdc = CDC.objects.filter(id=cdc_id, assigned_cdw=request.user).select_related('barangay').first()
        if not cdc:
            return Response({'error': 'You can only request accreditation for your assigned CDC.'}, status=status.HTTP_403_FORBIDDEN)

        existing = AccreditationRequest.objects.filter(
            cdc=cdc,
            status__in=['pending_review', 'under_evaluation', 'evaluated_by_staff', 'forwarded_to_admin'],
        ).first()
        if existing:
            return Response({'error': 'This CDC already has an active accreditation request.'}, status=status.HTTP_400_BAD_REQUEST)

        request_obj = AccreditationRequest.objects.create(
            cdc=cdc,
            requested_by=request.user,
            remarks=request.data.get('remarks', ''),
            status='pending_review',
            checklist_snapshot=get_accreditation_checklist(),
            passing_percentage=PASSING_PERCENTAGE,
        )
        cdc.accreditation_status = 'under_review'
        cdc.save(update_fields=['accreditation_status', 'updated_at'])
        ActivityLogService.log(
            request.user,
            'accreditation_request_submitted',
            f'Accreditation request submitted for {cdc.name}',
            target_type='accreditation_request',
            target_id=request_obj.id,
        )
        NotificationService.notify_accreditation_request_submitted(request_obj)
        return Response(self.get_serializer(request_obj).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        return Response({'error': 'Use workflow actions to update accreditation requests.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return Response({'error': 'Use workflow actions to update accreditation requests.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=False, methods=['get'], url_path='checklist-template')
    def checklist_template(self, request):
        return Response(get_accreditation_checklist())

    @action(detail=True, methods=['post'], url_path='start-evaluation')
    def start_evaluation(self, request, pk=None):
        item = self.get_object()
        if request.user.role != 'staff':
            return Response({'error': 'Only CSWDO Staff can start the evaluation.'}, status=status.HTTP_403_FORBIDDEN)
        item.status = 'under_evaluation'
        item.staff_evaluator = request.user
        item.save(update_fields=['status', 'staff_evaluator', 'updated_at'])
        ActivityLogService.log(request.user, 'accreditation_evaluation_started', f'Evaluation started for {item.cdc.name}', 'accreditation_request', item.id)
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=['post'], url_path='save-checklist')
    def save_checklist(self, request, pk=None):
        item = self.get_object()
        if request.user.role != 'staff':
            return Response({'error': 'Only CSWDO Staff can save checklist evaluations.'}, status=status.HTTP_403_FORBIDDEN)
        scores = compute_checklist_scores(
            request.data.get('checklist_answers', item.checklist_answers),
            item.checklist_snapshot or get_accreditation_checklist(),
            item.passing_percentage,
        )
        item.checklist_answers = request.data.get('checklist_answers', item.checklist_answers)
        item.header_answers = request.data.get('header_answers', item.header_answers)
        item.closing_answers = request.data.get('closing_answers', item.closing_answers)
        item.staff_remarks = request.data.get('staff_remarks', item.staff_remarks)
        item.status = request.data.get('status', 'under_evaluation')
        item.staff_evaluator = request.user
        item.total_score = scores['total_score']
        item.max_score = scores['max_score']
        item.percentage = scores['percentage']
        item.eligibility_result = scores['eligibility_result']
        item.sections_needing_improvement = scores['sections_needing_improvement']
        item.staff_evaluated_at = timezone.now()
        item.save()
        ActivityLogService.log(request.user, 'accreditation_checklist_saved', f'Checklist saved for {item.cdc.name}', 'accreditation_request', item.id, {'percentage': item.percentage})
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=['post'], url_path='forward-to-admin')
    def forward_to_admin(self, request, pk=None):
        item = self.get_object()
        if request.user.role != 'staff':
            return Response({'error': 'Only CSWDO Staff can forward evaluations.'}, status=status.HTTP_403_FORBIDDEN)
        if not item.checklist_answers:
            return Response({'error': 'Complete the accreditation checklist before forwarding to admin.'}, status=status.HTTP_400_BAD_REQUEST)
        complete, answered, total = checklist_is_complete(
            item.checklist_answers,
            item.checklist_snapshot or get_accreditation_checklist(),
        )
        if not complete:
            return Response(
                {'error': f'Complete all compliance fields before forwarding to admin. {answered}/{total} items completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item.status = 'forwarded_to_admin'
        item.staff_evaluator = request.user
        item.staff_remarks = request.data.get('staff_remarks', item.staff_remarks)
        item.staff_evaluated_at = timezone.now()
        item.save(update_fields=['status', 'staff_evaluator', 'staff_remarks', 'staff_evaluated_at', 'updated_at'])
        ActivityLogService.log(request.user, 'accreditation_forwarded_to_admin', f'Evaluation forwarded for {item.cdc.name}', 'accreditation_request', item.id, {'status': item.status})
        NotificationService.notify_accreditation_forwarded_to_admin(item)
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=['post'], url_path='needs-revision')
    def needs_revision(self, request, pk=None):
        item = self.get_object()
        if request.user.role not in ['staff', 'admin']:
            return Response({'error': 'Only CSWDO users can request revisions.'}, status=status.HTTP_403_FORBIDDEN)
        item.status = 'needs_revision'
        item.staff_remarks = request.data.get('remarks', item.staff_remarks)
        item.save(update_fields=['status', 'staff_remarks', 'updated_at'])
        ActivityLogService.log(request.user, 'accreditation_needs_revision', f'Revision requested for {item.cdc.name}', 'accreditation_request', item.id)
        NotificationService.notify_accreditation_returned_to_cdw(item)
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=['post'], url_path='admin-decision')
    def admin_decision(self, request, pk=None):
        item = self.get_object()
        if request.user.role != 'admin':
            return Response({'error': 'Only CSWDO Admin can issue the final decision.'}, status=status.HTTP_403_FORBIDDEN)
        decision = request.data.get('decision')
        remarks = request.data.get('remarks', '')
        if decision not in ['approved', 'rejected']:
            return Response({'error': 'Decision must be approved or rejected.'}, status=status.HTTP_400_BAD_REQUEST)

        item.status = decision
        item.admin_approver = request.user
        item.admin_remarks = remarks
        item.final_decision_at = timezone.now()
        item.save(update_fields=['status', 'admin_approver', 'admin_remarks', 'final_decision_at', 'updated_at'])

        cdc = item.cdc
        if decision == 'approved':
            issued_on = timezone.localdate()
            certificate_number = build_grant_to_operate_number(cdc, issued_on)
            expiry_date = add_years(issued_on, 3)
            cdc.accreditation_status = 'accredited'
            cdc.is_accredited = True
            cdc.accreditation_date = issued_on
            cdc.accredited_by = request.user
            cdc.accreditation_notes = remarks or item.staff_remarks
            cdc.license_number = certificate_number
            cdc.license_expiry_date = expiry_date
            cdc.save(update_fields=[
                'accreditation_status',
                'is_accredited',
                'accreditation_date',
                'accredited_by',
                'accreditation_notes',
                'license_number',
                'license_expiry_date',
                'updated_at',
            ])
            permit_type = 'renewal' if cdc.permit_records.exists() else 'initial'
            PermitRecord.objects.create(
                cdc=cdc,
                application_date=issued_on,
                permit_type=permit_type,
                status='issued',
                issued_on=issued_on,
                expires_on=expiry_date,
                is_temporary=False,
                notes=f'Grant to Operate issued through accreditation request REQ-{item.id:04d}. {remarks or item.staff_remarks}',
                issued_by=request.user,
            )
            authority_document = AuthorityDocument.objects.create(
                cdc=cdc,
                document_type='authority_to_operate',
                title='Grant to Operate',
                document_number=certificate_number,
                issued_on=issued_on,
                expires_on=expiry_date,
                notes='Automatically generated after CSWDO Admin approval of accreditation result.',
                verified_by=request.user,
            )
            authority_document.file.save(
                f'grant_to_operate_{certificate_number}.pdf',
                ContentFile(build_grant_to_operate_pdf(item, certificate_number, issued_on)),
                save=True,
            )
        else:
            cdc.accreditation_status = 'rejected'
            cdc.is_accredited = False
            cdc.accreditation_notes = remarks
            cdc.save(update_fields=['accreditation_status', 'is_accredited', 'accreditation_notes', 'updated_at'])

        ActivityLogService.log(request.user, f'accreditation_{decision}', f'Accreditation {decision} for {cdc.name}', 'accreditation_request', item.id)
        NotificationService.notify_accreditation_decided(item)
        return Response(self.get_serializer(item).data)
