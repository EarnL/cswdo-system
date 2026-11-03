"""Complete, center-scoped data for the official record download."""
from django.utils import timezone
from core import serializers
from core.models import AcademicYear
from core.services.data_integration_service import DataIntegrationService


RECORD_SERIALIZERS = {
    'children': ('child_set', serializers.ChildSerializer),
    'reports': ('report_set', serializers.ReportSerializer),
    'authority_documents': ('authority_documents', serializers.AuthorityDocumentSerializer),
    'permit_records': ('permit_records', serializers.PermitRecordSerializer),
    'annual_evaluations': ('annual_evaluations', serializers.AnnualEvaluationSerializer),
    'supervisory_visits': ('supervisory_visits', serializers.SupervisoryVisitSerializer),
    'child_health_records': ('child_health_records', serializers.ChildHealthRecordSerializer),
    'emergency_readiness': ('emergency_readiness_records', serializers.EmergencyReadinessSerializer),
    'safety_incidents': ('safety_incidents', serializers.SafetyIncidentSerializer),
    'child_protection_records': ('child_protection_records', serializers.ChildProtectionRecordSerializer),
    'staff_profiles': ('staff_profiles', serializers.StaffProfileSerializer),
    'staff_training_records': ('staff_training_records', serializers.StaffTrainingRecordSerializer),
    'physical_environment_assessments': ('physical_environment_assessments', serializers.PhysicalEnvironmentAssessmentSerializer),
    'interaction_observations': ('interaction_observations', serializers.InteractionObservationSerializer),
    'curriculum_plans': ('curriculum_plans', serializers.CurriculumPlanSerializer),
    'child_assessment_records': ('child_assessment_records', serializers.ChildAssessmentRecordSerializer),
    'staff_schedules': ('staff_schedules', serializers.StaffScheduleSerializer),
    'feeding_programs': ('feeding_programs', serializers.FeedingProgramSerializer),
    'parent_seminars': ('parent_seminars', serializers.ParentSeminarSerializer),
    'accreditation_requests': ('accreditation_requests', serializers.AccreditationRequestSerializer),
    'special_needs_assessments': ('special_needs_assessments', serializers.SpecialNeedsAssessmentSerializer),
}


def complete_cdc_record(cdc, context):
    profile = dict(serializers.CDCDetailSerializer(cdc, context=context).data)
    # The profile preview is limited to ten changes; the download is not.
    profile['audit_logs'] = serializers.CDCAuditLogSerializer(
        cdc.audit_logs.select_related('actor').all(), many=True, context=context,
    ).data
    records = {
        label: serializer(getattr(cdc, relation).all(), many=True, context=context).data
        for label, (relation, serializer) in RECORD_SERIALIZERS.items()
    }
    gap = DataIntegrationService.get_current_gap_analysis(cdc.barangay, AcademicYear.get_current())
    records['validated_population_basis'] = serializers.ChildrenGapAnalysisSerializer(gap, context=context).data if gap else None
    return {'cdc': profile, 'records': records, 'exported_at': timezone.now().isoformat()}
