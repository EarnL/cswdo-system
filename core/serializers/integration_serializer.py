"""
Serializers for Integration Models
Handles data serialization for BarangayPopulationMetrics, ChildrenGapAnalysis, 
SNPPlanningRecommendation, and other integration-related models.
"""
from rest_framework import serializers
from django.db.models import Q
from core.models import (
    BarangayPopulationMetrics,
    CDC,
    Child,
    EnrollmentData,
    ChildrenGapAnalysis,
    SNPPlanningRecommendation,
    DataIntegrationLog,
)


class BarangayPopulationMetricsSerializer(serializers.ModelSerializer):
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, allow_null=True)
    total_children_0_5 = serializers.SerializerMethodField()
    total_school_age = serializers.SerializerMethodField()
    vulnerable_children = serializers.SerializerMethodField()
    
    def get_total_children_0_5(self, obj):
        return obj.total_children_0_5
    
    def get_total_school_age(self, obj):
        return obj.total_school_age_children
    
    def get_vulnerable_children(self, obj):
        return obj.vulnerable_children_count
    
    class Meta:
        model = BarangayPopulationMetrics
        fields = [
            'id', 'barangay', 'barangay_name', 'academic_year', 'academic_year_name', 'total_population',
            'children_3_4', 'children_3_5', 'children_6_12',
            'adolescents_13_17', 'adults_18_64', 'elderly_65_plus',
            'total_children_0_5', 'total_school_age',
            'male_population', 'female_population',
            'single_parent_households', 'families_below_poverty_line',
            'children_with_disabilities', 'working_children', 'vulnerable_children',
            'malnourished_children', 'normal_nutrition_children',
            'last_updated', 'data_quality_score',
        ]
        read_only_fields = [
            'id', 'last_updated', 'data_quality_score',
            'total_children_0_5', 'total_school_age', 'vulnerable_children'
        ]


class EnrollmentDataSerializer(serializers.ModelSerializer):
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, allow_null=True)
    total_enrolled_0_5 = serializers.SerializerMethodField()
    total_enrolled = serializers.SerializerMethodField()
    
    def get_total_enrolled_0_5(self, obj):
        return obj.total_enrolled_0_5
    
    def get_total_enrolled(self, obj):
        return obj.total_enrolled
    
    class Meta:
        model = EnrollmentData
        fields = [
            'id', 'barangay', 'barangay_name', 'academic_year', 'academic_year_name',
            'enrolled_3_4', 'enrolled_6_12',
            'total_enrolled_0_5', 'total_enrolled',
            'daycare_enrollment', 'preschool_enrollment', 'school_enrollment',
            'feeding_program_enrollment', 'health_checkup_enrollment',
            'nutrition_program_enrollment', 'last_updated',
        ]
        read_only_fields = ['id', 'last_updated', 'total_enrolled_0_5', 'total_enrolled']


class ChildrenGapAnalysisSerializer(serializers.ModelSerializer):
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, allow_null=True)
    total_gap_0_5 = serializers.SerializerMethodField()
    total_gap_all_ages = serializers.SerializerMethodField()
    enrollment_rate_0_5 = serializers.SerializerMethodField()
    enrollment_rate_6_12 = serializers.SerializerMethodField()
    eligible_coverage_rate_3_4 = serializers.SerializerMethodField()
    validated_population_summary = serializers.SerializerMethodField()
    snp_service_gap_basis = serializers.SerializerMethodField()
    population_metrics = BarangayPopulationMetricsSerializer(read_only=True)
    enrollment_data = EnrollmentDataSerializer(read_only=True)
    
    def get_total_gap_0_5(self, obj):
        return obj.total_gap_0_5
    
    def get_total_gap_all_ages(self, obj):
        return obj.total_gap_all_ages
    
    def get_enrollment_rate_0_5(self, obj):
        return obj.enrollment_rate_0_5
    
    def get_enrollment_rate_6_12(self, obj):
        return obj.enrollment_rate_6_12

    def get_eligible_coverage_rate_3_4(self, obj):
        return obj.eligible_coverage_rate_3_4

    def get_validated_population_summary(self, obj):
        barangay = obj.barangay.name if obj.barangay_id else 'this barangay'
        return (
            f"Based on the latest validated CHO population data, there are {obj.population_children_3_4} children aged 3-4 "
            f"in Barangay {barangay}. "
            f"which is the official eligible CDC population and target enrollment base. "
            f"{obj.public_cdc_enrollment_children_3_4} are currently enrolled in CDC, leaving "
            f"{obj.public_cdc_gap_children_3_4} children for SNP validation or outreach."
        )

    def get_snp_service_gap_basis(self, obj):
        return obj.snp_service_gap_basis
    
    class Meta:
        model = ChildrenGapAnalysis
        fields = [
            'id', 'barangay', 'barangay_name', 'academic_year', 'academic_year_name',
            'population_metrics', 'enrollment_data',
            'gap_3_4', 'gap_6_12',
            'total_gap_0_5', 'total_gap_all_ages',
            'enrollment_rate_0_5', 'enrollment_rate_6_12',
            'eligible_coverage_rate_3_4', 'validated_population_summary',
            'gap_daycare', 'gap_preschool', 'gap_school',
            'gap_health_services', 'gap_feeding_program',
            'vulnerable_children_unenrolled', 'working_children_unenrolled',
            'population_children_3_4',
            'public_cdc_enrollment_children_3_4',
            'public_cdc_gap_children_3_4',
            'snp_service_gap_basis',
            # Session-based capacity management fields (NEW)
            'enrolled_children_total',
            'cdc_capacity_per_session',
            'sessions_needed_for_enrolled',
            'cdc_has_service_gap',
            'last_calculated', 'calculation_method',
        ]
        read_only_fields = [
            'id', 'last_calculated',
            'total_gap_0_5', 'total_gap_all_ages',
            'enrollment_rate_0_5', 'enrollment_rate_6_12',
            'eligible_coverage_rate_3_4', 'validated_population_summary',
            'snp_service_gap_basis',
            # Session fields are calculated automatically
            'population_children_3_4',
            'public_cdc_enrollment_children_3_4',
            'public_cdc_gap_children_3_4',
            'enrolled_children_total',
            'cdc_capacity_per_session',
            'sessions_needed_for_enrolled',
            'cdc_has_service_gap',
        ]


