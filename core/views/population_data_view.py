from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework import serializers
from core.models import PopulationDataRequest
from core.models.population_request import request_today
from core.services.population_request_service import submit_response, change_request_state
import json
import re
from core.models import AcademicYear, PopulationDataHistory, PopulationDataSubmission
from core.serializers.population_data_serializer import PopulationDataSubmissionSerializer
from core.services.population_analytics_service import PopulationAnalyticsService
from core.services.data_integration_service import DataIntegrationService

class PopulationDataViewSet(viewsets.ModelViewSet):
    serializer_class = PopulationDataSubmissionSerializer
    permission_classes = [IsAuthenticated]
    queryset = PopulationDataSubmission.objects.all()  # Required for DRF router basename generation

    def _add_history(self, submission, action, message, user=None, remarks='', revision_reason='', current_location=''):
        return PopulationDataHistory.objects.create(
            submission=submission,
            file_snapshot=submission.data_file.name if submission.data_file else '',
            action=action,
            status=submission.status,
            message=message,
            remarks=remarks or '',
            revision_reason=revision_reason or '',
            current_location=current_location or self._current_location_for_status(submission.status),
            acted_by=user,
        )

    def _current_location_for_status(self, status_value):
        return {
            'submitted': 'City Planning',
            'received': 'City Planning',
            'under_planning_review': 'City Planning',
            'returned_to_cho': 'CHO',
            'revised_by_cho': 'City Planning',
            'sent_to_cswdo': 'CSWDO',
            'received_by_cswdo': 'CSWDO',
            'rejected_by_admin': 'History',
            'current_basis': 'System Current Basis',
            'archived': 'History',
        }.get(status_value, 'Population Data Workflow')

    def _academic_year_from_text(self, value):
        text = str(value or '').strip().replace('–', '-').replace('—', '-')
        match = re.fullmatch(r'(\d{4})\s*-\s*(\d{4})', text)
        if not match:
            return None

        start_year = int(match.group(1))
        end_year = int(match.group(2))
        if end_year != start_year + 1:
            return None

        academic_year, _ = AcademicYear.objects.get_or_create(
            name=f'{start_year}-{end_year}',
            defaults={
                'start_year': start_year,
                'end_year': end_year,
                'start_date': timezone.datetime(start_year, 6, 1).date(),
                'end_date': timezone.datetime(end_year, 5, 31).date(),
                'is_active': False,
            },
        )
        return academic_year

    def get_queryset(self):
        user = self.request.user
        academic_year_id = self.request.query_params.get('academic_year')
        if user.role == 'cho':
            # CHO shares request responses; unlinked historical submissions remain personal.
            queryset = PopulationDataSubmission.objects.filter(Q(submitted_by=user) | Q(data_request__isnull=False))
        elif user.role in ['planning', 'city_planning']:
            # City Planning can see active review files plus their forwarded/returned history.
            queryset = PopulationDataSubmission.objects.filter(status__in=[
                'submitted',
                'received',
                'under_planning_review',
                'returned_to_cho',
                'revised_by_cho',
                'sent_to_cswdo',
                'received_by_cswdo',
                'current_basis',
                'archived',
            ])
        elif user.role == 'admin':
            # CSWDO Admin can see and decide on all CSWDO population records.
            queryset = PopulationDataSubmission.objects.all()
        elif user.role == 'staff':
            # CSWDO Staff is view-only and cannot see pending decision files as an approval queue.
            queryset = PopulationDataSubmission.objects.filter(
                status__in=['received_by_cswdo', 'current_basis', 'archived']
            )
        else:
            return PopulationDataSubmission.objects.none()

        if academic_year_id:
            queryset = queryset.filter(academic_year_id=academic_year_id)
        return queryset.select_related(
            'academic_year', 'submitted_by', 'processed_by_planning',
            'sent_to_cswdo_by', 'returned_to_cho_by'
        ).prefetch_related('history')

    def create(self, request, *args, **kwargs):
        if request.user.role != 'cho':
            return Response({'error': 'Only CHO can submit population data.'}, status=403)
        if not request.data.get('data_request'):
            return Response({'error': 'Open a data request to submit the requested population file.'}, status=400)
        item = get_object_or_404(PopulationDataRequest, pk=serializers.IntegerField(min_value=1).run_validation(request.data['data_request']))
        submission = submit_response(item.pk, request.user, request.FILES.get('data_file'), str(request.data.get('description') or ''))
        return Response(self.get_serializer(submission).data, status=201)

    def get_object(self):
        submission = super().get_object()
        if self.action in ['mark_received', 'send_to_cswdo', 'return_to_cho', 'resubmit_revision'] and submission.data_request_id:
            item = PopulationDataRequest.objects.select_for_update().get(pk=submission.data_request_id)
            if item.status in ['cancelled', 'completed']:
                raise ValidationError('This data request is closed.')
            submission.refresh_from_db()
        return submission

    def update(self, request, *args, **kwargs):
        return Response(
            {'error': 'Population submissions cannot be edited after upload.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def partial_update(self, request, *args, **kwargs):
        return Response(
            {'error': 'Population submissions cannot be edited after upload.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only administrators can delete population submissions.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if self.get_object().data_request_id:
            return Response({'error': 'Request-linked submissions are retained as workflow history.'}, status=400)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def preview_upload(self, request):
        """Preview an uploaded population file before it is submitted"""
        if request.user.role != 'cho':
            return Response({'error': 'Only CHO users can preview upload files.'}, status=status.HTTP_403_FORBIDDEN)
        uploaded_file = request.FILES.get('data_file')
        if not uploaded_file:
            return Response({'error': 'No file was provided for preview.'}, status=status.HTTP_400_BAD_REQUEST)

        self.get_serializer().validate_data_file(uploaded_file)
        preview = PopulationAnalyticsService.preview_upload_file(uploaded_file)
        if not preview.get('valid'):
            return Response(preview, status=status.HTTP_400_BAD_REQUEST)

        return Response(preview, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def mark_received(self, request, pk=None):
        """City Planning marks a submission as received"""
        if request.user.role not in ['planning', 'city_planning']:
            return Response({'error': 'Only City Planning can perform this action'},
                          status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        if submission.status not in ['submitted', 'revised_by_cho']:
            return Response({'error': 'Submission is not waiting for City Planning receiving action'},
                          status=status.HTTP_400_BAD_REQUEST)

        submission.status = 'under_planning_review'
        submission.processed_by_planning = request.user
        submission.processed_on = timezone.now()
        submission.save()
        self._add_history(
            submission,
            'planning_review_started',
            'City Planning received this population data and started review.',
            user=request.user,
            current_location='City Planning',
        )

        serializer = self.get_serializer(submission)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def send_to_cswdo(self, request, pk=None):
        """City Planning sends submission to CSWDO"""
        if request.user.role not in ['planning', 'city_planning']:
            return Response({'error': 'Only City Planning can perform this action'},
                          status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        if submission.status not in ['received', 'under_planning_review', 'revised_by_cho']:
            return Response({'error': 'Submission must be received first'},
                          status=status.HTTP_400_BAD_REQUEST)

        submission.status = 'sent_to_cswdo'
        submission.processed_by_planning = submission.processed_by_planning or request.user
        submission.processed_on = submission.processed_on or timezone.now()
        submission.sent_to_cswdo_by = request.user
        submission.sent_to_cswdo_on = timezone.now()
        submission.save()
        self._add_history(
            submission,
            'forwarded_to_cswdo',
            'City Planning approved and forwarded the validated population data to CSWDO.',
            user=request.user,
            current_location='CSWDO',
        )

        change_request_state(submission, 'completed')
        serializer = self.get_serializer(submission)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def return_to_cho(self, request, pk=None):
        """City Planning returns a submission to CHO for revision."""
        if request.user.role not in ['planning', 'city_planning']:
            return Response({'error': 'Only City Planning can perform this action'},
                          status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        if submission.status not in ['submitted', 'received', 'under_planning_review', 'revised_by_cho']:
            return Response({'error': 'Only files still under City Planning review can be returned to CHO'},
                          status=status.HTTP_400_BAD_REQUEST)

        revision_reason = str(request.data.get('revision_reason') or '').strip()
        remarks = str(request.data.get('remarks') or '').strip()
        if len(revision_reason) > 120:
            raise ValidationError({'revision_reason': 'Keep the reason within 120 characters.'})
        if not revision_reason or not remarks:
            return Response(
                {'error': 'Revision reason and remarks are required before returning the file to CHO.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if submission.data_request_id:
            deadline = serializers.DateField().run_validation(request.data.get('revision_due_date'))
            if deadline < request_today():
                raise ValidationError({'revision_due_date': 'Choose today or a later correction deadline.'})
            PopulationDataRequest.objects.filter(pk=submission.data_request_id).update(revision_due_date=deadline)

        submission.status = 'returned_to_cho'
        submission.returned_to_cho_by = request.user
        submission.returned_to_cho_on = timezone.now()
        submission.revision_reason = revision_reason
        submission.revision_remarks = remarks
        submission.save()
        self._add_history(
            submission,
            'returned_to_cho',
            'City Planning returned this population data to CHO for revision.',
            user=request.user,
            remarks=remarks,
            revision_reason=revision_reason,
            current_location='CHO',
        )

        change_request_state(submission, 'needs_revision')
        serializer = self.get_serializer(submission)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def resubmit_revision(self, request, pk=None):
        """CHO resubmits a returned population file after correction."""
        submission = self.get_object()
        if request.user.role != 'cho' or (not submission.data_request_id and submission.submitted_by_id != request.user.id):
            return Response({'error': 'Only the CHO user who submitted this file can resubmit it.'},
                          status=status.HTTP_403_FORBIDDEN)
        if submission.status != 'returned_to_cho':
            return Response({'error': 'Only returned population files can be resubmitted.'},
                          status=status.HTTP_400_BAD_REQUEST)

        if submission.data_request_id:
            revised = submit_response(submission.data_request_id, request.user, request.FILES.get('data_file'), str(request.data.get('resubmission_notes') or ''))
            return Response(self.get_serializer(revised).data)

        if request.data.get('title'):
            submission.title = str(request.data.get('title')).strip()
        if 'description' in request.data:
            submission.description = str(request.data.get('description') or '').strip()

        if request.data.get('academic_year') or request.data.get('academic_year_name'):
            academic_year = None
            if request.data.get('academic_year'):
                academic_year = AcademicYear.objects.filter(id=request.data.get('academic_year')).first()
            if not academic_year and request.data.get('academic_year_name'):
                academic_year = self._academic_year_from_text(request.data.get('academic_year_name'))
            if not academic_year:
                return Response(
                    {'academic_year_name': ['Use the format YYYY-YYYY, for example 2026-2027.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            submission.academic_year = academic_year

        uploaded_file = request.FILES.get('data_file')
        if uploaded_file:
            validation_serializer = self.get_serializer(submission, data={'data_file': uploaded_file}, partial=True)
            validation_serializer.is_valid(raise_exception=True)
            if submission.data_file and not submission.history.filter(file_snapshot=submission.data_file.name).exists():
                self._add_history(submission, 'previous_file', 'Previous file preserved before correction.', user=request.user)
            submission.data_file = uploaded_file
        elif not submission.data_file:
            return Response({'error': 'A revised CSV or Excel file is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.data.get('data_payload'):
            payload = request.data.get('data_payload')
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except json.JSONDecodeError:
                    return Response({'data_payload': ['Upload metadata must be a valid JSON object.']}, status=status.HTTP_400_BAD_REQUEST)
            submission.data_payload = payload

        submission.status = 'revised_by_cho'
        submission.revised_by_cho_on = timezone.now()
        submission.save()
        self._add_history(
            submission,
            'revised_by_cho',
            'CHO revised and resubmitted this population data to City Planning.',
            user=request.user,
            remarks=str(request.data.get('resubmission_notes') or '').strip(),
            current_location='City Planning',
        )

        serializer = self.get_serializer(submission)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def mark_received_by_cswdo(self, request, pk=None):
        """CSWDO Admin accepts a forwarded submission and applies it as the current basis."""
        if request.user.role != 'admin':
            return Response({'error': 'Only CSWDO Admin can approve and apply population data.'},
                          status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        if submission.status != 'sent_to_cswdo':
            return Response({'error': 'Submission must be sent to CSWDO first'},
                          status=status.HTTP_400_BAD_REQUEST)

        submission.status = 'received_by_cswdo'
        submission.received_by_cswdo_on = timezone.now()
        submission.save()
        self._add_history(
            submission,
            'accepted_by_cswdo',
            'CSWDO Admin accepted this population data for analysis and current-basis processing.',
            user=request.user,
            current_location='CSWDO',
        )

        # Step 1: Perform automatic analysis
        analysis_success = PopulationAnalyticsService.perform_analysis(submission.id)
        if not analysis_success:
            transaction.set_rollback(True)
            return Response({'error': 'Population analysis failed. The previous basis remains active; correct the submission before applying it.'}, status=status.HTTP_400_BAD_REQUEST)

        # Step 2: Trigger data integration across all departments
        # This cascades the population data to barangay metrics, enrollment gap analysis,
        # and SNP planning recommendations
        integration_result = DataIntegrationService.process_population_submission(submission.id)

        if not integration_result.get('success'):
            response_data = self.get_serializer(submission).data
            response_data['analysis_status'] = 'completed' if analysis_success else 'failed'
            response_data['integration_result'] = integration_result
            transaction.set_rollback(True)
            return Response({
                'error': integration_result.get('error') or 'Population data integration failed.',
                'data': response_data,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if integration_result.get('success'):
            previous_current = list(PopulationDataSubmission.objects.filter(
                academic_year=submission.academic_year,
                status='current_basis',
            ).exclude(id=submission.id))
            for previous in previous_current:
                previous.status = 'archived'
                previous.save(update_fields=['status', 'status_updated_on'])
                self._add_history(
                    previous,
                    'marked_outdated',
                    'CSWDO Admin marked this previous Current Population Basis as outdated.',
                    user=request.user,
                    current_location='History',
                )
            submission.status = 'current_basis'
            submission.save(update_fields=['status', 'status_updated_on'])
            self._add_history(
                submission,
                'set_as_current_basis',
                'CSWDO Admin set this dataset as the Current Population Basis and synchronized dependent records.',
                user=request.user,
                current_location='System Current Basis',
            )

        # Prepare response
        response_data = self.get_serializer(submission).data
        response_data['analysis_status'] = 'completed' if analysis_success else 'failed'
        response_data['integration_result'] = integration_result

        if not analysis_success:
            return Response({
                'warning': 'Data received and integrated, but analysis had issues.',
                'data': response_data
            }, status=status.HTTP_207_MULTI_STATUS)

        return Response({
            'message': 'New population basis applied successfully.',
            'data': response_data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject_population_data(self, request, pk=None):
        """CSWDO Admin rejects a forwarded population submission."""
        if request.user.role != 'admin':
            return Response({'error': 'Only CSWDO Admin can reject population data.'},
                          status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        if submission.status != 'sent_to_cswdo':
            return Response({'error': 'Only forwarded population data can be rejected.'},
                          status=status.HTTP_400_BAD_REQUEST)

        remarks = str(request.data.get('remarks') or '').strip()
        submission.status = 'rejected_by_admin'
        submission.save(update_fields=['status', 'status_updated_on'])
        self._add_history(
            submission,
            'rejected_by_admin',
            'CSWDO Admin rejected this forwarded population data.',
            user=request.user,
            remarks=remarks,
            current_location='History',
        )

        return Response(self.get_serializer(submission).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def archive_population_basis(self, request, pk=None):
        """CSWDO Admin marks a population basis as outdated and moves it to history."""
        if request.user.role != 'admin':
            return Response({'error': 'Only CSWDO Admin can archive population data.'},
                          status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        if submission.status not in ['current_basis', 'received_by_cswdo']:
            return Response({'error': 'Only accepted population data can be archived'},
                          status=status.HTTP_400_BAD_REQUEST)

        academic_year = submission.academic_year or AcademicYear.get_current()
        was_current = submission.status == 'current_basis'
        from core.services.population_basis_service import capture_basis
        capture_basis(submission)
        submission.status = 'archived'
        submission.save(update_fields=['status', 'status_updated_on'])
        from core.models import Notification
        Notification.objects.filter(source_key__startswith='population_basis_',
                                    source_key__endswith=f'_{submission.pk}').update(is_active=False)
        self._add_history(
            submission,
            'archived',
            'CSWDO Admin marked this population basis as outdated and moved it to history.',
            user=request.user,
            current_location='History',
        )

        replacement_result = None
        replacement = None
        if was_current:
            replacement = PopulationDataSubmission.objects.filter(
                academic_year=academic_year,
                status='received_by_cswdo',
            ).exclude(id=submission.id).order_by('-received_by_cswdo_on', '-submitted_on').first()

            if replacement:
                replacement.status = 'current_basis'
                replacement.save(update_fields=['status', 'status_updated_on'])
                self._add_history(
                    replacement,
                    'set_as_current_basis',
                    'CSWDO Admin promoted this accepted population data as the replacement Current Population Basis.',
                    user=request.user,
                    current_location='System Current Basis',
                )
                replacement_result = DataIntegrationService.process_population_submission(replacement.id)
                if not replacement_result.get('success'):
                    transaction.set_rollback(True)
                    return Response({
                        'error': replacement_result.get('error') or 'Replacement population basis integration failed.',
                        'archived': self.get_serializer(submission).data,
                        'replacement': self.get_serializer(replacement).data,
                        'integration_result': replacement_result,
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                DataIntegrationService._reset_academic_year_population_basis(academic_year)
                replacement_result = {
                    'success': True,
                    'message': 'No replacement population basis found. Current planning basis was cleared for this academic year.',
                }

        return Response({
            'message': 'Population data moved to history.',
            'archived': self.get_serializer(submission).data,
            'replacement': self.get_serializer(replacement).data if replacement else None,
            'integration_result': replacement_result,
        }, status=status.HTTP_200_OK)
