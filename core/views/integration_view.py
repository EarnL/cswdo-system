from core.permissions import OfficeAnalyticsPermission
"""
Integration Views
Provides API endpoints for accessing integrated population, enrollment, gap analysis,
and SNP planning data across all barangays.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from core.models import (
    AcademicYear,
    Barangay,
    BarangayPopulationMetrics,
    EnrollmentData,
    ChildrenGapAnalysis,
    SNPPlanningRecommendation,
    DataIntegrationLog,
)
from core.serializers.integration_serializer import (
    BarangayPopulationMetricsSerializer,
    EnrollmentDataSerializer,
    ChildrenGapAnalysisSerializer,
    SNPPlanningRecommendationSerializer,
    DataIntegrationLogSerializer,
    BarangayIntegrationStatusSerializer,
)
from core.services.data_integration_service import DataIntegrationService
from core.permissions import PlanningReadOnlyAuthenticated


def get_requested_academic_year(request):
    academic_year_id = request.query_params.get('academic_year')
    if academic_year_id:
        try:
            return AcademicYear.objects.get(id=academic_year_id)
        except AcademicYear.DoesNotExist:
            return AcademicYear.get_current()
    return AcademicYear.get_current()


class BarangayPopulationMetricsViewSet(viewsets.ModelViewSet):
    """
    Provides access to population metrics for all barangays.
    Shows age-group breakdowns, vulnerable populations, etc.
    """
    queryset = BarangayPopulationMetrics.objects.select_related('barangay', 'academic_year').all()
    serializer_class = BarangayPopulationMetricsSerializer
    permission_classes = [OfficeAnalyticsPermission]
    
    def get_queryset(self):
        user = self.request.user
        academic_year = get_requested_academic_year(self.request)
        if user.role == 'cho':
            # CHO can only see their own barangay if assigned
            return BarangayPopulationMetrics.objects.none()
        else:
            # Planning, CSWDO, staff can see all
            return BarangayPopulationMetrics.objects.select_related('barangay', 'academic_year', 'source_submission').filter(
                academic_year=academic_year,
                source_submission__status='current_basis',
            )
    
    @action(detail=False, methods=['get'])
    def by_barangay(self, request):
        """Get metrics for a specific barangay"""
        barangay_id = request.query_params.get('barangay_id')
        if not barangay_id:
            return Response(
                {'error': 'barangay_id parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            academic_year = get_requested_academic_year(request)
            metrics = BarangayPopulationMetrics.objects.get(
                barangay_id=barangay_id,
                academic_year=academic_year,
                source_submission__status='current_basis',
            )
            serializer = self.get_serializer(metrics)
            return Response(serializer.data)
        except BarangayPopulationMetrics.DoesNotExist:
            return Response(
                {'error': f'No population metrics found for barangay {barangay_id}'},
                status=status.HTTP_404_NOT_FOUND
            )


class EnrollmentDataViewSet(viewsets.ModelViewSet):
    """
    Current enrollment data by barangay and program.
    """
    queryset = EnrollmentData.objects.select_related('barangay', 'academic_year').all()
    serializer_class = EnrollmentDataSerializer
    permission_classes = [OfficeAnalyticsPermission]

    def get_queryset(self):
        queryset = self.queryset.filter(
            academic_year=get_requested_academic_year(self.request),
            gap_analyses__population_metrics__source_submission__status='current_basis',
            gap_analyses__population_metrics__children_3_4__isnull=False,
        ).distinct()
        barangay_id = self.request.query_params.get('barangay_id') or self.request.query_params.get('barangay')
        if barangay_id:
            queryset = queryset.filter(barangay_id=barangay_id)
        return queryset
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary of enrollment across all barangays"""
        academic_year = get_requested_academic_year(request)
        enrollments = EnrollmentData.objects.filter(academic_year=academic_year)
        
        total_enrolled_0_5 = sum(e.total_enrolled_0_5 for e in enrollments)
        total_enrolled_6_12 = sum(e.enrolled_6_12 for e in enrollments)
        
        return Response({
            'total_enrolled_0_5': total_enrolled_0_5,
            'total_enrolled_6_12': total_enrolled_6_12,
            'total_enrolled': total_enrolled_0_5 + total_enrolled_6_12,
            'barangay_count': enrollments.count(),
        })


class ChildrenGapAnalysisViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to gap analysis (calculated automatically).
    Shows unenrolled children by age group and vulnerability.
    """
    queryset = ChildrenGapAnalysis.objects.select_related('barangay', 'academic_year', 'population_metrics', 'enrollment_data').all()
    serializer_class = ChildrenGapAnalysisSerializer
    permission_classes = [OfficeAnalyticsPermission]

    def get_queryset(self):
        return self.queryset.filter(academic_year=get_requested_academic_year(self.request), population_metrics__children_3_4__isnull=False, population_metrics__source_submission__status='current_basis')
    
    @action(detail=False, methods=['get'])
    def gaps_by_priority(self, request):
        """
        Get all gaps sorted by priority (highest gaps first).
        Helps CSWDO identify where SNP is most needed.
        """
        gaps = self.get_queryset().order_by('-public_cdc_gap_children_3_4')
        
        results = []
        for gap in gaps:
            results.append({
                'barangay': gap.barangay.name,
                'total_gap_0_5': gap.total_gap_0_5,
                'enrollment_rate_0_5': gap.enrollment_rate_0_5,
                'vulnerable_unenrolled': gap.vulnerable_children_unenrolled,
                'needs_snp_urgently': gap.total_gap_0_5 > 50 or gap.enrollment_rate_0_5 < 30,
            })
        
        return Response(results)
    
    @action(detail=False, methods=['get'])
    def vulnerable_children_analysis(self, request):
        """
        Analysis of vulnerable children across all barangays.
        Groups by vulnerability type.
        """
        gaps = self.get_queryset()
        
        results = {
            'total_vulnerable_unenrolled': 0,
            'total_working_children_unenrolled': 0,
            'barangays_with_vulnerable_gaps': [],
        }
        
        for gap in gaps:
            results['total_vulnerable_unenrolled'] += gap.vulnerable_children_unenrolled
            results['total_working_children_unenrolled'] += gap.working_children_unenrolled
            
            if gap.vulnerable_children_unenrolled > 0 or gap.working_children_unenrolled > 0:
                results['barangays_with_vulnerable_gaps'].append({
                    'barangay': gap.barangay.name,
                    'vulnerable_unenrolled': gap.vulnerable_children_unenrolled,
                    'working_children_unenrolled': gap.working_children_unenrolled,
                })
        
        return Response(results)


class SNPPlanningRecommendationViewSet(viewsets.ViewSet):
    """
    SNP Planning Recommendations based on integrated data analysis.
    CSWDO uses these to plan Supervised Neighborhood Play programs.
    """
    permission_classes = [OfficeAnalyticsPermission]
    
    def list(self, request):
        """List all SNP recommendations"""
        academic_year = get_requested_academic_year(request)
        recommendations = SNPPlanningRecommendation.objects.filter(
            academic_year=academic_year,
            gap_analysis__population_metrics__source_submission__status='current_basis', gap_analysis__population_metrics__children_3_4__isnull=False,
        ).order_by('-recommended_snp_enrollment')
        serializer = SNPPlanningRecommendationSerializer(recommendations, many=True)
        return Response(serializer.data)
    
    def retrieve(self, request, pk=None):
        """Get specific SNP recommendation"""
        recommendation = get_object_or_404(
            SNPPlanningRecommendation.objects.filter(gap_analysis__population_metrics__source_submission__status='current_basis', gap_analysis__population_metrics__children_3_4__isnull=False),
            id=pk,
        )
        serializer = SNPPlanningRecommendationSerializer(recommendation)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_barangay(self, request):
        """Get SNP recommendation for a specific barangay"""
        barangay_id = request.query_params.get('barangay_id')
        if not barangay_id:
            return Response(
                {'error': 'barangay_id parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            recommendation = SNPPlanningRecommendation.objects.get(
                barangay_id=barangay_id,
                academic_year=get_requested_academic_year(request),
                gap_analysis__population_metrics__source_submission__status='current_basis', gap_analysis__population_metrics__children_3_4__isnull=False,
            )
            serializer = SNPPlanningRecommendationSerializer(recommendation)
            return Response(serializer.data)
        except SNPPlanningRecommendation.DoesNotExist:
            return Response(
                {'error': f'No SNP recommendation found for barangay {barangay_id}'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'])
    def high_priority_barangays(self, request):
        """
        Get barangays with highest SNP enrollment needs.
        Used for CSWDO resource allocation planning.
        """
        recommendations = SNPPlanningRecommendation.objects.filter(
            academic_year=get_requested_academic_year(request),
            recommended_snp_enrollment__gt=0,
            gap_analysis__population_metrics__source_submission__status='current_basis', gap_analysis__population_metrics__children_3_4__isnull=False,
        ).order_by('-recommended_snp_enrollment')[:10]
        
        results = []
        total_recommended = 0
        total_budget = 0
        
        for rec in recommendations:
            total_recommended += rec.recommended_snp_enrollment
            total_budget += rec.total_budget_needed
            
            results.append({
                'barangay': rec.barangay.name,
                'recommended_enrollment': rec.recommended_snp_enrollment,
                'high_priority_children': rec.high_priority_children,
                'budget_needed': float(rec.total_budget_needed),
                'volunteers_needed': rec.recommended_volunteers,
                'status': rec.status,
            })
        
        return Response({
            'top_10_barangays': results,
            'total_recommended_enrollment': total_recommended,
            'total_budget_needed': float(total_budget),
        })
    
    @action(detail=False, methods=['get'])
    def budget_summary(self, request):
        """
        Budget summary for all recommended SNP programs.
        Helps CSWDO plan annual budget allocation.
        """
        recommendations = SNPPlanningRecommendation.objects.filter(
            academic_year=get_requested_academic_year(request),
            gap_analysis__population_metrics__source_submission__status='current_basis', gap_analysis__population_metrics__children_3_4__isnull=False,
        )
        
        total_enrollment = sum(r.recommended_snp_enrollment for r in recommendations)
        total_budget = sum(float(r.total_budget_needed) for r in recommendations)
        total_snack_budget = sum(float(r.recommended_snack_budget) for r in recommendations)
        total_activity_budget = sum(float(r.recommended_activity_materials_budget) for r in recommendations)
        total_volunteers = sum(r.recommended_volunteers for r in recommendations)
        
        return Response({
            'total_recommended_children': total_enrollment,
            'total_budget_needed': total_budget,
            'budget_breakdown': {
                'snacks': total_snack_budget,
                'activities': total_activity_budget,
                'volunteer_coordination': total_budget - total_snack_budget - total_activity_budget,
            },
            'total_volunteers_needed': total_volunteers,
            'barangays_with_recommendations': recommendations.filter(
                recommended_snp_enrollment__gt=0
            ).count(),
        })
    
    @action(detail=True, methods=['post'])
    def approve_recommendation(self, request, pk=None):
        """CSWDO approves an SNP recommendation"""
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only CSWDO administrators can approve recommendations'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        recommendation = get_object_or_404(
            SNPPlanningRecommendation.objects.filter(gap_analysis__population_metrics__source_submission__status='current_basis', gap_analysis__population_metrics__children_3_4__isnull=False),
            id=pk,
        )
        recommendation.status = 'approved'
        recommendation.reviewed_by = request.user
        recommendation.save()
        
        serializer = SNPPlanningRecommendationSerializer(recommendation)
        return Response({
            'message': f'SNP recommendation for {recommendation.barangay.name} approved',
            'data': serializer.data
        })


class BarangayIntegrationStatusViewSet(viewsets.ViewSet):
    """
    Complete integration status for each barangay.
    Shows the entire data flow from population to SNP planning.
    """
    permission_classes = [OfficeAnalyticsPermission]
    
    @action(detail=False, methods=['get'])
    def all_barangays(self, request):
        """Get integration status for all barangays"""
        barangays = Barangay.objects.all()
        results = []
        academic_year = get_requested_academic_year(request)
        
        for barangay in barangays:
            status_data = DataIntegrationService.get_barangay_integration_status(barangay, academic_year)
            if status_data:
                results.append(status_data)
        
        return Response(results)
    
    @action(detail=False, methods=['get'])
    def by_barangay(self, request):
        """Get integration status for a specific barangay"""
        barangay_id = request.query_params.get('barangay_id')
        if not barangay_id:
            return Response(
                {'error': 'barangay_id parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            barangay = Barangay.objects.get(id=barangay_id)
            status_data = DataIntegrationService.get_barangay_integration_status(barangay, get_requested_academic_year(request))
            
            if status_data:
                return Response(status_data)
            else:
                return Response(
                    {'error': f'No integration data found for barangay {barangay_id}'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Barangay.DoesNotExist:
            return Response(
                {'error': f'Barangay {barangay_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class DataIntegrationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Audit logs for data integration events.
    Tracks when data is processed and how it cascades through the system.
    """
    queryset = DataIntegrationLog.objects.all()
    serializer_class = DataIntegrationLogSerializer
    permission_classes = [OfficeAnalyticsPermission]
    
    def get_queryset(self):
        user = self.request.user
        if user.role not in ['admin', 'staff']:
            return DataIntegrationLog.objects.none()
        return DataIntegrationLog.objects.filter(academic_year=get_requested_academic_year(self.request))
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Get logs filtered by integration type"""
        integration_type = request.query_params.get('type')
        if not integration_type:
            return Response(
                {'error': 'type parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logs = DataIntegrationLog.objects.filter(integration_type=integration_type).order_by('-timestamp')
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
