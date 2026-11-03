import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import api from '../api';
import AppIcon from '../components/AppIcon';
import OfficialCdcRecord from '../components/OfficialCdcRecord';
import { getRequirementStatuses } from '../utils/accreditationRequirements';

const initialComplianceForms = {
  authority: {
    document_type: 'authority_to_operate',
    title: 'Authority to Operate',
    document_number: '',
    issued_on: '',
    expires_on: '',
    notes: '',
  },
  permit: {
    application_date: '',
    permit_type: 'renewal',
    status: 'issued',
    issued_on: '',
    expires_on: '',
    is_temporary: false,
    notes: '',
  },
  evaluation: {
    school_year: '',
    evaluation_date: '',
    readiness_status: 'progressing',
    stakeholder_inputs_summary: '',
    strengths: '',
    areas_for_improvement: '',
  },
  supervisory: {
    visit_date: '',
    status: 'completed',
    findings: '',
    recommendations: '',
    follow_up_due: '',
  },
};

const initialHealthSafetyForms = {
  child: {
    name: '',
    age: '',
    is_special_needs: false,
  },
  childHealth: {
    child: '',
    screening_date: '',
    immunization_status: 'unknown',
    height: '',
    weight: '',
    nutritional_status: 'unknown',
    vision_screening_result: '',
    hearing_screening_result: '',
    oral_health_result: '',
    allergies: '',
    dietary_restrictions: '',
    medical_notes: '',
    medical_clearance_date: '',
  },
  emergency: {
    assessment_date: '',
    has_first_aid_kit: false,
    first_aid_kit_checked_on: '',
    fire_safety_equipment_available: false,
    last_drill_date: '',
    drills_this_year: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    notes: '',
  },
  incident: {
    child: '',
    incident_type: 'injury',
    incident_date: '',
    description: '',
    action_taken: '',
    referred_to: '',
    resolved_on: '',
    status: 'open',
  },
  childProtection: {
    review_date: '',
    written_policy_available: false,
    staff_training_last_date: '',
    parent_orientation_last_date: '',
    case_opened: false,
    case_status: 'none',
    external_referral_agency: '',
    notes: '',
  },
};

const initialStaffingForms = {
  profile: {
    full_name: '',
    role_type: 'teacher',
    employment_status: 'active',
    hire_date: '',
    highest_education: 'unspecified',
    has_eccd_training: false,
    is_qualified: false,
    is_primary_caregiver: false,
    first_aid_certified: false,
    notes: '',
  },
  training: {
    staff_profile: '',
    title: '',
    training_type: 'eccd',
    provider: '',
    completed_on: '',
    valid_until: '',
    hours: '',
    certificate_number: '',
    notes: '',
  },
};

const initialEnvironmentForms = {
  assessment: {
    assessment_date: '',
    has_safe_water_supply: false,
    has_functional_sanitation: false,
    has_stable_electricity: false,
    classroom_area: '',
    building_type_observed: '',
    building_condition: 'safe',
    handwashing_station_available: false,
    outdoor_play_area_available: false,
    outdoor_area_fenced: false,
    proper_drainage: false,
    fire_safety_equipment_available: false,
    notes: '',
  },
};

const initialInteractionForms = {
  observation: {
    observation_date: '',
    staff_child_interaction_rating: 'developing',
    child_child_interaction_rating: 'developing',
    fairness_and_inclusion_observed: false,
    independence_support_observed: false,
    positive_behavior_guidance_observed: false,
    routines_and_transitions_supportive: false,
    strengths: '',
    concerns: '',
    follow_up_actions: '',
    notes: '',
  },
};

