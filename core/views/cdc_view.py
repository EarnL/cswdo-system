from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import date, datetime
from decimal import Decimal
from core.models import CDC, CDCAuditLog, AuthorityDocument, PermitRecord
from core.serializers import CDCSerializer, CDCDetailSerializer
from core.services.data_integration_service import DataIntegrationService
from core.permissions import PlanningReadOnlyAuthenticated

class CDCViewSet(viewsets.ModelViewSet):
    queryset = CDC.objects.select_related(
        'barangay',
        'accredited_by',
        'assigned_cdw',
    ).prefetch_related(
        'preopening_requirements',
        'authority_documents',
        'permit_records',
        'annual_evaluations',
        'supervisory_visits',
        'child_health_records',
        'emergency_readiness_records',
        'safety_incidents',
        'child_protection_records',
        'physical_environment_assessments',
        'staff_profiles',
        'staff_training_records',
        'interaction_observations',
        'curriculum_plans',
        'child_assessment_records',
        'staff_schedules',
        'child_set',
        'audit_logs',
    )
    serializer_class = CDCSerializer
    permission_classes = [PlanningReadOnlyAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.role == 'cdw':
            queryset = queryset.filter(assigned_cdw=self.request.user)
        return queryset

    @action(detail=True, methods=['get'], url_path='complete-record')
    def complete_record(self, request, pk=None):
        if request.user.role != 'admin':
            return Response({'detail': 'Only CSWDO Admin can download the complete official record.'}, status=status.HTTP_403_FORBIDDEN)
        from core.services.cdc_record_export import complete_cdc_record
        response = Response(complete_cdc_record(self.get_object(), self.get_serializer_context()))
        response['Cache-Control'] = 'no-store'
        return response

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CDCDetailSerializer
        return CDCSerializer

    def get_permissions(self):
        """Allow read access to authenticated users and restrict management actions."""
        if self.action in ['list', 'retrieve', 'pending_accreditation', 'expired_licenses']:
            return [PlanningReadOnlyAuthenticated()]
        return [PlanningReadOnlyAuthenticated()]

    def list(self, request, *args, **kwargs):
        assigned_to_me = request.query_params.get('assigned_to_me')
        queryset = self.get_queryset()

        if assigned_to_me in ['true', '1'] and request.user.is_authenticated:
            queryset = queryset.filter(assigned_cdw=request.user)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def _serialize_audit_value(self, value):
        if hasattr(value, 'pk') and hasattr(value, '_meta'):
            return {
                'id': value.pk,
                'label': str(value),
            }
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return float(value)
        return value

    def _capture_field_values(self, instance, fields):
        return {
            field: self._serialize_audit_value(getattr(instance, field))
            for field in fields
        }

    def _build_field_changes(self, before_values, instance, fields):
        changes = {}
        for field in fields:
            previous = before_values.get(field)
            current = self._serialize_audit_value(getattr(instance, field))
            if previous != current:
                changes[field] = {
                    'from': previous,
                    'to': current,
                }
        return changes

    def _log_cdc_activity(self, cdc, actor, action, summary, field_changes=None):
        CDCAuditLog.objects.create(
            cdc=cdc,
            actor=actor if actor and actor.is_authenticated else None,
            action=action,
            summary=summary,
            field_changes=field_changes or {},
        )

    def perform_create(self, serializer):
        cdc = serializer.save()
        field_changes = {}
        for field in serializer.validated_data.keys():
            current = self._serialize_audit_value(getattr(cdc, field))
            if current not in [None, '', [], {}]:
                field_changes[field] = {
                    'from': None,
                    'to': current,
                }
        self._log_cdc_activity(
            cdc=cdc,
            actor=self.request.user,
            action='created',
            summary='CDC record created.',
            field_changes=field_changes,
        )
        try:
            DataIntegrationService._calculate_gap_analysis(cdc.barangay)
            DataIntegrationService._generate_snp_recommendation(cdc.barangay)
        except Exception:
            pass

    def perform_update(self, serializer):
        tracked_fields = list(serializer.validated_data.keys())
        before_values = self._capture_field_values(serializer.instance, tracked_fields)
        cdc = serializer.save()
        field_changes = self._build_field_changes(before_values, cdc, tracked_fields)
        if field_changes:
            self._log_cdc_activity(
                cdc=cdc,
                actor=self.request.user,
                action='updated',
                summary='CDC record updated.',
                field_changes=field_changes,
            )
        try:
            DataIntegrationService._calculate_gap_analysis(cdc.barangay)
            DataIntegrationService._generate_snp_recommendation(cdc.barangay)
        except Exception:
            pass

    def create(self, request, *args, **kwargs):
        """CSWDO staff encode CDC records; admins retain final control."""
        if request.user.role not in ['admin', 'staff']:
            return Response(
                {'error': 'Only CSWDO staff or administrators can register new CDCs'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.role not in ['admin', 'staff']:
            return Response(
                {'error': 'Only CSWDO staff or administrators can update CDC records'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if request.user.role not in ['admin', 'staff']:
            return Response(
                {'error': 'Only CSWDO staff or administrators can update CDC records'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only administrators can delete CDC records'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[PlanningReadOnlyAuthenticated])
    def accredit(self, request, pk=None):
        """Accredit a CDC - only administrators can finalize accreditation"""
        cdc = self.get_object()
        user = request.user

        if user.role != 'admin':
            return Response(
                {'error': 'Only administrators can accredit CDCs'},
                status=status.HTTP_403_FORBIDDEN
            )

        accreditation_status = request.data.get('status')
        license_number = request.data.get('license_number')
        license_expiry_date = request.data.get('license_expiry_date')
        notes = request.data.get('notes', '')
        today = timezone.localdate()

        if accreditation_status not in ['accredited', 'rejected']:
            return Response(
                {'error': 'Invalid accreditation status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        parsed_expiry_date = None
        if license_expiry_date:
            try:
                parsed_expiry_date = date.fromisoformat(license_expiry_date)
            except ValueError:
                return Response(
                    {'error': 'license_expiry_date must be in YYYY-MM-DD format'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        tracked_fields = [
            'accreditation_status',
            'is_accredited',
            'accreditation_date',
            'accredited_by',
            'accreditation_notes',
            'license_number',
            'license_expiry_date',
        ]
        before_values = self._capture_field_values(cdc, tracked_fields)

        # Update CDC accreditation
        cdc.accreditation_status = accreditation_status
        cdc.is_accredited = (accreditation_status == 'accredited')
        cdc.accreditation_date = today
        cdc.accredited_by = user
        cdc.accreditation_notes = notes

        if accreditation_status == 'accredited':
            cdc.license_number = license_number
            cdc.license_expiry_date = parsed_expiry_date
        else:
            cdc.license_number = cdc.license_number or ''
        cdc.save()
        field_changes = self._build_field_changes(before_values, cdc, tracked_fields)

        permit_type = 'renewal' if cdc.permit_records.exists() else 'initial'
        if accreditation_status == 'accredited':
            PermitRecord.objects.create(
                cdc=cdc,
                application_date=today,
                permit_type=permit_type,
                status='issued',
                issued_on=today,
                expires_on=parsed_expiry_date,
                is_temporary=False,
                notes=notes,
                issued_by=user,
            )
            if license_number:
                AuthorityDocument.objects.create(
                    cdc=cdc,
                    document_type='authority_to_operate',
                    title='Authority to Operate',
                    document_number=license_number,
                    issued_on=today,
                    expires_on=parsed_expiry_date,
                    notes=notes,
                    verified_by=user,
                )
        else:
            PermitRecord.objects.create(
                cdc=cdc,
                application_date=today,
                permit_type=permit_type,
                status='rejected',
                is_temporary=False,
                notes=notes,
                issued_by=user,
            )

        self._log_cdc_activity(
            cdc=cdc,
            actor=user,
            action=accreditation_status,
            summary=f"CDC accreditation marked as {accreditation_status}.",
            field_changes=field_changes,
        )

        serializer = self.get_serializer(cdc)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[PlanningReadOnlyAuthenticated])
    def request_accreditation(self, request, pk=None):
        """Request accreditation for a CDC - CDW can request this"""
        cdc = self.get_object()
        user = request.user

        # Check if user is the assigned CDW for this CDC
        if cdc.assigned_cdw != user:
            return Response(
                {'error': 'Only the assigned CDW can request accreditation'},
                status=status.HTTP_403_FORBIDDEN
            )

        notes = request.data.get('notes', '')

        # Update status to under review
        tracked_fields = ['accreditation_status', 'accreditation_notes']
        before_values = self._capture_field_values(cdc, tracked_fields)
        cdc.accreditation_status = 'under_review'
        cdc.accreditation_notes = notes
        cdc.save()
        PermitRecord.objects.create(
            cdc=cdc,
            application_date=timezone.localdate(),
            permit_type='renewal' if cdc.permit_records.exists() else 'initial',
            status='pending_review',
            notes=notes,
        )
        field_changes = self._build_field_changes(before_values, cdc, tracked_fields)
        self._log_cdc_activity(
            cdc=cdc,
            actor=user,
            action='accreditation_requested',
            summary='CDC accreditation review requested.',
            field_changes=field_changes,
        )

        serializer = self.get_serializer(cdc)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_accreditation(self, request):
        """Get all CDCs pending accreditation"""
        cdcs = CDC.objects.filter(accreditation_status__in=['pending', 'under_review', 'expired'])
        assigned_to_me = request.query_params.get('assigned_to_me')
        if assigned_to_me in ['true', '1'] and request.user.is_authenticated:
            cdcs = cdcs.filter(assigned_cdw=request.user)
        serializer = self.get_serializer(cdcs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def expired_licenses(self, request):
        """Get all CDCs with expired licenses"""
        cdcs = CDC.objects.filter(accreditation_status='expired')
        assigned_to_me = request.query_params.get('assigned_to_me')
        if assigned_to_me in ['true', '1'] and request.user.is_authenticated:
            cdcs = cdcs.filter(assigned_cdw=request.user)
        serializer = self.get_serializer(cdcs, many=True)
        return Response(serializer.data)
