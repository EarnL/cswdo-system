"""Shared, public-safe population basis and CDC indicators for both maps."""
from django.utils import timezone
from core.models import AcademicYear, Barangay, BarangayPopulationMetrics, CDC, Child, ChildrenGapAnalysis


def date_value(value):
    return value.isoformat() if value else None


def population_source(source):
    request = source.data_request if source and source.data_request_id else None
    return {
        'id': source.id if source else None,
        'title': source.title if source else '',
        'status': source.status if source else None,
        'period_start': date_value(request.period_start) if request else None,
        'period_end': date_value(request.period_end) if request else None,
        'received_by_cswdo_on': date_value(source.received_by_cswdo_on) if source else None,
        'sent_to_cswdo_on': date_value(source.sent_to_cswdo_on) if source else None,
    }


def shared_map_rows(academic_year=None):
    academic_year = academic_year or AcademicYear.get_current()
    metrics = {m.barangay_id: m for m in BarangayPopulationMetrics.objects.filter(
        academic_year=academic_year, source_submission__status='current_basis', children_3_4__isnull=False
    ).select_related('source_submission__data_request')}
    gaps = {g.barangay_id: g for g in ChildrenGapAnalysis.objects.filter(
        academic_year=academic_year, population_metrics_id__in=[m.id for m in metrics.values()]
    )}
    centers = {}
    for cdc in CDC.objects.all():
        centers.setdefault(cdc.barangay_id, []).append(cdc)
    enrollment = {}
    for child in Child.objects.filter(academic_year=academic_year, cdc__isnull=False,
                                      current_status='enrolled').select_related('cdc'):
        if child.is_daycare_eligible(academic_year):
            key = child.barangay_id
            enrollment[key] = enrollment.get(key, 0) + 1
    rows = []
    for barangay in Barangay.objects.order_by('name'):
        metric, gap = metrics.get(barangay.id), gaps.get(barangay.id)
        available = metric is not None and gap is not None
        children = metric.children_3_4 if available else None
        enrolled = enrollment.get(barangay.id, 0)
        cdcs = centers.get(barangay.id, [])
        capacity = sum(c.effective_capacity or c.max_capacity or 0 for c in cdcs)
        enrollment_gap = max(0, children - enrolled) if available else None
        capacity_gap = max(0, children - capacity) if available else None
        coverage = round(min(100, enrolled / children * 100), 1) if children else (0 if available else None)
        # Percentage of eligible children not recorded in CDC enrollment.
        score = round(enrollment_gap / children * 100, 1) if children else (0 if available else None)
        level = 'no_data' if not available else 'critical' if score >= 70 else 'elevated' if score >= 35 else 'watch'
        label = {'no_data': 'No validated population data', 'critical': 'Low recorded enrollment coverage',
                 'elevated': 'Enrollment coverage needs attention', 'watch': 'Higher recorded enrollment coverage'}[level]
        rows.append({
            'academic_year': {'id': academic_year.id, 'name': academic_year.name},
            'barangay': {'id': barangay.id, 'name': barangay.name},
            'population': {
                'has_current_basis': available,
                'total_population': metric.total_population if available else None,
                'children_3_5': metric.children_3_5 if available else None,
                'children_0_5': metric.children_0_2 + metric.children_3_5 if available else None,
                'children_3_4': children,
                'last_updated': date_value(metric.last_updated) if available else None,
                'source': population_source(metric.source_submission if available else None),
            },
            'public_cdc': {
                'centers': len(cdcs), 'capacity': capacity,
                'enrollment_3_4': enrolled,
                'gap_3_4': enrollment_gap,
                'capacity_gap': capacity_gap,
                'coverage_rate_3_4': coverage,
                'records_checked_at': timezone.now().isoformat(),
                'locations': [{'id': c.id, 'name': c.name, 'address': c.address,
                               'lat': c.latitude, 'lng': c.longitude,
                               'capacity': c.effective_capacity or c.max_capacity or 0,
                               'operating_days': c.operating_days, 'operating_hours': c.operating_hours}
                              for c in cdcs],
            },
            'service_signal': {'need_score': score, 'need_level': level, 'label': label,
                               'total_gap_0_5': enrollment_gap, 'enrollment_rate_0_5': coverage,
                               'definition': 'Percentage of children aged 3–4 not recorded in CDC enrollment. This does not establish unmet demand.'},
        })
    return rows
