import React from 'react';
import GlobalLoadingIndicator from './components/GlobalLoadingIndicator';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DaycareCentersPage from './pages/DaycareCentersPage';
import CDCDetailPage from './pages/CDCDetailPage';
import ReportsPage from './pages/ReportsPage';
import CDCPeriodicReportsPage from './pages/CDCPeriodicReportsPage';
import CdcReportsPage from './pages/CdcReportsPage';
import ReportFormReviewPage from './pages/ReportFormReviewPage';
import ReportDetailsPage from './pages/ReportDetailsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PredictiveAnalyticsPage from './pages/PredictiveAnalyticsPage';
import NationalBenchmarkPage from './pages/NationalBenchmarkPage';
import AccreditationPage from './pages/AccreditationPage';
import AccreditationRequirementsPage from './pages/AccreditationRequirementsPage';
import CDCRegistrationForm from './pages/CDCRegistrationForm';
import SNPPage from './pages/SNPPage';
import CDWDashboard from './pages/CDWDashboard';
import CDWCDCInformationPage from './pages/CDWCDCInformationPage';
import CDWReportForm from './pages/CDWReportForm';
import CDCProfileForm from './pages/CDCProfileForm';
import CDWReportsCenter from './pages/CDWReportsCenter';
import QuarterlyReportFormPage from './pages/QuarterlyReportFormPage';
import RegularProgramsPage from './pages/RegularProgramsPage';
import SpecialNeedsAssessmentPage from './pages/SpecialNeedsAssessmentPage';
import SpecialNeedsSummaryPage from './pages/SpecialNeedsSummaryPage';
import CDCCurriculumPage from './pages/CDCCurriculumPage';
import AdminProgramsPage from './pages/AdminProgramsPage';
import AdminProgramDetailPage from './pages/AdminProgramDetailPage';
import AdminProgramRecordDetailPage from './pages/AdminProgramRecordDetailPage';
import RoleDashboard from './pages/RoleDashboard';
import AdminLayout from './components/AdminLayout';
import RoleLayout from './components/RoleLayout';
import GrantToOperateGate from './components/GrantToOperateGate';
import MyProfile from './pages/MyProfile';
import NotificationsPage from './pages/NotificationsPage';
import CHODashboard from './pages/CHODashboard';
import PopulationRequestsPage from './pages/PopulationRequestsPage';
import CityPlanningDashboard from './pages/CityPlanningDashboard';
import PopulationDataPage from './pages/PopulationDataPage';
import CoverageMapPage from './pages/CoverageMapPage';
import PopulationMapPage from './pages/PopulationMapPage';
import ServiceGapAnalyticsPage from './pages/ServiceGapAnalyticsPage';
import UserManagementPage from './pages/UserManagementPage';
import LandingPage from './pages/LandingPage';
import CDCPapersWorkspace from './pages/CDCPapersWorkspace';
import CDCPaperDetailPage from './pages/CDCPaperDetailPage';
import StudentProfilesPage from './pages/StudentProfilesPage';
import AddChildPage from './pages/AddChildPage';
import StudentAssessmentResultsPage from './pages/StudentAssessmentResultsPage';
import HealthCheckupRecordsPage from './pages/HealthCheckupRecordsPage';

function AnimatedPage({ children }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="app-page-enter motion-stagger">
      {children}
    </div>
  );
}

