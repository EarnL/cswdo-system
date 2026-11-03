from core.permissions import OfficeAnalyticsPermission
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from core.models import AcademicYear, Barangay, BarangayPopulationMetrics, CDC, Child, ChildrenGapAnalysis, SNPPlanningRecommendation
from core.services.map_basis_service import shared_map_rows, population_source


def _date_or_none(value):
    return value.isoformat() if value else None


def _population_payload(metrics):
    if not metrics:
        return {
            "has_population_data": False,
            "source": None,
            "total_population": 0,
            "children_3_5": 0,
            "children_6_12": 0,
            "adolescents_13_17": 0,
            "children_3_4": 0,
            "male_population": 0,
            "female_population": 0,
            "single_parent_households": 0,
            "children_with_disabilities": 0,
            "working_children": 0,
            "vulnerable_children": 0,
            "data_quality_score": 0,
            "last_updated": None,
        }

    source = metrics.source_submission
    return {
        "has_population_data": True,
        "source": {
            "id": source.id if source else None,
            "title": source.title if source else "Manual / existing data",
            "status": source.status if source else None,
            "submitted_on": _date_or_none(source.submitted_on) if source else None,
            "sent_to_cswdo_on": _date_or_none(source.sent_to_cswdo_on) if source else None,
            "received_by_cswdo_on": _date_or_none(source.received_by_cswdo_on) if source else None,
        },
        "total_population": metrics.total_population,
        "children_3_5": metrics.children_3_5,
        "children_6_12": metrics.children_6_12,
        "adolescents_13_17": metrics.adolescents_13_17,
        "children_3_4": None,  # Filled from the period-specific shared basis below.
        "male_population": metrics.male_population,
        "female_population": metrics.female_population,
        "single_parent_households": metrics.single_parent_households,
        "children_with_disabilities": metrics.children_with_disabilities,
        "working_children": metrics.working_children,
        "vulnerable_children": metrics.vulnerable_children_count,
        "data_quality_score": metrics.data_quality_score,
        "last_updated": _date_or_none(metrics.last_updated),
    }


def _priority_label(need_score, public_cdc_gap_3_4, vulnerable_gap, enrollment_rate_0_5):
    if need_score >= 70 or public_cdc_gap_3_4 >= 75 or vulnerable_gap >= 25 or (enrollment_rate_0_5 and enrollment_rate_0_5 < 30):
        return "High priority underserved area"
    if need_score >= 35 or public_cdc_gap_3_4 >= 25 or vulnerable_gap > 0:
        return "Watchlist underserved area"
    return "Adequately covered / monitor"


def _cdc_load_label(status):
    if status == "service_gap":
        return "CDC Capacity Exceeded"
    if status == "near_capacity":
        return "CDC Approaching Capacity"
    return "CDC Within Capacity"


def _bounded_percent(value):
    return round(max(0, min(100, float(value or 0))), 1)


