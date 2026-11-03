from core.permissions import OfficeAnalyticsPermission
"""
Enhanced Benchmark Comparison Views
Provides comprehensive CDC analytics with location mapping and detailed service coverage analysis
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from core.models import Barangay, CDC
from core.services.enhanced_benchmark_service import EnhancedBenchmarkService


@api_view(['GET'])
@permission_classes([OfficeAnalyticsPermission])
def enhanced_benchmark_comparison(request):
    """
    Get comprehensive system-wide benchmark comparison with detailed CDC analytics
    """
    service = EnhancedBenchmarkService()
    data = service.get_system_wide_benchmark_comparison()

    return Response({
        'status': 'success',
        'data': data,
        'metadata': {
            'description': 'Enhanced benchmark comparison with location-based CDC analytics',
            'includes': [
                'system-wide metrics',
                'barangay rankings',
                'priority areas',
                'detailed CDC analytics',
                'service coverage analysis',
                'capacity utilization',
                'gap identification'
            ]
        }
    })


@api_view(['GET'])
@permission_classes([OfficeAnalyticsPermission])
def barangay_cdc_analytics(request, barangay_id):
    """
    Get detailed CDC analytics for a specific barangay
    """
    barangay = get_object_or_404(Barangay, id=barangay_id)
    service = EnhancedBenchmarkService()
    data = service.get_barangay_cdc_comparison(barangay)

    return Response({
        'status': 'success',
        'barangay': barangay.name,
        'data': data,
        'metadata': {
            'description': f'Detailed CDC analytics for {barangay.name} barangay',
            'includes': [
                'individual CDC performance',
                'population coverage',
                'capacity analysis',
                'service gaps',
                'recommendations'
            ]
        }
    })


@api_view(['GET'])
@permission_classes([OfficeAnalyticsPermission])
def cdc_detailed_analytics(request, cdc_id):
    """
    Get comprehensive analytics for a specific CDC
    """
    cdc = get_object_or_404(CDC, id=cdc_id)
    service = EnhancedBenchmarkService()
    data = service.get_cdc_detailed_analytics(cdc)

    return Response({
        'status': 'success',
        'cdc': cdc.name,
        'barangay': cdc.barangay.name,
        'data': data,
        'metadata': {
            'description': f'Comprehensive analytics for {cdc.name} CDC',
            'includes': [
                'population data',
                'enrollment metrics',
                'capacity analysis',
                'session efficiency',
                'service coverage',
                'performance metrics',
                'gap analysis'
            ]
        }
    })


@api_view(['GET'])
@permission_classes([OfficeAnalyticsPermission])
def location_based_analytics(request):
    """
    Get location-based analytics for mapping and geographic analysis
    """
    service = EnhancedBenchmarkService()
    data = service.get_location_based_analytics()

    return Response({
        'status': 'success',
        'data': data,
        'metadata': {
            'description': 'Location-based CDC analytics for mapping',
            'includes': [
                'geographic coordinates',
                'performance scores',
                'coverage zones',
                'service gaps',
                'expansion opportunities'
            ],
            'usage': 'Use latitude/longitude for map visualization, coverage_zones for color-coding'
        }
    })


@api_view(['GET'])
@permission_classes([OfficeAnalyticsPermission])
def benchmark_dashboard_summary(request):
    """
    Get dashboard summary with key metrics and insights
    """
    service = EnhancedBenchmarkService()
    system_data = service.get_system_wide_benchmark_comparison()

    # Extract key insights
    summary = system_data['system_summary']
    top_barangays = system_data['top_performing_barangays'][:3]
    priority_areas = system_data['priority_areas'][:5]

    # Calculate additional insights
    coverage_distribution = {
        'excellent': len([b for b in system_data['barangay_rankings']
                         if b['summary_metrics']['overall_coverage'] > 90]),
        'good': len([b for b in system_data['barangay_rankings']
                    if 70 <= b['summary_metrics']['overall_coverage'] <= 90]),
        'needs_improvement': len([b for b in system_data['barangay_rankings']
                                 if b['summary_metrics']['overall_coverage'] < 70]),
    }

    return Response({
        'status': 'success',
        'dashboard_summary': {
            'system_overview': {
                'total_barangays': summary['total_barangays'],
                'total_cdcs': summary['total_cdcs'],
                'system_coverage': summary['system_coverage'],
                'total_unserved': summary['total_unserved'],
                'capacity_gap': summary['total_capacity_gap'],
            },
            'performance_distribution': coverage_distribution,
            'top_performers': [
                {
                    'barangay': b['barangay_info']['name'],
                    'coverage': b['summary_metrics']['overall_coverage'],
                    'cdcs': b['summary_metrics']['total_cdcs']
                } for b in top_barangays
            ],
            'priority_areas': [
                {
                    'barangay': b['barangay_info']['name'],
                    'coverage': b['summary_metrics']['overall_coverage'],
                    'unserved': b['summary_metrics']['total_unserved'],
                    'cdcs': b['summary_metrics']['total_cdcs']
                } for b in priority_areas
            ],
            'key_insights': system_data['system_recommendations'][:3],
        },
        'metadata': {
            'description': 'Dashboard summary for quick overview of system performance',
            'refresh_frequency': 'daily',
            'data_freshness': 'real-time'
        }
    })