"""Period activity summaries and explicitly labelled current-record context."""
import calendar
from datetime import date, timedelta

from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.models import AcademicYear, FeedingProgram, Report
from core.services.cdc_annual_report_service import CDCAnnualReportService as Annual


def reporting_period(period_type, year, month=0, quarter=0):
    try:
        year, month, quarter = int(year), int(month or 0), int(quarter or 0)
        if not 1900 <= year <= 9998:
            raise ValueError
        if period_type == 'monthly' and 1 <= month <= 12:
            first, last = month, month
            label = f'{calendar.month_name[month]} {year}'
            quarter = (month - 1) // 3 + 1
        elif period_type == 'quarterly' and 1 <= quarter <= 4:
            first, last = quarter * 3 - 2, quarter * 3
            month = 0
            label = f'Q{quarter} {year}'
        elif period_type == 'annual':
            first, last, month, quarter = 1, 12, 0, 4
            label = str(year)
        else:
            raise ValueError
    except (ValueError, TypeError):
        raise ValidationError({'period': 'Choose a valid month, quarter or year for this report.'})
    return {
        'period_type': period_type, 'year': year, 'month': month, 'quarter': quarter,
        'label': label, 'start': date(year, first, 1).isoformat(),
        'end': date(year, last, calendar.monthrange(year, last)[1]).isoformat(),
    }


def display(value):
    if value is None or value == '':
        return 'Not recorded'
    if isinstance(value, float):
        return f'{value:,.1f}'
    if isinstance(value, bool):
        return 'Yes' if value else 'No'
    return str(value)


def counted(value, singular, plural=None):
    return f"{value} {singular if value == 1 else plural or singular + 's'}"