def _sessions_needed(enrollment, capacity_per_session):
    if not enrollment:
        return 0
    divisor = capacity_per_session or 1
    return -(-enrollment // divisor)


def _metrics_for_analytics(barangay_ids, academic_year):
    return BarangayPopulationMetrics.objects.select_related('source_submission', 'academic_year', 'barangay').filter(
        barangay_id__in=barangay_ids,
        academic_year=academic_year,
        source_submission__status='current_basis',
        children_3_4__isnull=False,
    )


def _gaps_for_metrics(metric_ids, academic_year):
    return ChildrenGapAnalysis.objects.select_related('population_metrics', 'academic_year').filter(
        academic_year=academic_year,
        population_metrics_id__in=metric_ids,
    )


def _snp_candidates_payload(barangay, academic_year):
    if not barangay:
        return {
            "count": 0,
            "children": [],
        }

    candidates = (
        Child.objects.filter(
            barangay=barangay,
            academic_year=academic_year,
            cdc__isnull=True,
            current_status='not_enrolled',
        )
        .filter(Q(population_memberships__submission__status='current_basis') | Q(population_source_submission__status='current_basis'))
        .distinct()
        .order_by('name', 'id')
    )

    eligible = []
    for child in candidates:
        age = child.age_for_academic_year(academic_year)
        if 3 <= age <= 4:
            eligible.append((child, age))

    return {
        "count": len(eligible),
        "children": [
            {
                "id": child.id,
                "name": child.name,
                "age": age,
                "sex": child.sex,
                "guardian_name": child.guardian_name or child.mother_name or child.father_name or "",
                "contact_number": child.contact_number,
                "address": child.complete_address,
                "population_source_title": child.population_source_submission.title if child.population_source_submission else "",
            }
            for child, age in eligible[:12]
        ],
    }

@api_view(['GET'])
@permission_classes([OfficeAnalyticsPermission])
def heatmap_data(request):
    if request.user.role not in ['admin', 'staff', 'planning', 'city_planning']:
        return Response({'detail': 'This map is available to CSWDO and City Planning staff.'}, status=403)
    academic_year_id = request.query_params.get('academic_year')
    if academic_year_id:
        academic_year = AcademicYear.objects.filter(id=academic_year_id).first() or AcademicYear.get_current()
    else:
        academic_year = AcademicYear.get_current()

    shared_rows = {row['barangay']['id']: row for row in shared_map_rows(academic_year)}
    data = CDC.objects.select_related('barangay').prefetch_related('staff_schedules', 'staff_profiles', 'performance_set').all()
    barangay_ids = [cdc.barangay_id for cdc in data if cdc.barangay_id]
    metric_rows = list(_metrics_for_analytics(barangay_ids, academic_year))
    metric_ids = [item.id for item in metric_rows]
    metrics_by_barangay = {item.barangay_id: item for item in metric_rows}
    gaps_by_barangay = {
        item.barangay_id: item
        for item in _gaps_for_metrics(metric_ids, academic_year)
    }
    snp_by_barangay = {
        item.barangay_id: item
        for item in SNPPlanningRecommendation.objects.filter(
            barangay_id__in=barangay_ids,
            academic_year=academic_year,
            gap_analysis__population_metrics__source_submission__status='current_basis',
            gap_analysis__population_metrics__children_3_4__isnull=False,
        )
    }
    enrollment_by_cdc = {}
    for child in Child.objects.filter(
        academic_year=academic_year,
        cdc__isnull=False,
        current_status='enrolled',
    ).select_related('cdc'):
        if not child.is_daycare_eligible(academic_year):
            continue
        enrollment_by_cdc[child.cdc_id] = enrollment_by_cdc.get(child.cdc_id, 0) + 1

    result = []
    for cdc in data:
        shared = shared_rows.get(cdc.barangay_id)
        gap_analysis = gaps_by_barangay.get(cdc.barangay_id)
        population_metrics = metrics_by_barangay.get(cdc.barangay_id)
        snp_recommendation = snp_by_barangay.get(cdc.barangay_id)
        max_capacity = cdc.max_capacity or 0
        session_capacity = cdc.capacity_per_session or max_capacity or 1
        sessions_per_day = cdc.sessions_per_day or 1
        effective_capacity = cdc.effective_capacity or max_capacity or 1
        enrollment = enrollment_by_cdc.get(cdc.id, 0)
        sessions_needed = _sessions_needed(enrollment, session_capacity)
        service_gap_exists = sessions_needed > sessions_per_day
        raw_utilization = (enrollment / effective_capacity) * 100 if effective_capacity > 0 else 0
        utilization = _bounded_percent(raw_utilization)
        latest_schedule = cdc.staff_schedules.first()
        teacher_count = latest_schedule.teacher_count if latest_schedule else cdc.staff_profiles.filter(
            employment_status='active',
            is_primary_caregiver=True,
        ).count()
        assistant_count = latest_schedule.assistant_count if latest_schedule else cdc.staff_profiles.filter(
            employment_status='active',
            role_type='assistant',
        ).count()
        if enrollment == 0:
            teacher_ratio_compliant = True
        elif teacher_count > 0 and enrollment <= teacher_count * 10:
            teacher_ratio_compliant = True
        elif teacher_count > 0 and assistant_count > 0 and enrollment <= teacher_count * 25:
            teacher_ratio_compliant = True
        else:
            teacher_ratio_compliant = False
        children_per_teacher = round(enrollment / teacher_count, 1) if teacher_count else None
        enrollment_gap_0_5 = gap_analysis.total_gap_0_5 if gap_analysis else 0
        public_cdc_gap_3_4 = gap_analysis.public_cdc_gap_children_3_4 if gap_analysis else 0
        vulnerable_gap = gap_analysis.vulnerable_children_unenrolled if gap_analysis else 0
        working_children_gap = gap_analysis.working_children_unenrolled if gap_analysis else 0
        enrollment_rate_0_5 = gap_analysis.enrollment_rate_0_5 if gap_analysis else 0
        population_children_0_5 = population_metrics.total_children_0_5 if population_metrics else 0
        cdc_coverage_rate_0_5 = (
            round((enrollment / population_children_0_5) * 100, 2)
            if population_children_0_5 > 0
            else enrollment_rate_0_5
        )
        population_children_3_4 = shared['population']['children_3_4'] if shared else None
        public_cdc_enrollment_3_4 = shared['public_cdc']['enrollment_3_4'] if shared else 0
        public_cdc_gap_3_4 = (shared['public_cdc']['gap_3_4'] or 0) if shared else 0

        need_score = (
            min(public_cdc_gap_3_4, 120) * 0.45
            + min(enrollment_gap_0_5, 160) * 0.30
            + min(vulnerable_gap, 80) * 0.20
            + min(working_children_gap, 40) * 0.05
        )
        need_score = (shared['service_signal']['need_score'] or 0) if shared else 0

        if need_score >= 70:
            need_level = "critical"
        elif need_score >= 35:
            need_level = "elevated"
        else:
            need_level = "watch"

        if service_gap_exists:
            status = "service_gap"
        elif utilization >= 85:
            status = "near_capacity"
        else:
            status = "stable"
        
        priority_label = shared['service_signal']['label'] if shared else 'No validated population data'
        recommended_snp_enrollment = snp_recommendation.recommended_snp_enrollment if snp_recommendation else 0
        recommended_budget = float(snp_recommendation.total_budget_needed) if snp_recommendation and recommended_snp_enrollment > 0 else 0
        snp_candidates = _snp_candidates_payload(cdc.barangay, academic_year)
        if request.user.role in ['planning', 'city_planning']:
            # City Planning monitors aggregate need; person-level follow-up stays with operational users.
            snp_candidates = {**snp_candidates, 'children': []}
        latest_performance = cdc.performance_set.order_by('-evaluated_at').first()
        facility_resources = {
            "building_type": cdc.get_building_type_display() if cdc.building_type else "",
            "total_area": cdc.total_area,
            "has_water_supply": cdc.has_water_supply,
            "has_sanitation": cdc.has_sanitation,
            "has_electricity": cdc.has_electricity,
            "has_feeding_program": cdc.has_feeding_program,
            "has_health_services": cdc.has_health_services,
            "offers_toddler_care": cdc.offers_toddler_care,
            "offers_preschool": cdc.offers_preschool,
            "total_staff": cdc.total_staff,
            "qualified_caregivers": cdc.qualified_caregivers,
            "volunteers": cdc.volunteers,
        }
        performance_payload = {
            "overall_score": latest_performance.overall_score if latest_performance else None,
            "performance_score": latest_performance.performance_score if latest_performance else None,
            "completeness_score": latest_performance.completeness_score if latest_performance else None,
            "submission_score": latest_performance.submission_score if latest_performance else None,
            "rating": latest_performance.rating if latest_performance else "Not rated",
            "reward": latest_performance.reward if latest_performance else "",
            "evaluated_at": _date_or_none(latest_performance.evaluated_at) if latest_performance else None,
        }

        result.append({
            "id": cdc.id,
            "academic_year": {"id": academic_year.id, "name": academic_year.name},
            "name": cdc.name,
            "barangay": cdc.barangay.name if cdc.barangay else "Unknown",
            "address": cdc.address,
            "contact_person": cdc.contact_person,
            "contact_number": cdc.contact_number,
            "email": cdc.email,
            "operating_days": cdc.operating_days,
            "operating_hours": cdc.operating_hours,
            "assigned_cdw": cdc.assigned_cdw.username if cdc.assigned_cdw else "",
            "lat": cdc.latitude,
            "lng": cdc.longitude,
            "enrollment": enrollment,
            "capacity": max_capacity,
            "capacity_per_session": session_capacity,
            "sessions_per_day": sessions_per_day,
            "effective_capacity": effective_capacity,
            "sessions_needed": sessions_needed,
            "available_slots": max(effective_capacity - enrollment, 0),
            "excess_children": max(enrollment - effective_capacity, 0),
            "utilization": utilization,
            "teacher_count": teacher_count,
            "assistant_count": assistant_count,
            "children_per_teacher": children_per_teacher,
            "teacher_ratio_compliant": teacher_ratio_compliant,
            "teacher_ratio_status": "Compliant" if teacher_ratio_compliant else "Overpopulated",
            "facility_resources": facility_resources,
            "performance_metrics": performance_payload,
            "accreditation": {
                "status": cdc.accreditation_status,
                "is_accredited": cdc.is_accredited,
                "license_number": cdc.license_number,
                "license_expiry_date": _date_or_none(cdc.license_expiry_date),
            },
            "status": status,
            "status_label": _cdc_load_label(status),
            "can_accommodate_all": not service_gap_exists,
            "barangay_gap": {
                "total_gap_0_5": enrollment_gap_0_5,
                "gap_3_4": gap_analysis.gap_3_4 if gap_analysis else 0,
                "gap_6_12": gap_analysis.gap_6_12 if gap_analysis else 0,
                "population_children_3_4": population_children_3_4,
                "public_cdc_enrollment_3_4": public_cdc_enrollment_3_4,
                "public_cdc_gap_3_4": public_cdc_gap_3_4,
                "vulnerable_unenrolled": vulnerable_gap,
                "working_children_unenrolled": working_children_gap,
                "enrollment_rate_0_5": enrollment_rate_0_5,
                "cdc_coverage_rate_0_5": cdc_coverage_rate_0_5,
                "cdc_has_service_gap": gap_analysis.cdc_has_service_gap if gap_analysis else False,
            },
            "shared_basis": shared,
            "barangay_population": {
                **_population_payload(population_metrics),
                'source': population_source(population_metrics.source_submission if population_metrics else None),
                'children_3_4': shared['population']['children_3_4'] if shared else None,
            },
            "underserved_indicators": {
                "priority_label": priority_label,
                "need_score": need_score,
                "need_level": need_level,
                "population_data_connected": bool(population_metrics),
                "public_cdc_gap_3_4": public_cdc_gap_3_4,
                "total_gap_0_5": enrollment_gap_0_5,
                "vulnerable_unenrolled": vulnerable_gap,
                "working_children_unenrolled": working_children_gap,
                "enrollment_rate_0_5": enrollment_rate_0_5,
                "cdc_coverage_rate_0_5": cdc_coverage_rate_0_5,
                "recommended_snp_enrollment": recommended_snp_enrollment,
                "recommended_budget": recommended_budget,
                "named_snp_candidates_count": snp_candidates["count"],
                "named_snp_candidates": snp_candidates["children"],
                "status_notes": [
                    "Population data is integrated from CHO -> City Planning -> CSWDO." if population_metrics else "No integrated population submission has reached CSWDO for this barangay yet.",
                    "High public CDC gap for ages 3-4." if public_cdc_gap_3_4 >= 25 else "Public CDC age 3-4 gap is currently manageable.",
                    "Vulnerable children need targeted follow-up." if vulnerable_gap > 0 or working_children_gap > 0 else "No vulnerable-child gap recorded from latest integrated data.",
                ],
            },
            "need_score": need_score,
            "need_level": need_level,
        })

    return Response(result)


def _public_priority_label(need_score, public_cdc_gap_3_4, has_population_data):
    if not has_population_data:
        return "No current population basis"
    if need_score >= 70 or public_cdc_gap_3_4 >= 75:
        return "High public service need"
    if need_score >= 35 or public_cdc_gap_3_4 >= 25:
        return "Monitor public service need"
    return "Public coverage manageable"


@api_view(['GET'])
@permission_classes([AllowAny])
def public_map_data(request):
    academic_year_id = request.query_params.get('academic_year')
    if academic_year_id:
        academic_year = AcademicYear.objects.filter(id=academic_year_id).first() or AcademicYear.get_current()
    else:
        academic_year = AcademicYear.get_current()

    return Response(shared_map_rows(academic_year))
