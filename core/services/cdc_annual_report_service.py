from collections import Counter
from types import SimpleNamespace
from core.services.population_basis_service import basis_for, working_year
from core.models import PopulationBasisSnapshot

from django.db.models import Count, Sum
from django.utils import timezone

from core.models import (
    AcademicYear,
    Child,
    ChildrenGapAnalysis,
    EnrollmentData,
    FeedingProgram,
    Report,
)
from core.services.data_integration_service import DataIntegrationService


class CDCAnnualReportService:
    """Builds a CDC annual report payload from records already stored in the system."""

    @staticmethod
    def build_payload(cdc, year=None, academic_year=None):
        academic_year = academic_year or working_year(cdc)
        year = int(year or timezone.localdate().year)

        children_qs = Child.objects.filter(cdc=cdc, academic_year=academic_year)
        enrolled_children = children_qs.filter(current_status='enrolled')
        enrollment = sum(child.is_daycare_eligible(academic_year) for child in enrolled_children)
        capacity = int(getattr(cdc, 'effective_capacity', 0) or cdc.max_capacity or 0)
        utilization = CDCAnnualReportService._percent(enrollment, capacity)

        child_statuses = dict(children_qs.values_list('current_status').annotate(total=Count('id')))
        sex_counts = dict(children_qs.values_list('sex').annotate(total=Count('id')))
        age_counts = Counter()
        for child in children_qs:
            age = child.age_for_academic_year(academic_year)
            if age == 3:
                age_counts['3'] += 1
            elif age == 4:
                age_counts['4'] += 1
            else:
                age_counts['outside_daycare_age'] += 1

        population_metrics = CDCAnnualReportService._latest_population_metrics(cdc, academic_year)
        enrollment_data = CDCAnnualReportService._latest_enrollment_data(cdc, academic_year)
        gap_analysis = CDCAnnualReportService._latest_gap_analysis(cdc, academic_year)

        reports_qs = Report.objects.filter(cdc=cdc, academic_year=academic_year)
        prior_reports = reports_qs.exclude(report_type='cdc_annual_report')
        report_counts = dict(prior_reports.values_list('report_type').annotate(total=Count('id')))
        reviewed_reports = prior_reports.filter(
            status__in=['verified_by_staff', 'forwarded_to_admin', 'approved'],
        ).count()

        feeding_qs = FeedingProgram.objects.filter(cdc=cdc)
        feeding_days = CDCAnnualReportService._related_count(feeding_qs, 'feeding_days')
        feeding_served = CDCAnnualReportService._related_sum(feeding_qs, 'feeding_days__beneficiaries_served')

        staff_count = CDCAnnualReportService._count(cdc, 'staff_profiles')
        active_staff_count = CDCAnnualReportService._count(cdc, 'staff_profiles', employment_status='active')
        qualified_staff = CDCAnnualReportService._count(cdc, 'staff_profiles', is_qualified=True)
        training_count = CDCAnnualReportService._count(cdc, 'staff_training_records')
        health_records = CDCAnnualReportService._count(cdc, 'child_health_records')
        emergency_records = CDCAnnualReportService._count(cdc, 'emergency_readiness_records')
        safety_incidents = CDCAnnualReportService._count(cdc, 'safety_incidents')
        protection_records = CDCAnnualReportService._count(cdc, 'child_protection_records')
        curriculum_plans = CDCAnnualReportService._count(cdc, 'curriculum_plans')
        assessment_records = CDCAnnualReportService._count(cdc, 'child_assessment_records')
        physical_assessments = CDCAnnualReportService._count(cdc, 'physical_environment_assessments')
        interaction_observations = CDCAnnualReportService._count(cdc, 'interaction_observations')

        compliance_records = {
            'authority_documents': CDCAnnualReportService._count(cdc, 'authority_documents'),
            'permit_records': CDCAnnualReportService._count(cdc, 'permit_records'),
            'annual_evaluations': CDCAnnualReportService._count(cdc, 'annual_evaluations'),
            'supervisory_visits': CDCAnnualReportService._count(cdc, 'supervisory_visits'),
        }

        population_3_4 = CDCAnnualReportService._metric_value(gap_analysis, 'population_children_3_4')
        barangay_coverage = CDCAnnualReportService._percent(enrollment, population_3_4)
        public_gap = CDCAnnualReportService._metric_value(gap_analysis, 'public_cdc_gap_children_3_4')
        vulnerable_gap = CDCAnnualReportService._metric_value(gap_analysis, 'vulnerable_children_unenrolled')

        health_score = CDCAnnualReportService._percent(
            min(health_records, enrollment) + emergency_records + protection_records,
            max(enrollment, 1) + 2,
        )
        curriculum_score = CDCAnnualReportService._percent(curriculum_plans + assessment_records, max(enrollment, 1) + 1)
        facility_score = CDCAnnualReportService._percent(
            int(bool(cdc.has_water_supply)) + int(bool(cdc.has_sanitation)) + int(bool(cdc.has_electricity)) + physical_assessments,
            4,
        )
        compliance_score = CDCAnnualReportService._percent(sum(compliance_records.values()) + int(cdc.is_accredited), 5)
        staffing_score = CDCAnnualReportService._percent(qualified_staff + training_count, max(active_staff_count, 1) + 1)

        data_basis = CDCAnnualReportService._data_basis(population_metrics, enrollment_data, academic_year)
        auto_metrics = {
            'enrollment': enrollment,
            'capacity': capacity,
            'utilization': utilization,
            'teacherCount': active_staff_count or staff_count or int(cdc.total_staff or 0),
            'childrenPerTeacher': round(enrollment / max(active_staff_count or staff_count or cdc.total_staff or 1, 1), 1),
            'population': population_3_4,
            'servedVsPopulation': barangay_coverage,
            'publicGap': public_gap,
            'vulnerableGap': vulnerable_gap,
            'healthRecords': health_records,
            'safetyIncidents': safety_incidents,
            'healthScore': health_score,
            'curriculumPlans': curriculum_plans,
            'childAssessmentRecords': assessment_records,
            'curriculumScore': curriculum_score,
            'facilityScore': facility_score,
            'complianceScore': compliance_score,
            'staffingScore': staffing_score,
            'staffTrainingRecords': training_count,
            'feedingPrograms': feeding_qs.count(),
            'feedingDays': feeding_days,
            'feedingBeneficiariesServed': feeding_served,
            'reportsSubmitted': prior_reports.count(),
            'approvedReports': reviewed_reports,
            'overcrowded': capacity > 0 and enrollment > capacity,
        }

        auto_tables = {
            'cdc_information': [
                ['CDC Name', cdc.name],
                ['Barangay', getattr(cdc.barangay, 'name', 'Not encoded')],
                ['Address', cdc.address or 'Not encoded'],
                ['Assigned CDW', getattr(cdc.assigned_cdw, 'username', 'Not assigned')],
                ['Contact Person', cdc.contact_person or 'Not encoded'],
                ['Contact Number', cdc.contact_number or 'Not encoded'],
                ['Operating Days', cdc.operating_days or 'Not encoded'],
                ['Operating Hours', cdc.operating_hours or 'Not encoded'],
                ['Establishment Date', cdc.establishment_date.isoformat() if cdc.establishment_date else 'Not encoded'],
                ['Sessions per Day', cdc.sessions_per_day],
                ['Capacity per Session', cdc.capacity_per_session],
                ['Total Center Capacity', capacity],
            ],
            'population_and_enrollment': [
                ['Current Population Basis', data_basis['population_basis']],
                ['Barangay Children 3-4', population_3_4],
                ['Current CDC Enrollment', enrollment],
                ['Barangay Coverage', f'{barangay_coverage:.1f}%'],
                ['Public CDC Gap Ages 3-4', public_gap],
                ['Vulnerable Unenrolled Children', vulnerable_gap],
                ['Enrollment Data Basis', data_basis['enrollment_basis']],
            ],
            'children_profile': [
                ['Total Child Records', children_qs.count()],
                ['Enrolled', child_statuses.get('enrolled', 0)],
                ['Not Enrolled', child_statuses.get('not_enrolled', 0)],
                ['Graduated', child_statuses.get('graduated', 0)],
                ['Transferred / Dropped / Aged Out', sum(child_statuses.get(key, 0) for key in ['transferred', 'dropped', 'aged_out'])],
                ['Male', sex_counts.get('male', 0)],
                ['Female', sex_counts.get('female', 0)],
                ['Pre-K1 Age 3', age_counts['3']],
                ['Pre-K2 Age 4', age_counts['4']],
                ['Outside daycare ages 3-4 (historical records)', age_counts['outside_daycare_age']],
                ['Children With Special Needs', children_qs.filter(is_special_needs=True).count()],
            ],
            'operations_and_programs': [
                ['Feeding Programs', feeding_qs.count()],
                ['Recorded Feeding Days', feeding_days],
                ['Beneficiaries Served', feeding_served],
                ['Health Records', health_records],
                ['Emergency Readiness Records', emergency_records],
                ['Safety Incidents', safety_incidents],
                ['Child Protection Records', protection_records],
                ['Curriculum Plans', curriculum_plans],
                ['Child Assessment Records', assessment_records],
                ['Interaction Observations', interaction_observations],
            ],
            'staffing_and_compliance': [
                ['Staff Profiles', staff_count],
                ['Active Staff', active_staff_count],
                ['Qualified Staff', qualified_staff],
                ['Training Records', training_count],
                ['Authority Documents', compliance_records['authority_documents']],
                ['Permit Records', compliance_records['permit_records']],
                ['Annual Evaluations', compliance_records['annual_evaluations']],
                ['Supervisory Visits', compliance_records['supervisory_visits']],
                ['Accreditation Status', cdc.get_accreditation_status_display()],
            ],
            'submitted_records': [
                ['Submitted CDC/CDW Reports', prior_reports.count()],
                ['Reviewed / Approved Reports', reviewed_reports],
                ['Monthly CDC Reports', report_counts.get('cdc_monthly_report', 0)],
                ['Quarterly CDC Reports', report_counts.get('cdc_quarterly_report', 0)],
                ['General Form 6 Reports', report_counts.get('form6', 0)],
                ['General Form 7 Reports', report_counts.get('form7', 0)],
            ],
        }

        sections = CDCAnnualReportService._sections(cdc, auto_metrics, auto_tables, data_basis)
        evidence = CDCAnnualReportService._evidence(cdc)

        return {
            'generated_summary_report': True,
            'daycare_age_range': [3, 4],
            'generated_at': timezone.now().isoformat(),
            'data_basis': data_basis,
            'period': {
                'period_type': 'annual',
                'month': 0,
                'quarter': 4,
                'year': year,
                'label': f'Annual {year}',
            },
            'report_mode': 'annual',
            'narratives': {},
            'evidence': evidence,
            'auto_calculated': auto_metrics,
            'auto_tables': auto_tables,
            'charts': [
                {'label': 'Capacity Utilization', 'value': utilization},
                {'label': 'Barangay Coverage', 'value': barangay_coverage},
                {'label': 'Health and Safety Readiness', 'value': health_score},
                {'label': 'Curriculum Readiness', 'value': curriculum_score},
                {'label': 'Facility Readiness', 'value': facility_score},
                {'label': 'Compliance Readiness', 'value': compliance_score},
                {'label': 'Staffing Readiness', 'value': staffing_score},
            ],
            'template_sections': sections,
        }

    @staticmethod
    def _sections(cdc, metrics, tables, data_basis):
        summary = (
            f"{cdc.name} recorded {metrics['enrollment']} current enrollee(s), "
            f"{metrics['reportsSubmitted']} submitted CDC/CDW report file(s), "
            f"{metrics['feedingPrograms']} feeding program record(s), and "
            f"{metrics['healthRecords']} child health record(s). The report uses {data_basis['population_basis'].lower()}."
        )
        capacity_note = (
            'Enrollment is above the encoded total center capacity and should be reviewed for scheduling, staffing, or facility action.'
            if metrics['overcrowded']
            else 'Enrollment is within the encoded total center capacity.'
        )

        return [
            {
                'key': 'executive_summary',
                'title': 'Executive Summary',
                'autoText': summary,
                'notes': summary,
                'table': [],
            },
            {
                'key': 'cdc_profile',
                'title': 'CDC Profile and Operations',
                'autoText': 'Basic center information, operating schedule, session capacity, and assigned personnel are taken from the CDC profile.',
                'notes': 'This section summarizes the official CDC profile stored in the system.',
                'table': tables['cdc_information'],
            },
            {
                'key': 'population_enrollment',
                'title': 'Population, Enrollment, and Coverage',
                'autoText': f"{metrics['enrollment']} enrolled child(ren), {metrics['population']} barangay child population basis, and {metrics['publicGap']} public CDC service gap count.",
                'notes': f"{capacity_note} Barangay coverage is calculated against the latest available population basis forwarded to CSWDO.",
                'table': tables['population_and_enrollment'],
            },
            {
                'key': 'children_profile',
                'title': 'Children and Enrollment Records',
                'autoText': 'Child counts are generated from the current academic year child records linked to this CDC.',
                'notes': 'Named child details remain in the system records; this report uses aggregate counts for readability.',
                'table': tables['children_profile'],
            },
            {
                'key': 'health_nutrition_safety',
                'title': 'Health, Nutrition, and Safety',
                'autoText': f"{metrics['healthRecords']} health record(s), {metrics['feedingPrograms']} feeding program(s), and {metrics['safetyIncidents']} safety incident(s) are linked to this CDC.",
                'notes': 'Health, nutrition, emergency readiness, and child protection information is summarized from encoded monitoring records.',
                'table': tables['operations_and_programs'],
            },
            {
                'key': 'learning_development',
                'title': 'Learning and Child Development',
                'autoText': f"{metrics['curriculumPlans']} curriculum plan(s) and {metrics['childAssessmentRecords']} assessment record(s) are available for this CDC.",
                'notes': 'Learning implementation is summarized from curriculum, assessment, and interaction observation records.',
                'table': [],
            },
            {
                'key': 'staffing_compliance',
                'title': 'Staffing, Compliance, and Readiness',
                'autoText': f"{metrics['teacherCount']} active/encoded staff member(s), {metrics['staffTrainingRecords']} training record(s), and compliance readiness of {metrics['complianceScore']:.1f}%.",
                'notes': 'This section brings together staff profiles, staff development records, accreditation status, and compliance monitoring files.',
                'table': tables['staffing_and_compliance'],
            },
            {
                'key': 'submitted_records',
                'title': 'Submitted Forms and Reports',
                'autoText': f"{metrics['approvedReports']} submitted report(s) are verified, forwarded, or approved by CSWDO.",
                'notes': 'Generated annual reports are summary records only and do not require approve, reject, or revision processing.',
                'table': tables['submitted_records'],
            },
            {
                'key': 'recommendations',
                'title': 'System Summary and Next Steps',
                'autoText': f"Key signals: {metrics['utilization']:.1f}% capacity utilization, {metrics['servedVsPopulation']:.1f}% barangay coverage, and {metrics['publicGap']} public CDC gap count.",
                'notes': CDCAnnualReportService._recommendation_text(metrics),
                'table': [],
            },
        ]

    @staticmethod
    def _recommendation_text(metrics):
        notes = []
        if metrics['overcrowded']:
            notes.append('Review session scheduling, room capacity, staffing, or expansion options.')
        if metrics['publicGap'] > 0:
            notes.append('Use the public CDC gap count for planning outreach and service expansion.')
        if metrics['healthScore'] < 70:
            notes.append('Prioritize updating health, safety, emergency readiness, and child protection records.')
        if metrics['curriculumScore'] < 70:
            notes.append('Update curriculum plans and child assessment records for a stronger development record.')
        if not notes:
            notes.append('Continue regular record updating and monitoring based on current CSWDO data.')
        return ' '.join(notes)

    @staticmethod
    def _latest_population_metrics(cdc, academic_year):
        if not cdc.barangay_id:
            return None
        basis = basis_for(cdc, academic_year)
        if basis:
            snapshot = PopulationBasisSnapshot.objects.filter(submission=basis.submission).first()
            figures = snapshot.barangays.get(str(cdc.barangay_id), {}) if snapshot else {}
            return SimpleNamespace(source_submission=basis.submission, children_3_4=figures.get('population'), last_updated=basis.applied_at)
        if cdc.assigned_cdw_id:
            return None
        return DataIntegrationService.get_current_population_metrics(cdc.barangay, academic_year)

    @staticmethod
    def _latest_enrollment_data(cdc, academic_year):
        qs = EnrollmentData.objects.filter(barangay=cdc.barangay)
        if academic_year:
            current = qs.filter(academic_year=academic_year).first()
            if current:
                return current
        return qs.order_by('-last_updated').first()

    @staticmethod
    def _latest_gap_analysis(cdc, academic_year):
        if not cdc.barangay_id:
            return None
        basis = basis_for(cdc, academic_year)
        if basis:
            snapshot = PopulationBasisSnapshot.objects.filter(submission=basis.submission).first()
            figures = snapshot.barangays.get(str(cdc.barangay_id), {}) if snapshot else {}
            enrolled = sum(child.is_daycare_eligible(academic_year) for child in Child.objects.filter(
                barangay_id=cdc.barangay_id, academic_year=academic_year, cdc__isnull=False, current_status='enrolled'))
            population = figures.get('population')
            return SimpleNamespace(population_children_3_4=population,
                public_cdc_enrollment_children_3_4=enrolled,
                public_cdc_gap_children_3_4=max(population-enrolled, 0) if population is not None else None,
                vulnerable_children_unenrolled=None)
        if cdc.assigned_cdw_id:
            return None
        return DataIntegrationService.get_current_gap_analysis(cdc.barangay, academic_year)

    @staticmethod
    def _data_basis(population_metrics, enrollment_data, academic_year):
        source = getattr(population_metrics, 'source_submission', None)
        if source:
            source_date = source.sent_to_cswdo_on or source.received_by_cswdo_on or source.submitted_on
            population_basis = f"{source.title} ({source.get_status_display()}, {source_date.date() if source_date else 'date not recorded'})"
        elif population_metrics:
            population_basis = f"Barangay population metrics updated {population_metrics.last_updated.date()}"
        else:
            population_basis = 'No CHO-to-CSWDO population basis is encoded yet'

        if enrollment_data:
            enrollment_basis = f"Enrollment data updated {enrollment_data.last_updated.date()}"
        else:
            enrollment_basis = 'Current child records linked to the CDC'

        return {
            'academic_year': academic_year.name if academic_year else '',
            'population_basis': population_basis,
            'enrollment_basis': enrollment_basis,
        }

    @staticmethod
    def _evidence(cdc):
        evidence = {}
        profile_picture = getattr(getattr(cdc, 'assigned_cdw', None), 'profile_picture', None)
        if profile_picture:
            evidence['cover_image'] = profile_picture.url
        else:
            evidence['cover_image'] = ''

        latest_files = []
        for manager_name, file_field in [
            ('authority_documents', 'file'),
            ('permit_records', 'inspection_report_file'),
            ('annual_evaluations', 'document_file'),
        ]:
            manager = getattr(cdc, manager_name, None)
            if not manager:
                continue
            item = manager.exclude(**{f'{file_field}': ''}).order_by('-created_at').first()
            stored_file = getattr(item, file_field, None) if item else None
            if stored_file:
                latest_files.append(stored_file.url)

        if latest_files:
            evidence['supporting_file'] = latest_files[0]
        return evidence

    @staticmethod
    def _count(cdc, manager_name, **filters):
        manager = getattr(cdc, manager_name, None)
        if not manager:
            return 0
        qs = manager.filter(**filters) if filters else manager.all()
        return qs.count()

    @staticmethod
    def _related_count(qs, related_name):
        return qs.aggregate(total=Count(related_name))['total'] or 0

    @staticmethod
    def _related_sum(qs, path):
        return qs.aggregate(total=Sum(path))['total'] or 0

    @staticmethod
    def _metric_value(obj, attr):
        if not obj:
            return 0
        value = getattr(obj, attr, 0)
        return int(value() if callable(value) else value or 0)

    @staticmethod
    def _percent(numerator, denominator):
        denominator = float(denominator or 0)
        if denominator <= 0:
            return 0.0
        return round(max(0.0, min(100.0, (float(numerator or 0) / denominator) * 100)), 1)
