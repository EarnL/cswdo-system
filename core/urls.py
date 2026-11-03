from django.urls import path, include
from rest_framework.routers import DefaultRouter

from core.views.barangay_view import BarangayViewSet
from core.views.population_basis_view import PopulationBasisView, PopulationAdoptionStatusView
from core.views.preopening_view import PreOpeningView
from core.views.academic_year_view import AcademicYearViewSet
from core.views.cdc_view import CDCViewSet
from core.views.child_view import ChildViewSet
from core.views.report_view import ReportViewSet
from core.views.performance_view import PerformanceViewSet
from core.views.population_data_view import PopulationDataViewSet
from core.views.population_request_view import PopulationRequestViewSet, PopulationScheduleViewSet
from core.views.integration_view import (
    BarangayPopulationMetricsViewSet,
    EnrollmentDataViewSet,
    ChildrenGapAnalysisViewSet,
    SNPPlanningRecommendationViewSet,
    BarangayIntegrationStatusViewSet,
    DataIntegrationLogViewSet,
)
from core.views.feeding_program_view import FeedingProgramViewSet
from core.views.parent_seminar_view import ParentSeminarViewSet
from core.views.compliance_view import (
    AuthorityDocumentViewSet,
    PermitRecordViewSet,
    AnnualEvaluationViewSet,
    SupervisoryVisitViewSet,
)
from core.views.health_safety_view import (
    ChildHealthRecordViewSet,
    EmergencyReadinessViewSet,
    SafetyIncidentViewSet,
    ChildProtectionRecordViewSet,
)
from core.views.staffing_view import StaffProfileViewSet, StaffTrainingRecordViewSet
from core.views.physical_environment_view import PhysicalEnvironmentAssessmentViewSet
from core.views.interaction_view import InteractionObservationViewSet
from core.views.curriculum_view import CurriculumDistributionViewSet, CurriculumGuideViewSet, CurriculumPlanViewSet, ChildAssessmentRecordViewSet, StaffScheduleViewSet
from core.views.user_management_view import UserManagementViewSet
from core.views.accreditation_request_view import AccreditationRequestViewSet
from core.views.special_needs_view import SpecialNeedsAssessmentViewSet

from core.views.heatmap_view import heatmap_data, public_map_data
from core.views.dashboard_view import dashboard_summary
from core.views.performance_compute_view import compute_all_performance
from core.views.benchmark_view import benchmark_comparison
from core.views.enhanced_benchmark_view import (
    enhanced_benchmark_comparison,
    barangay_cdc_analytics,
    cdc_detailed_analytics,
    location_based_analytics,
    benchmark_dashboard_summary,
)
from core.views.prediction_view import predictive_analytics_dashboard
from core.views.notification_view import (
    notification_summary,
    notification_list,
    notification_mark_read,
    notification_mark_unread,
    notification_mark_all_read,
)
from core.views.activity_log_view import ActivityLogListView
from core.views.report_draft_view import ReportDraftViewSet
from core.views.snp_view import SNPViewSet
from core.views.auth_views import MyTokenObtainPairView, SetBarangayView, BarangayListView, UserProfileView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.services.reminder_service import ReminderService

router = DefaultRouter()
router.register(r'academic-years', AcademicYearViewSet, basename='academic-years')
router.register(r'barangays', BarangayViewSet)
router.register(r'cdcs', CDCViewSet)
router.register(r'children', ChildViewSet, basename='children')
router.register(r'reports', ReportViewSet)
router.register(r'report-drafts', ReportDraftViewSet, basename='report-drafts')
router.register(r'performance', PerformanceViewSet)
router.register(r'snps', SNPViewSet)
router.register(r'population-data', PopulationDataViewSet)
router.register(r'population-requests', PopulationRequestViewSet, basename='population-requests')
router.register(r'population-request-schedules', PopulationScheduleViewSet, basename='population-request-schedules')

