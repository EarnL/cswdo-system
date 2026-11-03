from rest_framework import serializers

from core.models import AcademicYear, Child, ChildHealthRecord, SpecialNeedsAssessment


DOMAIN_LABELS = {
    'gross_motor': 'Gross Motor Development',
    'fine_motor': 'Fine Motor Development',
    'self_help': 'Self-Help',
    'receptive_language': 'Receptive Language',
    'expressive_language': 'Expressive Language',
    'cognitive': 'Cognitive Development',
    'social_emotional': 'Social-Emotional Development',
}


def domain_status(percent):
    if percent >= 80:
        return {'value': 'on_track', 'label': 'On Track'}
    if percent >= 60:
        return {'value': 'needs_monitoring', 'label': 'Needs Monitoring'}
    return {'value': 'needs_intervention', 'label': 'Needs Intervention'}


def overall_status_from_domains(domains, result):
    values = [item.get('status') for item in domains]
    if 'needs_intervention' in values or result == 'needs_further_assessment':
        return {'value': 'needs_intervention', 'label': 'Needs Intervention'}
    if 'needs_monitoring' in values or result == 'needs_monitoring':
        return {'value': 'needs_monitoring', 'label': 'Needs Monitoring'}
    return {'value': 'on_track', 'label': 'On Track'}