class SNPPlanningRecommendationSerializer(serializers.ModelSerializer):
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, allow_null=True)
    gap_analysis = ChildrenGapAnalysisSerializer(read_only=True)
    total_budget_needed = serializers.SerializerMethodField()
    population_3_4 = serializers.SerializerMethodField()
    current_enrollment_3_4 = serializers.SerializerMethodField()
    gap_3_4 = serializers.SerializerMethodField()
    cdc_capacity = serializers.SerializerMethodField()
    service_gap = serializers.SerializerMethodField()
    recommended_snp_slots = serializers.SerializerMethodField()
    priority_level = serializers.SerializerMethodField()
    suggested_action = serializers.SerializerMethodField()
    weekly_plan = serializers.SerializerMethodField()
    named_snp_candidates_count = serializers.SerializerMethodField()
    named_snp_candidates = serializers.SerializerMethodField()
    possible_snp_children_count = serializers.SerializerMethodField()
    possible_snp_children = serializers.SerializerMethodField()
    
    def get_total_budget_needed(self, obj):
        return float(obj.total_budget_needed)
    
    def get_population_3_4(self, obj):
        """Get population of children 3-4 from related gap analysis"""
        if obj.gap_analysis:
            return obj.gap_analysis.population_children_3_4
        return 0
    
    def get_current_enrollment_3_4(self, obj):
        """Get public CDC enrollment for children 3-4 from related gap analysis"""
        if obj.gap_analysis:
            return obj.gap_analysis.public_cdc_enrollment_children_3_4
        return 0
    
    def get_gap_3_4(self, obj):
        """Get public CDC gap for children 3-4 from related gap analysis"""
        if obj.gap_analysis:
            return obj.gap_analysis.public_cdc_gap_children_3_4
        return 0

    def _cdc_capacity(self, obj):
        return sum(
            max(cdc.effective_capacity or 0, cdc.current_enrollment or 0)
            for cdc in CDC.objects.filter(barangay=obj.barangay)
        )

    def get_cdc_capacity(self, obj):
        return self._cdc_capacity(obj)

    def _service_gap(self, obj):
        population = self.get_population_3_4(obj)
        enrollment = self.get_current_enrollment_3_4(obj)
        capacity_or_accommodated = max(self._cdc_capacity(obj), enrollment)
        return max(0, population - capacity_or_accommodated)

    def get_service_gap(self, obj):
        return self._service_gap(obj)

    def _recommended_slots(self, obj):
        service_gap = self._service_gap(obj)
        if service_gap <= 0:
            return 0
        if service_gap < 10:
            return service_gap
        return min(15, service_gap)

    def get_recommended_snp_slots(self, obj):
        return self._recommended_slots(obj)

    def get_priority_level(self, obj):
        service_gap = self._service_gap(obj)
        if service_gap <= 0:
            return 'No Gap'
        if service_gap >= 15:
            return 'High Priority'
        if service_gap >= 10:
            return 'Needs Monitoring'
        return 'Manageable'

    def get_suggested_action(self, obj):
        priority = self.get_priority_level(obj)
        if priority == 'High Priority':
            return 'Validate Possible Children'
        if priority == 'Needs Monitoring':
            return 'Prepare Weekly SNP List'
        if priority == 'Manageable':
            return 'Coordinate with Barangay'
        return 'Monitor Next Enrollment Cycle'

    def get_weekly_plan(self, obj):
        slots = self._recommended_slots(obj)
        return {
            'week_label': 'This Week',
            'barangay': obj.barangay.name,
            'suggested_children': slots,
            'suggested_session_days': 'Tuesday and Thursday' if slots else '',
            'suggested_time': '9:00 AM - 11:00 AM' if slots else '',
            'venue': 'Barangay meeting area or available CDC space' if slots else '',
            'assigned_cdw_or_volunteer': 'For CDW / Volunteer Validation' if slots else 'Not needed',
            'notes': 'Planning guide only. Validate with CDW, volunteer, and parent or guardian before inviting any child.',
        }

    def _named_snp_candidates(self, obj):
        queryset = Child.objects.filter(
            barangay=obj.barangay,
            academic_year=obj.academic_year,
        ).filter(Q(population_memberships__submission__status='current_basis') | Q(population_source_submission__status='current_basis'))
        queryset = queryset.distinct().select_related('cdc', 'barangay').order_by('cdc_id', 'current_status', 'name', 'id')
        children = []
        for child in queryset:
            age = child.age_for_academic_year(obj.academic_year)
            if 3 <= age <= 4:
                children.append((child, age))
        return children

    def _child_statuses(self, child):
        if child.cdc_id or child.current_status == 'enrolled':
            return 'Already Enrolled', 'Already Accommodated', 'Monitor Next Enrollment Cycle'
        if not child.student_id:
            return 'Not Matched', 'For Validation', 'Validate Possible Children'
        return 'Not Enrolled', 'Possible for SNP', 'Notify Parents / Guardians'

    def _child_payload(self, child, age):
        enrollment_status, validation_status, suggested_action = self._child_statuses(child)
        return {
            'id': child.id,
            'name': child.name,
            'age': age,
            'sex': child.sex,
            'barangay': child.barangay.name if child.barangay else '',
            'guardian_name': child.guardian_name or child.mother_name or child.father_name or '',
            'contact_number': child.contact_number,
            'address': child.complete_address,
            'enrollment_match_status': enrollment_status,
            'validation_status': validation_status,
            'suggested_action': suggested_action,
        }

    def get_named_snp_candidates_count(self, obj):
        return len([
            child for child, _age in self._named_snp_candidates(obj)
            if not child.cdc_id and child.current_status != 'enrolled'
        ])

    def get_named_snp_candidates(self, obj):
        return [
            self._child_payload(child, age)
            for child, age in self._named_snp_candidates(obj)
            if not child.cdc_id and child.current_status != 'enrolled'
        ][:15]

    def get_possible_snp_children_count(self, obj):
        if self._service_gap(obj) <= 0:
            return 0
        return len(self._named_snp_candidates(obj))

    def get_possible_snp_children(self, obj):
        if self._service_gap(obj) <= 0:
            return []
        limit = max(self._recommended_slots(obj), 15)
        return [
            self._child_payload(child, age)
            for child, age in self._named_snp_candidates(obj)[:limit]
        ]
    
    class Meta:
        model = SNPPlanningRecommendation
        fields = [
            'id', 'barangay', 'barangay_name', 'academic_year', 'academic_year_name', 'gap_analysis',
            'population_3_4', 'current_enrollment_3_4', 'gap_3_4',
            'cdc_capacity', 'service_gap',
            'recommended_snp_enrollment', 'recommended_snp_slots',
            'priority_level', 'suggested_action', 'weekly_plan',
            'named_snp_candidates_count', 'named_snp_candidates',
            'possible_snp_children_count', 'possible_snp_children',
            'high_priority_children', 'medium_priority_children', 'general_enrollment_children',
            'recommended_sessions_per_week', 'recommended_hours_per_session',
            'recommended_volunteers',
            'estimated_budget_needed', 'recommended_snack_budget',
            'recommended_activity_materials_budget', 'total_budget_needed',
            'recommendation_rationale', 'status',
            'generated_on', 'last_updated',
        ]
        read_only_fields = [
            'id', 'generated_on', 'last_updated', 'total_budget_needed',
            'population_3_4', 'current_enrollment_3_4', 'gap_3_4',
            'cdc_capacity', 'service_gap', 'recommended_snp_slots',
            'priority_level', 'suggested_action', 'weekly_plan',
            'possible_snp_children_count', 'possible_snp_children',
        ]