# Integration viewsets - new unified data views
router.register(r'integration/population-metrics', BarangayPopulationMetricsViewSet)
router.register(r'integration/enrollment', EnrollmentDataViewSet)
router.register(r'integration/gap-analysis', ChildrenGapAnalysisViewSet)
router.register(r'integration/snp-recommendations', SNPPlanningRecommendationViewSet, basename='snp-recommendations')
router.register(r'integration/barangay-status', BarangayIntegrationStatusViewSet, basename='barangay-status')
router.register(r'integration/logs', DataIntegrationLogViewSet)
router.register(r'feeding-programs', FeedingProgramViewSet, basename='feeding-programs')
router.register(r'parent-seminars', ParentSeminarViewSet, basename='parent-seminars')
router.register(r'authority-documents', AuthorityDocumentViewSet, basename='authority-documents')
router.register(r'permit-records', PermitRecordViewSet, basename='permit-records')
router.register(r'annual-evaluations', AnnualEvaluationViewSet, basename='annual-evaluations')
router.register(r'supervisory-visits', SupervisoryVisitViewSet, basename='supervisory-visits')
router.register(r'child-health-records', ChildHealthRecordViewSet, basename='child-health-records')
router.register(r'emergency-readiness', EmergencyReadinessViewSet, basename='emergency-readiness')
router.register(r'safety-incidents', SafetyIncidentViewSet, basename='safety-incidents')
router.register(r'child-protection-records', ChildProtectionRecordViewSet, basename='child-protection-records')
router.register(r'staff-profiles', StaffProfileViewSet, basename='staff-profiles')
router.register(r'staff-training-records', StaffTrainingRecordViewSet, basename='staff-training-records')
router.register(r'physical-environment-assessments', PhysicalEnvironmentAssessmentViewSet, basename='physical-environment-assessments')
router.register(r'interaction-observations', InteractionObservationViewSet, basename='interaction-observations')
router.register(r'curriculum-plans', CurriculumPlanViewSet, basename='curriculum-plans')
router.register(r'curriculum-guides', CurriculumGuideViewSet, basename='curriculum-guides')
router.register(r'curriculum-distributions', CurriculumDistributionViewSet, basename='curriculum-distributions')
router.register(r'child-assessment-records', ChildAssessmentRecordViewSet, basename='child-assessment-records')
router.register(r'staff-schedules', StaffScheduleViewSet, basename='staff-schedules')
router.register(r'users', UserManagementViewSet, basename='users')
router.register(r'accreditation-requests', AccreditationRequestViewSet, basename='accreditation-requests')
router.register(r'special-needs-assessments', SpecialNeedsAssessmentViewSet, basename='special-needs-assessments')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reminder_list(request):
    return Response({
        'total': len(ReminderService.get_reminders(request.user)),
        'reminders': ReminderService.get_reminders(request.user, limit=12),
    })

urlpatterns = [
    path('cdcs/<int:cdc_id>/population-basis/', PopulationBasisView.as_view()),
    path('population-adoption-status/', PopulationAdoptionStatusView.as_view()),
    path('cdcs/<int:cdc_id>/pre-opening/', PreOpeningView.as_view()),
    path('cdcs/<int:cdc_id>/pre-opening/<slug:section>/', PreOpeningView.as_view()),
    path('', include(router.urls)),                     # /api/barangays, /api/cdcs, etc.
    path('heatmap/', heatmap_data, name='heatmap'),     # /api/heatmap/
    path('public-map/', public_map_data, name='public_map'),
    path('dashboard/', dashboard_summary, name='dashboard'),  # /api/dashboard/
    path('compute-performance/', compute_all_performance, name='compute_perf'),
    path('benchmarks/', benchmark_comparison, name='benchmark_comparison'),
    path('enhanced-benchmarks/', enhanced_benchmark_comparison, name='enhanced_benchmark_comparison'),
    path('barangay/<int:barangay_id>/cdc-analytics/', barangay_cdc_analytics, name='barangay_cdc_analytics'),
    path('cdc/<int:cdc_id>/detailed-analytics/', cdc_detailed_analytics, name='cdc_detailed_analytics'),
    path('location-analytics/', location_based_analytics, name='location_based_analytics'),
    path('benchmark-dashboard/', benchmark_dashboard_summary, name='benchmark_dashboard_summary'),
    path('predictive-analytics/', predictive_analytics_dashboard, name='predictive_analytics_dashboard'),
    path('notifications/', notification_summary, name='notification_summary'),
    path('notifications/all/', notification_list, name='notification_list'),
    path('notifications/mark-all-read/', notification_mark_all_read, name='notification_mark_all_read'),
    path('notifications/<int:notification_id>/mark-read/', notification_mark_read, name='notification_mark_read'),
    path('notifications/<int:notification_id>/mark-unread/', notification_mark_unread, name='notification_mark_unread'),
    path('activity-logs/', ActivityLogListView.as_view(), name='activity_logs'),
    path('reminders/', reminder_list, name='reminders'),
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('set-barangay/', SetBarangayView.as_view(), name='set_barangay'),
    path('barangays/', BarangayListView.as_view(), name='barangay_list'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
]