class ChildSerializer(serializers.ModelSerializer):
    def to_representation(self, obj):
        request = self.context.get('request')
        if request and request.user.role == 'cdw' and obj.cdc_id and obj.cdc.assigned_cdw_id != request.user.pk:
            # Shared roster is status-only. Never serialize care or family records.
            return {
                'id': obj.pk, 'name': obj.name, 'sex': obj.sex,
                'age': obj.age_for_academic_year(), 'computed_age': obj.age_for_academic_year(),
                'barangay': obj.barangay_id, 'barangay_name': obj.barangay.name if obj.barangay else '',
                'cdc': obj.cdc_id, 'cdc_name': obj.cdc.name,
                'academic_year': obj.academic_year_id, 'academic_year_name': obj.academic_year.name if obj.academic_year else '',
                'population_reporting_period': obj.academic_year.name if obj.academic_year else '',
                'current_status': obj.current_status, 'can_view_profile': False, 'can_edit': False,
                'in_selected_population_basis': self.get_in_selected_population_basis(obj),
            }
        data = super().to_representation(obj)
        data['can_view_profile'] = True
        return data

    other_year_records = serializers.SerializerMethodField()

    def get_other_year_records(self, obj):
        view = self.context.get('view')
        if not view or getattr(view, 'action', None) != 'retrieve':
            return []
        return list(view.get_queryset().filter(person_id=obj.person_id).exclude(pk=obj.pk)
                    .order_by('-academic_year__start_year').values('id', 'academic_year__name', 'current_status'))

    in_selected_population_basis = serializers.SerializerMethodField()

    def get_in_selected_population_basis(self, obj):
        view = self.context.get('view')
        if view and hasattr(view, '_basis_members'):
            cache = self.context.setdefault('_basis_member_ids', {})
            year_id = obj.academic_year_id
            if year_id not in cache:
                cache[year_id] = set(view._basis_members(year=obj.academic_year).values_list('child_id', flat=True))
            return obj.pk in cache[year_id]
        return obj.population_memberships.filter(submission__status='current_basis').exists()

    can_edit = serializers.SerializerMethodField()

    def get_can_edit(self, obj):
        view = self.context.get('view')
        return bool(view and hasattr(view, 'can_edit_record') and view.can_edit_record(obj))

    def validate_photo(self, value):
        if value is not None:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError('Choose a photo smaller than 5 MB.')
            if getattr(value, 'image', None) is None or value.image.format not in ('JPEG', 'PNG', 'WEBP'):
                raise serializers.ValidationError('Choose a JPEG, PNG, or WebP photo.')
        return value

    def validate(self, attrs):
        instance = self.instance
        status = attrs.get('current_status', instance.current_status if instance else 'enrolled')
        cdc = attrs.get('cdc', instance.cdc if instance else None)
        request = self.context.get('request')
        if request and request.user.role == 'cdw':
            from core.models import CDC
            barangay = attrs.get('barangay', getattr(instance, 'barangay', None) or getattr(cdc, 'barangay', None))
            if not barangay or not CDC.objects.filter(assigned_cdw=request.user, barangay=barangay).exists():
                raise serializers.ValidationError({'barangay': 'Use the barangay of your assigned CDC.'})
            if cdc and cdc.barangay_id != barangay.pk:
                raise serializers.ValidationError({'barangay': 'The child and CDC must belong to the same barangay.'})
            if not instance:
                attrs.setdefault('barangay', barangay)
        if instance and 'cdc' in attrs and instance.cdc_id and getattr(attrs['cdc'], 'pk', None) != instance.cdc_id:
            raise serializers.ValidationError({'cdc': 'Use a transfer request to move this child to another CDC.'})
        if request and request.user.role == 'cdw' and cdc and cdc.assigned_cdw_id != request.user.pk:
            raise serializers.ValidationError({'cdc': 'You are not assigned to this CDC.'})
        if request and request.user.role == 'cdw' and cdc:
            from core.services.population_basis_service import working_year
            year = working_year(cdc)
            if not instance:
                attrs.setdefault('academic_year', year)
            if instance and 'academic_year' in attrs and attrs['academic_year'].pk != instance.academic_year_id:
                raise serializers.ValidationError({'academic_year': 'Keep this record in its original year. Enroll separately for the new year.'})
            if (not instance or 'cdc' in attrs) and attrs.get('academic_year', instance.academic_year if instance else year) != year:
                raise serializers.ValidationError({'academic_year': 'Apply the population update from your dashboard before opening this year.'})
        # Historical and population-only records remain editable. Validate a new
        # enrollment or a change to its age, year, status, or center.
        changing_enrollment = instance is None or any(
            key in attrs for key in ('date_of_birth', 'age', 'academic_year', 'cdc', 'current_status')
        )
        if cdc and status == 'enrolled' and changing_enrollment:
            candidate = Child(
                date_of_birth=attrs.get('date_of_birth', instance.date_of_birth if instance else None),
                age=attrs.get('age', instance.age if instance else 0),
                academic_year=attrs.get('academic_year') or (instance.academic_year if instance else None) or AcademicYear.get_current(),
            )
            if not candidate.is_daycare_eligible():
                raise serializers.ValidationError({
                    'age': 'Daycare enrollment requires age 3 or 4 at the start of the academic year.'
                })
        return attrs

    cdc_name = serializers.CharField(source='cdc.name', read_only=True, allow_null=True)
    barangay_name = serializers.CharField(source='barangay.name', read_only=True, allow_null=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, allow_null=True)
    population_source_title = serializers.CharField(source='population_source_submission.title', read_only=True, allow_null=True)
    population_source_status = serializers.CharField(source='population_source_submission.status', read_only=True, allow_null=True)
    population_reporting_period = serializers.CharField(source='population_source_submission.academic_year.name', read_only=True, allow_null=True)
    assigned_cdw_name = serializers.CharField(source='cdc.assigned_cdw.username', read_only=True, allow_null=True)
    computed_age = serializers.SerializerMethodField()
    parent_guardian_name = serializers.SerializerMethodField()
    contact_information = serializers.SerializerMethodField()
    enrollment_match_status = serializers.SerializerMethodField()
    population_match_status = serializers.SerializerMethodField()
    latest_special_needs_assessment = serializers.SerializerMethodField()
    assessment_history = serializers.SerializerMethodField()
    development_status = serializers.SerializerMethodField()
    latest_health_checkup = serializers.SerializerMethodField()
    health_checkup_records = serializers.SerializerMethodField()

    def get_computed_age(self, obj):
        return obj.age_for_academic_year(obj.academic_year)

    def get_parent_guardian_name(self, obj):
        return obj.guardian_name or obj.mother_name or obj.father_name or ''

    def get_contact_information(self, obj):
        return obj.contact_number or obj.alternate_contact_number or obj.emergency_contact_number or ''

    def get_enrollment_match_status(self, obj):
        if obj.current_status == 'enrolled' and obj.cdc_id:
            return {'value': 'enrolled', 'label': 'Enrolled in CDC'}
        if obj.current_status == 'not_enrolled' or not obj.cdc_id:
            return {'value': 'not_enrolled', 'label': 'Not Enrolled in CDC'}
        return {'value': 'unknown', 'label': 'Enrollment Status Unknown'}

    def get_population_match_status(self, obj):
        if obj.population_source_submission_id and obj.cdc_id:
            return {'value': 'matched', 'label': 'CHO Record Matched'}
        if obj.population_source_submission_id:
            return {'value': 'population_only', 'label': 'From CHO, Needs Follow-up'}
        return {'value': 'cdc_encoded', 'label': 'CDC Encoded Record'}

    def _assessment_queryset(self, obj):
        prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('special_needs_assessments')
        if prefetched is not None:
            return sorted(prefetched, key=lambda item: (item.assessment_date, item.updated_at), reverse=True)
        return SpecialNeedsAssessment.objects.filter(child=obj).select_related('assessed_by').order_by('-assessment_date', '-updated_at')

    def _health_queryset(self, obj):
        prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('health_records')
        if prefetched is not None:
            return sorted(prefetched, key=lambda item: (item.screening_date, item.created_at), reverse=True)
        return ChildHealthRecord.objects.filter(child=obj).select_related('recorded_by', 'verified_by').order_by('-screening_date', '-created_at')

    def _serialize_assessment(self, assessment, include_domains=False):
        if not assessment:
            return None
        payload = {
            'id': assessment.id,
            'assessment_type': assessment.assessment_type,
            'assessment_date': assessment.assessment_date,
            'result': assessment.result,
            'result_label': assessment.get_result_display(),
            'status': assessment.status,
            'status_label': assessment.get_status_display(),
            'examiner_name': assessment.examiner_name or (assessment.assessed_by.username if assessment.assessed_by else ''),
            'remarks': assessment.remarks,
        }
        if include_domains:
            payload['domains'] = self._domain_results(assessment)
        return payload

    def _domain_results(self, assessment):
        domain_scores = assessment.domain_scores or {}
        results = []
        for key, values in domain_scores.items():
            if key in ['scaled_scores', 'standard_score'] or not isinstance(values, dict):
                continue
            total = int(values.get('total') or 0)
            raw_score = int(values.get('raw_score') or 0)
            percent = int(values.get('percent') or ((raw_score / total) * 100 if total else 0))
            status = domain_status(percent)
            results.append({
                'key': key,
                'label': DOMAIN_LABELS.get(key, key.replace('_', ' ').title()),
                'raw_score': raw_score,
                'total': total,
                'percent': percent,
                'status': status['value'],
                'status_label': status['label'],
                'requires_attention': status['value'] != 'on_track',
            })
        return results

    def get_latest_special_needs_assessment(self, obj):
        assessments = self._assessment_queryset(obj)
        latest = assessments[0] if assessments else None
        return self._serialize_assessment(latest, include_domains=True)

    def get_assessment_history(self, obj):
        return [self._serialize_assessment(item) for item in self._assessment_queryset(obj)[:8]]

    def get_development_status(self, obj):
        assessments = self._assessment_queryset(obj)
        latest = assessments[0] if assessments else None
        if not latest:
            return {'value': 'not_assessed', 'label': 'No Assessment Yet'}
        return overall_status_from_domains(self._domain_results(latest), latest.result)

    def _serialize_health_record(self, record):
        if not record:
            return None
        return {
            'id': record.id,
            'screening_date': record.screening_date,
            'checkup_type': record.checkup_type,
            'checkup_type_label': record.get_checkup_type_display(),
            'conducted_by_label': record.get_conducted_by_display(),
            'conducted_by_name': record.conducted_by_name,
            'height': record.height,
            'weight': record.weight,
            'nutritional_status': record.nutritional_status,
            'nutritional_status_label': record.get_nutritional_status_display(),
            'health_findings': record.health_findings,
            'symptoms_observed': record.symptoms_observed,
            'medicine_given': record.medicine_given,
            'advice_given': record.advice_given,
            'needs_referral': record.needs_referral,
            'referral_reason': record.referral_reason,
            'referred_to_label': record.get_referred_to_display(),
            'follow_up_needed': record.follow_up_needed,
            'follow_up_date': record.follow_up_date,
            'follow_up_instruction': record.follow_up_instruction,
            'status': record.status,
            'status_label': record.get_status_display(),
            'recorded_by_name': record.recorded_by.username if record.recorded_by else '',
            'verified_by_name': record.verified_by.username if record.verified_by else '',
        }

    def get_latest_health_checkup(self, obj):
        records = self._health_queryset(obj)
        return self._serialize_health_record(records[0] if records else None)

    def get_health_checkup_records(self, obj):
        return [self._serialize_health_record(item) for item in self._health_queryset(obj)[:10]]

    class Meta:
        model = Child
        fields = '__all__'
        read_only_fields = ['student_id', 'bmi', 'created_at', 'updated_at', 'computed_age']
