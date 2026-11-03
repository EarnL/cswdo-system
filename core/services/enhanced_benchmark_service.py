"""
Enhanced Benchmark Analytics Service
Provides comprehensive CDC-level analytics with location mapping and service coverage analysis.
"""
from typing import Any, Dict, List

from core.models import AcademicYear, Barangay, BarangayPopulationMetrics, CDC, EnrollmentData
from core.services.data_integration_service import DataIntegrationService


def _bounded_percent(value: float) -> float:
    return round(max(0.0, min(100.0, float(value or 0))), 1)


class EnhancedBenchmarkService:
    """
    Enhanced benchmark service providing detailed CDC analytics and comparisons.
    """

    def __init__(self):
        self.national_benchmarks = {
            'enrollment_utilization': 85,
            'capacity_utilization': 80,
            'service_coverage': 90,
            'session_efficiency': 75,
            'facility_compliance': 80,
        }

    def _get_population_metrics(self, barangay: Barangay) -> Dict[str, int]:
        academic_year = AcademicYear.get_current()
        metrics = DataIntegrationService.get_current_population_metrics(barangay, academic_year)
        if not metrics:
            return {
                'total_children_0_5': 0,
                'children_3_4': 0,
                'vulnerable_children': 0,
            }

        return {
            'total_children_0_5': metrics.children_3_4 or 0,
            'children_3_4': metrics.children_3_4 or 0,
            'vulnerable_children': metrics.vulnerable_children_count,
        }

    def _get_latest_enrollment_metrics(self, barangay: Barangay) -> Dict[str, int]:
        academic_year = AcademicYear.get_current()
        enrollment = EnrollmentData.objects.filter(barangay=barangay, academic_year=academic_year).order_by('-last_updated', '-id').first()
        if not enrollment:
            return {
                'enrolled_3_4': 0,
                'total_enrolled': 0,
            }

        total_enrolled = enrollment.enrolled_3_4
        return {
            'enrolled_3_4': enrollment.enrolled_3_4,
            'total_enrolled': total_enrolled,
        }

    def _get_barangay_base_data(self, barangay: Barangay) -> Dict[str, Any]:
        population = self._get_population_metrics(barangay)
        enrollment = self._get_latest_enrollment_metrics(barangay)
        cdcs = list(CDC.objects.filter(barangay=barangay))

        total_capacity = sum(cdc.effective_capacity for cdc in cdcs)
        total_sessions_available = sum(cdc.sessions_per_day for cdc in cdcs)
        total_sessions_needed = sum(cdc.sessions_needed for cdc in cdcs)
        total_current_enrollment = sum(cdc.current_enrollment for cdc in cdcs)

        total_population = population['total_children_0_5']
        recorded_enrollment = enrollment['total_enrolled']
        served_children = max(recorded_enrollment, total_current_enrollment)
        served_children = min(served_children, total_population) if total_population else served_children
        total_unserved = max(0, total_population - served_children)
        public_cdc_gap_3_4 = max(0, (population['children_3_4'] or 0) - total_current_enrollment)

        coverage = (served_children / total_population * 100) if total_population > 0 else 0
        capacity_utilization = _bounded_percent((total_current_enrollment / total_capacity * 100) if total_capacity > 0 else 0)
        capacity_gap = max(0, total_current_enrollment - total_capacity)
        capacity_surplus = max(0, total_capacity - total_current_enrollment)

        potential_overlap = (
            len(cdcs) > 1 and total_unserved == 0 and capacity_surplus >= 15
        )
        needs_expansion = total_unserved > 0 or capacity_gap > 0 or total_sessions_needed > total_sessions_available

        return {
            'barangay': barangay,
            'population': population,
            'enrollment': enrollment,
            'cdcs': cdcs,
            'totals': {
                'total_cdcs': len(cdcs),
                'total_capacity': total_capacity,
                'total_sessions_available': total_sessions_available,
                'total_sessions_needed': total_sessions_needed,
                'total_current_enrollment': total_current_enrollment,
                'population_children_3_4': population['children_3_4'],
                'public_cdc_gap_3_4': public_cdc_gap_3_4,
                'served_children': served_children,
                'total_unserved': total_unserved,
                'coverage': round(coverage, 1),
                'capacity_utilization': capacity_utilization,
                'capacity_gap': capacity_gap,
                'capacity_surplus': capacity_surplus,
                'potential_overlap': potential_overlap,
                'needs_expansion': needs_expansion,
            },
        }

    def _calculate_performance_metrics(self, metrics: Dict[str, float]) -> Dict[str, Any]:
        performance_details = []
        standards_met = 0

        for metric_key, value in metrics.items():
            benchmark = self.national_benchmarks.get(metric_key, 0)
            gap = round(value - benchmark, 1)

            if value >= benchmark:
                status = 'exceeds'
                standards_met += 1
            elif gap >= -10:
                status = 'meets'
                standards_met += 1
            elif gap >= -20:
                status = 'near'
                standards_met += 0.5
            else:
                status = 'below'

            performance_details.append({
                'metric': metric_key,
                'value': round(value, 1),
                'benchmark': benchmark,
                'gap': gap,
                'status': status,
            })

        overall_score = (standards_met / len(metrics)) * 100 if metrics else 0

        if overall_score >= 90:
            rating = 'Outstanding'
        elif overall_score >= 80:
            rating = 'Very Good'
        elif overall_score >= 70:
            rating = 'Good'
        elif overall_score >= 60:
            rating = 'Needs Improvement'
        else:
            rating = 'Critical Attention'

        return {
            'overall_score': round(overall_score, 1),
            'rating': rating,
            'standards_met': standards_met,
            'total_standards': len(metrics),
            'details': performance_details,
        }

    def get_cdc_detailed_analytics(self, cdc: CDC) -> Dict[str, Any]:
        """
        Get comprehensive analytics for a specific CDC.
        """
        barangay_data = self._get_barangay_base_data(cdc.barangay)
        population = barangay_data['population']
        enrollment = barangay_data['enrollment']
        totals = barangay_data['totals']

        effective_capacity = cdc.effective_capacity
        capacity_utilization = _bounded_percent((cdc.current_enrollment / effective_capacity * 100) if effective_capacity > 0 else 0)
        enrollment_utilization = _bounded_percent((cdc.current_enrollment / cdc.max_capacity * 100) if cdc.max_capacity > 0 else 0)
        session_efficiency = _bounded_percent(
            cdc.current_enrollment / (cdc.sessions_needed * cdc.capacity_per_session) * 100
            if cdc.sessions_needed > 0 else 0
        )

        share_of_barangay_population_served = (
            cdc.current_enrollment / population['total_children_0_5'] * 100
        ) if population['total_children_0_5'] > 0 else 0
        share_of_barangay_enrollment_handled = (
            cdc.current_enrollment / totals['served_children'] * 100
        ) if totals['served_children'] > 0 else 0

        facility_compliance_flags = [
            cdc.has_water_supply,
            cdc.has_sanitation,
            cdc.has_electricity,
            cdc.has_feeding_program,
            cdc.has_health_services,
        ]
        facility_compliance = (sum(facility_compliance_flags) / len(facility_compliance_flags)) * 100

        capacity_gap = max(0, cdc.current_enrollment - effective_capacity)
        capacity_surplus = max(0, effective_capacity - cdc.current_enrollment)
        potential_overlap = (
            totals['potential_overlap'] and
            capacity_surplus >= cdc.capacity_per_session / 2
        )

        return {
            'cdc_info': {
                'id': cdc.id,
                'name': cdc.name,
                'location_label': f"{cdc.name} - Barangay {cdc.barangay.name}",
                'barangay': cdc.barangay.name,
                'address': cdc.address,
                'latitude': cdc.latitude,
                'longitude': cdc.longitude,
                'contact_person': cdc.contact_person,
                'contact_number': cdc.contact_number,
            },
            'population_data': {
                'age_group_basis': 'Barangay-based reference population',
                'total_children_0_5': population['total_children_0_5'],
                'children_3_4': population['children_3_4'],
                'vulnerable_children': population['vulnerable_children'],
            },
            'enrollment_data': {
                'estimated_enrolled_3_4': cdc.current_enrollment,
                'barangay_total_enrolled': enrollment['total_enrolled'],
                'current_cdc_enrollment': cdc.current_enrollment,
            },
            'capacity_metrics': {
                'max_capacity': cdc.max_capacity,
                'capacity_per_session': cdc.capacity_per_session,
                'sessions_per_day': cdc.sessions_per_day,
                'effective_capacity': effective_capacity,
                'capacity_utilization': capacity_utilization,
                'enrollment_utilization': enrollment_utilization,
                'capacity_surplus': capacity_surplus,
            },
            'session_analysis': {
                'sessions_needed': cdc.sessions_needed,
                'session_efficiency': session_efficiency,
                'can_accommodate_all': cdc.can_accommodate_all,
                'service_gap_exists': cdc.service_gap_exists,
            },
            'service_coverage': {
                'served_children': cdc.current_enrollment,
                'barangay_unserved_children': totals['total_unserved'],
                'barangay_population_children_3_4': population['children_3_4'],
                'barangay_public_cdc_gap_3_4': totals['public_cdc_gap_3_4'],
                'barangay_overall_coverage': totals['coverage'],
                'share_of_barangay_population_served': round(share_of_barangay_population_served, 1),
                'share_of_barangay_enrollment_handled': round(share_of_barangay_enrollment_handled, 1),
                'planning_note': 'The 3-4 gap compares public CDC enrollment against barangay population. Some children in the gap may already be enrolled in private institutions.',
            },
            'gaps_and_opportunities': {
                'capacity_gap': capacity_gap,
                'capacity_surplus': capacity_surplus,
                'barangay_unserved_children': totals['total_unserved'],
                'additional_sessions_needed': max(0, cdc.sessions_needed - cdc.sessions_per_day),
                'expansion_needed': totals['needs_expansion'] or capacity_gap > 0,
                'potential_overlap': potential_overlap,
            },
            'facility_compliance': round(facility_compliance, 1),
            'performance_metrics': self._calculate_performance_metrics({
                'capacity_utilization': capacity_utilization,
                'enrollment_utilization': enrollment_utilization,
                'service_coverage': totals['coverage'],
                'session_efficiency': session_efficiency,
                'facility_compliance': facility_compliance,
            }),
        }

    def _generate_barangay_recommendations(self, base_data: Dict[str, Any]) -> List[str]:
        totals = base_data['totals']
        population = base_data['population']
        recommendations = []

        if totals['total_cdcs'] == 0:
            recommendations.append('No CDC is registered in this barangay. Establish or accredit at least one center.')

        if totals['total_unserved'] > 0:
            recommendations.append(
                f"Reach {totals['total_unserved']} unserved children through enrollment drives, SNP referrals, or added CDC slots."
            )

        if totals['capacity_gap'] > 0 or totals['total_sessions_needed'] > totals['total_sessions_available']:
            recommendations.append(
                'Increase daily sessions or add classroom space because current operating sessions cannot absorb total demand.'
            )

        if totals['potential_overlap']:
            recommendations.append(
                'Potential overlap detected: review service boundaries and redistribute children before expanding infrastructure.'
            )

        if population['vulnerable_children'] > 0:
            recommendations.append(
                f"Prioritize {population['vulnerable_children']} vulnerable children for targeted outreach and support services."
            )

        if totals['coverage'] >= 95 and totals['capacity_gap'] == 0:
            recommendations.append('This barangay is well served. Document practices that can be replicated elsewhere.')

        return recommendations

    def _get_service_status(self, coverage: float, unserved: int, capacity_gap: int, total_cdcs: int) -> str:
        if total_cdcs == 0:
            return 'no_cdc'
        if unserved > 0 or capacity_gap > 0 or coverage < 70:
            return 'needs_support'
        if coverage >= 95 and capacity_gap == 0:
            return 'well_served'
        return 'stable'

    def get_barangay_cdc_comparison(self, barangay: Barangay) -> Dict[str, Any]:
        """
        Get comprehensive comparison of all CDCs within a barangay.
        """
        base_data = self._get_barangay_base_data(barangay)
        totals = base_data['totals']
        population = base_data['population']
        enrollment = base_data['enrollment']

        cdc_analytics = [self.get_cdc_detailed_analytics(cdc) for cdc in base_data['cdcs']]

        if cdc_analytics:
            best_cdc = max(cdc_analytics, key=lambda item: item['performance_metrics']['overall_score'])
            worst_cdc = min(cdc_analytics, key=lambda item: item['performance_metrics']['overall_score'])
            average_performance = round(
                sum(item['performance_metrics']['overall_score'] for item in cdc_analytics) / len(cdc_analytics),
                1,
            )
        else:
            best_cdc = None
            worst_cdc = None
            average_performance = 0

        service_status = self._get_service_status(
            totals['coverage'],
            totals['total_unserved'],
            totals['capacity_gap'],
            totals['total_cdcs'],
        )

        return {
            'barangay_info': {
                'name': barangay.name,
                'id': barangay.id,
            },
            'summary_metrics': {
                'total_cdcs': totals['total_cdcs'],
                'total_population_0_5': population['total_children_0_5'],
                'children_3_4': population['children_3_4'],
                'population_children_3_4': totals['population_children_3_4'],
                'total_enrolled': totals['served_children'],
                'recorded_enrollment_3_4': enrollment['enrolled_3_4'],
                'total_capacity': totals['total_capacity'],
                'total_sessions_available': totals['total_sessions_available'],
                'total_sessions_needed': totals['total_sessions_needed'],
                'overall_coverage': totals['coverage'],
                'capacity_utilization': totals['capacity_utilization'],
                'total_unserved': totals['total_unserved'],
                'total_capacity_gap': totals['capacity_gap'],
                'capacity_surplus': totals['capacity_surplus'],
                'public_cdc_gap_3_4': totals['public_cdc_gap_3_4'],
            },
            'service_status': service_status,
            'gap_overlap_analysis': {
                'service_gap_exists': totals['total_unserved'] > 0 or totals['capacity_gap'] > 0,
                'potential_overlap_exists': totals['potential_overlap'],
                'children_without_slots': totals['total_unserved'],
                'public_cdc_gap_3_4': totals['public_cdc_gap_3_4'],
                'excess_capacity': totals['capacity_surplus'],
                'sessions_shortfall': max(0, totals['total_sessions_needed'] - totals['total_sessions_available']),
                'planning_note': 'Public CDC gap for ages 3-4 is a service-planning basis for SNP and may include children attending private institutions.',
            },
            'cdc_analytics': cdc_analytics,
            'performance_summary': {
                'best_performing_cdc': best_cdc['cdc_info']['location_label'] if best_cdc else None,
                'worst_performing_cdc': worst_cdc['cdc_info']['location_label'] if worst_cdc else None,
                'average_performance_score': average_performance,
            },
            'recommendations': self._generate_barangay_recommendations(base_data),
        }

    def _generate_system_recommendations(
        self,
        coverage: float,
        unserved: int,
        capacity_gap: int,
        needs_support_count: int,
        overlap_watch_count: int,
    ) -> List[str]:
        recommendations = []

        if coverage < 80:
            recommendations.append(
                f"System coverage is {coverage:.1f}%. Strengthen barangay-level enrollment and referral campaigns."
            )

        if unserved > 0:
            recommendations.append(
                f"{unserved} children remain unserved across the network. Prioritize additional sessions and targeted outreach."
            )

        if capacity_gap > 0:
            recommendations.append(
                f"Current CDC network is short by {capacity_gap} slots against active enrollment demand."
            )

        if needs_support_count > 0:
            recommendations.append(
                f"{needs_support_count} barangays need added support, staffing, or service expansion."
            )

        if overlap_watch_count > 0:
            recommendations.append(
                f"{overlap_watch_count} barangays show possible overlap. Review catchment assignments before adding new centers."
            )

        if not recommendations:
            recommendations.append('System coverage and capacity are stable. Maintain monitoring and preserve service quality.')

        recommendations.append('Use barangay-to-barangay comparisons to direct budget, staff deployment, and future CDC accreditation.')
        return recommendations

    def get_system_wide_benchmark_comparison(self) -> Dict[str, Any]:
        """
        Get comprehensive system-wide benchmark comparison with location mapping.
        """
        barangays = list(Barangay.objects.all())
        barangay_comparisons = [self.get_barangay_cdc_comparison(barangay) for barangay in barangays]

        system_totals = {
            'total_cdcs': sum(item['summary_metrics']['total_cdcs'] for item in barangay_comparisons),
            'total_population': sum(item['summary_metrics']['total_population_0_5'] for item in barangay_comparisons),
            'total_enrolled': sum(item['summary_metrics']['total_enrolled'] for item in barangay_comparisons),
            'total_capacity': sum(item['summary_metrics']['total_capacity'] for item in barangay_comparisons),
            'total_unserved': sum(item['summary_metrics']['total_unserved'] for item in barangay_comparisons),
            'total_capacity_gap': sum(item['summary_metrics']['total_capacity_gap'] for item in barangay_comparisons),
            'total_sessions_available': sum(item['summary_metrics']['total_sessions_available'] for item in barangay_comparisons),
            'total_sessions_needed': sum(item['summary_metrics']['total_sessions_needed'] for item in barangay_comparisons),
        }

        system_coverage = (
            system_totals['total_enrolled'] / system_totals['total_population'] * 100
        ) if system_totals['total_population'] > 0 else 0
        system_capacity_utilization = _bounded_percent(
            system_totals['total_enrolled'] / system_totals['total_capacity'] * 100
            if system_totals['total_capacity'] > 0 else 0
        )

        ranked_barangays = sorted(
            barangay_comparisons,
            key=lambda item: (
                item['summary_metrics']['overall_coverage'],
                -item['summary_metrics']['total_unserved'],
                item['summary_metrics']['capacity_utilization'],
            ),
            reverse=True,
        )

        priority_barangays = [
            item for item in barangay_comparisons
            if item['service_status'] == 'needs_support'
        ]
        well_served_barangays = [
            item for item in barangay_comparisons
            if item['service_status'] == 'well_served'
        ]
        overlap_watchlist = [
            item for item in barangay_comparisons
            if item['gap_overlap_analysis']['potential_overlap_exists']
        ]
        zero_cdc_barangays = [
            item for item in barangay_comparisons
            if item['service_status'] == 'no_cdc'
        ]

        return {
            'system_summary': {
                'total_barangays': len(barangays),
                'total_cdcs': system_totals['total_cdcs'],
                'total_population_0_5': system_totals['total_population'],
                'total_enrolled': system_totals['total_enrolled'],
                'total_capacity': system_totals['total_capacity'],
                'system_coverage': round(system_coverage, 1),
                'system_capacity_utilization': system_capacity_utilization,
                'total_unserved': system_totals['total_unserved'],
                'total_capacity_gap': system_totals['total_capacity_gap'],
                'total_sessions_available': system_totals['total_sessions_available'],
                'total_sessions_needed': system_totals['total_sessions_needed'],
            },
            'barangay_rankings': ranked_barangays,
            'priority_areas': priority_barangays,
            'well_served_barangays': well_served_barangays,
            'overlap_watchlist': overlap_watchlist,
            'zero_cdc_barangays': zero_cdc_barangays,
            'top_performing_barangays': ranked_barangays[:5] if len(ranked_barangays) >= 5 else ranked_barangays,
            'underperforming_barangays': ranked_barangays[-5:] if len(ranked_barangays) >= 5 else ranked_barangays,
            'system_recommendations': self._generate_system_recommendations(
                system_coverage,
                system_totals['total_unserved'],
                system_totals['total_capacity_gap'],
                len(priority_barangays),
                len(overlap_watchlist),
            ),
        }

    def get_location_based_analytics(self) -> Dict[str, Any]:
        """
        Get analytics organized by geographic location for mapping.
        """
        cdcs = CDC.objects.select_related('barangay').all()
        location_data = []

        for cdc in cdcs:
            analytics = self.get_cdc_detailed_analytics(cdc)
            location_data.append({
                'cdc_id': cdc.id,
                'cdc_name': cdc.name,
                'location_label': analytics['cdc_info']['location_label'],
                'barangay': cdc.barangay.name,
                'latitude': cdc.latitude,
                'longitude': cdc.longitude,
                'performance_score': analytics['performance_metrics']['overall_score'],
                'service_coverage': analytics['service_coverage']['barangay_overall_coverage'],
                'capacity_utilization': analytics['capacity_metrics']['capacity_utilization'],
                'served_children': analytics['service_coverage']['served_children'],
                'unserved_children': analytics['service_coverage']['barangay_unserved_children'],
                'capacity_gap': analytics['gaps_and_opportunities']['capacity_gap'],
                'sessions_per_day': cdc.sessions_per_day,
                'expansion_needed': analytics['gaps_and_opportunities']['expansion_needed'],
                'potential_overlap': analytics['gaps_and_opportunities']['potential_overlap'],
            })

        return {
            'total_cdcs': len(location_data),
            'location_data': location_data,
            'coverage_zones': self._categorize_coverage_zones(location_data),
        }

    def _categorize_coverage_zones(self, location_data: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        zones = {
            'excellent': [],
            'good': [],
            'needs_attention': [],
            'critical': [],
        }

        for cdc in location_data:
            coverage = cdc['service_coverage']
            has_gaps = cdc['unserved_children'] > 0 or cdc['capacity_gap'] > 0

            if coverage >= 95 and not has_gaps:
                zones['excellent'].append(cdc)
            elif coverage >= 80 and not has_gaps:
                zones['good'].append(cdc)
            elif coverage >= 60 or cdc['potential_overlap']:
                zones['needs_attention'].append(cdc)
            else:
                zones['critical'].append(cdc)

        return zones
