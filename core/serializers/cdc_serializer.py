from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers
from core.models import AcademicYear, CDC, Child
from core.serializers.compliance_serializer import (
    AnnualEvaluationSerializer,
    AuthorityDocumentSerializer,
    PermitRecordSerializer,
    SupervisoryVisitSerializer,
)
from core.serializers.cdc_audit_log_serializer import CDCAuditLogSerializer
from core.serializers.health_safety_serializer import (
    ChildHealthRecordSerializer,
    ChildProtectionRecordSerializer,
    EmergencyReadinessSerializer,
    SafetyIncidentSerializer,
)
from core.serializers.interaction_serializer import InteractionObservationSerializer
from core.serializers.staffing_serializer import StaffProfileSerializer, StaffTrainingRecordSerializer
from core.serializers.physical_environment_serializer import PhysicalEnvironmentAssessmentSerializer
from core.serializers.curriculum_serializer import (
    ChildAssessmentRecordSerializer,
    CurriculumPlanSerializer,
    StaffScheduleSerializer,
)
from core.services.grant_to_operate_service import GrantToOperateService
from core.services.data_integration_service import DataIntegrationService

class CDCSerializer(serializers.ModelSerializer):
    def validate_assigned_cdw(self, worker):
        if worker is None:
            return worker
        if worker.role != 'cdw':
            raise serializers.ValidationError('Choose a CDW account.')
        centers = CDC.objects.filter(assigned_cdw=worker)
        if self.instance:
            centers = centers.exclude(pk=self.instance.pk)
        if centers.exists():
            raise serializers.ValidationError('This CDW already has a CDC. Remove the previous assignment first.')
        return worker

    preopening_readiness = serializers.SerializerMethodField()

    def get_preopening_readiness(self, obj):
        from core.services.preopening_service import preparation_summary
        return preparation_summary(obj)

    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    accredited_by_name = serializers.CharField(source='accredited_by.username', read_only=True)
    assigned_cdw_name = serializers.CharField(source='assigned_cdw.username', read_only=True)
    is_license_valid = serializers.ReadOnlyField()
    latest_authority_document = serializers.SerializerMethodField()
    latest_permit_record = serializers.SerializerMethodField()
    latest_annual_evaluation = serializers.SerializerMethodField()
    latest_supervisory_visit = serializers.SerializerMethodField()
    authority_documents_count = serializers.SerializerMethodField()
    supporting_documents_count = serializers.SerializerMethodField()
    permit_records_count = serializers.SerializerMethodField()
    annual_evaluations_count = serializers.SerializerMethodField()
    supervisory_visits_count = serializers.SerializerMethodField()
    compliance_snapshot = serializers.SerializerMethodField()
    latest_child_health_record = serializers.SerializerMethodField()
    latest_emergency_readiness = serializers.SerializerMethodField()
    latest_safety_incident = serializers.SerializerMethodField()
    latest_child_protection_record = serializers.SerializerMethodField()
    child_health_records_count = serializers.SerializerMethodField()
    emergency_readiness_count = serializers.SerializerMethodField()
    safety_incidents_count = serializers.SerializerMethodField()
    child_protection_records_count = serializers.SerializerMethodField()
    health_safety_snapshot = serializers.SerializerMethodField()
    latest_staff_profile = serializers.SerializerMethodField()
    latest_staff_training_record = serializers.SerializerMethodField()
    staff_profiles_count = serializers.SerializerMethodField()
    active_staff_profiles_count = serializers.SerializerMethodField()
    qualified_staff_profiles_count = serializers.SerializerMethodField()
    staff_training_records_count = serializers.SerializerMethodField()
    recent_staff_training_count = serializers.SerializerMethodField()
    staffing_snapshot = serializers.SerializerMethodField()
    latest_physical_environment_assessment = serializers.SerializerMethodField()
    physical_environment_assessments_count = serializers.SerializerMethodField()
    physical_environment_snapshot = serializers.SerializerMethodField()
    latest_interaction_observation = serializers.SerializerMethodField()
    interaction_observations_count = serializers.SerializerMethodField()
    interaction_snapshot = serializers.SerializerMethodField()
    latest_curriculum_plan = serializers.SerializerMethodField()
    latest_child_assessment_record = serializers.SerializerMethodField()
    latest_staff_schedule = serializers.SerializerMethodField()
    curriculum_plans_count = serializers.SerializerMethodField()
    child_assessment_records_count = serializers.SerializerMethodField()
    staff_schedules_count = serializers.SerializerMethodField()
    curriculum_snapshot = serializers.SerializerMethodField()
    grant_to_operate_status = serializers.SerializerMethodField()
    has_valid_grant_to_operate = serializers.SerializerMethodField()
    grant_to_operate_guide = serializers.SerializerMethodField()

    class Meta:
        model = CDC
        exclude = ('offers_infant_care',)

    def _serialize_latest(self, manager, serializer_class):
        instance = manager.all().first()
        if not instance:
            return None
        return serializer_class(instance, context=self.context).data

    def get_grant_to_operate_status(self, obj):
        return GrantToOperateService.get_status(obj)

    def get_has_valid_grant_to_operate(self, obj):
        return GrantToOperateService.has_valid_grant(obj)

    def get_grant_to_operate_guide(self, obj):
        status = GrantToOperateService.get_status(obj)
        return {
            'title': status['label'],
            'next_step': status['next_step'],
            'current_actions': status['current_actions'],
            'requirement_steps': status['requirement_steps'],
            'requirements_complete': status['requirements_complete'],
            'readiness_percent': status['readiness_percent'],
            'missing_requirements': status['missing_requirements'],
            'allowed_features': status['allowed_features'],
            'restricted_features': status['restricted_features'],
        }

    def get_latest_authority_document(self, obj):
        return self._serialize_latest(obj.authority_documents, AuthorityDocumentSerializer)

    def get_latest_permit_record(self, obj):
        return self._serialize_latest(obj.permit_records, PermitRecordSerializer)

    def get_latest_annual_evaluation(self, obj):
        return self._serialize_latest(obj.annual_evaluations, AnnualEvaluationSerializer)

    def get_latest_supervisory_visit(self, obj):
        return self._serialize_latest(obj.supervisory_visits, SupervisoryVisitSerializer)

    def get_authority_documents_count(self, obj):
        return obj.authority_documents.count()

    def get_supporting_documents_count(self, obj):
        authority_files = obj.authority_documents.exclude(file='').filter(file__isnull=False).count()
        permit_files = obj.permit_records.exclude(inspection_report_file='').filter(inspection_report_file__isnull=False).count()
        return authority_files + permit_files

    def get_permit_records_count(self, obj):
        return obj.permit_records.count()

    def get_annual_evaluations_count(self, obj):
        return obj.annual_evaluations.count()

    def get_supervisory_visits_count(self, obj):
        return obj.supervisory_visits.count()

    def get_compliance_snapshot(self, obj):
        latest_permit = obj.permit_records.first()
        latest_evaluation = obj.annual_evaluations.first()
        latest_visit = obj.supervisory_visits.first()
        has_authority_document = obj.authority_documents.exists()
        has_active_permit = bool(latest_permit and latest_permit.is_active)
        has_recent_evaluation = latest_evaluation is not None
        has_recent_supervisory_visit = latest_visit is not None
        missing_items = []

        if not has_authority_document:
            missing_items.append('Authority document')
        if not has_active_permit:
            missing_items.append('Active permit')
        if not has_recent_evaluation:
            missing_items.append('Annual evaluation')
        if not has_recent_supervisory_visit:
            missing_items.append('Supervisory visit')

        readiness_score = round(
            (
                int(has_authority_document)
                + int(has_active_permit)
                + int(has_recent_evaluation)
                + int(has_recent_supervisory_visit)
            ) / 4 * 100,
            1,
        )

        return {
            'has_authority_document': has_authority_document,
            'has_active_permit': has_active_permit,
            'has_recent_evaluation': has_recent_evaluation,
            'has_recent_supervisory_visit': has_recent_supervisory_visit,
            'readiness_score': readiness_score,
            'missing_items': missing_items,
        }

    def get_latest_child_health_record(self, obj):
        return self._serialize_latest(obj.child_health_records, ChildHealthRecordSerializer)

    def get_latest_emergency_readiness(self, obj):
        return self._serialize_latest(obj.emergency_readiness_records, EmergencyReadinessSerializer)

    def get_latest_safety_incident(self, obj):
        return self._serialize_latest(obj.safety_incidents, SafetyIncidentSerializer)

    def get_latest_child_protection_record(self, obj):
        return self._serialize_latest(obj.child_protection_records, ChildProtectionRecordSerializer)

    def get_child_health_records_count(self, obj):
        return obj.child_health_records.count()

    def get_emergency_readiness_count(self, obj):
        return obj.emergency_readiness_records.count()

    def get_safety_incidents_count(self, obj):
        return obj.safety_incidents.count()

    def get_child_protection_records_count(self, obj):
        return obj.child_protection_records.count()

    def get_health_safety_snapshot(self, obj):
        latest_readiness = obj.emergency_readiness_records.first()
        latest_protection = obj.child_protection_records.first()
        has_health_record = obj.child_health_records.exists()
        has_emergency_readiness = latest_readiness is not None
        has_first_aid = bool(latest_readiness and latest_readiness.has_first_aid_kit)
        has_child_protection = bool(latest_protection and latest_protection.written_policy_available)
        recent_incidents = obj.safety_incidents.count()
        missing_items = []

        if not has_health_record:
            missing_items.append('Child health record')
        if not has_emergency_readiness:
            missing_items.append('Emergency readiness assessment')
        if has_emergency_readiness and not has_first_aid:
            missing_items.append('First aid kit confirmation')
        if not has_child_protection:
            missing_items.append('Child protection review')

        readiness_score = round(
            (
                int(has_health_record)
                + int(has_emergency_readiness)
                + int(has_first_aid)
                + int(has_child_protection)
            ) / 4 * 100,
            1,
        )

        return {
            'has_child_health_record': has_health_record,
            'has_emergency_readiness': has_emergency_readiness,
            'has_first_aid_kit_confirmed': has_first_aid,
            'has_child_protection_review': has_child_protection,
            'readiness_score': readiness_score,
            'recent_incident_count': recent_incidents,
            'missing_items': missing_items,
        }

    def get_latest_staff_profile(self, obj):
        return self._serialize_latest(obj.staff_profiles, StaffProfileSerializer)

    def get_latest_staff_training_record(self, obj):
        return self._serialize_latest(obj.staff_training_records, StaffTrainingRecordSerializer)

    def get_staff_profiles_count(self, obj):
        return obj.staff_profiles.count()

    def get_active_staff_profiles_count(self, obj):
        return obj.staff_profiles.filter(employment_status='active').count()

    def get_qualified_staff_profiles_count(self, obj):
        return obj.staff_profiles.filter(employment_status='active', is_qualified=True).count()

    def get_staff_training_records_count(self, obj):
        return obj.staff_training_records.count()

    def get_recent_staff_training_count(self, obj):
        cutoff = timezone.localdate() - timedelta(days=730)
        return obj.staff_training_records.filter(completed_on__gte=cutoff).count()

    def get_staffing_snapshot(self, obj):
        cutoff = timezone.localdate() - timedelta(days=730)
        active_staff = obj.staff_profiles.filter(employment_status='active')
        active_primary_caregivers = active_staff.filter(is_primary_caregiver=True).count()
        qualified_staff = active_staff.filter(is_qualified=True).count()
        recent_training_count = obj.staff_training_records.filter(completed_on__gte=cutoff).count()
        teaching_staff = active_primary_caregivers or (1 if obj.assigned_cdw_id else 0)

        if teaching_staff > 0:
            ratio_ok = (obj.current_enrollment / teaching_staff) <= 25
        else:
            ratio_ok = obj.current_enrollment <= 0

        has_staff_profile = active_staff.exists()
        has_qualified_staff = qualified_staff > 0
        has_recent_training = recent_training_count > 0
        has_assigned_cdw = bool(obj.assigned_cdw_id)
        missing_items = []

        if not has_staff_profile:
            missing_items.append('Active staff profile')
        if not has_qualified_staff:
            missing_items.append('Qualified staff evidence')
        if not has_recent_training:
            missing_items.append('Recent staff training')
        if not has_assigned_cdw:
            missing_items.append('Assigned CDW')
        if not ratio_ok:
            missing_items.append('1:25 staff-child ratio compliance')

        readiness_score = round(
            (
                int(has_staff_profile)
                + int(has_qualified_staff)
                + int(has_recent_training)
                + int(has_assigned_cdw)
                + int(ratio_ok)
            ) / 5 * 100,
            1,
        )

        return {
            'has_active_staff_profile': has_staff_profile,
            'has_qualified_staff': has_qualified_staff,
            'has_recent_training': has_recent_training,
            'has_assigned_cdw': has_assigned_cdw,
            'group_ratio_compliant': ratio_ok,
            'active_primary_caregivers_count': active_primary_caregivers,
            'qualified_staff_count': qualified_staff,
            'recent_training_count': recent_training_count,
            'readiness_score': readiness_score,
            'missing_items': missing_items,
        }

    def get_latest_physical_environment_assessment(self, obj):
        return self._serialize_latest(obj.physical_environment_assessments, PhysicalEnvironmentAssessmentSerializer)

    def get_physical_environment_assessments_count(self, obj):
        return obj.physical_environment_assessments.count()

    def get_physical_environment_snapshot(self, obj):
        latest_assessment = obj.physical_environment_assessments.first()
        has_water_supply = (
            latest_assessment.has_safe_water_supply
            if latest_assessment is not None
            else bool(obj.has_water_supply)
        )
        has_sanitation = (
            latest_assessment.has_functional_sanitation
            if latest_assessment is not None
            else bool(obj.has_sanitation)
        )
        has_electricity = (
            latest_assessment.has_stable_electricity
            if latest_assessment is not None
            else bool(obj.has_electricity)
        )
        classroom_area = (
            latest_assessment.classroom_area
            if latest_assessment is not None and latest_assessment.classroom_area is not None
            else obj.total_area
        )
        building_type = (
            latest_assessment.building_type_observed
            if latest_assessment is not None and latest_assessment.building_type_observed
            else obj.building_type
        )
        missing_items = []

        if latest_assessment is None:
            missing_items.append('Physical environment assessment')
        if not has_water_supply:
            missing_items.append('Water supply verification')
        if not has_sanitation:
            missing_items.append('Sanitation verification')
        if not has_electricity:
            missing_items.append('Electricity verification')
        if not classroom_area:
            missing_items.append('Classroom area documentation')
        if not building_type:
            missing_items.append('Building type documentation')

        readiness_score = round(
            (
                int(latest_assessment is not None)
                + int(has_water_supply)
                + int(has_sanitation)
                + int(has_electricity)
                + int(bool(classroom_area))
                + int(bool(building_type))
            ) / 6 * 100,
            1,
        )

        return {
            'has_assessment': latest_assessment is not None,
            'has_water_supply': has_water_supply,
            'has_sanitation': has_sanitation,
            'has_electricity': has_electricity,
            'classroom_area_documented': bool(classroom_area),
            'building_type_documented': bool(building_type),
            'readiness_score': readiness_score,
            'missing_items': missing_items,
        }

    def get_latest_interaction_observation(self, obj):
        return self._serialize_latest(obj.interaction_observations, InteractionObservationSerializer)

    def get_interaction_observations_count(self, obj):
        return obj.interaction_observations.count()

    def get_interaction_snapshot(self, obj):
        latest_observation = obj.interaction_observations.first()
        has_observation = latest_observation is not None
        staff_child_positive = bool(
            latest_observation and latest_observation.staff_child_interaction_rating == 'supportive'
        )
        child_child_positive = bool(
            latest_observation and latest_observation.child_child_interaction_rating == 'supportive'
        )
        fairness_and_inclusion_observed = bool(
            latest_observation and latest_observation.fairness_and_inclusion_observed
        )
        independence_support_observed = bool(
            latest_observation and latest_observation.independence_support_observed
        )
        positive_behavior_guidance_observed = bool(
            latest_observation and latest_observation.positive_behavior_guidance_observed
        )
        routines_and_transitions_supportive = bool(
            latest_observation and latest_observation.routines_and_transitions_supportive
        )
        missing_items = []

        if not has_observation:
            missing_items.append('Interaction observation')
        if has_observation and not staff_child_positive:
            missing_items.append('Supportive staff-child interaction evidence')
        if has_observation and not child_child_positive:
            missing_items.append('Positive child-child interaction evidence')
        if has_observation and not fairness_and_inclusion_observed:
            missing_items.append('Fairness and inclusion evidence')
        if has_observation and not independence_support_observed:
            missing_items.append('Independence support evidence')
        if has_observation and not positive_behavior_guidance_observed:
            missing_items.append('Positive behavior guidance evidence')
        if has_observation and not routines_and_transitions_supportive:
            missing_items.append('Supportive routines and transitions evidence')

        readiness_score = round(
            (
                int(has_observation)
                + int(staff_child_positive)
                + int(child_child_positive)
                + int(fairness_and_inclusion_observed)
                + int(independence_support_observed)
                + int(positive_behavior_guidance_observed)
                + int(routines_and_transitions_supportive)
            ) / 7 * 100,
            1,
        )

        return {
            'has_observation': has_observation,
            'staff_child_interaction_positive': staff_child_positive,
            'child_child_interaction_positive': child_child_positive,
            'fairness_and_inclusion_observed': fairness_and_inclusion_observed,
            'independence_support_observed': independence_support_observed,
            'positive_behavior_guidance_observed': positive_behavior_guidance_observed,
            'routines_and_transitions_supportive': routines_and_transitions_supportive,
            'readiness_score': readiness_score,
            'missing_items': missing_items,
        }

    def get_latest_curriculum_plan(self, obj):
        return self._serialize_latest(obj.curriculum_plans, CurriculumPlanSerializer)

    def get_latest_child_assessment_record(self, obj):
        return self._serialize_latest(obj.child_assessment_records, ChildAssessmentRecordSerializer)

    def get_latest_staff_schedule(self, obj):
        return self._serialize_latest(obj.staff_schedules, StaffScheduleSerializer)

    def get_curriculum_plans_count(self, obj):
        return obj.curriculum_plans.count()

    def get_child_assessment_records_count(self, obj):
        return obj.child_assessment_records.count()

    def get_staff_schedules_count(self, obj):
        return obj.staff_schedules.count()

    def get_curriculum_snapshot(self, obj):
        latest_plan = obj.curriculum_plans.first()
        latest_schedule = obj.staff_schedules.first()
        has_curriculum_plan = latest_plan is not None
        has_daily_schedule = bool(latest_plan and latest_plan.daily_schedule.strip())
        has_activity_areas = bool(latest_plan and latest_plan.activity_areas_description.strip())
        has_assessment_record = obj.child_assessment_records.exists()
        child_count = obj.child_set.count()
        assessed_children_count = obj.child_assessment_records.exclude(child__isnull=True).values('child_id').distinct().count()
        assessment_coverage = round((assessed_children_count / child_count) * 100, 1) if child_count else 0

        teacher_count = latest_schedule.teacher_count if latest_schedule else obj.staff_profiles.filter(
            employment_status='active',
            is_primary_caregiver=True,
        ).count()
        assistant_count = latest_schedule.assistant_count if latest_schedule else obj.staff_profiles.filter(
            employment_status='active',
            role_type='assistant',
        ).count()
        trained_adult_count = latest_schedule.trained_adult_count if latest_schedule else obj.staff_profiles.filter(
            employment_status='active',
            first_aid_certified=True,
        ).count()
        two_trained_adults_available = (
            latest_schedule.two_trained_adults_available
            if latest_schedule
            else trained_adult_count >= 2
        )

        if obj.current_enrollment == 0:
            ratio_compliant = True
        elif teacher_count > 0 and obj.current_enrollment <= teacher_count * 10:
            ratio_compliant = True
        elif teacher_count > 0 and assistant_count > 0 and obj.current_enrollment <= teacher_count * 25:
            ratio_compliant = True
        else:
            ratio_compliant = False

        missing_items = []
        if not has_curriculum_plan:
            missing_items.append('Curriculum plan')
        if has_curriculum_plan and not latest_plan.nelf_aligned:
            missing_items.append('NELF alignment evidence')
        if has_curriculum_plan and not latest_plan.elds_aligned:
            missing_items.append('ELDS alignment evidence')
        if has_curriculum_plan and not latest_plan.play_based:
            missing_items.append('Play-based implementation evidence')
        if has_curriculum_plan and not has_daily_schedule:
            missing_items.append('Daily schedule')
        if has_curriculum_plan and not has_activity_areas:
            missing_items.append('Activity area documentation')
        if not has_assessment_record:
            missing_items.append('Child assessment record')
        if latest_schedule is None:
            missing_items.append('Staff schedule')
        if not ratio_compliant:
            missing_items.append('Ratio compliance evidence')
        if not two_trained_adults_available:
            missing_items.append('Two trained adults available')

        readiness_score = round(
            (
                int(has_curriculum_plan)
                + int(bool(latest_plan and latest_plan.nelf_aligned))
                + int(bool(latest_plan and latest_plan.elds_aligned))
                + int(bool(latest_plan and latest_plan.play_based))
                + int(has_daily_schedule)
                + int(has_assessment_record)
                + int(latest_schedule is not None)
                + int(ratio_compliant)
                + int(two_trained_adults_available)
            ) / 9 * 100,
            1,
        )

        return {
            'has_curriculum_plan': has_curriculum_plan,
            'nelf_aligned': bool(latest_plan and latest_plan.nelf_aligned),
            'elds_aligned': bool(latest_plan and latest_plan.elds_aligned),
            'play_based': bool(latest_plan and latest_plan.play_based),
            'daily_schedule_documented': has_daily_schedule,
            'activity_areas_documented': has_activity_areas,
            'has_child_assessment_record': has_assessment_record,
            'has_staff_schedule': latest_schedule is not None,
            'ratio_compliant': ratio_compliant,
            'two_trained_adults_available': two_trained_adults_available,
            'teacher_count': teacher_count,
            'assistant_count': assistant_count,
            'trained_adult_count': trained_adult_count,
            'assessed_children_count': assessed_children_count,
            'assessment_coverage': assessment_coverage,
            'readiness_score': readiness_score,
            'missing_items': missing_items,
        }


