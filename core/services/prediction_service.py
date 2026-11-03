"""Deterministic, source-labelled enrollment and barangay coverage scenarios."""
from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime
from math import ceil, isfinite
from statistics import mean
from django.utils import timezone
from core.models import AcademicYear, Barangay, BarangayPopulationMetrics, CDC, Child, Report


def numeric(value):
    if value in (None, '') or isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if isfinite(result) and result >= 0 else None
    except (TypeError, ValueError):
        return None


def complete_sum(values):
    values = list(values)
    return round(sum(values), 1) if values and all(v is not None for v in values) else None


def annual_slope(points):
    # A complete annual interval is required; avoid annualizing a short-term spike.
    if len(points) < 2 or (points[-1]['date'] - points[0]['date']).days < 365:
        return None
    xs = [(p['date'] - points[0]['date']).days / 365.2425 for p in points]
    ys = [p['value'] for p in points]
    denominator = sum((x - mean(xs)) ** 2 for x in xs)
    return sum((x - mean(xs)) * (y - mean(ys)) for x, y in zip(xs, ys)) / denominator if denominator else None


def validate_history(points):
    errors, baseline_errors = [], []
    for index in range(2, len(points)):
        training, actual = points[:index], points[index]
        slope = annual_slope(training)
        if slope is None:
            continue
        years = (actual['date'] - training[-1]['date']).days / 365.2425
        estimate = max(0, training[-1]['value'] + slope * years)
        errors.append(abs(estimate - actual['value']))
        baseline_errors.append(abs(training[-1]['value'] - actual['value']))
    return {'held_out_periods': len(errors), 'mean_absolute_error_children': round(mean(errors), 2) if errors else None,
            'constant_baseline_mae_children': round(mean(baseline_errors), 2) if errors else None,
            'method': 'Expanding-window holdout; only earlier records fit each prediction.'}


def public_history(points):
    return [{**p, 'date': p['date'].isoformat(), 'label': p['date'].isoformat()} for p in points]