class DataIntegrationLogSerializer(serializers.ModelSerializer):
    integration_type_display = serializers.CharField(source='get_integration_type_display', read_only=True)
    barangay_name = serializers.CharField(source='barangay.name', read_only=True, allow_null=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, allow_null=True)
    
    class Meta:
        model = DataIntegrationLog
        fields = [
            'id', 'timestamp', 'integration_type', 'integration_type_display',
            'barangay', 'barangay_name', 'academic_year', 'academic_year_name', 'source_submission',
            'affected_records_count', 'status', 'message',
            'processing_time_ms',
        ]
        read_only_fields = [
            'id', 'timestamp', 'affected_records_count', 'status',
            'processing_time_ms', 'integration_type_display'
        ]


class BarangayIntegrationStatusSerializer(serializers.Serializer):
    """
    Comprehensive view of all integrated data for a single barangay.
    Combines population metrics, enrollment data, gaps, and SNP recommendations.
    """
    barangay_name = serializers.CharField()
    
    population_metrics = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Population breakdown by age groups"
    )
    
    enrollment = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Current enrollment by age groups"
    )
    
    gaps = serializers.DictField(
        help_text="Calculated gaps (unenrolled children)"
    )
    
    snp_plan = serializers.DictField(
        help_text="SNP planning recommendation details"
    )