class CDCDetailSerializer(CDCSerializer):
    audit_logs = serializers.SerializerMethodField()
    population_children_3_4 = serializers.SerializerMethodField()
    barangay_public_cdc_enrollment_children_3_4 = serializers.SerializerMethodField()
    barangay_public_cdc_gap_children_3_4 = serializers.SerializerMethodField()
    snp_planning_note = serializers.SerializerMethodField()

    class Meta(CDCSerializer.Meta):
        exclude = CDCSerializer.Meta.exclude

    def get_audit_logs(self, obj):
        recent_logs = obj.audit_logs.select_related('actor').all()[:10]
        return CDCAuditLogSerializer(recent_logs, many=True).data

    def get_population_children_3_4(self, obj):
        if not obj.barangay_id:
            return 0
        if self.context.get('request') and self.context['request'].user.role == 'cdw':
            from core.services.population_basis_service import working_year, basis_for, basis_info
            basis = basis_for(obj, working_year(obj))
            return (basis_info(basis.submission, obj)['population'] or 0) if basis else 0
        gap = DataIntegrationService.get_current_gap_analysis(obj.barangay, AcademicYear.get_current())
        if gap:
            return gap.population_children_3_4
        metrics = DataIntegrationService.get_current_population_metrics(obj.barangay, AcademicYear.get_current())
        return metrics.children_3_4 if metrics else 0

    def get_barangay_public_cdc_enrollment_children_3_4(self, obj):
        if not obj.barangay_id:
            return 0
        if self.context.get('request') and self.context['request'].user.role == 'cdw':
            from core.services.population_basis_service import working_year
            year = working_year(obj)
            return sum(child.is_daycare_eligible(year) for child in Child.objects.filter(
                barangay_id=obj.barangay_id, academic_year=year, cdc__isnull=False, current_status='enrolled'))
        gap = DataIntegrationService.get_current_gap_analysis(obj.barangay, AcademicYear.get_current())
        return gap.public_cdc_enrollment_children_3_4 if gap else 0

    def get_barangay_public_cdc_gap_children_3_4(self, obj):
        if not obj.barangay_id:
            return 0
        if self.context.get('request') and self.context['request'].user.role == 'cdw':
            return max(self.get_population_children_3_4(obj) - self.get_barangay_public_cdc_enrollment_children_3_4(obj), 0)
        gap = DataIntegrationService.get_current_gap_analysis(obj.barangay, AcademicYear.get_current())
        if gap:
            return gap.public_cdc_gap_children_3_4
        population = self.get_population_children_3_4(obj)
        enrollment = self.get_barangay_public_cdc_enrollment_children_3_4(obj)
        return max(population - enrollment, 0)

    def get_snp_planning_note(self, obj):
        return (
            'This gap compares barangay population ages 3-4 with public CDC enrollment only. '
            'Some children in the gap may already be enrolled in private institutions.'
        )
