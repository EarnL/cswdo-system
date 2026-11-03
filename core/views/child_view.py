from rest_framework import status, viewsets, serializers
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import re
from copy import copy
from django.utils import timezone
from django.db.models import Prefetch
from django.db.models import Q, Count
from django.db import transaction

from core.models import AcademicYear, CDC, Child, ChildHealthRecord, SpecialNeedsAssessment
from core.serializers import ChildSerializer
from core.services.data_integration_service import DataIntegrationService
from core.services.grant_to_operate_service import GrantToOperateService
from core.permissions import PlanningReadOnlyAuthenticated
from core.models import CDCPopulationBasis, PopulationMembership, Barangay, ChildTransfer
from core.services.population_basis_service import working_year, basis_for


class ChildViewSet(viewsets.ModelViewSet):
    queryset = Child.objects.select_related(
        'academic_year',
        'barangay',
        'cdc',
        'cdc__barangay',
        'cdc__assigned_cdw',
        'population_source_submission__academic_year',
    ).prefetch_related(
        Prefetch(
            'special_needs_assessments',
            queryset=SpecialNeedsAssessment.objects.select_related('assessed_by').order_by('-assessment_date', '-updated_at'),
        ),
        Prefetch(
            'health_records',
            queryset=ChildHealthRecord.objects.select_related('recorded_by', 'verified_by').order_by('-screening_date', '-created_at'),
        )
    ).all()
    serializer_class = ChildSerializer
    permission_classes = [PlanningReadOnlyAuthenticated]

    def _can_access_cdc(self, user, cdc):
        if user.role in ['admin', 'staff', 'cho', 'planning', 'city_planning']:
            return True
        if user.role == 'cdw' and cdc.assigned_cdw_id == user.id:
            return True
        return False

    def _can_manage(self, user):
        return user.role in ['admin', 'staff', 'cho'] or user.role == 'cdw'

    def can_edit_record(self, child):
        user = self.request.user
        return (
            self._can_manage(user)
            and (not child.cdc or self._can_access_cdc(user, child.cdc))
            and (user.role != 'cdw' or not child.cdc or GrantToOperateService.has_valid_grant(child.cdc))
        )

    def _normalize_name(self, value):
        return re.sub(r'\s+', ' ', str(value or '').strip()).lower()

    def _working_year(self):
        if self.request.user.role == 'cdw':
            selected = self._record_cdc()
            if selected:
                return working_year(selected)
            cdc = CDC.objects.filter(assigned_cdw=self.request.user).first()
            if cdc:
                return working_year(cdc)
        return AcademicYear.get_current()

    def _record_cdc(self):
        cdc_id = self.request.query_params.get('record_cdc')
        if not cdc_id or self.request.user.role != 'cdw':
            return None
        if not str(cdc_id).isdigit():
            raise ValidationError({'record_cdc': 'Choose an assigned CDC.'})
        cdc = CDC.objects.select_related('barangay').filter(pk=cdc_id, assigned_cdw=self.request.user).first()
        if not cdc:
            raise PermissionDenied('This CDC is not assigned to you.')
        return cdc

    @action(detail=False, methods=['get'], url_path='record-context')
    def record_context(self, request):
        if request.user.role != 'cdw':
            raise PermissionDenied('This records view is for assigned CDWs.')
        assignments = []
        for cdc in CDC.objects.filter(assigned_cdw=request.user).select_related('barangay').order_by('name', 'pk'):
            year = working_year(cdc)
            basis = basis_for(cdc, year)
            assignments.append({'id': cdc.pk, 'name': cdc.name, 'barangay': cdc.barangay_id,
                'barangay_name': cdc.barangay.name, 'can_view': GrantToOperateService.has_valid_grant(cdc),
                'academic_year': {'id': year.pk, 'name': year.name, 'start_date': year.start_date},
                'basis': {'id': basis.submission_id, 'title': basis.submission.title, 'year': year.name} if basis else None})
        selected = self._record_cdc()
        if not selected and assignments:
            default = next((item for item in assignments if item['can_view']), assignments[0])
            selected = CDC.objects.get(pk=default['id'])
        years = []
        if selected and GrantToOperateService.has_valid_grant(selected):
            rows = Child.objects.filter(cdc=selected, barangay_id=selected.barangay_id,
                academic_year__start_year__lte=working_year(selected).start_year).filter(
                    Q(cdc__isnull=False) | Q(population_source_submission__isnull=False)
                    | Q(pk__in=PopulationMembership.objects.values('child_id')))
            years = list(rows.values('academic_year', 'academic_year__name', 'academic_year__start_date')
                .annotate(total=Count('pk'), male=Count('pk', filter=Q(sex='male')),
                    female=Count('pk', filter=Q(sex='female'))).order_by('-academic_year__start_date'))
        return Response({'assignments': assignments, 'selected_cdc': selected.pk if selected else None, 'years': years})

    def _basis_members(self, cdc=None, year=None):
        year = year or self._working_year()
        cdc = cdc or self._record_cdc()
        if cdc and self.request.user.role == 'cdw':
            basis = basis_for(cdc, year)
            return PopulationMembership.objects.filter(submission_id=basis.submission_id if basis else None)
        if self.request.user.role == 'cdw':
            bases = CDCPopulationBasis.objects.filter(cdc__assigned_cdw=self.request.user, academic_year=year)
            return PopulationMembership.objects.filter(submission_id__in=bases.values('submission_id'))
        return PopulationMembership.objects.filter(submission__status='current_basis', submission__academic_year=year)

    @action(detail=False, methods=['get'], url_path='enrollment-options')
    def enrollment_options(self, request):
        if not self._can_manage(request.user):
            raise PermissionDenied('You cannot enroll children.')
        year = self._working_year()
        cdcs = CDC.objects.select_related('barangay').order_by('name')
        if request.user.role == 'cdw':
            cdcs = cdcs.filter(assigned_cdw=request.user)
        options = []
        for cdc in cdcs:
            allowed = request.user.role != 'cdw' or GrantToOperateService.has_valid_grant(cdc)
            options.append({'id': cdc.pk, 'name': cdc.name, 'barangay': cdc.barangay_id,
                            'barangay_name': cdc.barangay.name, 'can_enroll': allowed})
        selected = self._record_cdc()
        if not selected and request.user.role == 'cdw' and options:
            default = next((item for item in options if item['can_enroll']), options[0])
            selected = cdcs.get(pk=default['id'])
        if selected:
            year = working_year(selected)
        return Response({'selected_cdc': selected.pk if selected else None, 'academic_year': {'id': year.pk, 'name': year.name,
                         'start_date': year.start_date, 'end_date': year.end_date}, 'cdcs': options})

    @action(detail=False, methods=['get'], url_path='cho-matches')
    def cho_matches(self, request):
        if not self._can_manage(request.user):
            raise PermissionDenied('You cannot enroll children.')
        term = re.sub(r'\s+', ' ', request.query_params.get('q', '').strip())[:150]
        if len(term) < 2:
            return Response({'results': [], 'has_more': False})
        queryset = self.get_queryset().filter(Q(pk__in=self._basis_members().values('child_id')) | Q(cdc__isnull=False))
        for word in term.split():
            queryset = queryset.filter(name__icontains=word)
        matches = list(queryset.order_by('name', 'id')[:13])
        return Response({'results': self.get_serializer(matches[:12], many=True).data, 'has_more': len(matches) > 12})

    def _possible_enrollment_duplicates(self, name, dob, cdc, year):
        candidates = Child.objects.filter(academic_year=year).filter(
            Q(cdc=cdc) | Q(barangay_id=cdc.barangay_id)
        )
        # Names alone are not sufficient to select a person automatically.
        normalized = self._normalize_name(name)
        return [child for child in candidates if self._normalize_name(child.name) == normalized
                and (not dob or not child.date_of_birth or dob == child.date_of_birth)]

    def _has_active_identity(self, child, year):
        candidates = Child.objects.filter(academic_year=year, current_status='enrolled', cdc__isnull=False).exclude(pk=child.pk)
        if candidates.filter(person_id=child.person_id).exists():
            return True
        if child.date_of_birth:
            return any(self._normalize_name(row.name) == self._normalize_name(child.name)
                for row in candidates.filter(barangay_id=child.barangay_id, date_of_birth=child.date_of_birth))
        return False

    @action(detail=False, methods=['get', 'post'], url_path='transfers')
    @transaction.atomic
    def transfers(self, request):
        if request.user.role not in ('cdw', 'admin', 'staff'):
            raise PermissionDenied('You cannot manage transfers.')
        if request.method == 'POST':
            class TransferInput(serializers.Serializer):
                child_id = serializers.IntegerField(min_value=1)
                cdc = serializers.PrimaryKeyRelatedField(queryset=CDC.objects.all())
            inputs = TransferInput(data=request.data)
            inputs.is_valid(raise_exception=True)
            target = inputs.validated_data['cdc']
            if not self._can_access_cdc(request.user, target):
                raise PermissionDenied('You are not assigned to this CDC.')
            Barangay.objects.select_for_update().get(pk=target.barangay_id)
            child = Child.objects.select_for_update().filter(pk=inputs.validated_data['child_id'], barangay_id=target.barangay_id).first()
            if not child or not child.cdc_id or child.cdc_id == target.pk:
                raise ValidationError('Choose a child linked to another CDC in your barangay.')
            if child.academic_year_id != working_year(target).pk or not GrantToOperateService.has_valid_grant(target):
                raise ValidationError('The receiving CDC needs a valid grant and the same academic year.')
            pending = ChildTransfer.objects.filter(child=child, status='pending').first()
            if pending:
                if pending.to_cdc_id == target.pk:
                    return Response({'id': pending.pk, 'status': 'pending'})
                return Response({'error': 'A transfer request is already pending for this child.'}, status=409)
            transfer = ChildTransfer.objects.create(child=child, academic_year=child.academic_year,
                from_cdc=child.cdc, to_cdc=target, requested_by=request.user)
            return Response({'id': transfer.pk, 'status': 'pending'}, status=201)
        queryset = ChildTransfer.objects.select_related('child', 'from_cdc', 'to_cdc', 'academic_year').order_by('-requested_at')
        if request.user.role == 'cdw':
            queryset = queryset.filter(Q(from_cdc__assigned_cdw=request.user) | Q(to_cdc__assigned_cdw=request.user))
        return Response([{'id': row.pk, 'child_name': row.child.name, 'from_cdc': row.from_cdc.name,
            'to_cdc': row.to_cdc.name, 'academic_year': row.academic_year.name, 'status': row.status,
            'can_review': row.status == 'pending' and (request.user.role in ('admin', 'staff') or row.from_cdc.assigned_cdw_id == request.user.pk),
            'requested_at': row.requested_at, 'reviewed_at': row.reviewed_at} for row in queryset[:100]])

    @action(detail=False, methods=['post'], url_path=r'transfers/(?P<transfer_id>\d+)/review')
    @transaction.atomic
    def review_transfer(self, request, transfer_id=None):
        row = ChildTransfer.objects.filter(pk=transfer_id).select_related('child', 'from_cdc', 'to_cdc').first()
        if not row:
            raise ValidationError('Transfer request not found.')
        if request.user.role not in ('admin', 'staff') and not (request.user.role == 'cdw' and row.from_cdc.assigned_cdw_id == request.user.pk):
            raise PermissionDenied('Only the current center or CSWDO can review this transfer.')
        decision = request.data.get('decision')
        if decision not in ('approved', 'declined'):
            raise ValidationError('Choose approve or decline.')
        Barangay.objects.select_for_update().get(pk=row.to_cdc.barangay_id)
        row = ChildTransfer.objects.select_for_update().get(pk=row.pk)
        if row.status != 'pending':
            return Response({'error': 'This request has already been reviewed.'}, status=409)
        child = Child.objects.select_for_update().get(pk=row.child_id)
        if decision == 'approved':
            if child.cdc_id != row.from_cdc_id or child.academic_year_id != row.academic_year_id:
                return Response({'error': 'The enrollment changed. Decline this request and submit a new one.'}, status=409)
            if child.barangay_id != row.to_cdc.barangay_id or working_year(row.to_cdc).pk != row.academic_year_id or not GrantToOperateService.has_valid_grant(row.to_cdc):
                raise ValidationError('The receiving CDC must have a valid grant and the same barangay and academic year.')
            if not child.is_daycare_eligible():
                raise ValidationError('This child is not eligible for daycare in this academic year.')
            if self._has_active_identity(child, row.academic_year):
                raise ValidationError('Another enrollment matches this child. Ask CSWDO to review the records before transferring.')
            child.cdc = row.to_cdc
            child.current_status = 'enrolled'
            child.save(update_fields=['cdc', 'current_status'])
            # The same child ID retains all related care records; the audit keeps both centers.
            for center in (row.from_cdc, row.to_cdc):
                if working_year(center).pk == row.academic_year_id:
                    center.current_enrollment = sum(item.is_daycare_eligible(row.academic_year) for item in Child.objects.filter(cdc=center, academic_year_id=row.academic_year_id, current_status='enrolled'))
                    center.save(update_fields=['current_enrollment'])
            transaction.on_commit(lambda: self._refresh_population_planning(child))
        row.status = decision
        row.reviewed_by = request.user
        row.reviewed_at = timezone.now()
        row.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
        return Response({'id': row.pk, 'status': row.status})

    @action(detail=False, methods=['post'], url_path='enroll')
    @transaction.atomic
    def enroll(self, request):
        if not self._can_manage(request.user):
            raise PermissionDenied('You cannot enroll children.')
        class EnrollmentInput(serializers.Serializer):
            cdc = serializers.PrimaryKeyRelatedField(queryset=CDC.objects.all())
            academic_year = serializers.IntegerField()
            child_id = serializers.IntegerField(required=False, min_value=1)
            enrollment_date = serializers.DateField()

        inputs = EnrollmentInput(data=request.data)
        inputs.is_valid(raise_exception=True)
        values = inputs.validated_data
        # Serialize enrollment across centers in the barangay, including manual entry.
        Barangay.objects.select_for_update().get(pk=values['cdc'].barangay_id)
        cdc = CDC.objects.select_for_update().get(pk=values['cdc'].pk)
        if not self._can_access_cdc(request.user, cdc):
            raise PermissionDenied('You are not assigned to this CDC.')
        if request.user.role == 'cdw' and not GrantToOperateService.has_valid_grant(cdc):
            raise PermissionDenied(GrantToOperateService.cdw_operating_error(cdc))
        year = working_year(cdc) if request.user.role == 'cdw' else AcademicYear.get_current()
        if values['academic_year'] != year.pk:
            raise ValidationError({'academic_year': 'The enrollment period changed. Reload this page before enrolling.'})
        if not year.start_date <= values['enrollment_date'] <= year.end_date:
            raise ValidationError({'enrollment_date': 'Choose a date within the current enrollment period.'})
        updates = {'cdc': cdc.pk, 'academic_year': year.pk, 'current_status': 'enrolled',
                   'enrollment_date': values['enrollment_date']}
        if values.get('child_id'):
            shared = Child.objects.filter(pk=values['child_id'], academic_year=year, barangay_id=cdc.barangay_id, cdc__isnull=False).select_related('cdc').first()
            if shared and shared.cdc_id != cdc.pk:
                return Response({'error': f'Already linked to {shared.cdc.name}. Request a transfer to move this child.', 'cdc_name': shared.cdc.name}, status=409)
            child = self.get_queryset().filter(pk=values['child_id'], academic_year=year).select_for_update(of=('self',)).first()
            if not child:
                raise PermissionDenied('This child record is not available for enrollment.')
            if not self._basis_members(cdc, year).filter(child=child).exists():
                raise ValidationError({'child_id': 'This CHO record is no longer part of the validated current basis. Search again.'})
            if self._has_active_identity(child, year):
                return Response({'error': 'This child already has an enrollment for this academic year. Ask CSWDO to review the matching records.'}, status=409)
            if child.cdc_id and (child.current_status == 'enrolled' or child.cdc_id != cdc.pk):
                return Response({'error': 'This child already has a CDC enrollment for this period. Open the existing profile.',
                                 'child_id': child.pk, 'cdc_name': child.cdc.name, 'academic_year_name': year.name}, status=409)
            # Only fill missing contact details here. Identity/source changes go through the profile.
            for field in ('guardian_name', 'contact_number'):
                if not getattr(child, field):
                    updates[field] = str(request.data.get(field, '')).strip()
            serializer = self.get_serializer(child, data=updates, partial=True)
        else:
            allowed = ('name', 'sex', 'date_of_birth', 'age', 'guardian_name', 'contact_number',
                       'complete_address', 'father_name', 'mother_name')
            data = {key: request.data[key] for key in allowed if key in request.data}
            data.update(updates, barangay=cdc.barangay_id)
            serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        record = serializer.instance
        for field in ('guardian_name', 'contact_number'):
            if not (serializer.validated_data.get(field) or (getattr(record, field, '') if record else '')).strip():
                raise ValidationError({field: 'This field is required for enrollment.'})
        if record is None:
            duplicates = self._possible_enrollment_duplicates(
                serializer.validated_data['name'], serializer.validated_data.get('date_of_birth'), cdc, year,
            )
            if duplicates:
                visible_ids = set(self.get_queryset().filter(pk__in=[item.pk for item in duplicates]).values_list('pk', flat=True))
                match = duplicates[0] if len(duplicates) == 1 and duplicates[0].pk in visible_ids else None
                return Response({'error': 'A matching child record already exists. Select the CHO result, open the existing profile, or ask CSWDO to review the match.',
                                 'child_id': match.pk if match else None}, status=409)
        serializer.save()
        transaction.on_commit(lambda: self._refresh_population_planning(serializer.instance))
        return Response(self.get_serializer(serializer.instance).data, status=200 if record else 201)

    def _find_population_match(self, validated_data):
        name = self._normalize_name(validated_data.get('name'))
        barangay = validated_data.get('barangay')
        cdc = validated_data.get('cdc')
        academic_year = validated_data.get('academic_year') or AcademicYear.get_current()
        date_of_birth = validated_data.get('date_of_birth')

        if not name:
            return None
        if not barangay and cdc:
            barangay = cdc.barangay
        if not barangay:
            return None

        candidates = Child.objects.filter(
            academic_year=academic_year,
            barangay=barangay,
            cdc__isnull=True,
            pk__in=self._basis_members(cdc, academic_year).values('child_id'),
        ).filter(
            Q(current_status='not_enrolled') | Q(current_status='enrolled')
        ).order_by('id').select_for_update()

        for child in candidates:
            if self._normalize_name(child.name) != name:
                continue
            if date_of_birth and child.date_of_birth and child.date_of_birth != date_of_birth:
                continue
            return child
        return None

    def _refresh_population_planning(self, child):
        if not child or not child.barangay_id:
            return

        if child.cdc_id:
            active_count = sum(item.is_daycare_eligible(child.academic_year) for item in Child.objects.filter(
                cdc=child.cdc,
                academic_year=child.academic_year,
                current_status='enrolled',
            ))
            if child.cdc.current_enrollment != active_count:
                child.cdc.current_enrollment = active_count
                child.cdc.save(update_fields=['current_enrollment'])

        try:
            DataIntegrationService._update_enrollment_from_child_records(child.barangay, child.academic_year)
            DataIntegrationService._calculate_gap_analysis(child.barangay, child.academic_year)
            DataIntegrationService._generate_snp_recommendation(child.barangay, child.academic_year)
        except Exception as exc:
            # Enrollment should still save even if planning data cannot be refreshed.
            print(f'Failed to refresh population planning for child {child.id}: {exc}')

    def get_queryset(self):
        queryset = self.queryset
        user = self.request.user
        cdc_id = self.request.query_params.get('cdc')
        barangay_id = self.request.query_params.get('barangay')
        academic_year_id = self.request.query_params.get('academic_year')
        include_history = self.request.query_params.get('include_history') == 'true' or self.action == 'retrieve'
        status_filter = self.request.query_params.get('status')
        if user.role == 'cdw':
            selected_cdc = self._record_cdc()
            assigned_cdcs = CDC.objects.filter(
                assigned_cdw=user,
                is_accredited=True,
                accreditation_status='accredited',
                license_expiry_date__gte=timezone.localdate(),
            )
            if not assigned_cdcs.exists():
                return queryset.none()
            if selected_cdc:
                assigned_cdcs = assigned_cdcs.filter(pk=selected_cdc.pk)
            assigned_barangay_ids = assigned_cdcs.values_list('barangay_id', flat=True)
            scope = (
                Q(cdc__assigned_cdw=user)
                | Q(cdc__isnull=True, barangay_id__in=assigned_barangay_ids, population_source_submission__isnull=False)
                | Q(cdc__isnull=True, barangay_id__in=assigned_barangay_ids, pk__in=PopulationMembership.objects.values('child_id'))
            )
            if self.action in ('list', 'cho_matches'):
                scope |= Q(barangay_id__in=assigned_barangay_ids, cdc__isnull=False)
            queryset = queryset.filter(scope, barangay_id__in=assigned_barangay_ids)
            if self.action == 'list' and (include_history or self.request.query_params.get('record_scope') == 'cdc'):
                queryset = queryset.filter(cdc__in=assigned_cdcs)
            if selected_cdc:
                selected_year = working_year(selected_cdc)
                if include_history:
                    queryset = queryset.filter(academic_year__start_year__lte=selected_year.start_year)
                else:
                    queryset = queryset.filter(academic_year=selected_year)
        if cdc_id:
            queryset = queryset.filter(cdc_id=cdc_id)
        if barangay_id:
            queryset = queryset.filter(barangay_id=barangay_id)
        if academic_year_id:
            queryset = queryset.filter(academic_year_id=academic_year_id)
        elif not include_history:
            queryset = queryset.filter(academic_year=self._working_year())
        if not include_history:
            queryset = queryset.filter(
                Q(population_source_submission__isnull=True)
                | Q(pk__in=self._basis_members(year=AcademicYear.objects.filter(pk=academic_year_id).first() if academic_year_id else None).values('child_id'))
                | Q(cdc__isnull=False)
            )
        if status_filter:
            queryset = queryset.filter(current_status=status_filter)
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cdc = serializer.validated_data.get('cdc')
        if not self._can_manage(request.user) or (cdc and not self._can_access_cdc(request.user, cdc)):
            return Response({'error': 'You are not allowed to register children for this CDC.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and cdc and not GrantToOperateService.has_valid_grant(cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(cdc)}, status=status.HTTP_403_FORBIDDEN)

        duplicates = []
        if cdc:
            Barangay.objects.select_for_update().get(pk=cdc.barangay_id)
            CDC.objects.select_for_update().get(pk=cdc.pk)
            duplicates = self._possible_enrollment_duplicates(
                serializer.validated_data.get('name', ''), serializer.validated_data.get('date_of_birth'),
                cdc, serializer.validated_data.get('academic_year') or AcademicYear.get_current(),
            )
            if any(item.cdc_id for item in duplicates) or len(duplicates) > 1:
                return Response({'error': 'A matching child record already exists for this period. Use Add Child to select the existing record.'}, status=409)

        population_match = self._find_population_match(serializer.validated_data)
        if duplicates and not population_match:
            return Response({'error': 'A matching child record is already linked to a CDC. Review it in Records before proceeding.'}, status=409)
        if population_match:
            for field, value in serializer.validated_data.items():
                setattr(population_match, field, value)
            population_match.current_status = 'enrolled'
            population_match.save()
            transaction.on_commit(lambda: self._refresh_population_planning(population_match))
            return Response(self.get_serializer(population_match).data, status=status.HTTP_200_OK)

        self.perform_create(serializer)
        transaction.on_commit(lambda: self._refresh_population_planning(serializer.instance))
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(serializer.instance).data, status=status.HTTP_201_CREATED, headers=headers)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.barangay_id:
            Barangay.objects.select_for_update().get(pk=instance.barangay_id)
        instance = Child.objects.select_for_update().get(pk=instance.pk)
        if not self._can_manage(request.user) or (instance.cdc and not self._can_access_cdc(request.user, instance.cdc)):
            return Response({'error': 'You are not allowed to update this child record.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and instance.cdc and not GrantToOperateService.has_valid_grant(instance.cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(instance.cdc)}, status=status.HTTP_403_FORBIDDEN)
        response = super().update(request, *args, **kwargs)
        self._refresh_population_planning(self.get_object())
        return response

    def perform_update(self, serializer):
        candidate = copy(serializer.instance)
        for field, value in serializer.validated_data.items():
            setattr(candidate, field, value)
        if candidate.cdc_id and candidate.current_status == 'enrolled':
            Barangay.objects.select_for_update().get(pk=candidate.cdc.barangay_id)
            if self._has_active_identity(candidate, candidate.academic_year):
                raise ValidationError('Another enrollment matches this child. Ask CSWDO to review the records.')
            if not serializer.instance.cdc_id:
                duplicates = self._possible_enrollment_duplicates(candidate.name, candidate.date_of_birth, candidate.cdc, candidate.academic_year)
                if any(item.pk != candidate.pk and item.cdc_id for item in duplicates):
                    raise ValidationError('A matching child is already linked to a CDC. Use the transfer process.')
        serializer.save()

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage(request.user) or (instance.cdc and not self._can_access_cdc(request.user, instance.cdc)):
            return Response({'error': 'You are not allowed to update this child record.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'cdw' and instance.cdc and not GrantToOperateService.has_valid_grant(instance.cdc):
            return Response({'error': GrantToOperateService.cdw_operating_error(instance.cdc)}, status=status.HTTP_403_FORBIDDEN)
        response = super().partial_update(request, *args, **kwargs)
        self._refresh_population_planning(self.get_object())
        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role != 'admin' or (instance.cdc and not self._can_access_cdc(request.user, instance.cdc)):
            return Response({'error': 'Only administrators can delete child records.'}, status=status.HTTP_403_FORBIDDEN)
        if instance.population_memberships.exists() or instance.transfers.exists():
            raise ValidationError('This child belongs to population history and must be retained.')
        return super().destroy(request, *args, **kwargs)