class PredictionService:
    FORECAST_YEARS = 4
    TARGET_CHILDREN_PER_STAFF = 25
    CHILDREN_PER_SESSION = 30
    APPROVED = ['approved', 'verified_by_staff', 'forwarded_to_admin']

    @staticmethod
    def _extract_report_enrollment(report):
        payload = report.payload
        if not isinstance(payload, dict) or payload.get('daycare_age_range') != [3, 4]:
            return None
        form = payload.get('formData') or {}
        if not isinstance(form, dict):
            return None
        for value in [form.get('totalChildren'), form.get('total_children'), form.get('currentEnrollment'), payload.get('totalChildren')]:
            number = numeric(value)
            if number is not None:
                return number
        return None

    @staticmethod
    def _get_enrollment_history(cdc, current_enrollment=None):
        groups = defaultdict(dict)
        today = timezone.localdate()
        for report in Report.objects.filter(cdc=cdc, status__in=PredictionService.APPROVED,
                                             report_type__in=['form7', 'child_profile']).order_by('submitted_on', 'id'):
            value = PredictionService._extract_report_enrollment(report)
            if value is None:
                continue
            try:
                if report.period_type == 'monthly' and 1 <= report.month <= 12:
                    month = report.month
                elif report.period_type == 'quarterly' and 1 <= report.quarter <= 4:
                    month = report.quarter * 3
                elif report.period_type == 'annual':
                    month = 12
                else:
                    continue
                stamp = date(report.year, month, monthrange(report.year, month)[1])
            except (ValueError, TypeError):
                continue
            if stamp > today:
                continue
            # Same report type and same seasonal period; latest approved revision wins.
            key = (report.report_type, report.period_type, month)
            groups[key][stamp] = {'date': stamp, 'value': value, 'report_id': report.id,
                                   'basis': f'{report.report_type}: reported {report.period_type} enrollment, ages 3-4'}
        series = [sorted(group.values(), key=lambda p: p['date'])[-8:] for group in groups.values()]
        return max(series, key=lambda ps: (len(ps), ps[-1]['date'])) if series else []

    @staticmethod
    def _get_current_enrollment(cdc, academic_year):
        return float(sum(child.is_daycare_eligible(academic_year) for child in Child.objects.filter(
            cdc=cdc, academic_year=academic_year, current_status='enrolled')))

    @staticmethod
    def _build_cdc_forecast(cdc, current_year, academic_year):
        current = PredictionService._get_current_enrollment(cdc, academic_year)
        history = PredictionService._get_enrollment_history(cdc)
        slope = annual_slope(history)
        capacity = numeric(cdc.effective_capacity)
        if capacity is None:
            capacity = numeric(cdc.max_capacity)
        points = []
        for offset in range(5):
            value = round(max(0, current + (slope or 0) * offset), 1)
            points.append({'year': current_year + offset, 'projected_enrollment': value,
                           'projected_utilization': round(value / capacity * 100, 1) if capacity else None})
        final = points[-1]['projected_enrollment']
        gap = max(0, final - capacity) if capacity is not None else None
        utilization = points[-1]['projected_utilization']
        risk = 'unknown' if capacity is None else 'high' if gap > 0 else 'medium' if utilization is not None and utilization >= 85 else 'low'
        return {'cdc_id': cdc.id, 'cdc_name': cdc.name, 'barangay_id': cdc.barangay_id,
                'barangay': cdc.barangay.name if cdc.barangay else 'Not recorded',
                'current_enrollment': current, 'effective_capacity': capacity,
                'current_utilization': round(current / capacity * 100, 1) if capacity else None,
                'projected_growth_rate': round(slope / current * 100, 1) if slope is not None and current else None,
                'annual_change_children': round(slope, 2) if slope is not None else None,
                'projected_enrollment_final_year': final, 'projected_capacity_gap': gap,
                'additional_slots_needed': ceil(gap) if gap is not None else None,
                'additional_sessions_needed': ceil(gap / 30) if gap is not None else None,
                'additional_staff_needed': max(0, ceil(final / 25) - cdc.total_staff) if cdc.total_staff is not None else None,
                'estimated_cdcs_required': None, 'predicted_not_enrolled': None,
                'years_until_capacity_breach': next((p['year'] - current_year for p in points[1:] if capacity is not None and p['projected_enrollment'] > capacity), None),
                'risk_level': risk, 'risk_score': {'unknown': 0, 'low': 25, 'medium': 60, 'high': 90}[risk],
                'confidence_score': min(100, round(len(history) / 4 * 100)),
                'evidence_level': 'trend' if slope is not None else 'constant scenario',
                'forecast_points': points, 'history': public_history(history), 'validation': validate_history(history),
                'barangay_need': {},
                'drivers': ['Same report type and seasonal period; approved ages 3-4 reports only.',
                            f'Annual enrollment change: {round(slope, 1)} children.' if slope is not None else 'Insufficient comparable history; current enrollment held constant.',
                            'Capacity and staffing are held at current recorded values.'],
                'assumption_breakdown': {'method': 'Annual linear change, anchored to current eligible enrollment; floor at zero.'}}

    @staticmethod
    def _build_barangay_forecasts(cdcs, academic_year, current_year):
        results = []
        for barangay in Barangay.objects.all().order_by('id'):
            centers = [row for row in cdcs if row['barangay_id'] == barangay.id]
            metrics = list(BarangayPopulationMetrics.objects.filter(barangay=barangay, children_3_4__isnull=False)
                           .select_related('academic_year', 'source_submission').order_by('academic_year__start_date'))
            current = next((m for m in metrics if m.academic_year_id == academic_year.id and m.source_submission
                            and m.source_submission.status == 'current_basis'), None)
            eligible = [m for m in metrics if m.academic_year and m.academic_year.start_date <= academic_year.start_date
                        and m.source_submission and (m == current or (m.academic_year_id != academic_year.id
                        and m.source_submission.status in ['archived', 'current_basis'] and m.source_submission.received_by_cswdo_on))]
            history = [{'date': m.academic_year.start_date, 'value': float(m.children_3_4),
                        'source_submission_id': m.source_submission_id, 'academic_year': m.academic_year.name,
                        'basis': 'Approved ages 3-4 population; academic-year reference'} for m in eligible][-8:]
            slope = annual_slope(history) if current else None
            capacity = complete_sum(row['effective_capacity'] for row in centers) if centers else 0
            points = []
            for offset in range(5):
                population = round(max(0, current.children_3_4 + (slope or 0) * offset), 1) if current else None
                enrollment = round(sum(row['forecast_points'][offset]['projected_enrollment'] for row in centers), 1)
                served = min(population, enrollment, capacity) if population is not None and capacity is not None else None
                points.append({'year': current_year + offset, 'eligible_children': population,
                               'projected_enrollment': enrollment, 'capacity': capacity,
                               'coverage_gap': round(population - served, 1) if served is not None else None,
                               'capacity_shortfall': round(max(0, population - capacity), 1) if population is not None and capacity is not None else None})
            results.append({'barangay_id': barangay.id, 'barangay': barangay.name, 'cdc_count': len(centers),
                            'source_submission_id': current.source_submission_id if current else None,
                            'basis': 'Potential public CDC demand, ages 3-4; not expressed enrollment intentions.',
                            'evidence_level': 'not recorded' if current is None else 'trend' if slope is not None else 'constant scenario',
                            'annual_change_children': round(slope, 2) if slope is not None else None,
                            'history': public_history(history), 'validation': validate_history(history), 'forecast_points': points})
        return results

    @staticmethod
    def generate_predictive_dashboard():
        today = timezone.localdate()
        year = AcademicYear.get_current()
        cdcs = [PredictionService._build_cdc_forecast(cdc, today.year, year) for cdc in CDC.objects.select_related('barangay').all()]
        cdcs.sort(key=lambda row: (row['risk_score'], row['projected_capacity_gap'] or 0), reverse=True)
        barangays = PredictionService._build_barangay_forecasts(cdcs, year, today.year)
        coverage = sum(row['source_submission_id'] is not None for row in barangays)
        series = {'labels': [str(today.year + n) for n in range(5)], 'enrollment': [], 'capacity_gap': [],
                  'predicted_unenrolled': [], 'required_cdcs': [], 'snp_demand': [None] * 5, 'eligible_children': []}
        for offset in range(5):
            series['enrollment'].append(round(sum(c['forecast_points'][offset]['projected_enrollment'] for c in cdcs), 1))
            series['capacity_gap'].append(complete_sum(max(0, c['forecast_points'][offset]['projected_enrollment'] - c['effective_capacity']) if c['effective_capacity'] is not None else None for c in cdcs))
            series['predicted_unenrolled'].append(complete_sum(b['forecast_points'][offset]['coverage_gap'] for b in barangays))
            population = complete_sum(b['forecast_points'][offset]['eligible_children'] for b in barangays)
            series['eligible_children'].append(population)
            series['required_cdcs'].append(ceil(population / 30) if population is not None else None)
        total_capacity = complete_sum(c['effective_capacity'] for c in cdcs)
        current_total, final_total = series['enrollment'][0], series['enrollment'][-1]
        validation_rows = [c['validation'] for c in cdcs]
        tested = sum(v['held_out_periods'] for v in validation_rows)
        summary = {'total_cdcs_forecasted': len(cdcs), 'high_risk_cdcs': sum(c['risk_level'] == 'high' for c in cdcs),
                   'medium_risk_cdcs': sum(c['risk_level'] == 'medium' for c in cdcs),
                   'projected_capacity_gap_total': series['capacity_gap'][-1],
                   'recommended_new_slots': complete_sum(c['additional_slots_needed'] for c in cdcs),
                   'recommended_additional_sessions': complete_sum(c['additional_sessions_needed'] for c in cdcs),
                   'recommended_additional_staff': complete_sum(c['additional_staff_needed'] for c in cdcs),
                   'predicted_not_enrolled_total': series['predicted_unenrolled'][-1],
                   'estimated_cdcs_required_total': series['required_cdcs'][-1],
                   'average_projected_utilization': round(final_total / total_capacity * 100, 1) if total_capacity else None,
                   'highest_risk_cdc': cdcs[0]['cdc_name'] if cdcs else None,
                   'barangays_with_population_basis': coverage, 'total_barangays': len(barangays),
                   'trend_supported_cdcs': sum(c['evidence_level'] == 'trend' for c in cdcs),
                   'validation': {'held_out_periods': tested,
                       'mean_absolute_error_children': round(sum(v['mean_absolute_error_children'] * v['held_out_periods'] for v in validation_rows if v['held_out_periods']) / tested, 2) if tested else None}}
        sections = {
            'enrollment_forecasting': {'current_enrollment': current_total, 'projected_enrollment': final_total,
                'projected_growth_children': round(final_total - current_total, 1), 'priority_cdcs': cdcs[:5],
                'planning_message': 'Comparable annual changes; limited histories use a clearly labelled constant scenario.'},
            'cdc_demand_projection': {'predicted_not_enrolled': series['predicted_unenrolled'][-1],
                'estimated_cdcs_required': series['required_cdcs'][-1], 'average_projected_utilization': summary['average_projected_utilization'],
                'priority_cdcs': [], 'planning_message': 'Population demand and coverage gaps are counted once per barangay. Missing sources leave citywide totals unavailable.'},
            'staffing_projection': {**summary, 'priority_cdcs': cdcs[:5],
                'planning_message': 'Planning assumptions: 30 slots per session and 25 children per staff member; not new center counts.'}}
        return {'model_version': 2, 'generated_at': timezone.now().isoformat(), 'forecast_horizon_years': 4,
                'data_basis': {'academic_year': year.name, 'current_data': 'Current eligible enrollment and approved CHO ages 3-4 population.',
                               'historical_data': 'Latest approved report per comparable seasonal period; approved population by academic year.'},
                'summary': summary, 'planning_sections': sections, 'chart_series': series, 'top_risks': cdcs[:5],
                'cdc_forecasts': cdcs, 'barangay_forecasts': barangays,
                'assumptions': {'model_name': 'Comparable-history enrollment and barangay coverage scenarios',
                    'limitations': ['Potential demand assumes all eligible children could need public CDC services; private enrollment and parental choice are not forecast.',
                                   'No birth, migration or future facility changes are invented. Sparse histories use constant scenarios.',
                                   'Each CDC contributes to its location barangay; cross-barangay attendance is not modelled.',
                                   'Evidence score is history availability (four points = 100), not prediction accuracy.',
                                   'Holdout errors compare saved historical periods, not future accuracy.'],
                    'confidence_method': {'description': 'History availability only; see holdout MAE for validation.'}}}