class CenterSummaryService:
    @staticmethod
    def build(cdc, period_type, year, month=0, quarter=0, academic_year=None, supplied=None):
        period = reporting_period(period_type, year, month, quarter)
        from core.services.population_basis_service import working_year
        academic_year = academic_year or working_year(cdc)
        supplied = supplied if isinstance(supplied, dict) else {}
        # Keep the existing eligibility, ratios, readiness formulas and detailed tables.
        payload = Annual.build_payload(cdc, year=period['year'], academic_year=academic_year)
        metrics, tables = payload['auto_calculated'], payload['auto_tables']
        if period_type != 'annual':
            # Monthly/quarterly reports previously used the CDC API snapshots.
            # Reuse those rules rather than silently substituting annual formulas.
            from core.serializers.cdc_serializer import CDCSerializer
            snapshot = CDCSerializer()
            if academic_year.pk == working_year(cdc).pk:
                metrics['enrollment'] = cdc.current_enrollment
            metrics['teacherCount'] = snapshot.get_active_staff_profiles_count(cdc) or cdc.qualified_caregivers or cdc.total_staff
            metrics['childrenPerTeacher'] = metrics['enrollment'] / metrics['teacherCount'] if metrics['teacherCount'] else None
            metrics['utilization'] = metrics['enrollment'] / metrics['capacity'] * 100 if metrics['capacity'] else None
            metrics['servedVsPopulation'] = metrics['enrollment'] / metrics['population'] * 100 if metrics['population'] else None
            metrics['overcrowded'] = metrics['capacity'] > 0 and metrics['enrollment'] > metrics['capacity']
            for key, getter in [('healthScore', 'get_health_safety_snapshot'), ('curriculumScore', 'get_curriculum_snapshot'),
                                ('facilityScore', 'get_physical_environment_snapshot'), ('complianceScore', 'get_compliance_snapshot'),
                                ('staffingScore', 'get_staffing_snapshot')]:
                metrics[key] = getattr(snapshot, getter)(cdc)['readiness_score']
            for row in tables['population_and_enrollment']:
                if row[0] == 'Current CDC Enrollment':
                    row[1] = metrics['enrollment']
                elif row[0] == 'Barangay Coverage':
                    row[1] = f"{metrics['servedVsPopulation']:.1f}%" if metrics['servedVsPopulation'] is not None else None
        for table in tables.values():
            for row in table:
                row[1:] = ['Not recorded' if value == 'Not encoded' else value for value in row[1:]]
        for row in tables['submitted_records']:
            row[0] = {'General Form 6 Reports': 'Child Development Worker Profiles', 'General Form 7 Reports': 'Child Development Center Profiles'}.get(row[0], row[0])
        if not (metrics['healthRecords'] or cdc.emergency_readiness_records.exists() or cdc.child_protection_records.exists()):
            metrics['healthScore'] = None
        if not (metrics['curriculumPlans'] or metrics['childAssessmentRecords']):
            metrics['curriculumScore'] = None
        if not (metrics['teacherCount'] or metrics['staffTrainingRecords']):
            metrics['staffingScore'] = None
        snapshot_basis = f'Current records as of {timezone.localdate().isoformat()}; academic year {academic_year.name}'
        tables['facilities_and_programs'] = [[label, getattr(cdc, field, None)] for label, field in [
            ('Email', 'email'), ('Building type', 'building_type'), ('Total area (square meters)', 'total_area'),
            ('Water supply', 'has_water_supply'), ('Sanitation', 'has_sanitation'), ('Electricity', 'has_electricity'),
            ('Toddler care (2-3)', 'offers_toddler_care'), ('Preschool program (3-4)', 'offers_preschool'),
            ('Feeding program offered', 'has_feeding_program'), ('Health services offered', 'has_health_services'),
            ('License number', 'license_number'), ('License expiry', 'license_expiry_date'),
        ]]
        # Normalize date/decimal fields for the JSON snapshot, preserving null and zero.
        tables['facilities_and_programs'] = [[label, value if isinstance(value, (str, int, float, bool, type(None))) else str(value)] for label, value in tables['facilities_and_programs']]
        gap = Annual._latest_gap_analysis(cdc, academic_year)
        for key, attr in [('population', 'population_children_3_4'), ('publicGap', 'public_cdc_gap_children_3_4'), ('vulnerableGap', 'vulnerable_children_unenrolled')]:
            if gap is None or getattr(gap, attr, None) is None:
                metrics[key] = None
        if not metrics['population']:
            metrics['servedVsPopulation'] = None
        if not metrics['capacity']:
            metrics['utilization'] = None
        if not metrics['teacherCount']:
            metrics['childrenPerTeacher'] = None
        tables['staffing_and_compliance'].append(['Children per teacher/caregiver', round(metrics['childrenPerTeacher'], 1) if metrics['childrenPerTeacher'] is not None else None])
        population_labels = {'Barangay Children 3-4': 'population', 'Barangay Coverage': 'servedVsPopulation',
            'Public CDC Gap Ages 3-4': 'publicGap', 'Vulnerable Unenrolled Children': 'vulnerableGap'}
        for row in tables['population_and_enrollment']:
            key = population_labels.get(row[0])
            if key and metrics[key] is None:
                row[1] = None

        activity_specs = [
            ('healthRecords', 'Health records', 'child_health_records', 'screening_date'),
            ('safetyIncidents', 'Safety incident records', 'safety_incidents', 'incident_date'),
            ('staffTrainingRecords', 'Staff training records', 'staff_training_records', 'completed_on'),
            ('childAssessmentRecords', 'Child development assessment records', 'child_assessment_records', 'assessment_date'),
            ('parentSeminars', 'Parent seminars', 'parent_seminars', 'date_conducted'),
            ('emergencyRecords', 'Emergency readiness assessments', 'emergency_readiness_records', 'assessment_date'),
            ('protectionRecords', 'Child protection reviews', 'child_protection_records', 'review_date'),
        ]
        activity, sources, comparisons = {}, {}, []
        prior_end = date.fromisoformat(period['start']) - timedelta(days=1)
        if period_type == 'monthly':
            prior_start = prior_end.replace(day=1)
        elif period_type == 'quarterly':
            prior_start = date(prior_end.year, prior_end.month - 2, 1)
        else:
            prior_start = date(prior_end.year, 1, 1)
        rows = []
        for key, label, relation, field in activity_specs:
            manager = getattr(cdc, relation)
            qs = manager.filter(**{f'{field}__range': (period['start'], period['end'])})
            value = qs.count()
            activity[key] = value
            rows.append([label, value, 'No records found for this period' if value == 0 else 'Saved records dated in this period'])
            sources[key] = {'basis': 'period', 'source': relation, 'date_field': field, 'start': period['start'], 'end': period['end'], 'undated_records': manager.filter(**{f'{field}__isnull': True}).count()}
            if key in ['healthRecords', 'parentSeminars'] and value:
                prior = manager.filter(**{f'{field}__range': (prior_start, prior_end)}).count()
                if prior:
                    comparisons.append([label, f'{value} now / {prior} previously', f'{value - prior:+d} records; previous period {prior_start} to {prior_end}'])
        feeding = FeedingProgram.objects.filter(cdc=cdc, feeding_days__feeding_date__range=(period['start'], period['end']), feeding_days__status='completed')
        days = feeding.values('feeding_days__id').distinct().count()
        served = feeding.aggregate(total=Sum('feeding_days__beneficiaries_served'))['total']
        activity.update(feedingDays=days, feedingBeneficiariesServed=served if days else None)
        rows.extend([['Recorded feeding days', days, 'Completed feeding logs only'], ['Feeding servings recorded', activity['feedingBeneficiariesServed'], 'Sum of daily beneficiaries served on completed days; may include the same child on several days']])
        sources['feedingDays'] = {'basis': 'period', 'source': 'feeding_days', 'date_field': 'feeding_date', 'start': period['start'], 'end': period['end']}
        period_reports = Report.objects.filter(cdc=cdc, year=period['year']).exclude(report_type__in=['cdc_monthly_report', 'cdc_quarterly_report', 'cdc_annual_report'])
        if period_type == 'monthly':
            period_reports = period_reports.filter(period_type='monthly', month=period['month'])
        elif period_type == 'quarterly':
            period_reports = period_reports.filter(quarter=period['quarter']).exclude(period_type='annual')
        activity['reportsSubmitted'] = period_reports.count()
        activity['approvedReports'] = period_reports.filter(status__in=['verified_by_staff', 'forwarded_to_admin', 'approved']).count()
        rows.append(['Supporting reports for this period', activity['reportsSubmitted'], 'Count of report documents, not additional activities'])
        tables['period_activities'] = rows
        scope = {'monthly': 'month', 'quarterly': 'quarter', 'annual': 'year'}[period_type]
        overview = f"This report summarizes saved records for {cdc.name} for {period['label']}. During this {scope}, the records include {counted(activity['healthRecords'], 'health record')}, {counted(days, 'completed feeding day')} and {counted(activity['parentSeminars'], 'parent seminar')}. Current enrollment and facility details are shown separately as context."
        capacity_text = f"Current records show {counted(metrics['enrollment'], 'enrolled child', 'enrolled children')} and a center capacity of {metrics['capacity']}."
        if metrics['capacity'] > 0:
            capacity_text += ' Enrollment exceeds the recorded capacity.' if metrics['overcrowded'] else ' Enrollment is within the recorded capacity.'
        else:
            capacity_text += ' Capacity use cannot be calculated because no positive capacity is recorded.'
        concerns = []
        if metrics['overcrowded']:
            concerns.append('Review staffing, session schedules and available space because current enrollment exceeds recorded capacity.')
        if activity['safetyIncidents']:
            concerns.append(f"Review the {counted(activity['safetyIncidents'], 'safety incident record')} dated in this period and the recorded follow-up actions.")
        if metrics['population'] is None:
            concerns.append('The population basis is not recorded, so barangay coverage cannot be reported.')
        if not days:
            concerns.append('No feeding logs were found for this period. Check whether records still need to be entered; this does not confirm that no feeding took place.')
        if not concerns:
            concerns.append('No over-capacity or recorded safety-incident concern was identified from these measures. This is not a complete assessment of service quality.')

        def section(key, title, text, table=None, basis=None):
            return {'key': key, 'title': title, 'autoText': text, 'notes': '', 'table': table or [], 'basis': basis or period['label']}

        sections = [
            section('executive_summary', 'Report Overview', overview),
            section('enrollment_and_children', 'Enrollment and Capacity', capacity_text, tables['population_and_enrollment'] + tables['children_profile'], snapshot_basis),
            section('health_nutrition', 'Programs and Services', f"The table lists records dated during this {scope}. Record counts describe documented work, not unique children or proven improvements in health or development.", rows),
            section('staffing_development', 'Staff and Facilities', f"Current records list {counted(metrics['teacherCount'], 'staff member')}. This {scope} includes {counted(activity['staffTrainingRecords'], 'staff training record')}. Readiness percentages use the existing record-based formulas; they are not measures of children's outcomes.", tables['cdc_information'] + tables['staffing_and_compliance'] + tables['facilities_and_programs'], snapshot_basis),
            section('accomplishments', 'Accomplishments', f"Recorded work includes {counted(activity['childAssessmentRecords'], 'child development assessment')} and {counted(activity['parentSeminars'], 'parent seminar')} in this {scope}. Supporting documentation includes {counted(activity['approvedReports'], 'approved report')} for this period. These document counts are not added to activity totals." + (' Comparisons below use the same dated record types in both periods; they describe saved entries, not verified changes in service outcomes.' if comparisons else ''), comparisons),
            section('challenges', 'Concerns and Next Steps', '\n\n'.join(concerns)),
            section('data_sources', 'Data Sources', f"Activity dates: {period['start']} to {period['end']}. {snapshot_basis}. {payload['data_basis']['population_basis']}. Missing information is shown as Not recorded. A zero record count does not prove that no service was provided.", [[label, value] for label, value in tables['submitted_records']], snapshot_basis),
            section('stored_context', 'Additional Stored Records', 'These current or cumulative records are retained for reference and are not accomplishments attributed to the selected period.', tables['operations_and_programs'], snapshot_basis),
        ]
        narratives = supplied.get('narratives') or {}
        # Keep every old narrative key, including sections consolidated in the new design.
        notes = [{'label': key.replace('_', ' ').title(), 'text': value} for key, value in narratives.items() if value]
        evidence = {**payload.get('evidence', {}), **(supplied.get('evidence') or {})}
        payload.update(summary_version=2, prepared_on=timezone.localdate().isoformat(), period=period, report_mode=period_type, generated_summary_report=period_type == 'annual', comparisons=comparisons,
            summary=overview, template_sections=sections, narratives=narratives, cdw_notes=notes, evidence=evidence,
            period_metrics=activity, metric_sources={'current_context': snapshot_basis, **sources},
            report_header={'center': cdc.name, 'barangay': getattr(cdc.barangay, 'name', ''), 'prepared_by': cdc.assigned_cdw.get_full_name() or cdc.assigned_cdw.username if cdc.assigned_cdw else 'Not assigned'},
            key_figures=[{'label': 'Current enrollment', 'value': metrics['enrollment'], 'context': snapshot_basis},
                         {'label': 'Health records', 'value': activity['healthRecords'], 'context': period['label']},
                         {'label': 'Feeding days', 'value': days, 'context': period['label']},
                         {'label': 'Parent seminars', 'value': activity['parentSeminars'], 'context': period['label']}])
        payload['charts'] = [{'label': item['label'], 'value': metrics.get(key), 'basis': snapshot_basis} for item, key in zip(payload['charts'], ['utilization', 'servedVsPopulation', 'healthScore', 'curriculumScore', 'facilityScore', 'complianceScore', 'staffingScore'])]
        return payload
