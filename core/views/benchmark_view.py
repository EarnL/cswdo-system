from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.models import Barangay, CDC, Child, Report
from core.services.data_integration_service import DataIntegrationService


STANDARD_AREAS = [
    {
        'key': 'health_nutrition_safety',
        'label': 'Health, Nutrition, and Safety',
        'pdf_pages': 'Health / Nutrition / Safety',
        'description': 'Health check-up records, nutrition and feeding services, hygiene, emergency readiness, first aid, referrals, and child protection.',
        'indicators': [
            {'key': 'health_services', 'label': 'Health services available', 'type': 'bool', 'benchmark': 'Available'},
            {'key': 'feeding_program', 'label': 'Feeding program available', 'type': 'bool', 'benchmark': 'Available'},
            {'key': 'safe_water', 'label': 'Safe water access', 'type': 'bool', 'benchmark': 'Available'},
            {'key': 'child_health_record_documented', 'label': 'Child health record documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'emergency_readiness_documented', 'label': 'Emergency readiness documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'first_aid_ready', 'label': 'First aid readiness documented', 'type': 'bool', 'benchmark': 'Documented'},
            {'key': 'child_protection_documented', 'label': 'Child protection review documented', 'type': 'bool', 'benchmark': 'Recorded'},
        ],
        'data_gap_note': 'No record available yet for missing health, nutrition, safety, or emergency-readiness items.',
    },
    {
        'key': 'physical_environment_safety',
        'label': 'Physical Environment and Safety',
        'pdf_pages': 'Facility / Safety',
        'description': 'CDC facility information, classroom condition, sanitation, water, electricity, emergency readiness, and safety equipment.',
        'indicators': [
            {'key': 'water_supply', 'label': 'Water supply documented', 'type': 'bool', 'benchmark': 'Available'},
            {'key': 'sanitation', 'label': 'Toilet and sanitation documented', 'type': 'bool', 'benchmark': 'Available'},
            {'key': 'electricity', 'label': 'Electricity documented', 'type': 'bool', 'benchmark': 'Available'},
            {'key': 'space_documented', 'label': 'Classroom area documented', 'type': 'bool', 'benchmark': 'Documented'},
            {'key': 'building_type', 'label': 'Building type documented', 'type': 'bool', 'benchmark': 'Documented'},
            {'key': 'emergency_readiness_documented', 'label': 'Emergency readiness documented', 'type': 'bool', 'benchmark': 'Recorded'},
        ],
        'data_gap_note': 'No record available yet for missing facility, classroom, sanitation, or safety evidence.',
    },
    {
        'key': 'staff_qualifications_development',
        'label': 'Staff Qualifications and Development',
        'pdf_pages': 'Staffing',
        'description': 'Assigned CDW, staff profiles, qualifications, trainings, certificates, duty assignments, and supervision ratios.',
        'indicators': [
            {'key': 'assigned_cdw', 'label': 'Assigned child development worker/teacher', 'type': 'bool', 'benchmark': 'Assigned'},
            {'key': 'staff_profile_documented', 'label': 'Active staff profile documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'qualified_staff_documented', 'label': 'Qualified staff evidence documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'recent_staff_training_documented', 'label': 'Recent staff training documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'group_ratio_maximum', 'label': 'Maximum 1:25 supervision ceiling', 'type': 'bool', 'benchmark': 'Compliant'},
        ],
        'data_gap_note': 'No record available yet for missing staff profile, qualification, training, or schedule evidence.',
    },
    {
        'key': 'curriculum_instruction_assessment',
        'label': 'Curriculum, Instruction, and Assessment',
        'pdf_pages': 'Curriculum / Assessment',
        'description': 'Curriculum guides, toddler/preschool program readiness, child assessment records, routines, schedules, and development monitoring.',
        'indicators': [
            {'key': 'curriculum_plan_documented', 'label': 'Written curriculum plan documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'nelf_elds_alignment_documented', 'label': 'NELF/ELDS alignment documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'daily_schedule_documented', 'label': 'Daily program schedule documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'authentic_child_assessment_documented', 'label': 'Authentic child assessment documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'program_offered', 'label': 'Toddler or preschool program offered', 'type': 'bool', 'benchmark': 'Available'},
            {'key': 'ratio_rule_compliant', 'label': 'Ratio rule compliant', 'type': 'bool', 'benchmark': 'Compliant'},
            {'key': 'two_trained_adults_available', 'label': 'Two trained adults available', 'type': 'bool', 'benchmark': 'Available'},
        ],
        'data_gap_note': 'No record available yet for missing curriculum plan, program routine, child assessment, or schedule evidence.',
    },
    {
        'key': 'family_community_linkages',
        'label': 'Family Involvement and Community Linkages',
        'pdf_pages': 'Family / Community',
        'description': 'Parent or guardian contact information, family support records, community activities, referrals, volunteers, and barangay or LGU support.',
        'indicators': [
            {'key': 'contact_person', 'label': 'Family/community contact person recorded', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'contact_number', 'label': 'Family/community contact number recorded', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'volunteers', 'label': 'Volunteer/community support recorded', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'guardian_information_recorded', 'label': 'Guardian information recorded in child profiles', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'parent_community_report_submitted', 'label': 'Parent/community report submitted', 'type': 'bool', 'benchmark': 'Submitted'},
        ],
        'data_gap_note': 'No record available yet for missing family participation, referral, or community-linkage evidence.',
    },
    {
        'key': 'leadership_management_support',
        'label': 'Leadership, Program Management, and Support',
        'pdf_pages': 'Management / Accreditation',
        'description': 'CDC profile, operating schedule, capacity, accreditation status, monitoring history, authority or grant to operate, and reports.',
        'indicators': [
            {'key': 'authority_document_on_file', 'label': 'Authority document on file', 'type': 'bool', 'benchmark': 'Documented'},
            {'key': 'permit_active', 'label': 'Authority or permit active', 'type': 'bool', 'benchmark': 'Valid'},
            {'key': 'operating_schedule_documented', 'label': 'Operating schedule documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'capacity_documented', 'label': 'Capacity documented', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'assigned_supervision', 'label': 'Assigned supervision/contact staff', 'type': 'bool', 'benchmark': 'Available'},
            {'key': 'annual_evaluation_documented', 'label': 'Annual evaluation documented', 'type': 'bool', 'benchmark': 'Documented'},
            {'key': 'supervisory_visit_documented', 'label': 'Supervisory visit documented', 'type': 'bool', 'benchmark': 'Documented'},
            {'key': 'recent_reporting', 'label': 'CDC summary or monitoring report submitted', 'type': 'bool', 'benchmark': 'Submitted'},
        ],
        'data_gap_note': 'No record available yet for missing authority, schedule, monitoring, report, or management-support evidence.',
    },
    {
        'key': 'child_records_program_readiness',
        'label': 'Child Records and Program Readiness',
        'pdf_pages': 'Records / Readiness',
        'description': 'Student profiles, enrollment records, current population basis, service gap analysis, capacity readiness, and CDC program records.',
        'indicators': [
            {'key': 'child_profiles_recorded', 'label': 'Child profiles recorded', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'current_population_basis_connected', 'label': 'Current population basis connected', 'type': 'bool', 'benchmark': 'Connected'},
            {'key': 'service_gap_analysis_available', 'label': 'Service gap analysis available', 'type': 'bool', 'benchmark': 'Available'},
            {'key': 'enrollment_within_capacity', 'label': 'Enrollment within effective capacity', 'type': 'bool', 'benchmark': 'Within capacity'},
            {'key': 'program_offered', 'label': 'CDC program readiness recorded', 'type': 'bool', 'benchmark': 'Recorded'},
            {'key': 'recent_reporting', 'label': 'Recent CDC report submitted', 'type': 'bool', 'benchmark': 'Submitted'},
        ],
        'data_gap_note': 'No record available yet for missing child profile, population-basis, gap-analysis, or program-readiness evidence.',
    },
]


def _status_for_percent(value, benchmark):
    gap = round(value - benchmark, 1)
    if value >= benchmark:
        return 'meets', gap
    if gap >= -5:
        return 'near', gap
    return 'below', gap


def _status_for_bool(value):
    return ('meets', 0) if value else ('below', -100)


def _cdc_context(cdc):
    reports = list(Report.objects.filter(cdc=cdc).order_by('-year', '-quarter', '-submitted_on'))
    report_count = len(reports)
    on_time_rate = (
        (sum(1 for report in reports if report.is_on_time) / report_count) * 100
        if report_count
        else 0
    )
    completeness_rate = (
        (sum(1 for report in reports if report.is_complete) / report_count) * 100
        if report_count
        else 0
    )
    recent_training_cutoff = timezone.localdate() - timedelta(days=730)
    active_staff_profiles = cdc.staff_profiles.filter(employment_status='active')
    active_primary_caregivers = active_staff_profiles.filter(is_primary_caregiver=True).count()
    qualified_staff_profiles = active_staff_profiles.filter(is_qualified=True).count()
    recent_staff_training_count = cdc.staff_training_records.filter(completed_on__gte=recent_training_cutoff).count()
    teaching_staff = active_primary_caregivers or (1 if cdc.assigned_cdw else 0)

    supervision_ratio_ok = True
    if teaching_staff > 0:
        supervision_ratio_ok = (cdc.current_enrollment / teaching_staff) <= 25
    elif cdc.current_enrollment > 0:
        supervision_ratio_ok = False

    latest_authority_document = cdc.authority_documents.all().first()
    latest_permit_record = cdc.permit_records.all().first()
    latest_annual_evaluation = cdc.annual_evaluations.all().first()
    latest_supervisory_visit = cdc.supervisory_visits.all().first()
    latest_emergency_readiness = cdc.emergency_readiness_records.all().first()
    latest_child_protection = cdc.child_protection_records.all().first()
    latest_physical_environment = cdc.physical_environment_assessments.all().first()
    latest_interaction_observation = cdc.interaction_observations.all().first()
    latest_curriculum_plan = cdc.curriculum_plans.all().first()
    latest_staff_schedule = cdc.staff_schedules.all().first()
    has_child_health_record = cdc.child_health_records.exists()
    has_child_assessment_record = cdc.child_assessment_records.exists()
    child_profiles = Child.objects.filter(cdc=cdc)
    enrolled_child_count = child_profiles.filter(current_status='enrolled').count()
    guardian_information_recorded = child_profiles.filter(guardian_name__gt='').exists()
    parent_community_report_submitted = any(
        getattr(report, 'report_type', '') == 'parent_community'
        for report in reports
    )
    population_metrics = DataIntegrationService.get_current_population_metrics(cdc.barangay) if cdc.barangay_id else None
    gap_analysis = DataIntegrationService.get_current_gap_analysis(cdc.barangay) if cdc.barangay_id else None

    is_public_style = cdc.building_type in {'owned', 'barangay', 'school'}
    authority_document_on_file = bool(latest_authority_document or cdc.license_number or is_public_style)
    authority_to_operate = bool(authority_document_on_file)
    permit_record_documented = bool(latest_permit_record or cdc.license_number or is_public_style)
    permit_active = (
        latest_permit_record.is_active
        if latest_permit_record
        else (cdc.is_license_valid if cdc.license_number else bool(is_public_style or cdc.is_accredited))
    )
    annual_evaluation_documented = bool(latest_annual_evaluation)
    supervisory_visit_documented = bool(latest_supervisory_visit)
    emergency_readiness_documented = bool(latest_emergency_readiness)
    first_aid_ready = bool(latest_emergency_readiness and latest_emergency_readiness.has_first_aid_kit)
    child_protection_documented = bool(latest_child_protection and latest_child_protection.written_policy_available)
    water_supply_documented = (
        latest_physical_environment.has_safe_water_supply
        if latest_physical_environment is not None
        else bool(cdc.has_water_supply)
    )
    sanitation_documented = (
        latest_physical_environment.has_functional_sanitation
        if latest_physical_environment is not None
        else bool(cdc.has_sanitation)
    )
    electricity_documented = (
        latest_physical_environment.has_stable_electricity
        if latest_physical_environment is not None
        else bool(cdc.has_electricity)
    )
    space_documented = bool(
        latest_physical_environment is not None and latest_physical_environment.classroom_area
    ) or bool(cdc.total_area and cdc.total_area > 0)
    building_type_documented = bool(
        (latest_physical_environment and latest_physical_environment.building_type_observed)
        or cdc.building_type
    )
    interaction_observation_documented = latest_interaction_observation is not None
    staff_child_interaction_positive = bool(
        latest_interaction_observation
        and latest_interaction_observation.staff_child_interaction_rating == 'supportive'
    )
    child_child_interaction_positive = bool(
        latest_interaction_observation
        and latest_interaction_observation.child_child_interaction_rating == 'supportive'
    )
    fairness_inclusion_observed = bool(
        latest_interaction_observation
        and latest_interaction_observation.fairness_and_inclusion_observed
    )
    independence_support_observed = bool(
        latest_interaction_observation
        and latest_interaction_observation.independence_support_observed
    )
    positive_behavior_guidance_observed = bool(
        latest_interaction_observation
        and latest_interaction_observation.positive_behavior_guidance_observed
    )
    routines_transitions_supportive = bool(
        latest_interaction_observation
        and latest_interaction_observation.routines_and_transitions_supportive
    )
    teacher_count = latest_staff_schedule.teacher_count if latest_staff_schedule else active_primary_caregivers
    assistant_count = latest_staff_schedule.assistant_count if latest_staff_schedule else active_staff_profiles.filter(role_type='assistant').count()
    trained_adult_count = latest_staff_schedule.trained_adult_count if latest_staff_schedule else active_staff_profiles.filter(first_aid_certified=True).count()
    if cdc.current_enrollment == 0:
        ratio_rule_compliant = True
    elif teacher_count > 0 and cdc.current_enrollment <= teacher_count * 10:
        ratio_rule_compliant = True
    elif teacher_count > 0 and assistant_count > 0 and cdc.current_enrollment <= teacher_count * 25:
        ratio_rule_compliant = True
    else:
        ratio_rule_compliant = False
    two_trained_adults_available = (
        latest_staff_schedule.two_trained_adults_available
        if latest_staff_schedule
        else trained_adult_count >= 2
    )

    return {
        'report_count': report_count,
        'on_time_rate': round(on_time_rate, 1),
        'completeness_rate': round(completeness_rate, 1),
        'teaching_staff': teaching_staff,
        'has_staff_profile': active_staff_profiles.exists(),
        'qualified_staff_profiles': qualified_staff_profiles,
        'recent_staff_training_count': recent_staff_training_count,
        'supervision_ratio_ok': supervision_ratio_ok,
        'recent_reporting': report_count > 0,
        'program_offered': any([cdc.offers_toddler_care, cdc.offers_preschool]),
        'operating_schedule_documented': bool(cdc.operating_days and cdc.operating_hours),
        'capacity_documented': bool((cdc.max_capacity or 0) > 0 or (cdc.capacity_per_session or 0) > 0),
        'child_profiles_recorded': child_profiles.exists() or enrolled_child_count > 0,
        'guardian_information_recorded': guardian_information_recorded,
        'parent_community_report_submitted': parent_community_report_submitted,
        'current_population_basis_connected': population_metrics is not None,
        'service_gap_analysis_available': gap_analysis is not None,
        'enrollment_within_capacity': cdc.current_enrollment <= (cdc.effective_capacity or cdc.max_capacity or 0) if (cdc.effective_capacity or cdc.max_capacity or 0) else cdc.current_enrollment == 0,
        'curriculum_plan_documented': latest_curriculum_plan is not None,
        'nelf_elds_alignment_documented': bool(
            latest_curriculum_plan
            and (latest_curriculum_plan.nelf_aligned or latest_curriculum_plan.elds_aligned)
        ),
        'daily_schedule_documented': bool(
            latest_curriculum_plan and latest_curriculum_plan.daily_schedule.strip()
        ),
        'authentic_child_assessment_documented': has_child_assessment_record,
        'ratio_rule_compliant': ratio_rule_compliant,
        'two_trained_adults_available': two_trained_adults_available,
        'authority_to_operate': authority_to_operate,
        'authority_document_on_file': authority_document_on_file,
        'permit_record_documented': permit_record_documented,
        'permit_active': permit_active,
        'annual_evaluation_documented': annual_evaluation_documented,
        'supervisory_visit_documented': supervisory_visit_documented,
        'has_child_health_record': has_child_health_record,
        'emergency_readiness_documented': emergency_readiness_documented,
        'first_aid_ready': first_aid_ready,
        'child_protection_documented': child_protection_documented,
        'water_supply_documented': water_supply_documented,
        'sanitation_documented': sanitation_documented,
        'electricity_documented': electricity_documented,
        'space_documented': space_documented,
        'building_type_documented': building_type_documented,
        'interaction_observation_documented': interaction_observation_documented,
        'staff_child_interaction_positive': staff_child_interaction_positive,
        'child_child_interaction_positive': child_child_interaction_positive,
        'fairness_inclusion_observed': fairness_inclusion_observed,
        'independence_support_observed': independence_support_observed,
        'positive_behavior_guidance_observed': positive_behavior_guidance_observed,
        'routines_transitions_supportive': routines_transitions_supportive,
        'assigned_supervision': bool(cdc.assigned_cdw or cdc.contact_person),
        'recent_updates': (timezone.now() - cdc.updated_at).days <= 365 if cdc.updated_at else False,
        'latest_permit_record': latest_permit_record,
    }


def _evaluate_indicator(indicator_key, cdc, context):
    if indicator_key == 'health_services':
        return bool(cdc.has_health_services)
    if indicator_key == 'feeding_program':
        return bool(cdc.has_feeding_program)
    if indicator_key == 'safe_water':
        return bool(cdc.has_water_supply)
    if indicator_key == 'water_supply':
        return bool(context['water_supply_documented'])
    if indicator_key == 'sanitation':
        return bool(context['sanitation_documented'])
    if indicator_key == 'child_health_record_documented':
        return bool(context['has_child_health_record'])
    if indicator_key == 'emergency_readiness_documented':
        return bool(context['emergency_readiness_documented'])
    if indicator_key == 'first_aid_ready':
        return bool(context['first_aid_ready'])
    if indicator_key == 'child_protection_documented':
        return bool(context['child_protection_documented'])
    if indicator_key == 'electricity':
        return bool(context['electricity_documented'])
    if indicator_key == 'space_documented':
        return bool(context['space_documented'])
    if indicator_key == 'building_type':
        return bool(context['building_type_documented'])
    if indicator_key == 'interaction_observation_documented':
        return bool(context['interaction_observation_documented'])
    if indicator_key == 'staff_child_interaction_positive':
        return bool(context['staff_child_interaction_positive'])
    if indicator_key == 'child_child_interaction_positive':
        return bool(context['child_child_interaction_positive'])
    if indicator_key == 'fairness_inclusion_observed':
        return bool(context['fairness_inclusion_observed'])
    if indicator_key == 'independence_support_observed':
        return bool(context['independence_support_observed'])
    if indicator_key == 'positive_behavior_guidance_observed':
        return bool(context['positive_behavior_guidance_observed'])
    if indicator_key == 'routines_transitions_supportive':
        return bool(context['routines_transitions_supportive'])
    if indicator_key == 'assigned_cdw':
        return bool(cdc.assigned_cdw)
    if indicator_key == 'staff_profile_documented':
        return bool(context['has_staff_profile'])
    if indicator_key == 'qualified_staff_documented':
        return bool(context['qualified_staff_profiles'] > 0)
    if indicator_key == 'recent_staff_training_documented':
        return bool(context['recent_staff_training_count'] > 0)
    if indicator_key == 'group_ratio_maximum':
        return bool(context['supervision_ratio_ok'])
    if indicator_key == 'curriculum_plan_documented':
        return bool(context['curriculum_plan_documented'])
    if indicator_key == 'nelf_elds_alignment_documented':
        return bool(context['nelf_elds_alignment_documented'])
    if indicator_key == 'daily_schedule_documented':
        return bool(context['daily_schedule_documented'])
    if indicator_key == 'authentic_child_assessment_documented':
        return bool(context['authentic_child_assessment_documented'])
    if indicator_key == 'ratio_rule_compliant':
        return bool(context['ratio_rule_compliant'])
    if indicator_key == 'two_trained_adults_available':
        return bool(context['two_trained_adults_available'])
    if indicator_key == 'program_offered':
        return bool(context['program_offered'])
    if indicator_key == 'contact_person':
        return bool(cdc.contact_person)
    if indicator_key == 'contact_number':
        return bool(cdc.contact_number)
    if indicator_key == 'volunteers':
        return bool(cdc.volunteers and cdc.volunteers > 0)
    if indicator_key == 'guardian_information_recorded':
        return bool(context['guardian_information_recorded'])
    if indicator_key == 'parent_community_report_submitted':
        return bool(context['parent_community_report_submitted'])
    if indicator_key == 'authority_to_operate':
        return bool(context['authority_to_operate'])
    if indicator_key == 'authority_document_on_file':
        return bool(context['authority_document_on_file'])
    if indicator_key == 'operating_schedule_documented':
        return bool(context['operating_schedule_documented'])
    if indicator_key == 'capacity_documented':
        return bool(context['capacity_documented'])
    if indicator_key == 'assigned_supervision':
        return bool(context['assigned_supervision'])
    if indicator_key == 'annual_evaluation_documented':
        return bool(context['annual_evaluation_documented'])
    if indicator_key == 'supervisory_visit_documented':
        return bool(context['supervisory_visit_documented'])
    if indicator_key == 'permit_record_documented':
        return bool(context['permit_record_documented'])
    if indicator_key == 'permit_active':
        return bool(context['permit_active'])
    if indicator_key == 'accreditation_status':
        return bool(cdc.accreditation_status)
    if indicator_key == 'recent_reporting':
        return bool(context['recent_reporting'])
    if indicator_key == 'child_profiles_recorded':
        return bool(context['child_profiles_recorded'])
    if indicator_key == 'current_population_basis_connected':
        return bool(context['current_population_basis_connected'])
    if indicator_key == 'service_gap_analysis_available':
        return bool(context['service_gap_analysis_available'])
    if indicator_key == 'enrollment_within_capacity':
        return bool(context['enrollment_within_capacity'])
    return None


def _build_indicator_result(indicator, cdc, context):
    value = _evaluate_indicator(indicator['key'], cdc, context)
    if indicator['type'] == 'percent':
        status, gap = _status_for_percent(value or 0, indicator['benchmark'])
        display_value = round(value or 0, 1)
    else:
        status, gap = _status_for_bool(bool(value))
        display_value = bool(value)

    return {
        'key': indicator['key'],
        'label': indicator['label'],
        'benchmark': indicator['benchmark'],
        'value': display_value,
        'status': status,
        'gap': gap,
    }


def _build_area_result(area, cdc, context):
    if not area['indicators']:
        return {
            'key': area['key'],
            'label': area['label'],
            'pdf_pages': area['pdf_pages'],
            'description': area['description'],
            'score': None,
            'meets_count': 0,
            'indicator_count': 0,
            'status': 'data_needed',
            'indicators': [],
            'data_gap_note': area['data_gap_note'],
        }

    indicators = [_build_indicator_result(indicator, cdc, context) for indicator in area['indicators']]
    meets_count = sum(1 for indicator in indicators if indicator['status'] == 'meets')
    indicator_count = len(indicators)
    score = round((meets_count / indicator_count) * 100, 1) if indicator_count else None

    if score is None:
        status = 'data_needed'
    elif score >= 80:
        status = 'meets'
    elif score >= 60:
        status = 'near'
    else:
        status = 'below'

    return {
        'key': area['key'],
        'label': area['label'],
        'pdf_pages': area['pdf_pages'],
        'description': area['description'],
        'score': score,
        'meets_count': meets_count,
        'indicator_count': indicator_count,
        'status': status,
        'indicators': indicators,
        'data_gap_note': area['data_gap_note'],
    }


def _build_cdc_comparison(cdc):
    context = _cdc_context(cdc)
    area_results = [_build_area_result(area, cdc, context) for area in STANDARD_AREAS]
    measurable_areas = [area for area in area_results if area['score'] is not None]
    overall_compliance = round(
        sum(area['score'] for area in measurable_areas) / len(measurable_areas),
        1,
    ) if measurable_areas else 0
    data_coverage = round(
        (len(measurable_areas) / len(STANDARD_AREAS)) * 100,
        1,
    ) if STANDARD_AREAS else 0
    strongest_area = max(measurable_areas, key=lambda area: area['score']) if measurable_areas else None
    weakest_area = min(measurable_areas, key=lambda area: area['score']) if measurable_areas else None

    if overall_compliance >= 80:
        compliance_status = 'meets'
    elif overall_compliance >= 60:
        compliance_status = 'attention'
    else:
        compliance_status = 'critical'

    return {
        'cdc_id': cdc.id,
        'cdc_name': cdc.name,
        'barangay_name': cdc.barangay.name if cdc.barangay else 'Unknown',
        'overall_compliance': overall_compliance,
        'data_coverage': data_coverage,
        'compliance_status': compliance_status,
        'strongest_area': strongest_area,
        'weakest_area': weakest_area,
        'current_enrollment': cdc.current_enrollment,
        'effective_capacity': cdc.effective_capacity,
        'report_on_time': context['on_time_rate'],
        'report_completeness': context['completeness_rate'],
        'authority_to_operate': context['authority_to_operate'],
        'recognition_status': cdc.accreditation_status,
        'permit_status': context['latest_permit_record'].status if context['latest_permit_record'] else cdc.accreditation_status,
        'area_results': area_results,
        'data_gap_areas': [area['label'] for area in area_results if area['status'] == 'data_needed'],
    }


def _aggregate_barangay(barangay, cdc_rows):
    if not cdc_rows:
        return {
            'barangay_name': barangay.name,
            'total_cdcs': 0,
            'average_compliance': 0,
            'average_data_coverage': 0,
            'status': 'No CDCs registered',
            'status_code': 'no_data',
            'strongest_area': None,
            'weakest_area': None,
            'area_details': [],
            'cdc_details': [],
            'compliant_cdcs': 0,
            'at_risk_cdcs': 0,
        }

    average_compliance = round(sum(cdc['overall_compliance'] for cdc in cdc_rows) / len(cdc_rows), 1)
    average_data_coverage = round(sum(cdc['data_coverage'] for cdc in cdc_rows) / len(cdc_rows), 1)

    area_details = []
    for area in STANDARD_AREAS:
        scored = [
            area_result['score']
            for cdc in cdc_rows
            for area_result in cdc['area_results']
            if area_result['key'] == area['key'] and area_result['score'] is not None
        ]
        area_score = round(sum(scored) / len(scored), 1) if scored else None
        if area_score is None:
            status = 'data_needed'
        elif area_score >= 80:
            status = 'meets'
        elif area_score >= 60:
            status = 'near'
        else:
            status = 'below'
        area_details.append({
            'key': area['key'],
            'label': area['label'],
            'pdf_pages': area['pdf_pages'],
            'score': area_score,
            'status': status,
            'data_gap_note': area['data_gap_note'],
        })

    measurable_area_details = [area for area in area_details if area['score'] is not None]
    strongest_area = max(measurable_area_details, key=lambda item: item['score']) if measurable_area_details else None
    weakest_area = min(measurable_area_details, key=lambda item: item['score']) if measurable_area_details else None

    if average_compliance >= 80:
        status = 'Meets national benchmark'
        status_code = 'meets'
    elif average_compliance >= 60:
        status = 'Needs attention against national benchmark'
        status_code = 'attention'
    else:
        status = 'Critical compliance gap'
        status_code = 'critical'

    return {
        'barangay_name': barangay.name,
        'total_cdcs': len(cdc_rows),
        'average_compliance': average_compliance,
        'average_data_coverage': average_data_coverage,
        'status': status,
        'status_code': status_code,
        'strongest_area': strongest_area,
        'weakest_area': weakest_area,
        'area_details': area_details,
        'cdc_details': cdc_rows,
        'compliant_cdcs': sum(1 for cdc in cdc_rows if cdc['overall_compliance'] >= 80),
        'at_risk_cdcs': sum(1 for cdc in cdc_rows if cdc['overall_compliance'] < 60),
    }


@api_view(['GET'])
def benchmark_comparison(request):
    barangays = list(Barangay.objects.all().order_by('name'))
    centers = CDC.objects.select_related('barangay').all()
    if request.user.role == 'cdw':
        centers = centers.filter(assigned_cdw=request.user)
    cdc_rows = [_build_cdc_comparison(cdc) for cdc in centers]

    barangay_comparison = []
    for barangay in barangays:
        rows = [cdc for cdc in cdc_rows if cdc['barangay_name'] == barangay.name]
        barangay_comparison.append(_aggregate_barangay(barangay, rows))

    ranked_barangays = sorted(
        barangay_comparison,
        key=lambda row: (row['average_compliance'], row['compliant_cdcs'], row['total_cdcs']),
        reverse=True,
    )

    measurable_cdc_rows = [row for row in cdc_rows if row['overall_compliance'] is not None]
    average_cdc_compliance = round(
        sum(row['overall_compliance'] for row in measurable_cdc_rows) / len(measurable_cdc_rows),
        1,
    ) if measurable_cdc_rows else 0

    area_summary = []
    for area in STANDARD_AREAS:
        scores = []
        for cdc in cdc_rows:
            for area_result in cdc['area_results']:
                if area_result['key'] == area['key'] and area_result['score'] is not None:
                    scores.append(area_result['score'])
        average_score = round(sum(scores) / len(scores), 1) if scores else None
        area_summary.append({
            'key': area['key'],
            'label': area['label'],
            'pdf_pages': area['pdf_pages'],
            'average_score': average_score,
            'cdc_meeting_standard': sum(1 for score in scores if score >= 80),
            'cdc_count_with_data': len(scores),
            'measurable_indicator_count': len(area['indicators']),
            'data_gap_note': area['data_gap_note'],
        })

    weakest_area = min(
        [item for item in area_summary if item['average_score'] is not None],
        key=lambda item: item['average_score'],
        default=None,
    )

    return Response({
        'national_standard_reference': {
            'title': 'Standards and Guidelines for Center-Based Early Childhood Programs for 0 to 4 Years Old Filipino Children',
            'issuing_body': 'ECCD Council',
            'approval_date': 'September 10, 2015',
            'source_file_name': 'STANDARDS-AND-GUIDELINES-for-CENTER-BASED-FOR-ECCD-PROGRAMS-1.pdf',
            'areas': [
                {
                    'key': area['key'],
                    'label': area['label'],
                    'pdf_pages': area['pdf_pages'],
                    'description': area['description'],
                    'measurable_indicator_count': len(area['indicators']),
                    'data_gap_note': area['data_gap_note'],
                }
                for area in STANDARD_AREAS
            ],
        },
        'overview': {
            'total_barangays': len(barangay_comparison),
            'total_cdcs_assessed': len(cdc_rows),
            'average_cdc_compliance': average_cdc_compliance,
            'barangays_with_data': sum(1 for row in ranked_barangays if row['total_cdcs'] > 0),
            'barangays_meeting_all_standards': sum(1 for row in ranked_barangays if row['status_code'] == 'meets'),
            'barangays_needing_attention': sum(1 for row in ranked_barangays if row['status_code'] in ['attention', 'critical']),
            'top_barangay': ranked_barangays[0] if ranked_barangays else None,
            'most_at_risk_barangay': min(
                [row for row in ranked_barangays if row['status_code'] != 'no_data'],
                key=lambda row: (row['average_compliance'], row['compliant_cdcs']),
                default=None,
            ),
            'weakest_system_area': weakest_area,
        },
        'area_summary': area_summary,
        'barangay_comparison': ranked_barangays,
        'cdc_comparison': sorted(cdc_rows, key=lambda row: row['overall_compliance']),
    })