const StatCard = ({ label, value, hint, icon = 'analytics', tone = 'sky' }) => (
  <article className={`cdc-stat-card cdc-stat-card-${tone}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      </div>
      <span className="cdc-stat-icon">
        <AppIcon name={icon} className="h-5 w-5" />
      </span>
    </div>
    {hint ? <p className="mt-2 text-xs leading-4 text-slate-500">{hint}</p> : null}
  </article>
);

const DetailBlock = ({ label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
  </div>
);

const DetailSection = ({ title, icon, children, className = '' }) => (
  <section className={`cdc-section ${className}`}>
    <div className="cdc-section-header">
      <span className="cdc-section-icon">
        <AppIcon name={icon} className="h-5 w-5" />
      </span>
      <h2>{title}</h2>
    </div>
    {children}
  </section>
);

const FormCard = ({ title, eyebrow, children, className = '', ...props }) => (
  <form {...props} className={`rounded-lg border border-slate-200 bg-slate-50 p-5 ${className}`}>
    {eyebrow ? <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">{eyebrow}</p> : null}
    <h3 className="mt-1 text-lg font-black text-slate-900">{title}</h3>
    <div className="mt-5 space-y-5">{children}</div>
  </form>
);

const FormGroup = ({ title, children, columns = 'md:grid-cols-2' }) => (
  <div>
    <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
    <div className={`grid gap-3 ${columns}`}>{children}</div>
  </div>
);

const Field = ({ label, children, className = '' }) => (
  <label className={`block text-sm font-semibold text-slate-700 ${className}`}>
    <span>{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const CheckField = ({ label, children }) => (
  <label className="flex min-h-[48px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
    {children}
    <span>{label}</span>
  </label>
);

const ReadinessBar = ({ label, value, icon }) => {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  const tone = score >= 80 ? 'emerald' : score >= 50 ? 'amber' : 'rose';

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AppIcon name={icon} className="h-4 w-4 shrink-0 text-[#0f4b94]" />
          <p className="truncate text-sm font-bold text-slate-800">{label}</p>
        </div>
        <span className={`rounded-lg px-2 py-1 text-xs font-black cdc-score-${tone}`}>{score.toFixed(0)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full cdc-score-fill-${tone}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
};

function CDCDetailPage({ mode = 'profile' }) {
  const { cdcId } = useParams();
  const [cdc, setCdc] = useState(null);
  const [children, setChildren] = useState([]);
  const [environmentAssessments, setEnvironmentAssessments] = useState([]);
  const [interactionObservations, setInteractionObservations] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [staffTrainingRecords, setStaffTrainingRecords] = useState([]);
  const [curriculumPlans, setCurriculumPlans] = useState([]);
  const [childAssessmentRecords, setChildAssessmentRecords] = useState([]);
  const [staffSchedules, setStaffSchedules] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [gapRows, setGapRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [complianceMessage, setComplianceMessage] = useState('');
  const [complianceError, setComplianceError] = useState('');
  const [complianceForms, setComplianceForms] = useState(initialComplianceForms);
  const [healthSafetyForms, setHealthSafetyForms] = useState(initialHealthSafetyForms);
  const [staffingForms, setStaffingForms] = useState(initialStaffingForms);
  const [environmentForms, setEnvironmentForms] = useState(initialEnvironmentForms);
  const [interactionForms, setInteractionForms] = useState(initialInteractionForms);

  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
  const isAdminView = role === 'admin';
  const directoryPath = role === 'cdw'
    ? '/cdw/cdc-information'
    : role === 'staff'
      ? '/staff/daycare-centers'
      : '/admin/daycare-centers';
  const curriculumPath = role === 'cdw'
    ? `/cdw/curriculum-assessment?cdc=${cdcId}`
    : role === 'staff'
      ? `/staff/curriculum-assessment?cdc=${cdcId}`
      : `/admin/curriculum-assessment?cdc=${cdcId}`;
  const canManageCompliance = ['admin', 'staff'].includes(role || '');
  const canManageHealthSafety = ['admin', 'staff', 'cho', 'cdw'].includes(role || '');
  const canManageStaffing = ['admin', 'staff', 'cdw'].includes(role || '');
  const canManageCurriculum = ['admin', 'staff', 'cdw'].includes(role || '');
  const canManageEnvironment = ['admin', 'staff', 'cho', 'cdw'].includes(role || '');
  const canManageInteractions = ['admin', 'staff', 'cho', 'cdw'].includes(role || '');

  const fetchCdc = useCallback(async () => {
    try {
      setLoading(true);
      const [
        cdcResponse,
        reportsResponse,
        childrenResponse,
        environmentResponse,
        interactionResponse,
        staffProfilesResponse,
        trainingResponse,
        curriculumResponse,
        assessmentResponse,
        scheduleResponse,
        gapsResponse,
      ] = await Promise.all([
        api.get(`/cdcs/${cdcId}/`),
        api.get('/reports/'),
        api.get(`/children/?cdc=${cdcId}`),
        api.get(`/physical-environment-assessments/?cdc=${cdcId}`),
        api.get(`/interaction-observations/?cdc=${cdcId}`),
        api.get(`/staff-profiles/?cdc=${cdcId}`),
        api.get(`/staff-training-records/?cdc=${cdcId}`),
        api.get(`/curriculum-plans/?cdc=${cdcId}`),
        api.get(`/child-assessment-records/?cdc=${cdcId}`),
        api.get(`/staff-schedules/?cdc=${cdcId}`),
        api.get('/integration/gap-analysis/').catch(() => ({ data: [] })),
      ]);

      setCdc(cdcResponse.data);
      setChildren(childrenResponse.data || []);
      setEnvironmentAssessments(environmentResponse.data || []);
      setInteractionObservations(interactionResponse.data || []);
      setStaffProfiles(staffProfilesResponse.data || []);
      setStaffTrainingRecords(trainingResponse.data || []);
      setCurriculumPlans(curriculumResponse.data || []);
      setChildAssessmentRecords(assessmentResponse.data || []);
      setStaffSchedules(scheduleResponse.data || []);
      setGapRows(Array.isArray(gapsResponse.data) ? gapsResponse.data : gapsResponse.data?.results || []);
      const relatedReports = (reportsResponse.data || [])
        .filter((report) => String(report.cdc) === String(cdcId))
        .sort((left, right) => new Date(right.submitted_on) - new Date(left.submitted_on))
        .slice(0, 3);
      setRecentReports(relatedReports);
    } catch (error) {
      console.log(error);
      setCdc(null);
      setChildren([]);
      setEnvironmentAssessments([]);
      setInteractionObservations([]);
      setStaffProfiles([]);
      setStaffTrainingRecords([]);
      setCurriculumPlans([]);
      setChildAssessmentRecords([]);
      setStaffSchedules([]);
      setRecentReports([]);
      setGapRows([]);
    } finally {
      setLoading(false);
    }
  }, [cdcId]);

  useEffect(() => {
    fetchCdc();
  }, [fetchCdc]);


  const formatFieldLabel = (field) => field.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());

  const formatDateTime = (value) => {
    if (!value) {
      return 'Not available';
    }

    return new Date(value).toLocaleString();
  };

  const formatDate = (value) => {
    if (!value) {
      return 'Not available';
    }

    return new Date(value).toLocaleDateString();
  };

  const formatAuditValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return 'Empty';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'object') {
      if (value.label) {
        return value.label;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const handleComplianceChange = (section, event) => {
    const { name, value, type, checked } = event.target;
    setComplianceForms((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const handleHealthSafetyChange = (section, event) => {
    const { name, value, type, checked } = event.target;
    setHealthSafetyForms((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const handleStaffingChange = (section, event) => {
    const { name, value, type, checked } = event.target;
    setStaffingForms((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const handleEnvironmentChange = (section, event) => {
    const { name, value, type, checked } = event.target;
    setEnvironmentForms((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const handleInteractionChange = (section, event) => {
    const { name, value, type, checked } = event.target;
    setInteractionForms((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const submitComplianceForm = async (section, endpoint) => {
    setSavingKey(section);
    setComplianceMessage('');
    setComplianceError('');

    try {
      await api.post(endpoint, {
        ...complianceForms[section],
        cdc: Number(cdcId),
      });
      setComplianceMessage('Compliance record saved successfully.');
      setComplianceForms((current) => ({
        ...current,
        [section]: initialComplianceForms[section],
      }));
      await fetchCdc();
    } catch (error) {
      console.error(`Failed to save ${section} compliance record`, error);
      setComplianceError(error.response?.data?.error || 'Failed to save compliance record.');
    } finally {
      setSavingKey('');
    }
  };

  const submitHealthSafetyForm = async (section, endpoint, payloadBuilder = (form) => form) => {
    setSavingKey(section);
    setComplianceMessage('');
    setComplianceError('');

    try {
      await api.post(endpoint, payloadBuilder(healthSafetyForms[section]));
      setComplianceMessage('Health and safety record saved successfully.');
      setHealthSafetyForms((current) => ({
        ...current,
        [section]: initialHealthSafetyForms[section],
      }));
      await fetchCdc();
    } catch (error) {
      console.error(`Failed to save ${section} health and safety record`, error);
      setComplianceError(error.response?.data?.error || 'Failed to save health and safety record.');
    } finally {
      setSavingKey('');
    }
  };

  const submitStaffingForm = async (section, endpoint, payloadBuilder = (form) => form) => {
    setSavingKey(section);
    setComplianceMessage('');
    setComplianceError('');

    try {
      await api.post(endpoint, payloadBuilder(staffingForms[section]));
      setComplianceMessage('Staffing record saved successfully.');
      setStaffingForms((current) => ({
        ...current,
        [section]: initialStaffingForms[section],
      }));
      await fetchCdc();
    } catch (error) {
      console.error(`Failed to save ${section} staffing record`, error);
      setComplianceError(error.response?.data?.error || 'Failed to save staffing record.');
    } finally {
      setSavingKey('');
    }
  };

  const submitEnvironmentForm = async (section, endpoint, payloadBuilder = (form) => form) => {
    setSavingKey(section);
    setComplianceMessage('');
    setComplianceError('');

    try {
      await api.post(endpoint, payloadBuilder(environmentForms[section]));
      setComplianceMessage('Physical environment record saved successfully.');
      setEnvironmentForms((current) => ({
        ...current,
        [section]: initialEnvironmentForms[section],
      }));
      await fetchCdc();
    } catch (error) {
      console.error(`Failed to save ${section} physical environment record`, error);
      setComplianceError(error.response?.data?.error || 'Failed to save physical environment record.');
    } finally {
      setSavingKey('');
    }
  };

  const submitInteractionForm = async (section, endpoint, payloadBuilder = (form) => form) => {
    setSavingKey(section);
    setComplianceMessage('');
    setComplianceError('');

    try {
      await api.post(endpoint, payloadBuilder(interactionForms[section]));
      setComplianceMessage('Interaction observation saved successfully.');
      setInteractionForms((current) => ({
        ...current,
        [section]: initialInteractionForms[section],
      }));
      await fetchCdc();
    } catch (error) {
      console.error(`Failed to save ${section} interaction observation`, error);
      setComplianceError(error.response?.data?.error || 'Failed to save interaction observation.');
    } finally {
      setSavingKey('');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#0f4b94]"></div>
      </div>
    );
  }

  if (!cdc) {
    return (
      <div className="rounded-[26px] border border-white/80 bg-white/90 p-8 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">CDC Detail</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Center not found</h1>
        <p className="mt-3 text-slate-600">
          The selected CDC record could not be loaded. It may have been removed or is temporarily unavailable.
        </p>
        <Link
          to={directoryPath}
          className="mt-6 inline-flex items-center rounded-2xl bg-[#0f4b94] px-5 py-3 font-semibold text-white transition hover:bg-[#0b3b76]"
        >
          Back to CDC Directory
        </Link>
      </div>
    );
  }

  const capacity = Number(cdc.max_capacity) || 0;
  const enrollment = Number(cdc.current_enrollment) || 0;
  const availableSlots = Math.max(capacity - enrollment, 0);
  const populationBasis = gapRows.find((row) => Number(row.barangay) === Number(cdc.barangay)) || null;
  const complianceSnapshot = cdc.compliance_snapshot || {};
  const healthSafetySnapshot = cdc.health_safety_snapshot || {};
  const staffingSnapshot = cdc.staffing_snapshot || {};
  const physicalEnvironmentSnapshot = cdc.physical_environment_snapshot || {};
  const interactionSnapshot = cdc.interaction_snapshot || {};
  const curriculumSnapshot = cdc.curriculum_snapshot || {};
  const latestPermit = cdc.latest_permit_record;
  const latestAuthorityDocument = cdc.latest_authority_document;
  const latestAnnualEvaluation = cdc.latest_annual_evaluation;
  const latestSupervisoryVisit = cdc.latest_supervisory_visit;
  const latestChildHealthRecord = cdc.latest_child_health_record;
  const latestEmergencyReadiness = cdc.latest_emergency_readiness;
  const latestSafetyIncident = cdc.latest_safety_incident;
  const latestChildProtectionRecord = cdc.latest_child_protection_record;
  const latestStaffProfile = cdc.latest_staff_profile;
  const latestStaffTrainingRecord = cdc.latest_staff_training_record;
  const latestPhysicalEnvironmentAssessment = cdc.latest_physical_environment_assessment;
  const latestInteractionObservation = cdc.latest_interaction_observation;
  const latestCurriculumPlan = cdc.latest_curriculum_plan;
  const latestChildAssessmentRecord = cdc.latest_child_assessment_record;
  const latestStaffSchedule = cdc.latest_staff_schedule;
  const readinessItems = [
    { label: 'Compliance', value: complianceSnapshot.readiness_score, icon: 'shield' },
    { label: 'Facilities', value: physicalEnvironmentSnapshot.readiness_score, icon: 'building' },
    { label: 'Interactions', value: interactionSnapshot.readiness_score, icon: 'children' },
    { label: 'Staffing', value: staffingSnapshot.readiness_score, icon: 'users' },
    { label: 'Curriculum', value: curriculumSnapshot.readiness_score, icon: 'curriculum' },
    { label: 'Health', value: healthSafetySnapshot.readiness_score, icon: 'nutrition' },
  ];
  const recordItems = [
    { label: 'Authority Docs', value: cdc.authority_documents_count || 0 },
    { label: 'Evaluations', value: cdc.annual_evaluations_count || 0 },
    { label: 'Facility Records', value: cdc.physical_environment_assessments_count || 0 },
    { label: 'Observations', value: cdc.interaction_observations_count || 0 },
    { label: 'Staff Profiles', value: cdc.active_staff_profiles_count || 0 },
    { label: 'Health Records', value: cdc.child_health_records_count || 0 },
  ];
  const programBadges = [
    { label: 'SNP (Supervised Neighborhood Play)', active: Number(cdc.barangay_public_cdc_gap_children_3_4 || 0) > 0 || Boolean(cdc.snp_planning_note) },
    { label: 'Toddler Care', active: cdc.offers_toddler_care },
    { label: 'Preschool', active: cdc.offers_preschool },
    { label: 'Feeding', active: cdc.has_feeding_program },
    { label: 'Health Services', active: cdc.has_health_services },
    { label: 'Water', active: cdc.has_water_supply },
    { label: 'Sanitation', active: cdc.has_sanitation },
    { label: 'Electricity', active: cdc.has_electricity },
  ];

  const isCdwView = role === 'cdw';
  const isRecordsFormView = mode === 'records-form';
  const hasGrantToOperate = Boolean(cdc.has_valid_grant_to_operate);
  if (isCdwView && !isRecordsFormView && !hasGrantToOperate) {
    return <Navigate to="/cdw/accreditation-requirements" replace />;
  }
  const showRecordSummaries = !isCdwView && !isRecordsFormView;
  const showRecordForms = isRecordsFormView;
  const workspacePath = role === 'cdw'
    ? `/cdw/papers/${cdcId}`
    : role === 'staff'
      ? `/staff/daycare-centers/${cdcId}/papers`
      : `/admin/daycare-centers/${cdcId}/papers`;
  const accreditationStatus = cdc.accreditation_status || 'draft';
  const statusLabel = accreditationStatus.replaceAll('_', ' ');
  const requirementStatus = getRequirementStatuses(cdc);
  const coverageValue = populationBasis
    ? Number(populationBasis.eligible_coverage_rate_3_4 || 0)
    : Number(cdc.population_children_3_4 || 0) > 0
      ? (enrollment / Number(cdc.population_children_3_4 || 1)) * 100
      : 0;
  const accreditationActive = hasGrantToOperate || accreditationStatus === 'accredited';

  if (isAdminView && !isRecordsFormView) {
    return <OfficialCdcRecord key={cdc.id} cdc={cdc} directoryPath={directoryPath} workspacePath={workspacePath} populationBasis={populationBasis}
      relatedRecords={{ children, environment_assessments: environmentAssessments, interaction_observations: interactionObservations, staff_profiles: staffProfiles, staff_training_records: staffTrainingRecords, curriculum_plans: curriculumPlans, child_assessment_records: childAssessmentRecords, staff_schedules: staffSchedules, recent_reports: recentReports }} />;
  }

  if (isCdwView && !isRecordsFormView) {
    const compactItems = [
      { label: 'Barangay', value: cdc.barangay_name || 'Not set', icon: 'map' },
      { label: 'Address', value: cdc.address || 'Not available', icon: 'building' },
      { label: 'Contact Person', value: cdc.contact_person || 'Not set', icon: 'profile' },
      { label: 'Contact Number', value: cdc.contact_number || 'Not set', icon: 'phone' },
      { label: 'Email', value: cdc.email || 'Not set', icon: 'reports' },
      { label: 'Assigned CDW', value: cdc.assigned_cdw_name || 'Not assigned', icon: 'users' },
      { label: 'Latitude', value: cdc.latitude ?? 'N/A', icon: 'map' },
      { label: 'Longitude', value: cdc.longitude ?? 'N/A', icon: 'map' },
    ];

    const operationItems = [
      { label: 'Operating Days', value: cdc.operating_days || 'Not set', icon: 'reports' },
      { label: 'Operating Hours', value: cdc.operating_hours || 'Not set', icon: 'analytics' },
      { label: 'Total Staff', value: cdc.total_staff ?? 0, icon: 'users' },
      { label: 'Qualified Caregivers', value: cdc.qualified_caregivers ?? 0, icon: 'profile' },
      { label: 'Volunteers', value: cdc.volunteers ?? 0, icon: 'children' },
      { label: 'Establishment Date', value: cdc.establishment_date || 'Not set', icon: 'reports' },
    ];

    const recordCreated = formatDateTime(cdc.created_at);
    const recordUpdated = formatDateTime(cdc.updated_at);
    const recentReportText = recentReports.length ? `${recentReports.length} recent report${recentReports.length === 1 ? '' : 's'}` : 'No reports linked';
    const recentChangeText = cdc.audit_logs?.length ? `${cdc.audit_logs.length} recent change${cdc.audit_logs.length === 1 ? '' : 's'}` : 'No change history recorded';

    return (
      <div className="space-y-4">
        <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_310px_300px] lg:items-center">
            <div>
              <Link to={directoryPath} className="inline-flex items-center gap-2 text-sm font-bold text-[#0f4b94] hover:text-[#0b3b76]">
                <AppIcon name="chevronLeft" className="h-4 w-4" />
                Back to CDC Directory
              </Link>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-sm font-bold text-[#0f4b94]">
                <AppIcon name="map" className="h-4 w-4" />
                {cdc.barangay_name || 'Barangay not set'}
              </div>
              <h1 className="mt-4 text-3xl font-black text-slate-950">{cdc.name}</h1>
            </div>

            <div className={`rounded-lg border p-4 ${accreditationActive ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full ${accreditationActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  <AppIcon name="shield" className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Accreditation Status</p>
                  <p className={`mt-1 text-xl font-black ${accreditationActive ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {accreditationActive ? 'Active' : statusLabel}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    Grant to Operate: {hasGrantToOperate ? 'Approved' : 'Not Yet Approved'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <Link to="/cdw/accreditation-requirements" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f4b94] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0b3b76]">
                <AppIcon name="reports" className="h-5 w-5" />
                View Accreditation Requirements
              </Link>
              <Link to={workspacePath} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-[#0f4b94] hover:bg-sky-50">
                <AppIcon name="reports" className="h-5 w-5" />
                Manage Records
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Enrollment" value={enrollment} hint="Children enrolled" icon="children" tone="sky" />
            <StatCard label="Capacity" value={capacity} hint="Maximum child slots" icon="building" tone="emerald" />
            <StatCard label="Staff" value={cdc.qualified_staff_profiles_count || cdc.qualified_caregivers || 0} hint="Qualified staff" icon="users" tone="amber" />
            <StatCard label="Coverage" value={`${coverageValue.toFixed(1)}%`} hint="Enrollment vs. eligible base" icon="analytics" tone="sky" />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
          <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
              <span className="rounded-lg bg-sky-50 p-2 text-[#0f4b94]">
                <AppIcon name="building" className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-black text-slate-950">CDC Overview</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {compactItems.map((item) => (
                <DetailBlock key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </section>

          <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
              <span className="rounded-lg bg-sky-50 p-2 text-[#0f4b94]">
                <AppIcon name="users" className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-black text-slate-950">Operations & Staffing</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {operationItems.map((item) => (
                <DetailBlock key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </section>

          <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
              <span className="rounded-lg bg-sky-50 p-2 text-[#0f4b94]">
                <AppIcon name="shield" className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-black text-slate-950">Accreditation & Requirements</h2>
            </div>
            <div className="space-y-3">
              <DetailBlock label="Current Accreditation Status" value={accreditationActive ? 'Active' : statusLabel} />
              <DetailBlock label="Latest Authority Document" value={latestAuthorityDocument?.title || latestAuthorityDocument?.document_type || 'Not recorded'} />
              <DetailBlock label="Latest Permit Record" value={latestPermit ? latestPermit.status.replaceAll('_', ' ') : 'Not recorded'} />
              <DetailBlock label="Readiness / Completion" value={`${requirementStatus.readiness}% Complete`} />
            </div>
            <Link to="/cdw/accreditation-requirements" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f4b94] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0b3b76]">
              <AppIcon name="reports" className="h-5 w-5" />
              Open Accreditation Requirements
            </Link>
          </section>
        </div>

        <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
            <span className="rounded-lg bg-sky-50 p-2 text-[#0f4b94]">
              <AppIcon name="analytics" className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-black text-slate-950">Record Activity</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailBlock label="CDC Record Created" value={recordCreated} />
            <DetailBlock label="Last Updated" value={recordUpdated} />
            <DetailBlock label="Recent Reports" value={recentReportText} />
            <DetailBlock label="Recent Changes" value={recentChangeText} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="cdc-detail-page space-y-4">
      <section className="cdc-hero">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to={directoryPath} className="cdc-no-print inline-flex items-center gap-2 text-sm font-semibold text-[#0f4b94] hover:text-[#0b3b76]">
              <AppIcon name="chevronLeft" className="h-4 w-4" />
              Back to CDC Directory
            </Link>
            {isAdminView ? (
              <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#0f4b94]">
                Official CDC Record
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {cdc.barangay_name || 'Barangay not set'}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">{cdc.name}</h1>
          </div>

          <div className="cdc-no-print flex flex-wrap gap-2 lg:justify-end">
            {isAdminView ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f4b94] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0b3b76]"
              >
                <AppIcon name="print" className="h-4 w-4" />
                Print / Save PDF
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatCard label="Enrollment" value={enrollment} hint={`${availableSlots} open slot${availableSlots === 1 ? '' : 's'}`} icon="children" tone="sky" />
          <StatCard label="Capacity" value={capacity} hint="Maximum child slots" icon="building" tone="emerald" />
          <StatCard label="Staff" value={cdc.active_staff_profiles_count || 0} hint={`${cdc.qualified_staff_profiles_count || 0} qualified`} icon="users" tone="amber" />
        </div>

        {populationBasis ? (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-sky-700">Current Validated Population Basis</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-sky-950">
              {populationBasis.validated_population_summary}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <StatCard label="Eligible 3-4" value={populationBasis.population_children_3_4 || 0} hint="Official CDC target base" icon="children" tone="sky" />
              <StatCard label="CDC Enrolled" value={populationBasis.public_cdc_enrollment_children_3_4 || 0} hint="Validated student records" icon="shield" tone="emerald" />
              <StatCard label="Unreached / SNP" value={populationBasis.public_cdc_gap_children_3_4 || 0} hint="For SNP validation" icon="gap" tone="amber" />
              <StatCard label="Coverage" value={`${Number(populationBasis.eligible_coverage_rate_3_4 || 0).toFixed(1)}%`} hint="CDC enrollment vs. eligible base" icon="analytics" tone="sky" />
            </div>
          </div>
        ) : null}

        {!isCdwView && !isRecordsFormView ? (
          <>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="cdc-panel">
                <div className="mb-3 flex items-center gap-2">
                  <AppIcon name="analytics" className="h-5 w-5 text-[#0f4b94]" />
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Readiness</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {readinessItems.map((item) => (
                    <ReadinessBar key={item.label} {...item} />
                  ))}
                </div>
              </div>

              <div className="cdc-panel">
                <div className="mb-3 flex items-center gap-2">
                  <AppIcon name="reports" className="h-5 w-5 text-[#0f4b94]" />
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Records</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {recordItems.map((item) => (
                    <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs font-bold text-slate-500">{item.label}</p>
                      <p className="mt-1 text-lg font-black text-slate-950">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <AppIcon name="nutrition" className="h-5 w-5 text-sky-700" />
                <h2 className="text-sm font-black uppercase tracking-wide text-sky-800">SNP Planning Basis</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <DetailBlock label="Barangay Population Ages 3-4" value={cdc.population_children_3_4 || 0} />
                <DetailBlock label="Public CDC Enrollment" value={cdc.barangay_public_cdc_enrollment_children_3_4 || 0} />
                <DetailBlock label="Public CDC Gap Basis" value={cdc.barangay_public_cdc_gap_children_3_4 || 0} />
              </div>
              {cdc.snp_planning_note ? <p className="mt-3 text-sm text-slate-600">{cdc.snp_planning_note}</p> : null}
            </div>
          </>
        ) : null}
      </section>

      {isCdwView && !isRecordsFormView ? (
        <section className="rounded-[26px] border-2 border-blue-300 bg-blue-50 p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">📝</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900">CDC profile and accreditation status</h2>
              <p className="mt-2 text-sm text-slate-700">
                This page is focused on the center profile, assignment details, and accreditation status. Manage forms, supporting documents, and record PDFs in the Records and Documents Workspace.
              </p>
              <Link
                to={workspacePath}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                View Records and Documents Workspace
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {isCdwView && !isRecordsFormView ? (
        <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#0f4b94]">CDC Information</p>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">Profile, status, and monitoring workflow</h2>
              <p className="mt-3 text-sm text-slate-600">
                The CDC provides and maintains records. CSWDO verifies information, performs assessments and observations, records findings, and decides whether to approve, reject, or request corrections.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <DetailBlock label="Assigned CDC" value={cdc.name} />
                <DetailBlock label="Barangay" value={cdc.barangay_name || 'Not set'} />
                <DetailBlock label="Contact Person" value={cdc.contact_person || 'Not set'} />
                <DetailBlock label="Contact Number" value={cdc.contact_number || 'Not set'} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-black uppercase tracking-wide text-slate-700">Records workflow</p>
              <div className="mt-5 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="font-semibold text-slate-900">CDW Responsibilities</p>
                  <ul className="mt-3 list-inside list-disc space-y-2">
                    <li>Maintain CDC profile information and operational records.</li>
                    <li>Upload supporting documents and keep files organized by record type.</li>
                    <li>Keep source records current for CSWDO review.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">CSWDO Responsibilities</p>
                  <ul className="mt-3 list-inside list-disc space-y-2">
                    <li>Review submitted records and verify documentation.</li>
                    <li>Conduct official assessments in the Accreditation module.</li>
                    <li>Approve, request revisions, or reject documentation.</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Link
                  to={workspacePath}
                  className="block rounded-2xl bg-[#0f4b94] px-5 py-3 text-center font-semibold text-white transition hover:bg-[#0b3b76]"
                >
                  Open Records and Documents Workspace
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {!isRecordsFormView ? (
          <>
        <DetailSection title="Center Information" icon="building">
          <div className="mt-4 grid gap-3 text-slate-700">
            <DetailBlock label="Barangay" value={cdc.barangay_name || 'Not set'} />
            <DetailBlock label="Address" value={cdc.address || 'Not available'} />
            <div className="grid gap-3 md:grid-cols-2">
              <DetailBlock label="Contact Person" value={cdc.contact_person || 'Not set'} />
              <DetailBlock label="Contact Number" value={cdc.contact_number || 'Not set'} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DetailBlock label="Email" value={cdc.email || 'Not set'} />
              <DetailBlock label="Assigned CDW" value={cdc.assigned_cdw_name || 'Not assigned'} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DetailBlock label="Latitude" value={cdc.latitude ?? 'N/A'} />
              <DetailBlock label="Longitude" value={cdc.longitude ?? 'N/A'} />
            </div>
          </div>
        </DetailSection>

        <DetailSection title="Operations and Staffing" icon="users">
          <div className="mt-4 grid gap-3 md:grid-cols-2 text-slate-700">
            <DetailBlock label="Operating Days" value={cdc.operating_days || 'Not set'} />
            <DetailBlock label="Operating Hours" value={cdc.operating_hours || 'Not set'} />
            <DetailBlock label="Total Staff" value={cdc.total_staff ?? 'Not set'} />
            <DetailBlock label="Qualified Caregivers" value={cdc.qualified_caregivers ?? 'Not set'} />
            <DetailBlock label="Volunteers" value={cdc.volunteers ?? 'Not set'} />
            <DetailBlock label="Establishment Date" value={cdc.establishment_date || 'Not set'} />
          </div>
        </DetailSection>

        <DetailSection title="Programs and Facilities" icon="programs">
          <div className="mt-4 flex flex-wrap gap-2">
            {programBadges.map((item) => (
              <span key={item.label} className={`rounded-full px-3 py-1.5 text-xs font-black ${item.active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
                {item.label}
              </span>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 text-slate-700">
            <DetailBlock label="Building Type" value={cdc.building_type || 'Not set'} />
            <DetailBlock label="Total Area" value={cdc.total_area || 'Not set'} />
          </div>
          {cdc.special_notes ? <div className="mt-3"><DetailBlock label="Special Notes" value={cdc.special_notes} /></div> : null}
        </DetailSection>

        <DetailSection title="Accreditation Status" icon="shield">
          <div className="mt-4 grid gap-3 text-slate-700">
            <DetailBlock label="Current Status" value={statusLabel} />
            <DetailBlock label="Latest Authority Document" value={latestAuthorityDocument?.title || latestAuthorityDocument?.document_type || 'Not recorded'} />
            <DetailBlock label="Latest Permit" value={latestPermit ? latestPermit.status.replaceAll('_', ' ') : 'Not recorded'} />
            <DetailBlock label="Latest CSWDO Verification" value={latestSupervisoryVisit ? formatDate(latestSupervisoryVisit.visit_date) : 'Not recorded'} />
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Facility assessment results, interaction observation ratings, compliance comments, and accreditation findings are CSWDO verification records. CDWs may provide source information and supporting documents, but official ratings and findings are handled by authorized CSWDO personnel.
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              to={workspacePath}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#0f4b94] px-3 py-2 text-center text-sm font-bold leading-5 text-white transition hover:bg-[#0b3b76]"
            >
              Records and Documents
            </Link>
            {isCdwView ? (
              <Link
                to="/cdw/accreditation-requirements"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-bold leading-5 text-slate-800 transition hover:border-[#0f4b94] hover:bg-sky-50"
              >
                Accreditation Requirements
              </Link>
            ) : null}
          </div>
        </DetailSection>
          </>
        ) : (
          <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <Link to={workspacePath} className="text-sm font-semibold text-[#0f4b94] hover:text-[#0b3b76]">
              Back to Records and Documents
            </Link>
            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#0f4b94]">CDC Record Forms</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{cdc.name}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Select the form section you need below. These records feed the documents workspace; CSWDO verification results and accreditation findings remain controlled by authorized CSWDO personnel.
            </p>
          </section>
        )}

        {/* Accreditation summaries stay out of the CDW profile; forms live under Records and Documents. */}
        {(showRecordSummaries || showRecordForms) && (
          <>
            {showRecordSummaries && (
              <>
            <DetailSection title="Area II Physical Environment" icon="building" className="xl:col-span-2">
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Assessment</p>
              <p className="mt-2 text-base font-bold text-slate-900">
                {latestPhysicalEnvironmentAssessment ? formatDate(latestPhysicalEnvironmentAssessment.assessment_date) : 'Not recorded'}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {latestPhysicalEnvironmentAssessment
                  ? `${latestPhysicalEnvironmentAssessment.building_condition.replaceAll('_', ' ')} | ${latestPhysicalEnvironmentAssessment.building_type_observed || 'Building type not noted'}`
                  : 'No Area II record yet.'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Utilities Verified</p>
              <p className="mt-2 text-base font-bold text-slate-900">
                {[
                  physicalEnvironmentSnapshot.has_water_supply,
                  physicalEnvironmentSnapshot.has_sanitation,
                  physicalEnvironmentSnapshot.has_electricity,
                ].filter(Boolean).length}
                /3
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Classroom Area</p>
              <p className="mt-2 text-base font-bold text-slate-900">
                {latestPhysicalEnvironmentAssessment?.classroom_area || cdc.total_area || 'Not set'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Extra Safety Supports</p>
              <p className="mt-2 text-base font-bold text-slate-900">
                {[
                  latestPhysicalEnvironmentAssessment?.handwashing_station_available,
                  latestPhysicalEnvironmentAssessment?.outdoor_area_fenced,
                  latestPhysicalEnvironmentAssessment?.proper_drainage,
                  latestPhysicalEnvironmentAssessment?.fire_safety_equipment_available,
                ].filter(Boolean).length}
                /4
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-bold text-slate-900">Recent Records</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                  {environmentAssessments.length} records
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {environmentAssessments.length ? environmentAssessments.slice(0, 6).map((assessment) => (
                  <div key={assessment.id} className="rounded-xl bg-white px-3 py-2">
                    <p className="font-semibold text-slate-900">{formatDate(assessment.assessment_date)}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Water: {assessment.has_safe_water_supply ? 'Yes' : 'No'} | Sanitation: {assessment.has_functional_sanitation ? 'Yes' : 'No'} | Electricity: {assessment.has_stable_electricity ? 'Yes' : 'No'}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-600">No Area II assessments have been saved for this CDC yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Missing Area II Items</p>
              {physicalEnvironmentSnapshot.missing_items?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {physicalEnvironmentSnapshot.missing_items.map((item) => (
                    <span key={item} className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-sm text-emerald-900">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-emerald-900">Core Area II records are tracked.</p>
              )}
            </div>
          </div>
        </DetailSection>

        <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
          <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Area III Interactions and Relationships</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Observation</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestInteractionObservation ? formatDate(latestInteractionObservation.observation_date) : 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestInteractionObservation
                  ? `Observer: ${latestInteractionObservation.observed_by_name || 'Not set'}`
                  : 'No classroom observation has been stored for this CDC yet.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Positive Interaction Signals</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {[
                  interactionSnapshot.staff_child_interaction_positive,
                  interactionSnapshot.child_child_interaction_positive,
                  interactionSnapshot.fairness_and_inclusion_observed,
                  interactionSnapshot.independence_support_observed,
                  interactionSnapshot.positive_behavior_guidance_observed,
                  interactionSnapshot.routines_and_transitions_supportive,
                ].filter(Boolean).length}
                /6
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Counts the core Area III behaviors confirmed in the most recent observation.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Staff-Child Interaction</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestInteractionObservation
                  ? latestInteractionObservation.staff_child_interaction_rating.replaceAll('_', ' ')
                  : 'Not rated'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Direct observation of how staff respond, guide, and connect with children.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Peer Climate</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestInteractionObservation
                  ? latestInteractionObservation.child_child_interaction_rating.replaceAll('_', ' ')
                  : 'Not rated'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Captures child-child interaction quality, inclusion, and the tone of routines and transitions.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-slate-900">Recent Area III Records</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {interactionObservations.length} records
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {interactionObservations.length ? interactionObservations.slice(0, 6).map((observation) => (
                  <div key={observation.id} className="rounded-2xl bg-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{formatDate(observation.observation_date)}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Staff-child: {observation.staff_child_interaction_rating.replaceAll('_', ' ')} | Child-child: {observation.child_child_interaction_rating.replaceAll('_', ' ')}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-600">No Area III observations have been saved for this CDC yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-800">Missing Area III Items</p>
              {interactionSnapshot.missing_items?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {interactionSnapshot.missing_items.map((item) => (
                    <span key={item} className="rounded-full border border-violet-300 bg-white px-3 py-1 text-sm text-violet-900">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-violet-900">This CDC currently has the core Area III observation records tracked in the system.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
          <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Area IV Staffing and Training</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Staff Profile</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestStaffProfile?.full_name || 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestStaffProfile
                  ? `${latestStaffProfile.role_type.replaceAll('_', ' ')} | ${latestStaffProfile.is_qualified ? 'Qualified' : 'Needs qualification review'}`
                  : 'No personnel profile has been stored for this CDC yet.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Training Record</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestStaffTrainingRecord?.title || 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestStaffTrainingRecord
                  ? `${formatDate(latestStaffTrainingRecord.completed_on)} | ${latestStaffTrainingRecord.provider || 'Provider not set'}`
                  : 'Continuing education records are still missing for this CDC.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Qualified Staff</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {cdc.qualified_staff_profiles_count || 0}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Active staff currently marked as qualified in Area IV records.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ratio Coverage</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {staffingSnapshot.group_ratio_compliant ? 'Compliant' : 'Needs support'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Primary caregivers tracked: {staffingSnapshot.active_primary_caregivers_count || 0}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-slate-900">Staff Roster</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {staffProfiles.length} records
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {staffProfiles.length ? staffProfiles.slice(0, 6).map((profile) => (
                  <div key={profile.id} className="rounded-2xl bg-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{profile.full_name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {profile.role_type.replaceAll('_', ' ')} | {profile.employment_status.replaceAll('_', ' ')} | Qualified: {profile.is_qualified ? 'Yes' : 'No'}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-600">No Area IV personnel profiles have been added for this CDC yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-slate-900">Recent Training Records</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {staffTrainingRecords.length} records
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {staffTrainingRecords.length ? staffTrainingRecords.slice(0, 6).map((training) => (
                  <div key={training.id} className="rounded-2xl bg-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{training.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(training.completed_on)} | {training.staff_profile_name || 'Center-wide record'} | {training.training_type.replaceAll('_', ' ')}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-600">No staff training history has been recorded for this CDC yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-800">Missing Area IV Items</p>
            {staffingSnapshot.missing_items?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {staffingSnapshot.missing_items.map((item) => (
                  <span key={item} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-sm text-amber-900">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-amber-900">This CDC currently has the core Area IV staffing records tracked in the system.</p>
            )}
          </div>
        </section>

        <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Area V Curriculum and Assessment</p>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">Written plans, authentic assessments, and staffing schedule</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Area V now reads from direct curriculum plans, child assessment records, and staff schedules instead of report-only proxies.
              </p>
            </div>
            {canManageCurriculum ? (
              <Link
                to={curriculumPath}
                className="inline-flex items-center justify-center rounded-2xl bg-[#0f4b94] px-5 py-3 font-semibold text-white transition hover:bg-[#0b3b76]"
              >
                Open Area V Workspace
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Curriculum Plan</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestCurriculumPlan?.curriculum_title || latestCurriculumPlan?.school_year || 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestCurriculumPlan
                  ? `${latestCurriculumPlan.school_year} | NELF: ${latestCurriculumPlan.nelf_aligned ? 'Yes' : 'No'} | ELDS: ${latestCurriculumPlan.elds_aligned ? 'Yes' : 'No'}`
                  : 'No written curriculum plan has been stored for this CDC yet.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Child Assessment</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestChildAssessmentRecord?.child_name || 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestChildAssessmentRecord
                  ? `${latestChildAssessmentRecord.assessment_method.replaceAll('_', ' ')} | ${latestChildAssessmentRecord.domain.replaceAll('_', ' ')}`
                  : 'No authentic child assessment has been stored yet.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Staff Schedule</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestStaffSchedule?.effective_from || 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestStaffSchedule
                  ? `Teachers: ${latestStaffSchedule.teacher_count} | Assistants: ${latestStaffSchedule.assistant_count}`
                  : 'No current staff schedule has been stored yet.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Assessment Coverage</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {`${Number(curriculumSnapshot.assessment_coverage || 0).toFixed(0)}%`}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Children with at least one linked Area V assessment record.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-slate-900">Curriculum Plans</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {curriculumPlans.length} records
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {curriculumPlans.length ? curriculumPlans.slice(0, 6).map((plan) => (
                  <div key={plan.id} className="rounded-2xl bg-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{plan.curriculum_title || plan.school_year}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {plan.school_year} | Play-based: {plan.play_based ? 'Yes' : 'No'}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-600">No Area V curriculum plans have been added for this CDC yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-slate-900">Assessment Records</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {childAssessmentRecords.length} records
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {childAssessmentRecords.length ? childAssessmentRecords.slice(0, 6).map((record) => (
                  <div key={record.id} className="rounded-2xl bg-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{record.child_name || 'Center-wide assessment'}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {record.assessment_method.replaceAll('_', ' ')} | {record.domain.replaceAll('_', ' ')} | {formatDate(record.assessment_date)}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-600">No Area V child assessments have been added for this CDC yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-slate-900">Staff Schedules</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {staffSchedules.length} records
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {staffSchedules.length ? staffSchedules.slice(0, 6).map((schedule) => (
                  <div key={schedule.id} className="rounded-2xl bg-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{formatDate(schedule.effective_from)}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Teachers: {schedule.teacher_count} | Assistants: {schedule.assistant_count} | Trained adults: {schedule.trained_adult_count}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-600">No Area V staff schedules have been added for this CDC yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-800">Missing Area V Items</p>
            {curriculumSnapshot.missing_items?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {curriculumSnapshot.missing_items.map((item) => (
                  <span key={item} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-sm text-amber-900">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-amber-900">This CDC currently has the core Area V curriculum records tracked in the system.</p>
            )}
          </div>
        </section>

        <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
          <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Health, Safety, and Child Protection</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Child Health Record</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestChildHealthRecord?.child_name || 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestChildHealthRecord
                  ? `${formatDate(latestChildHealthRecord.screening_date)} | ${latestChildHealthRecord.nutritional_status.replaceAll('_', ' ')}`
                  : 'Child-level health records are still missing for this CDC.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Emergency Readiness</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestEmergencyReadiness ? formatDate(latestEmergencyReadiness.assessment_date) : 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestEmergencyReadiness
                  ? `First aid: ${latestEmergencyReadiness.has_first_aid_kit ? 'Yes' : 'No'} | Drills this year: ${latestEmergencyReadiness.drills_this_year || 0}`
                  : 'Emergency readiness assessment has not been logged yet.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Safety Incident</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestSafetyIncident ? latestSafetyIncident.incident_type.replaceAll('_', ' ') : 'No incident logged'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestSafetyIncident
                  ? `${formatDate(latestSafetyIncident.incident_date)} | ${latestSafetyIncident.status.replaceAll('_', ' ')}`
                  : 'Incident logging is available but no entries exist yet.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Child Protection Review</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestChildProtectionRecord ? formatDate(latestChildProtectionRecord.review_date) : 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestChildProtectionRecord
                  ? `Policy on file: ${latestChildProtectionRecord.written_policy_available ? 'Yes' : 'No'} | Case status: ${latestChildProtectionRecord.case_status.replaceAll('_', ' ')}`
                  : 'Child protection review records are still missing.'}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-800">Missing Area I Items</p>
            {healthSafetySnapshot.missing_items?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {healthSafetySnapshot.missing_items.map((item) => (
                  <span key={item} className="rounded-full border border-rose-300 bg-white px-3 py-1 text-sm text-rose-900">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-rose-900">This CDC currently has the core Area I records tracked in the system.</p>
            )}
          </div>
        </section>

        <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
          <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Compliance and Permit Readiness</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Authority Document</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestAuthorityDocument?.title || latestAuthorityDocument?.document_type || 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestAuthorityDocument
                  ? `${latestAuthorityDocument.document_number || 'No number'} | ${latestAuthorityDocument.is_current ? 'Current' : 'Expired'}`
                  : 'Add an authority document to support Area VII and VIII documentation.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Permit</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestPermit ? latestPermit.status.replaceAll('_', ' ') : 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestPermit
                  ? `Applied ${formatDate(latestPermit.application_date)}${latestPermit.expires_on ? ` | Expires ${formatDate(latestPermit.expires_on)}` : ''}`
                  : 'Permit records will appear here after review or manual entry.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Annual Evaluation</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestAnnualEvaluation?.school_year || 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestAnnualEvaluation
                  ? `${formatDate(latestAnnualEvaluation.evaluation_date)} | ${latestAnnualEvaluation.readiness_status.replaceAll('_', ' ')}`
                  : 'Annual internal evaluation records are still missing for this CDC.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Supervisory Visit</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {latestSupervisoryVisit ? formatDate(latestSupervisoryVisit.visit_date) : 'Not recorded'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestSupervisoryVisit
                  ? `${latestSupervisoryVisit.status.replaceAll('_', ' ')} | ${latestSupervisoryVisit.supervisor_name || 'Supervisor not set'}`
                  : 'No supervisory visit has been logged yet.'}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-800">Missing Compliance Items</p>
            {complianceSnapshot.missing_items?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {complianceSnapshot.missing_items.map((item) => (
                  <span key={item} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-sm text-amber-900">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-amber-900">This CDC currently has the core permit and management records tracked in the system.</p>
            )}
          </div>
        </section>

              </>
            )}

        {showRecordForms && canManageCompliance ? (
          <section id="compliance-documents-form" className="scroll-mt-24 rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Compliance Actions</p>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">Manage permit, evaluation, and supervisory records</h2>
                <p className="mt-2 text-sm text-slate-600">
                  These records are maintained by authorized CSWDO staff and are reflected as read-only compliance data for CDWs.
                </p>
              </div>
              {complianceMessage ? <p className="text-sm font-semibold text-emerald-700">{complianceMessage}</p> : null}
              {complianceError ? <p className="text-sm font-semibold text-rose-700">{complianceError}</p> : null}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitComplianceForm('authority', '/authority-documents/');
                }}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-lg font-semibold text-slate-900">Authority Document</p>
                <div className="mt-4 grid gap-4">
                  <select
                    name="document_type"
                    value={complianceForms.authority.document_type}
                    onChange={(event) => handleComplianceChange('authority', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="authority_to_operate">Authority to Operate</option>
                    <option value="business_permit">Business Permit</option>
                    <option value="ownership_document">Ownership or Organization Document</option>
                    <option value="barangay_resolution">Barangay or LGU Resolution</option>
                    <option value="inspection_report">Inspection Report</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="text"
                    name="title"
                    value={complianceForms.authority.title}
                    onChange={(event) => handleComplianceChange('authority', event)}
                    placeholder="Document title"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <input
                    type="text"
                    name="document_number"
                    value={complianceForms.authority.document_number}
                    onChange={(event) => handleComplianceChange('authority', event)}
                    placeholder="Document number"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="date"
                      name="issued_on"
                      value={complianceForms.authority.issued_on}
                      onChange={(event) => handleComplianceChange('authority', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                    <input
                      type="date"
                      name="expires_on"
                      value={complianceForms.authority.expires_on}
                      onChange={(event) => handleComplianceChange('authority', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </div>
                  <textarea
                    name="notes"
                    rows="3"
                    value={complianceForms.authority.notes}
                    onChange={(event) => handleComplianceChange('authority', event)}
                    placeholder="Authority notes"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <button
                    type="submit"
                    disabled={savingKey === 'authority'}
                    className="rounded-2xl bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'authority' ? 'Saving...' : 'Save Authority Document'}
                  </button>
                </div>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitComplianceForm('permit', '/permit-records/');
                }}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-lg font-semibold text-slate-900">Permit Record</p>
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="date"
                      name="application_date"
                      value={complianceForms.permit.application_date}
                      onChange={(event) => handleComplianceChange('permit', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                    <select
                      name="permit_type"
                      value={complianceForms.permit.permit_type}
                      onChange={(event) => handleComplianceChange('permit', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    >
                      <option value="initial">Initial Permit</option>
                      <option value="renewal">Renewal Permit</option>
                      <option value="temporary">Temporary Permit</option>
                    </select>
                  </div>
                  <select
                    name="status"
                    value={complianceForms.permit.status}
                    onChange={(event) => handleComplianceChange('permit', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="issued">Issued</option>
                    <option value="temporary">Temporary Permit</option>
                    <option value="expired">Expired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="date"
                      name="issued_on"
                      value={complianceForms.permit.issued_on}
                      onChange={(event) => handleComplianceChange('permit', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                    <input
                      type="date"
                      name="expires_on"
                      value={complianceForms.permit.expires_on}
                      onChange={(event) => handleComplianceChange('permit', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="is_temporary"
                      checked={complianceForms.permit.is_temporary}
                      onChange={(event) => handleComplianceChange('permit', event)}
                    />
                    Mark as temporary permit
                  </label>
                  <textarea
                    name="notes"
                    rows="3"
                    value={complianceForms.permit.notes}
                    onChange={(event) => handleComplianceChange('permit', event)}
                    placeholder="Permit notes"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <button
                    type="submit"
                    disabled={savingKey === 'permit'}
                    className="rounded-2xl bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'permit' ? 'Saving...' : 'Save Permit Record'}
                  </button>
                </div>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitComplianceForm('evaluation', '/annual-evaluations/');
                }}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-lg font-semibold text-slate-900">Annual Evaluation</p>
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="text"
                      name="school_year"
                      value={complianceForms.evaluation.school_year}
                      onChange={(event) => handleComplianceChange('evaluation', event)}
                      placeholder="School year, e.g. 2026-2027"
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                    <input
                      type="date"
                      name="evaluation_date"
                      value={complianceForms.evaluation.evaluation_date}
                      onChange={(event) => handleComplianceChange('evaluation', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </div>
                  <select
                    name="readiness_status"
                    value={complianceForms.evaluation.readiness_status}
                    onChange={(event) => handleComplianceChange('evaluation', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="ready">Ready for Recognition</option>
                    <option value="progressing">Progressing</option>
                    <option value="needs_support">Needs Support</option>
                  </select>
                  <textarea
                    name="stakeholder_inputs_summary"
                    rows="3"
                    value={complianceForms.evaluation.stakeholder_inputs_summary}
                    onChange={(event) => handleComplianceChange('evaluation', event)}
                    placeholder="Stakeholder inputs summary"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <textarea
                    name="strengths"
                    rows="3"
                    value={complianceForms.evaluation.strengths}
                    onChange={(event) => handleComplianceChange('evaluation', event)}
                    placeholder="Strengths observed"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <textarea
                    name="areas_for_improvement"
                    rows="3"
                    value={complianceForms.evaluation.areas_for_improvement}
                    onChange={(event) => handleComplianceChange('evaluation', event)}
                    placeholder="Areas for improvement"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <button
                    type="submit"
                    disabled={savingKey === 'evaluation'}
                    className="rounded-2xl bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'evaluation' ? 'Saving...' : 'Save Annual Evaluation'}
                  </button>
                </div>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitComplianceForm('supervisory', '/supervisory-visits/');
                }}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-lg font-semibold text-slate-900">Supervisory Visit</p>
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="date"
                      name="visit_date"
                      value={complianceForms.supervisory.visit_date}
                      onChange={(event) => handleComplianceChange('supervisory', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                    <select
                      name="status"
                      value={complianceForms.supervisory.status}
                      onChange={(event) => handleComplianceChange('supervisory', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    >
                      <option value="completed">Completed</option>
                      <option value="follow_up_needed">Follow-up Needed</option>
                      <option value="closed">Closed</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>
                  <textarea
                    name="findings"
                    rows="3"
                    value={complianceForms.supervisory.findings}
                    onChange={(event) => handleComplianceChange('supervisory', event)}
                    placeholder="Key findings from the visit"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <textarea
                    name="recommendations"
                    rows="3"
                    value={complianceForms.supervisory.recommendations}
                    onChange={(event) => handleComplianceChange('supervisory', event)}
                    placeholder="Recommendations and next steps"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <input
                    type="date"
                    name="follow_up_due"
                    value={complianceForms.supervisory.follow_up_due}
                    onChange={(event) => handleComplianceChange('supervisory', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <button
                    type="submit"
                    disabled={savingKey === 'supervisory'}
                    className="rounded-2xl bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'supervisory' ? 'Saving...' : 'Save Supervisory Visit'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        {showRecordForms && canManageEnvironment ? (
          <section id="facility-assessment-form" className="scroll-mt-24 rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Area II Actions</p>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">Add a physical environment assessment</h2>
                <p className="mt-2 text-sm text-slate-600">
                  This form writes Area II facility records into the system so benchmark scoring can rely on observed utilities, space, and building documentation.
                </p>
              </div>
              {complianceMessage ? <p className="text-sm font-semibold text-emerald-700">{complianceMessage}</p> : null}
              {complianceError ? <p className="text-sm font-semibold text-rose-700">{complianceError}</p> : null}
            </div>

            <FormCard
              title="Physical Environment Assessment"
              eyebrow="Area II"
              onSubmit={(event) => {
                event.preventDefault();
                submitEnvironmentForm('assessment', '/physical-environment-assessments/', (form) => ({
                  ...form,
                  cdc: Number(cdcId),
                  classroom_area: form.classroom_area === '' ? null : Number(form.classroom_area),
                }));
              }}
              className="mt-6"
            >
              <FormGroup title="Assessment Details">
                <Field label="Assessment date">
                  <input
                    type="date"
                    name="assessment_date"
                    value={environmentForms.assessment.assessment_date}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </Field>
                <Field label="Building condition">
                  <select
                    name="building_condition"
                    value={environmentForms.assessment.building_condition}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  >
                    <option value="safe">Safe and sound</option>
                    <option value="minor_repairs">Needs minor repairs</option>
                    <option value="major_repairs">Needs major repairs</option>
                    <option value="unsafe">Unsafe</option>
                  </select>
                </Field>
                <Field label="Classroom area">
                  <input
                    type="number"
                    name="classroom_area"
                    value={environmentForms.assessment.classroom_area}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                    placeholder="Square meters"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    min="0"
                    step="0.01"
                  />
                </Field>
                <Field label="Observed building type">
                  <select
                    name="building_type_observed"
                    value={environmentForms.assessment.building_type_observed}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  >
                    <option value="">Select building type</option>
                    <option value="owned">Owned building</option>
                    <option value="rented">Rented building</option>
                    <option value="barangay">Barangay hall</option>
                    <option value="school">School facility</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </FormGroup>

              <FormGroup title="Utilities and Safety Checks" columns="sm:grid-cols-2 xl:grid-cols-4">
                <CheckField label="Safe water supply">
                  <input
                    type="checkbox"
                    name="has_safe_water_supply"
                    checked={environmentForms.assessment.has_safe_water_supply}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                  />
                </CheckField>
                <CheckField label="Functional sanitation">
                  <input
                    type="checkbox"
                    name="has_functional_sanitation"
                    checked={environmentForms.assessment.has_functional_sanitation}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                  />
                </CheckField>
                <CheckField label="Stable electricity">
                  <input
                    type="checkbox"
                    name="has_stable_electricity"
                    checked={environmentForms.assessment.has_stable_electricity}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                  />
                </CheckField>
                <CheckField label="Handwashing station">
                  <input
                    type="checkbox"
                    name="handwashing_station_available"
                    checked={environmentForms.assessment.handwashing_station_available}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                  />
                </CheckField>
                <CheckField label="Outdoor play area">
                  <input
                    type="checkbox"
                    name="outdoor_play_area_available"
                    checked={environmentForms.assessment.outdoor_play_area_available}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                  />
                </CheckField>
                <CheckField label="Fenced outdoor area">
                  <input
                    type="checkbox"
                    name="outdoor_area_fenced"
                    checked={environmentForms.assessment.outdoor_area_fenced}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                  />
                </CheckField>
                <CheckField label="Proper drainage">
                  <input
                    type="checkbox"
                    name="proper_drainage"
                    checked={environmentForms.assessment.proper_drainage}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                  />
                </CheckField>
                <CheckField label="Fire safety equipment">
                  <input
                    type="checkbox"
                    name="fire_safety_equipment_available"
                    checked={environmentForms.assessment.fire_safety_equipment_available}
                    onChange={(event) => handleEnvironmentChange('assessment', event)}
                  />
                </CheckField>
              </FormGroup>

              <Field label="Notes, repairs needed, or site observations">
                <textarea
                  name="notes"
                  rows="4"
                  value={environmentForms.assessment.notes}
                  onChange={(event) => handleEnvironmentChange('assessment', event)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                ></textarea>
              </Field>
              <button
                type="submit"
                disabled={savingKey === 'assessment'}
                className="w-full rounded-lg bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {savingKey === 'assessment' ? 'Saving...' : 'Save Area II Assessment'}
              </button>
            </FormCard>
          </section>
        ) : null}

        {showRecordForms && canManageInteractions ? (
          <section id="interaction-observation-form" className="scroll-mt-24 rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Area III Actions</p>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">Add an interaction observation</h2>
                <p className="mt-2 text-sm text-slate-600">
                  This form records classroom observation details so Area III scoring can reflect interaction quality, inclusion, and behavior guidance.
                </p>
              </div>
              {complianceMessage ? <p className="text-sm font-semibold text-emerald-700">{complianceMessage}</p> : null}
              {complianceError ? <p className="text-sm font-semibold text-rose-700">{complianceError}</p> : null}
            </div>

            <FormCard
              title="Interaction Observation"
              eyebrow="Area III"
              onSubmit={(event) => {
                event.preventDefault();
                submitInteractionForm('observation', '/interaction-observations/', (form) => ({
                  ...form,
                  cdc: Number(cdcId),
                }));
              }}
              className="mt-6"
            >
              <FormGroup title="Observation Details">
                <Field label="Observation date">
                  <input
                    type="date"
                    name="observation_date"
                    value={interactionForms.observation.observation_date}
                    onChange={(event) => handleInteractionChange('observation', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </Field>
                <div className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                  The observer is recorded automatically from the signed-in user.
                </div>
              </FormGroup>

              <FormGroup title="Interaction Ratings">
                <Field label="Staff-child interaction">
                  <select
                    name="staff_child_interaction_rating"
                    value={interactionForms.observation.staff_child_interaction_rating}
                    onChange={(event) => handleInteractionChange('observation', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  >
                    <option value="supportive">Supportive and positive</option>
                    <option value="developing">Developing or inconsistent</option>
                    <option value="needs_support">Needs support</option>
                  </select>
                </Field>
                <Field label="Child-child interaction">
                  <select
                    name="child_child_interaction_rating"
                    value={interactionForms.observation.child_child_interaction_rating}
                    onChange={(event) => handleInteractionChange('observation', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  >
                    <option value="supportive">Supportive and positive</option>
                    <option value="developing">Developing or inconsistent</option>
                    <option value="needs_support">Needs support</option>
                  </select>
                </Field>
              </FormGroup>

              <FormGroup title="Observed Practices" columns="sm:grid-cols-2 xl:grid-cols-4">
                <CheckField label="Fairness and inclusion">
                  <input
                    type="checkbox"
                    name="fairness_and_inclusion_observed"
                    checked={interactionForms.observation.fairness_and_inclusion_observed}
                    onChange={(event) => handleInteractionChange('observation', event)}
                  />
                </CheckField>
                <CheckField label="Independence support">
                  <input
                    type="checkbox"
                    name="independence_support_observed"
                    checked={interactionForms.observation.independence_support_observed}
                    onChange={(event) => handleInteractionChange('observation', event)}
                  />
                </CheckField>
                <CheckField label="Positive behavior guidance">
                  <input
                    type="checkbox"
                    name="positive_behavior_guidance_observed"
                    checked={interactionForms.observation.positive_behavior_guidance_observed}
                    onChange={(event) => handleInteractionChange('observation', event)}
                  />
                </CheckField>
                <CheckField label="Supportive routines">
                  <input
                    type="checkbox"
                    name="routines_and_transitions_supportive"
                    checked={interactionForms.observation.routines_and_transitions_supportive}
                    onChange={(event) => handleInteractionChange('observation', event)}
                  />
                </CheckField>
              </FormGroup>

              <FormGroup title="Findings and Follow-up">
                <Field label="Strengths">
                  <textarea
                    name="strengths"
                    rows="3"
                    value={interactionForms.observation.strengths}
                    onChange={(event) => handleInteractionChange('observation', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  ></textarea>
                </Field>
                <Field label="Concerns">
                  <textarea
                    name="concerns"
                    rows="3"
                    value={interactionForms.observation.concerns}
                    onChange={(event) => handleInteractionChange('observation', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  ></textarea>
                </Field>
                <Field label="Follow-up actions">
                  <textarea
                    name="follow_up_actions"
                    rows="3"
                    value={interactionForms.observation.follow_up_actions}
                    onChange={(event) => handleInteractionChange('observation', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  ></textarea>
                </Field>
                <Field label="Additional notes">
                  <textarea
                    name="notes"
                    rows="3"
                    value={interactionForms.observation.notes}
                    onChange={(event) => handleInteractionChange('observation', event)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  ></textarea>
                </Field>
              </FormGroup>
              <button
                type="submit"
                disabled={savingKey === 'observation'}
                className="w-full rounded-lg bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {savingKey === 'observation' ? 'Saving...' : 'Save Area III Observation'}
              </button>
            </FormCard>
          </section>
        ) : null}

        {showRecordForms && canManageStaffing ? (
          <section id="staff-training-form" className="scroll-mt-24 rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Area IV Actions</p>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">Add staff profiles and training records</h2>
                <p className="mt-2 text-sm text-slate-600">
                  These forms add Area IV staffing records so benchmark scoring no longer depends on simple staff-count proxies alone.
                </p>
              </div>
              {complianceMessage ? <p className="text-sm font-semibold text-emerald-700">{complianceMessage}</p> : null}
              {complianceError ? <p className="text-sm font-semibold text-rose-700">{complianceError}</p> : null}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <FormCard
                title="Staff Profile"
                eyebrow="Area IV"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitStaffingForm('profile', '/staff-profiles/', (form) => ({
                    ...form,
                    cdc: Number(cdcId),
                  }));
                }}
              >
                <FormGroup title="Basic Details">
                  <input
                    type="text"
                    name="full_name"
                    value={staffingForms.profile.full_name}
                    onChange={(event) => handleStaffingChange('profile', event)}
                    placeholder="Staff full name"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    required
                  />
                  <select
                    name="role_type"
                    value={staffingForms.profile.role_type}
                    onChange={(event) => handleStaffingChange('profile', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="cdw">Child Development Worker</option>
                    <option value="teacher">Teacher or Caregiver</option>
                    <option value="assistant">Teacher Aide or Assistant</option>
                    <option value="health">Health or Nutrition Personnel</option>
                    <option value="volunteer">Volunteer</option>
                    <option value="admin_support">Administrative or Support Staff</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    name="employment_status"
                    value={staffingForms.profile.employment_status}
                    onChange={(event) => handleStaffingChange('profile', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <input
                    type="date"
                    name="hire_date"
                    value={staffingForms.profile.hire_date}
                    onChange={(event) => handleStaffingChange('profile', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                </FormGroup>

                <FormGroup title="Qualifications">
                  <select
                    name="highest_education"
                    value={staffingForms.profile.highest_education}
                    onChange={(event) => handleStaffingChange('profile', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="unspecified">Education not specified</option>
                    <option value="high_school">High School</option>
                    <option value="vocational">Vocational or Technical</option>
                    <option value="college_level">College Level</option>
                    <option value="bachelors">Bachelor&apos;s Degree</option>
                    <option value="masters">Master&apos;s Degree or Higher</option>
                    <option value="other">Other</option>
                  </select>
                  <CheckField label="ECCD or early childhood training completed">
                    <input
                      type="checkbox"
                      name="has_eccd_training"
                      checked={staffingForms.profile.has_eccd_training}
                      onChange={(event) => handleStaffingChange('profile', event)}
                    />
                  </CheckField>
                  <CheckField label="Qualified">
                      <input
                        type="checkbox"
                        name="is_qualified"
                        checked={staffingForms.profile.is_qualified}
                        onChange={(event) => handleStaffingChange('profile', event)}
                      />
                  </CheckField>
                  <CheckField label="Counts for ratio">
                      <input
                        type="checkbox"
                        name="is_primary_caregiver"
                        checked={staffingForms.profile.is_primary_caregiver}
                        onChange={(event) => handleStaffingChange('profile', event)}
                      />
                  </CheckField>
                  <CheckField label="First aid certified">
                      <input
                        type="checkbox"
                        name="first_aid_certified"
                        checked={staffingForms.profile.first_aid_certified}
                        onChange={(event) => handleStaffingChange('profile', event)}
                      />
                  </CheckField>
                </FormGroup>

                <Field label="Notes">
                  <textarea
                    name="notes"
                    rows="3"
                    value={staffingForms.profile.notes}
                    onChange={(event) => handleStaffingChange('profile', event)}
                    placeholder="Role, assignment, or qualification notes"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  ></textarea>
                </Field>
                  <button
                    type="submit"
                    disabled={savingKey === 'profile'}
                    className="w-full rounded-lg bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'profile' ? 'Saving...' : 'Save Staff Profile'}
                  </button>
              </FormCard>

              <FormCard
                title="Training Record"
                eyebrow="Area IV"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitStaffingForm('training', '/staff-training-records/', (form) => ({
                    ...form,
                    cdc: Number(cdcId),
                    staff_profile: form.staff_profile ? Number(form.staff_profile) : null,
                    hours: form.hours === '' ? null : Number(form.hours),
                  }));
                }}
              >
                <FormGroup title="Training Details">
                  <select
                    name="staff_profile"
                    value={staffingForms.training.staff_profile}
                    onChange={(event) => handleStaffingChange('training', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="">Center-wide or unlinked training</option>
                    {staffProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="title"
                    value={staffingForms.training.title}
                    onChange={(event) => handleStaffingChange('training', event)}
                    placeholder="Training title"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    required
                  />
                  <select
                    name="training_type"
                    value={staffingForms.training.training_type}
                    onChange={(event) => handleStaffingChange('training', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="eccd">ECCD or Early Childhood</option>
                    <option value="first_aid_cpr">First Aid or CPR</option>
                    <option value="child_protection">Child Protection</option>
                    <option value="inclusive_education">Inclusive Education</option>
                    <option value="health_nutrition">Health or Nutrition</option>
                    <option value="emergency_preparedness">Emergency Preparedness</option>
                    <option value="curriculum_assessment">Curriculum or Assessment</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="text"
                    name="provider"
                    value={staffingForms.training.provider}
                    onChange={(event) => handleStaffingChange('training', event)}
                    placeholder="Training provider"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                </FormGroup>

                <FormGroup title="Dates and Certificate">
                  <input
                    type="date"
                    name="completed_on"
                    value={staffingForms.training.completed_on}
                    onChange={(event) => handleStaffingChange('training', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <input
                    type="date"
                    name="valid_until"
                    value={staffingForms.training.valid_until}
                    onChange={(event) => handleStaffingChange('training', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <input
                    type="number"
                    name="hours"
                    value={staffingForms.training.hours}
                    onChange={(event) => handleStaffingChange('training', event)}
                    placeholder="Training hours"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    min="0"
                    step="0.5"
                  />
                  <input
                    type="text"
                    name="certificate_number"
                    value={staffingForms.training.certificate_number}
                    onChange={(event) => handleStaffingChange('training', event)}
                    placeholder="Certificate number"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                </FormGroup>
                <Field label="Notes">
                  <textarea
                    name="notes"
                    rows="3"
                    value={staffingForms.training.notes}
                    onChange={(event) => handleStaffingChange('training', event)}
                    placeholder="Training notes"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  ></textarea>
                </Field>
                  <button
                    type="submit"
                    disabled={savingKey === 'training'}
                    className="w-full rounded-lg bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'training' ? 'Saving...' : 'Save Training Record'}
                  </button>
              </FormCard>
            </div>
          </section>
        ) : null}

        {showRecordForms && canManageHealthSafety ? (
          <section id="health-safety-form" className="scroll-mt-24 rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Area I Actions</p>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">Add health, incident, and child protection records</h2>
                <p className="mt-2 text-sm text-slate-600">
                  These forms add Area I records directly into the system so benchmark scoring can use actual health and safety records.
                </p>
              </div>
              {complianceMessage ? <p className="text-sm font-semibold text-emerald-700">{complianceMessage}</p> : null}
              {complianceError ? <p className="text-sm font-semibold text-rose-700">{complianceError}</p> : null}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-slate-900">Child Registry</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {children.length} children
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {children.length ? children.slice(0, 6).map((child) => (
                    <div key={child.id} className="rounded-2xl bg-white px-4 py-3">
                      <p className="font-semibold text-slate-900">{child.name}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Age {child.age} | Special needs: {child.is_special_needs ? 'Yes' : 'No'}
                      </p>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-600">No child records have been registered for this CDC yet.</p>
                  )}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitHealthSafetyForm('child', '/children/', (form) => ({
                      ...form,
                      cdc: Number(cdcId),
                      age: Number(form.age || 0),
                    }));
                  }}
                  className="mt-5 grid gap-4"
                >
                  <input
                    type="text"
                    name="name"
                    value={healthSafetyForms.child.name}
                    onChange={(event) => handleHealthSafetyChange('child', event)}
                    placeholder="Child name"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    required
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="number"
                      name="age"
                      value={healthSafetyForms.child.age}
                      onChange={(event) => handleHealthSafetyChange('child', event)}
                      placeholder="Age"
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                      min="0"
                      required
                    />
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="is_special_needs"
                        checked={healthSafetyForms.child.is_special_needs}
                        onChange={(event) => handleHealthSafetyChange('child', event)}
                      />
                      Child has special needs
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={savingKey === 'child'}
                    className="rounded-2xl bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'child' ? 'Saving...' : 'Save Child Record'}
                  </button>
                </form>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitHealthSafetyForm('childHealth', '/child-health-records/', (form) => ({
                    ...form,
                    cdc: Number(cdcId),
                    child: form.child ? Number(form.child) : null,
                    height: form.height || null,
                    weight: form.weight || null,
                  }));
                }}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-lg font-semibold text-slate-900">Child Health Record</p>
                <div className="mt-4 grid gap-4">
                  <select
                    name="child"
                    value={healthSafetyForms.childHealth.child}
                    onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    required
                  >
                    <option value="">Select child</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name} (Age {child.age})
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="date"
                      name="screening_date"
                      value={healthSafetyForms.childHealth.screening_date}
                      onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                    <select
                      name="immunization_status"
                      value={healthSafetyForms.childHealth.immunization_status}
                      onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="complete">Complete</option>
                      <option value="partial">Partial</option>
                      <option value="not_started">Not Started</option>
                    </select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="number"
                      step="0.01"
                      name="height"
                      value={healthSafetyForms.childHealth.height}
                      onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                      placeholder="Height"
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                    <input
                      type="number"
                      step="0.01"
                      name="weight"
                      value={healthSafetyForms.childHealth.weight}
                      onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                      placeholder="Weight"
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </div>
                  <select
                    name="nutritional_status"
                    value={healthSafetyForms.childHealth.nutritional_status}
                    onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="normal">Normal</option>
                    <option value="underweight">Underweight</option>
                    <option value="severely_underweight">Severely Underweight</option>
                    <option value="overweight">Overweight</option>
                  </select>
                  <input
                    type="text"
                    name="vision_screening_result"
                    value={healthSafetyForms.childHealth.vision_screening_result}
                    onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                    placeholder="Vision screening result"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <input
                    type="text"
                    name="hearing_screening_result"
                    value={healthSafetyForms.childHealth.hearing_screening_result}
                    onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                    placeholder="Hearing screening result"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <input
                    type="text"
                    name="oral_health_result"
                    value={healthSafetyForms.childHealth.oral_health_result}
                    onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                    placeholder="Oral health result"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <textarea
                    name="allergies"
                    rows="2"
                    value={healthSafetyForms.childHealth.allergies}
                    onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                    placeholder="Allergies"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <textarea
                    name="dietary_restrictions"
                    rows="2"
                    value={healthSafetyForms.childHealth.dietary_restrictions}
                    onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                    placeholder="Dietary restrictions"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <textarea
                    name="medical_notes"
                    rows="2"
                    value={healthSafetyForms.childHealth.medical_notes}
                    onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                    placeholder="Medical notes"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <input
                    type="date"
                    name="medical_clearance_date"
                    value={healthSafetyForms.childHealth.medical_clearance_date}
                    onChange={(event) => handleHealthSafetyChange('childHealth', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <button
                    type="submit"
                    disabled={savingKey === 'childHealth'}
                    className="rounded-2xl bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'childHealth' ? 'Saving...' : 'Save Child Health Record'}
                  </button>
                </div>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitHealthSafetyForm('emergency', '/emergency-readiness/', (form) => ({
                    ...form,
                    cdc: Number(cdcId),
                    drills_this_year: Number(form.drills_this_year || 0),
                  }));
                }}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-lg font-semibold text-slate-900">Emergency Readiness</p>
                <div className="mt-4 grid gap-4">
                  <input
                    type="date"
                    name="assessment_date"
                    value={healthSafetyForms.emergency.assessment_date}
                    onChange={(event) => handleHealthSafetyChange('emergency', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="has_first_aid_kit"
                      checked={healthSafetyForms.emergency.has_first_aid_kit}
                      onChange={(event) => handleHealthSafetyChange('emergency', event)}
                    />
                    First aid kit available
                  </label>
                  <input
                    type="date"
                    name="first_aid_kit_checked_on"
                    value={healthSafetyForms.emergency.first_aid_kit_checked_on}
                    onChange={(event) => handleHealthSafetyChange('emergency', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="fire_safety_equipment_available"
                      checked={healthSafetyForms.emergency.fire_safety_equipment_available}
                      onChange={(event) => handleHealthSafetyChange('emergency', event)}
                    />
                    Fire safety equipment available
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="date"
                      name="last_drill_date"
                      value={healthSafetyForms.emergency.last_drill_date}
                      onChange={(event) => handleHealthSafetyChange('emergency', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                    <input
                      type="number"
                      name="drills_this_year"
                      value={healthSafetyForms.emergency.drills_this_year}
                      onChange={(event) => handleHealthSafetyChange('emergency', event)}
                      placeholder="Drills this year"
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                      min="0"
                    />
                  </div>
                  <input
                    type="text"
                    name="emergency_contact_name"
                    value={healthSafetyForms.emergency.emergency_contact_name}
                    onChange={(event) => handleHealthSafetyChange('emergency', event)}
                    placeholder="Emergency contact name"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <input
                    type="text"
                    name="emergency_contact_number"
                    value={healthSafetyForms.emergency.emergency_contact_number}
                    onChange={(event) => handleHealthSafetyChange('emergency', event)}
                    placeholder="Emergency contact number"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <textarea
                    name="notes"
                    rows="3"
                    value={healthSafetyForms.emergency.notes}
                    onChange={(event) => handleHealthSafetyChange('emergency', event)}
                    placeholder="Emergency readiness notes"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <button
                    type="submit"
                    disabled={savingKey === 'emergency'}
                    className="rounded-2xl bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'emergency' ? 'Saving...' : 'Save Emergency Readiness'}
                  </button>
                </div>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitHealthSafetyForm('incident', '/safety-incidents/', (form) => ({
                    ...form,
                    cdc: Number(cdcId),
                    child: form.child ? Number(form.child) : null,
                  }));
                }}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-lg font-semibold text-slate-900">Safety Incident</p>
                <div className="mt-4 grid gap-4">
                  <select
                    name="child"
                    value={healthSafetyForms.incident.child}
                    onChange={(event) => handleHealthSafetyChange('incident', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="">No specific child</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-4 md:grid-cols-2">
                    <select
                      name="incident_type"
                      value={healthSafetyForms.incident.incident_type}
                      onChange={(event) => handleHealthSafetyChange('incident', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    >
                      <option value="injury">Injury</option>
                      <option value="illness">Illness</option>
                      <option value="behavior">Behavior Concern</option>
                      <option value="hazard">Hazard Exposure</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="date"
                      name="incident_date"
                      value={healthSafetyForms.incident.incident_date}
                      onChange={(event) => handleHealthSafetyChange('incident', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </div>
                  <textarea
                    name="description"
                    rows="3"
                    value={healthSafetyForms.incident.description}
                    onChange={(event) => handleHealthSafetyChange('incident', event)}
                    placeholder="Incident description"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    required
                  ></textarea>
                  <textarea
                    name="action_taken"
                    rows="3"
                    value={healthSafetyForms.incident.action_taken}
                    onChange={(event) => handleHealthSafetyChange('incident', event)}
                    placeholder="Action taken"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  ></textarea>
                  <input
                    type="text"
                    name="referred_to"
                    value={healthSafetyForms.incident.referred_to}
                    onChange={(event) => handleHealthSafetyChange('incident', event)}
                    placeholder="Referred to"
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="date"
                      name="resolved_on"
                      value={healthSafetyForms.incident.resolved_on}
                      onChange={(event) => handleHealthSafetyChange('incident', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                    <select
                      name="status"
                      value={healthSafetyForms.incident.status}
                      onChange={(event) => handleHealthSafetyChange('incident', event)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    >
                      <option value="open">Open</option>
                      <option value="monitoring">Monitoring</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={savingKey === 'incident'}
                    className="rounded-2xl bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingKey === 'incident' ? 'Saving...' : 'Save Safety Incident'}
                  </button>
                </div>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitHealthSafetyForm('childProtection', '/child-protection-records/', (form) => ({
                    ...form,
                    cdc: Number(cdcId),
                  }));
                }}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 xl:col-span-2"
              >
                <p className="text-lg font-semibold text-slate-900">Child Protection Review</p>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <input
                    type="date"
                    name="review_date"
                    value={healthSafetyForms.childProtection.review_date}
                    onChange={(event) => handleHealthSafetyChange('childProtection', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <select
                    name="case_status"
                    value={healthSafetyForms.childProtection.case_status}
                    onChange={(event) => handleHealthSafetyChange('childProtection', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="none">No Active Case</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="referred">Referred</option>
                    <option value="closed">Closed</option>
                  </select>
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="written_policy_available"
                      checked={healthSafetyForms.childProtection.written_policy_available}
                      onChange={(event) => handleHealthSafetyChange('childProtection', event)}
                    />
                    Written child protection policy available
                  </label>
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="case_opened"
                      checked={healthSafetyForms.childProtection.case_opened}
                      onChange={(event) => handleHealthSafetyChange('childProtection', event)}
                    />
                    Active case opened
                  </label>
                  <input
                    type="date"
                    name="staff_training_last_date"
                    value={healthSafetyForms.childProtection.staff_training_last_date}
                    onChange={(event) => handleHealthSafetyChange('childProtection', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <input
                    type="date"
                    name="parent_orientation_last_date"
                    value={healthSafetyForms.childProtection.parent_orientation_last_date}
                    onChange={(event) => handleHealthSafetyChange('childProtection', event)}
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                  <input
                    type="text"
                    name="external_referral_agency"
                    value={healthSafetyForms.childProtection.external_referral_agency}
                    onChange={(event) => handleHealthSafetyChange('childProtection', event)}
                    placeholder="External referral agency"
                    className="rounded-2xl border border-slate-300 px-4 py-3 xl:col-span-2"
                  />
                  <textarea
                    name="notes"
                    rows="4"
                    value={healthSafetyForms.childProtection.notes}
                    onChange={(event) => handleHealthSafetyChange('childProtection', event)}
                    placeholder="Child protection notes"
                    className="rounded-2xl border border-slate-300 px-4 py-3 xl:col-span-2"
                  ></textarea>
                  <button
                    type="submit"
                    disabled={savingKey === 'childProtection'}
                    className="rounded-2xl bg-[#0f4b94] px-4 py-3 font-semibold text-white disabled:opacity-60 xl:col-span-2"
                  >
                    {savingKey === 'childProtection' ? 'Saving...' : 'Save Child Protection Review'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

          </>
        )}
        <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] xl:col-span-2">
          <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Record Activity</p>
          <div className="mt-6 space-y-4 text-slate-700">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailBlock label="CDC Record Created" value={formatDateTime(cdc.created_at)} />
              <DetailBlock label="Last Updated" value={formatDateTime(cdc.updated_at)} />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-500">Recent Related Reports</p>
              {recentReports.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {recentReports.map((report) => (
                    <article key={report.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{report.title || report.report_type_label}</p>
                          <p className="text-sm text-slate-600">
                            {report.report_type_label} submitted by {report.submitted_by_name || 'Unknown user'}
                          </p>
                        </div>
                        <p className="text-sm text-slate-500">{formatDateTime(report.submitted_on)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-1">No submitted reports are currently linked to this CDC.</p>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-500">Recent Record Changes</p>
              {cdc.audit_logs?.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {cdc.audit_logs.map((log) => (
                    <article key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{log.summary}</p>
                          <p className="text-sm text-slate-600">
                            {log.actor_username || 'System'} - {formatDateTime(log.created_at)}
                          </p>
                        </div>
                        <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0f4b94]">
                          {log.action.replaceAll('_', ' ')}
                        </span>
                      </div>

                      {Object.keys(log.field_changes || {}).length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {Object.entries(log.field_changes).map(([field, change]) => (
                            <div key={field} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">{formatFieldLabel(field)}:</span>{' '}
                              <span>{formatAuditValue(change.from)}</span>{' '}
                              <span className="text-slate-400">-&gt;</span>{' '}
                              <span>{formatAuditValue(change.to)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-1">No field-by-field change history has been recorded for this CDC yet.</p>
              )}
            </div>

            <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-slate-600">
              This activity panel now includes backend audit entries for CDC create, update, accreditation, and new compliance record workflows.
            </p>
          </div>
        </section>
        ) : null}
      </div>
    </div>
  );
}

export default CDCDetailPage;