function App() {
  const token = localStorage.getItem('access');
  const role = localStorage.getItem('role');
  const withRoleLayout = (roleName, element) => <RoleLayout role={roleName}>{element}</RoleLayout>;
  const withAnimation = (element) => <AnimatedPage>{element}</AnimatedPage>;

  return (
    <BrowserRouter>
      <GlobalLoadingIndicator />
      <Routes>

        {/* LOGIN */}
        <Route path="/" element={withAnimation(<LandingPage />)} />
        <Route path="/login" element={withAnimation(<Login />)} />
        <Route path="/register" element={<Navigate to="/" replace />} />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={token && role === 'admin' ? <AdminLayout /> : withAnimation(<Login />)}
        >
          <Route index element={<Dashboard />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="daycare-centers" element={<DaycareCentersPage />} />
          <Route path="daycare-centers/:cdcId" element={<CDCDetailPage />} />
          <Route path="daycare-centers/:cdcId/pre-opening" element={<AccreditationRequirementsPage review />} />
          <Route path="daycare-centers/:cdcId/papers" element={<CDCPapersWorkspace />} />
          <Route path="daycare-centers/:cdcId/papers/forms" element={<CDCDetailPage mode="records-form" />} />
          <Route path="daycare-centers/:cdcId/papers/:paperId" element={<CDCPaperDetailPage />} />
          <Route path="daycare-centers/:cdcId/edit" element={<CDCRegistrationForm />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/details/:section" element={<ReportDetailsPage />} />
          <Route path="cdc-reports/:reportMode" element={<CDCPeriodicReportsPage />} />
          <Route path="cdc-reports" element={<CDCPeriodicReportsPage />} />
          <Route path="reports/cdc/:cdcId" element={<CdcReportsPage />} />
          <Route path="reports/cdc/:cdcId/forms/:reportId" element={<ReportFormReviewPage />} />
          <Route path="population-data" element={<PopulationDataPage />} />
          <Route path="data-requests" element={<PopulationRequestsPage role="admin" />} />
          <Route path="data-requests/:requestId" element={<PopulationRequestsPage role="admin" />} />
          <Route path="service-gap-analytics" element={<ServiceGapAnalyticsPage />} />
          <Route path="coverage-map" element={<CoverageMapPage />} />
          <Route path="population-map" element={<PopulationMapPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="predictive-analytics" element={<PredictiveAnalyticsPage />} />
          <Route path="national-benchmark" element={<NationalBenchmarkPage />} />
          <Route path="accreditation" element={<AccreditationPage />} />
          <Route path="accreditation/:requestId" element={<AccreditationPage />} />
          <Route path="programs" element={<AdminProgramsPage />} />
          <Route path="programs/:programId" element={<AdminProgramDetailPage />} />
          <Route path="programs/:programId/:recordId" element={<AdminProgramRecordDetailPage />} />
          <Route path="regular-programs" element={<RegularProgramsPage />} />
          <Route path="regular-programs/:programSection" element={<RegularProgramsPage />} />
          <Route path="curriculum-assessment" element={<CDCCurriculumPage />} />
          <Route path="cdc-registration" element={<CDCRegistrationForm />} />
          <Route path="snp" element={<SNPPage />} />
          <Route path="profile" element={<MyProfile />} />
        </Route>
        <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />

        {/* CDW */}
        <Route
          path="/cdw"
          element={token && role === 'cdw' ? <CDWDashboard /> : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/report"
          element={token && role === 'cdw' ? <GrantToOperateGate wrapLayout><CDWReportForm /></GrantToOperateGate> : withAnimation(<Login />)}
        />
        <Route path="/cdw/reports/submissions/:reportId" element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><ReportFormReviewPage /></GrantToOperateGate>) : withAnimation(<Login />)} />
        <Route
          path="/cdw/reports"
          element={token && role === 'cdw' ? <GrantToOperateGate wrapLayout><CDWReportsCenter /></GrantToOperateGate> : withAnimation(<Login />)}
        />
        <Route path="/cdw/cdc-reports/:reportMode" element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><CDCPeriodicReportsPage /></GrantToOperateGate>) : withAnimation(<Login />)} />
        <Route
          path="/cdw/cdc-reports"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><CDCPeriodicReportsPage /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/cdc-information"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <CDWCDCInformationPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/cdc-information/:cdcId"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <CDCDetailPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/quarterly-reports/:reportType"
          element={token && role === 'cdw' ? <GrantToOperateGate wrapLayout><QuarterlyReportFormPage /></GrantToOperateGate> : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/form7"
          element={token && role === 'cdw' ? <CDCProfileForm /> : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/accreditation"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <AccreditationPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/accreditation-requirements/:cdcId?/:section?"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <AccreditationRequirementsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/regular-programs"
          element={token && role === 'cdw' ? <GrantToOperateGate wrapLayout><RegularProgramsPage /></GrantToOperateGate> : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/regular-programs/:programSection"
          element={token && role === 'cdw' ? <GrantToOperateGate wrapLayout><RegularProgramsPage /></GrantToOperateGate> : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/curriculum-assessment"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><CDCCurriculumPage /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/special-needs"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><SpecialNeedsAssessmentPage key="records" /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route path="/cdw/special-needs/new" element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><SpecialNeedsAssessmentPage key="new" /></GrantToOperateGate>) : withAnimation(<Login />)} />
        <Route path="/cdw/special-needs/:assessmentId" element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><SpecialNeedsAssessmentPage /></GrantToOperateGate>) : withAnimation(<Login />)} />
        <Route path="/cdw/reports/special-needs-summary" element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><SpecialNeedsSummaryPage /></GrantToOperateGate>) : withAnimation(<Login />)} />

        <Route
          path="/cdw/students"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><StudentProfilesPage /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/students/health-records"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><HealthCheckupRecordsPage /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/students/:childId/health-records"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><HealthCheckupRecordsPage /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/students/assessment-results"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><StudentAssessmentResultsPage /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/students/:childId/assessment-results"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><StudentAssessmentResultsPage /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/students/add"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><AddChildPage /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/students/:childId"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <GrantToOperateGate><StudentProfilesPage /></GrantToOperateGate>) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/profile"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <MyProfile />) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/notifications"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <NotificationsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/papers/:cdcId"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <CDCPapersWorkspace />) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/papers/:cdcId/forms"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <CDCDetailPage mode="records-form" />) : withAnimation(<Login />)}
        />
        <Route
          path="/cdw/papers/:cdcId/:paperId"
          element={token && role === 'cdw' ? withRoleLayout('cdw', <CDCPaperDetailPage />) : withAnimation(<Login />)}
        />
        <Route path="/cho/data-requests" element={token && role === 'cho' ? withRoleLayout('cho', <PopulationRequestsPage role="cho" />) : withAnimation(<Login />)} />
        <Route path="/cho/data-requests/:requestId" element={token && role === 'cho' ? withRoleLayout('cho', <PopulationRequestsPage role="cho" />) : withAnimation(<Login />)} />
        <Route path="/staff/data-requests" element={token && role === 'staff' ? withRoleLayout('staff', <PopulationRequestsPage role="staff" />) : withAnimation(<Login />)} />
        <Route path="/staff/data-requests/:requestId" element={token && role === 'staff' ? withRoleLayout('staff', <PopulationRequestsPage role="staff" />) : withAnimation(<Login />)} />
        <Route path="/planning/data-requests" element={token && (role === 'planning' || role === 'city_planning') ? withRoleLayout('planning', <PopulationRequestsPage role="planning" />) : withAnimation(<Login />)} />
        <Route path="/planning/data-requests/:requestId" element={token && (role === 'planning' || role === 'city_planning') ? withRoleLayout('planning', <PopulationRequestsPage role="planning" />) : withAnimation(<Login />)} />
        <Route path="/cho/submissions" element={token && role === 'cho' ? withRoleLayout('cho', <PopulationRequestsPage role="cho" mode="submissions" />) : withAnimation(<Login />)} />
        <Route path="/cho/submissions/earlier" element={token && role === 'cho' ? withRoleLayout('cho', <CHODashboard historyOnly />) : withAnimation(<Login />)} />
        <Route path="/cho/notifications" element={token && role === 'cho' ? withRoleLayout('cho', <NotificationsPage compact />) : withAnimation(<Login />)} />
        {/* CHO */}
        <Route
          path="/cho"
          element={token && role === 'cho' ? withRoleLayout('cho', <PopulationRequestsPage role="cho" mode="dashboard" />) : withAnimation(<Login />)}
        />

        <Route
          path="/staff"
          element={token && role === 'staff' ? <RoleDashboard role="staff" /> : withAnimation(<Login />)}
        />
        <Route
          path="/staff/operations"
          element={token && role === 'staff' ? withRoleLayout('staff', <AdminProgramsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/operations/:programId"
          element={token && role === 'staff' ? withRoleLayout('staff', <AdminProgramDetailPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/operations/:programId/:recordId"
          element={token && role === 'staff' ? withRoleLayout('staff', <AdminProgramRecordDetailPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/programs"
          element={token && role === 'staff' ? <Navigate to="/staff/operations" replace /> : withAnimation(<Login />)}
        />
        <Route
          path="/staff/reports"
          element={token && role === 'staff' ? withRoleLayout('staff', <ReportsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/reports/details/:section"
          element={token && role === 'staff' ? withRoleLayout('staff', <ReportDetailsPage />) : withAnimation(<Login />)}
        />
        <Route path="/staff/cdc-reports/:reportMode" element={token && role === 'staff' ? withRoleLayout('staff', <CDCPeriodicReportsPage />) : withAnimation(<Login />)} />
        <Route
          path="/staff/cdc-reports"
          element={token && role === 'staff' ? withRoleLayout('staff', <CDCPeriodicReportsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/daycare-centers"
          element={token && role === 'staff' ? withRoleLayout('staff', <DaycareCentersPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/daycare-centers/:cdcId/pre-opening"
          element={token && role === 'staff' ? withRoleLayout('staff', <AccreditationRequirementsPage review />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/daycare-centers/:cdcId"
          element={token && role === 'staff' ? withRoleLayout('staff', <CDCDetailPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/daycare-centers/:cdcId/papers"
          element={token && role === 'staff' ? withRoleLayout('staff', <CDCPapersWorkspace />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/daycare-centers/:cdcId/papers/forms"
          element={token && role === 'staff' ? withRoleLayout('staff', <CDCDetailPage mode="records-form" />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/daycare-centers/:cdcId/papers/:paperId"
          element={token && role === 'staff' ? withRoleLayout('staff', <CDCPaperDetailPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/reports/cdc/:cdcId"
          element={token && role === 'staff' ? withRoleLayout('staff', <CdcReportsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/reports/cdc/:cdcId/forms/:reportId"
          element={token && role === 'staff' ? withRoleLayout('staff', <ReportFormReviewPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/population-data"
          element={token && role === 'staff' ? withRoleLayout('staff', <PopulationDataPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/service-gap-analytics"
          element={token && role === 'staff' ? withRoleLayout('staff', <ServiceGapAnalyticsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/population-map"
          element={token && role === 'staff' ? withRoleLayout('staff', <PopulationMapPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/regular-programs"
          element={token && role === 'staff' ? <RegularProgramsPage /> : withAnimation(<Login />)}
        />
        <Route
          path="/staff/regular-programs/:programSection"
          element={token && role === 'staff' ? <RegularProgramsPage /> : withAnimation(<Login />)}
        />
        <Route
          path="/staff/curriculum-assessment"
          element={token && role === 'staff' ? withRoleLayout('staff', <CDCCurriculumPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/national-benchmark"
          element={token && role === 'staff' ? withRoleLayout('staff', <NationalBenchmarkPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/accreditation"
          element={token && role === 'staff' ? withRoleLayout('staff', <AccreditationPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/profile"
          element={token && role === 'staff' ? withRoleLayout('staff', <MyProfile />) : withAnimation(<Login />)}
        />
        <Route
          path="/staff/notifications"
          element={token && role === 'staff' ? withRoleLayout('staff', <NotificationsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/cho/profile"
          element={token && role === 'cho' ? withRoleLayout('cho', <MyProfile />) : withAnimation(<Login />)}
        />
        <Route
          path="/cho/*"
          element={token && role === 'cho' ? <Navigate to="/cho" replace /> : withAnimation(<Login />)}
        />

        <Route
          path="/planning"
          element={token && (role === 'planning' || role === 'city_planning') ? withRoleLayout('planning', <CityPlanningDashboard />) : withAnimation(<Login />)}
        />
        <Route
          path="/planning/profile"
          element={token && (role === 'planning' || role === 'city_planning') ? withRoleLayout('planning', <MyProfile />) : withAnimation(<Login />)}
        />
        <Route
          path="/planning/notifications"
          element={token && (role === 'planning' || role === 'city_planning') ? withRoleLayout('planning', <NotificationsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/planning/population-map"
          element={token && (role === 'planning' || role === 'city_planning') ? withRoleLayout('planning', <PopulationMapPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/planning/service-coverage"
          element={token && (role === 'planning' || role === 'city_planning') ? withRoleLayout('planning', <ServiceGapAnalyticsPage />) : withAnimation(<Login />)}
        />
        <Route
          path="/planning/*"
          element={token && (role === 'planning' || role === 'city_planning') ? <Navigate to="/planning" replace /> : withAnimation(<Login />)}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
