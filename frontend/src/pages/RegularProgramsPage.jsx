import AppIcon from '../components/AppIcon';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import RoleLayout from '../components/RoleLayout';
import api from '../api';

const weekdayOptions = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

const scheduleLabels = {
  daily: 'Daily feeding (Mon-Fri)',
  mwf: 'MWF schedule',
  tth: 'TTH schedule',
  custom: 'Custom schedule',
};

const programTabs = [
  { key: 'records', label: 'Program Records' },
  { key: 'feeding', label: 'Feeding Program' },
  { key: 'seminars', label: 'Parent Seminars' },
  { key: 'health', label: 'Health Checkups' },
];

const statusBadgeClasses = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  scheduled: 'bg-sky-100 text-sky-800',
  submitted: 'bg-indigo-100 text-indigo-800',
  under_review: 'bg-amber-100 text-amber-800',
  verified: 'bg-emerald-100 text-emerald-800',
  returned: 'bg-rose-100 text-rose-800',
  rescheduled: 'bg-amber-100 text-amber-800',
  on_hold: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

const programTypeLabels = {
  all: 'All program types',
  feeding: 'Feeding Program',
  seminar: 'Parent Seminar',
  health: 'Health Checkup',
};

const alertClasses = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  return [];
};

const StatCard = ({ label, value, hint }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
    <p className="mt-2 text-sm text-slate-600">{hint}</p>
  </div>
);

function RegularProgramsPage() {
  const location = useLocation();
  const activeRole = localStorage.getItem('role') || 'staff';
  const { programSection } = useParams();
  const navigate = useNavigate();
  const basePath = `/${activeRole}/regular-programs`;
  const query = new URLSearchParams(location.search);
  const legacyTab = query.get('tab');
  const requestedSection = programSection || legacyTab || (query.get('notification_focus')?.includes('feeding') ? 'feeding' : '');
  const activeTab = programTabs.some(tab => tab.key === requestedSection) ? requestedSection : '';
  const workspaceView = query.get('view') || '';
  const showWorkspace = Boolean(workspaceView) || Boolean(query.get('notification_focus'));
  const requestedProgram = query.get('program');
  const [loading, setLoading] = useState(true);
  const [savingProgram, setSavingProgram] = useState(false);
  const [savingDayRecord, setSavingDayRecord] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [cdcs, setCdcs] = useState([]);
  const [children, setChildren] = useState([]);
  const [childHealthRecords, setChildHealthRecords] = useState([]);
  const [feedingPrograms, setFeedingPrograms] = useState([]);
  const [parentSeminars, setParentSeminars] = useState([]);
  const [monitoring, setMonitoring] = useState(null);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [recordFilter, setRecordFilter] = useState('all');
  const [programTypeFilter, setProgramTypeFilter] = useState('all');
  const [recordSearch, setRecordSearch] = useState('');
  const [recordDateFilter, setRecordDateFilter] = useState('');
  const [selectedRecordDetail, setSelectedRecordDetail] = useState(null);
  const [reviewModal, setReviewModal] = useState(null);
  const [showFeedingCreate, setShowFeedingCreate] = useState(false);
  const [showFeedingAlerts, setShowFeedingAlerts] = useState(false);
  const [showDayRecordForm, setShowDayRecordForm] = useState(false);
  const [showFeedingSchedule, setShowFeedingSchedule] = useState(false);
  const notificationFocus = useMemo(() => new URLSearchParams(location.search).get('notification_focus') || '', [location.search]);
  const isFeedingFocus = notificationFocus.includes('feeding');

  const [feedingForm, setFeedingForm] = useState({
    title: '120-Day Feeding Program',
    cdc: '',
    budget_allocation: '',
    target_beneficiaries: '',
    start_date: '',
    schedule_type: 'daily',
    custom_schedule_days: [],
    notes: '',
  });

  const [dayRecordForm, setDayRecordForm] = useState({
    feeding_date: '',
    status: 'completed',
    beneficiaries_served: '',
    attendance_count: '',
    meals_served: '',
    notes: '',
  });
  const [seminarData, setSeminarData] = useState({
    seminarTitle: '',
    cdc: '',
    date: '',
    time: '',
    venue: '',
    facilitator: '',
    participants: '',
    status: 'scheduled',
    topics: '',
    materials: '',
    outcomes: '',
  });
  const [healthCheckData, setHealthCheckData] = useState({
    cdc: '',
    child: '',
    screening_date: '',
    checkup_type: 'general',
    conducted_by: 'barangay_health_worker',
    conducted_by_name: '',
    height: '',
    weight: '',
    nutritional_status: 'unknown',
    health_findings: '',
    symptoms_observed: '',
    medicine_given: '',
    advice_given: '',
    needs_referral: false,
    referral_reason: '',
    referred_to: '',
    follow_up_needed: false,
    follow_up_date: '',
    follow_up_instruction: '',
    medical_notes: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadFeedingData() {
      setLoading(true);
      setError('');
      setWarning('');

      try {
        const assignedQuery = activeRole === 'cdw' ? '?assigned_to_me=true' : '';
        const [cdcResponse, programsResponse, monitoringResponse, childrenResponse, healthRecordsResponse, seminarsResponse] = await Promise.allSettled([
          api.get(`/cdcs/${assignedQuery}`),
          api.get('/feeding-programs/'),
          api.get('/feeding-programs/monitoring_summary/'),
          api.get('/children/?status=enrolled'),
          api.get('/child-health-records/'),
          api.get('/parent-seminars/'),
        ]);

        if (!isMounted) {
          return;
        }

        if (cdcResponse.status !== 'fulfilled') {
          throw cdcResponse.reason;
        }

        const nextCdcs = normalizeList(cdcResponse.value.data);
        const nextPrograms = programsResponse.status === 'fulfilled'
          ? normalizeList(programsResponse.value.data)
          : [];
        const nextChildren = childrenResponse.status === 'fulfilled'
          ? normalizeList(childrenResponse.value.data).filter((child) => child.current_status === 'enrolled' && child.cdc)
          : [];
        const nextHealthRecords = healthRecordsResponse.status === 'fulfilled'
          ? normalizeList(healthRecordsResponse.value.data)
          : [];
        const nextSeminars = seminarsResponse.status === 'fulfilled'
          ? normalizeList(seminarsResponse.value.data)
          : [];
        const nextMonitoring = monitoringResponse.status === 'fulfilled'
          ? monitoringResponse.value.data
          : {
              summary: {
                total_programs: nextPrograms.length,
                active_programs: nextPrograms.filter((program) => program.status === 'active').length,
                completed_programs: nextPrograms.filter((program) => program.status === 'completed').length,
                total_completed_days: 0,
                total_remaining_days: 0,
                total_beneficiaries_served: 0,
                total_missed_days: 0,
              },
              programs: nextPrograms,
              watchlist: [],
            };

        setCdcs(nextCdcs);
        setChildren(nextChildren);
        setChildHealthRecords(nextHealthRecords);
        setFeedingPrograms(nextPrograms);
        setParentSeminars(nextSeminars);
        setMonitoring(nextMonitoring);

        if (nextCdcs.length > 0) {
          setFeedingForm((current) => (
            current.cdc ? current : { ...current, cdc: String(nextCdcs[0].id) }
          ));
          setSeminarData((current) => (
            current.cdc ? current : { ...current, cdc: String(nextCdcs[0].id) }
          ));
          setHealthCheckData((current) => (
            current.cdc ? current : { ...current, cdc: String(nextCdcs[0].id) }
          ));
        }
        if (nextChildren.length > 0) {
          setHealthCheckData((current) => (
            current.child ? current : {
              ...current,
              child: String(nextChildren[0].id),
              cdc: String(nextChildren[0].cdc),
            }
          ));
        }

        setSelectedProgramId((current) => {
          if (current && nextPrograms.some((program) => String(program.id) === String(current))) {
            return current;
          }
          const preferredProgram = nextPrograms.find((program) => program.status === 'active') || nextPrograms[0];
          return preferredProgram ? String(preferredProgram.id) : '';
        });

        if (programsResponse.status !== 'fulfilled' || monitoringResponse.status !== 'fulfilled' || childrenResponse.status !== 'fulfilled' || healthRecordsResponse.status !== 'fulfilled' || seminarsResponse.status !== 'fulfilled') {
          setWarning('Some program records are temporarily unavailable, but your assigned CDC list is loaded so you can still prepare available forms.');
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        console.error('Failed to load feeding program data', loadError);
        setError('Failed to load feeding program data.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadFeedingData();

    return () => {
      isMounted = false;
    };
  }, [activeRole]);

  useEffect(() => {
    if (requestedProgram && feedingPrograms.some(program => String(program.id) === requestedProgram)) setSelectedProgramId(requestedProgram);
  }, [requestedProgram, feedingPrograms]);

  useEffect(() => {
    setShowFeedingCreate(workspaceView === 'new' && activeTab === 'feeding');
    setShowDayRecordForm(false);
  }, [workspaceView, activeTab]);

  const selectedProgram = useMemo(
    () => feedingPrograms.find((program) => String(program.id) === String(selectedProgramId)) || null,
    [feedingPrograms, selectedProgramId]
  );

  const selectedMetrics = selectedProgram?.metrics || null;
  const upcomingDays = useMemo(
    () => (selectedProgram?.feeding_days || []).filter((day) => day.status === 'scheduled').slice(0, 10),
    [selectedProgram]
  );
  const recentDays = useMemo(
    () => [...(selectedProgram?.feeding_days || [])]
      .filter((day) => day.status !== 'scheduled')
      .sort((a, b) => (a.feeding_date < b.feeding_date ? 1 : -1))
      .slice(0, 10),
    [selectedProgram]
  );

  const programRecords = useMemo(() => {
    const feedingRecords = feedingPrograms.map((program) => ({
      id: `feeding-${program.id}`,
      sourceId: program.id,
      type: 'feeding',
      programType: 'Feeding Program',
      title: program.title || 'Feeding Program',
      cdcName: program.cdc_name,
      barangayName: program.barangay_name,
      date: program.start_date,
      peopleLabel: `${program.metrics?.total_beneficiaries_served || program.target_beneficiaries || 0} children served/targeted`,
      submittedBy: program.created_by_name || 'CDW / Staff',
      status: program.status || 'active',
      reviewedBy: program.reviewed_by_name || 'For monitoring',
      remarks: program.notes || 'No remarks recorded',
      detailRows: [
        ['Program Type', 'Feeding Program'],
        ['Program Title', program.title || 'Feeding Program'],
        ['CDC', program.cdc_name || 'Not recorded'],
        ['Barangay', program.barangay_name || 'Not recorded'],
        ['Start Date', program.start_date || 'Not recorded'],
        ['Target Beneficiaries', program.target_beneficiaries || 0],
        ['Children Served', program.metrics?.total_beneficiaries_served || 0],
        ['Status', formatProgramValue(program.status)],
        ['Recorded By', program.created_by_name || 'CDW / Staff'],
        ['Remarks', program.notes || 'No remarks recorded'],
      ],
    }));

    const seminarRecords = parentSeminars.map((seminar) => ({
      id: `seminar-${seminar.id}`,
      sourceId: seminar.id,
      type: 'seminar',
      programType: 'Parent Seminar',
      title: seminar.seminar_title || 'Parent Seminar',
      cdcName: seminar.cdc_name,
      barangayName: seminar.barangay_name,
      date: seminar.date_conducted,
      peopleLabel: `${seminar.participants_count || 0} parents / guardians`,
      submittedBy: seminar.recorded_by_name || 'CDW / Staff',
      status: seminar.status || 'scheduled',
      reviewedBy: 'For monitoring',
      remarks: seminar.remarks || seminar.topics || 'No remarks recorded',
      detailRows: [
        ['Program Type', 'Parent Seminar'],
        ['Seminar Title / Topic', seminar.seminar_title || 'Not recorded'],
        ['CDC', seminar.cdc_name || 'Not recorded'],
        ['Barangay', seminar.barangay_name || 'Not recorded'],
        ['Date Conducted', seminar.date_conducted || 'Not recorded'],
        ['Venue', seminar.venue || 'Not recorded'],
        ['Facilitator / Speaker', seminar.facilitator || 'Not recorded'],
        ['Parents / Guardians Attended', seminar.participants_count || 0],
        ['Status', formatProgramValue(seminar.status)],
        ['Recorded By', seminar.recorded_by_name || 'CDW / Staff'],
        ['Remarks', seminar.remarks || seminar.topics || 'No remarks recorded'],
      ],
    }));

    const healthRecords = childHealthRecords.map((record) => ({
      id: `health-${record.id}`,
      sourceId: record.id,
      type: 'health',
      programType: 'Health Checkup',
      title: record.child_name || 'Child health checkup',
      cdcName: record.cdc_name,
      barangayName: record.barangay_name,
      date: record.screening_date,
      peopleLabel: record.child_name || 'Child record',
      submittedBy: record.recorded_by_name || 'CDW / Staff',
      status: record.status || 'submitted',
      reviewedBy: record.verified_by_name || 'For review',
      remarks: record.health_findings || record.medical_notes || 'No findings recorded',
      detailRows: [
        ['Program Type', 'Health Checkup'],
        ['Child Name', record.child_name || 'Not recorded'],
        ['CDC', record.cdc_name || 'Not recorded'],
        ['Barangay', record.barangay_name || 'Not recorded'],
        ['Date of Checkup', record.screening_date || 'Not recorded'],
        ['Checkup Type', record.checkup_type_label || formatProgramValue(record.checkup_type)],
        ['Height', record.height ? `${record.height} cm` : 'Not recorded'],
        ['Weight', record.weight ? `${record.weight} kg` : 'Not recorded'],
        ['Health Findings', record.health_findings || 'No findings recorded'],
        ['Referral Needed', record.needs_referral ? 'Yes' : 'No'],
        ['Follow-up Date', record.follow_up_date || 'Not recorded'],
        ['Status', record.status_label || formatProgramValue(record.status)],
        ['Recorded By', record.recorded_by_name || 'CDW / Staff'],
        ['Remarks', record.review_remarks || record.medical_notes || 'No remarks recorded'],
      ],
    }));

    return [...feedingRecords, ...seminarRecords, ...healthRecords]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [childHealthRecords, feedingPrograms, parentSeminars]);

  const categoryRecords = programRecords.filter(record => record.type === (activeTab === 'seminars' ? 'seminar' : activeTab) && [record.title, record.cdcName, record.barangayName].join(' ').toLowerCase().includes(recordSearch.trim().toLowerCase()));

  const visibleProgramRecords = useMemo(() => (
    programRecords.filter((record) => {
      const matchesType = programTypeFilter === 'all' || record.type === programTypeFilter;
      const matchesStatus = recordFilter === 'all' || record.status === recordFilter;
      const haystack = [
        record.programType,
        record.title,
        record.cdcName,
        record.barangayName,
        record.peopleLabel,
        record.submittedBy,
        record.remarks,
      ].join(' ').toLowerCase();
      const matchesSearch = !recordSearch || haystack.includes(recordSearch.toLowerCase());
      const matchesDate = !recordDateFilter || record.date === recordDateFilter;
      return matchesType && matchesStatus && matchesSearch && matchesDate;
    })
  ), [programRecords, programTypeFilter, recordDateFilter, recordFilter, recordSearch]);

  const enrolledHealthChildren = useMemo(() => (
    children.filter((child) => child.current_status === 'enrolled' && child.cdc)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  ), [children]);

  const selectedHealthChild = useMemo(() => (
    enrolledHealthChildren.find((child) => String(child.id) === String(healthCheckData.child)) || null
  ), [enrolledHealthChildren, healthCheckData.child]);

  const visibleHealthRecords = useMemo(() => (
    [...childHealthRecords]
      .filter((record) => !healthCheckData.child || String(record.child) === String(healthCheckData.child))
      .sort((a, b) => String(b.screening_date || b.created_at || '').localeCompare(String(a.screening_date || a.created_at || '')))
      .slice(0, 12)
  ), [childHealthRecords, healthCheckData.child]);

  useEffect(() => {
    if (!isFeedingFocus) return;
    const focusedProgram = (monitoring?.watchlist || [])[0] || feedingPrograms.find((program) => program.metrics?.missed_feeding_days > 0) || feedingPrograms[0];
    if (focusedProgram?.id) {
      setSelectedProgramId(String(focusedProgram.id));
    }
  }, [feedingPrograms, isFeedingFocus, monitoring]);

  const operationsSummary = useMemo(() => {
    const programs = feedingPrograms || [];
    const totalChildrenServed = programs.reduce((sum, program) => sum + Number(program.metrics?.total_beneficiaries_served || 0), 0);
    const upcomingSchedules = programs.reduce((sum, program) => sum + (program.feeding_days || []).filter((day) => day.status === 'scheduled').length, 0);
    return {
      totalPrograms: monitoring?.summary?.total_programs || programs.length,
      activePrograms: monitoring?.summary?.active_programs || programs.filter((program) => program.status === 'active').length,
      completedActivities: monitoring?.summary?.total_completed_days || 0,
      childrenServed: monitoring?.summary?.total_beneficiaries_served || totalChildrenServed,
      upcomingSchedules,
      reviewNeeded: programs.filter((program) => ['draft', 'on_hold'].includes(program.status)).length,
    };
  }, [feedingPrograms, monitoring]);

  const handleFeedingFormChange = (event) => {
    const { name, value } = event.target;
    setFeedingForm((current) => ({ ...current, [name]: value }));
  };

  const handleCustomDayToggle = (value) => {
    setFeedingForm((current) => {
      const exists = current.custom_schedule_days.includes(value);
      return {
        ...current,
        custom_schedule_days: exists
          ? current.custom_schedule_days.filter((day) => day !== value)
          : [...current.custom_schedule_days, value].sort((a, b) => a - b),
      };
    });
  };

  const handleDayRecordChange = (event) => {
    const { name, value } = event.target;
    setDayRecordForm((current) => ({ ...current, [name]: value }));
  };

  const handleSeminarChange = (event) => {
    const { name, value } = event.target;
    setSeminarData((current) => ({ ...current, [name]: value }));
  };

  const handleHealthCheckChange = (event) => {
    const { name, value, type, checked } = event.target;
    setHealthCheckData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleHealthChildChange = (event) => {
    const childId = event.target.value;
    const child = enrolledHealthChildren.find((item) => String(item.id) === String(childId));
    setHealthCheckData((current) => ({
      ...current,
      child: childId,
      cdc: child?.cdc ? String(child.cdc) : current.cdc,
    }));
  };

  const refreshPrograms = async () => {
    const [programsResponse, monitoringResponse] = await Promise.all([
      api.get('/feeding-programs/'),
      api.get('/feeding-programs/monitoring_summary/'),
    ]);
    const nextPrograms = normalizeList(programsResponse.data);
    setFeedingPrograms(nextPrograms);
    setMonitoring(monitoringResponse.data);
    if (nextPrograms.length > 0 && !selectedProgramId) {
      setSelectedProgramId(String(nextPrograms[0].id));
    }
  };

  const refreshHealthRecords = async () => {
    const response = await api.get('/child-health-records/');
    setChildHealthRecords(normalizeList(response.data));
  };

  const refreshParentSeminars = async () => {
    const response = await api.get('/parent-seminars/');
    setParentSeminars(normalizeList(response.data));
  };

  const submitCreateProgram = async () => {
    setSavingProgram(true);
    setError('');
    setSuccessMessage('');

    try {
      const payload = {
        ...feedingForm,
        cdc: Number(feedingForm.cdc),
        budget_allocation: feedingForm.budget_allocation || 0,
        target_beneficiaries: Number(feedingForm.target_beneficiaries || 0),
      };

      if (payload.schedule_type !== 'custom') {
        payload.custom_schedule_days = [];
      }

      const response = await api.post('/feeding-programs/', payload);
      await refreshPrograms();
      setSelectedProgramId(String(response.data.id));
      setSuccessMessage('Feeding program created and scheduled automatically.');
      setDayRecordForm((current) => ({
        ...current,
        feeding_date: response.data.metrics?.next_scheduled_feeding_day || '',
      }));
    } catch (saveError) {
      console.error('Failed to create feeding program', saveError);
      setError(saveError.response?.data?.error || 'Failed to create feeding program.');
    } finally {
      setSavingProgram(false);
      setReviewModal(null);
    }
  };

  const handleCreateProgram = async (event) => {
    event.preventDefault();
    setReviewModal({ type: 'create_program' });
  };

  const submitRecordDay = async () => {
    if (!selectedProgram) {
      return;
    }

    setSavingDayRecord(true);
    setError('');
    setSuccessMessage('');

    try {
      await api.post(`/feeding-programs/${selectedProgram.id}/record_day/`, {
        ...dayRecordForm,
        beneficiaries_served: Number(dayRecordForm.beneficiaries_served || 0),
        attendance_count: Number(dayRecordForm.attendance_count || 0),
        meals_served: Number(dayRecordForm.meals_served || 0),
      });
      await refreshPrograms();
      setSuccessMessage('Feeding day recorded successfully.');
    } catch (saveError) {
      console.error('Failed to record feeding day', saveError);
      setError(saveError.response?.data?.error || 'Failed to record feeding day.');
    } finally {
      setSavingDayRecord(false);
      setReviewModal(null);
    }
  };

  const handleRecordDay = async (event) => {
    event.preventDefault();
    setReviewModal({ type: 'record_day' });
  };

  const handleSyncSchedule = async () => {
    if (!selectedProgram) {
      return;
    }

    try {
      await api.post(`/feeding-programs/${selectedProgram.id}/sync_schedule/`);
      await refreshPrograms();
      setSuccessMessage('Schedule synced successfully.');
    } catch (syncError) {
      console.error('Failed to sync feeding schedule', syncError);
      setError(syncError.response?.data?.error || 'Failed to sync feeding schedule.');
    }
  };

  const handleSeminarSubmit = (event) => {
    event.preventDefault();
    setReviewModal({ type: 'seminar' });
  };

  const submitParentSeminar = async () => {
    if (!seminarData.cdc) {
      setError('Please select a CDC for the parent seminar.');
      setReviewModal(null);
      return;
    }
    if (!seminarData.seminarTitle || !seminarData.date) {
      setError('Please enter the seminar title and date conducted.');
      setReviewModal(null);
      return;
    }

    setSavingProgram(true);
    setError('');
    setSuccessMessage('');

    try {
      await api.post('/parent-seminars/', {
        seminar_title: seminarData.seminarTitle,
        cdc: Number(seminarData.cdc),
        date_conducted: seminarData.date,
        time_conducted: seminarData.time || null,
        venue: seminarData.venue,
        facilitator: seminarData.facilitator,
        participants_count: Number(seminarData.participants || 0),
        status: seminarData.status,
        topics: seminarData.topics,
        materials: seminarData.materials,
        remarks: seminarData.outcomes,
      });
      await refreshParentSeminars();
      setSuccessMessage('Parent seminar saved and added to Program Records.');
      setSeminarData((current) => ({
        ...current,
        seminarTitle: '',
        date: '',
        time: '',
        venue: '',
        facilitator: '',
        participants: '',
        status: 'scheduled',
        topics: '',
        materials: '',
        outcomes: '',
      }));
    } catch (saveError) {
      console.error('Failed to save parent seminar', saveError);
      const details = saveError.response?.data;
      setError(details?.error || details?.seminar_title?.[0] || details?.date_conducted?.[0] || 'Failed to save parent seminar.');
    } finally {
      setSavingProgram(false);
      setReviewModal(null);
    }
  };

  const handleHealthCheckSubmit = (event) => {
    event.preventDefault();
    setReviewModal({ type: 'health' });
  };

  const submitHealthCheck = async () => {
    if (!selectedHealthChild) {
      setError('Please select an enrolled child first.');
      setReviewModal(null);
      return;
    }

    setSavingProgram(true);
    setError('');
    setSuccessMessage('');

    try {
      const payload = {
        ...healthCheckData,
        cdc: Number(selectedHealthChild.cdc),
        child: Number(selectedHealthChild.id),
        screening_date: healthCheckData.screening_date || new Date().toISOString().slice(0, 10),
        height: healthCheckData.height || null,
        weight: healthCheckData.weight || null,
        referred_to: healthCheckData.needs_referral ? healthCheckData.referred_to : '',
        referral_reason: healthCheckData.needs_referral ? healthCheckData.referral_reason : '',
        follow_up_date: healthCheckData.follow_up_needed ? healthCheckData.follow_up_date || null : null,
        follow_up_instruction: healthCheckData.follow_up_needed ? healthCheckData.follow_up_instruction : '',
        status: activeRole === 'cdw' ? 'submitted' : 'verified',
      };
      await api.post('/child-health-records/', payload);
      await refreshHealthRecords();
      setSuccessMessage('Health check-up saved, linked to the child profile, and added to Program Records.');
      setHealthCheckData((current) => ({
        ...current,
        screening_date: '',
        height: '',
        weight: '',
        nutritional_status: 'unknown',
        health_findings: '',
        symptoms_observed: '',
        medicine_given: '',
        advice_given: '',
        needs_referral: false,
        referral_reason: '',
        referred_to: '',
        follow_up_needed: false,
        follow_up_date: '',
        follow_up_instruction: '',
        medical_notes: '',
      }));
    } catch (saveError) {
      console.error('Failed to save health check-up', saveError);
      const details = saveError.response?.data;
      setError(details?.error || details?.child?.[0] || 'Failed to save health check-up.');
    } finally {
      setSavingProgram(false);
      setReviewModal(null);
    }
  };

  const confirmLocalSchedule = () => {
    if (reviewModal?.type === 'seminar') {
      submitParentSeminar();
      return;
    }
    if (reviewModal?.type === 'health') {
      submitHealthCheck();
      return;
    }
    setReviewModal(null);
  };

  return (
    <RoleLayout role={activeRole}>
      <div className="mx-auto max-w-7xl space-y-6 pb-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>{activeTab && <Link to={basePath} className="mb-3 inline-flex text-sm font-medium text-[#0f4b94] hover:underline">&larr; Back to Regular Programs</Link>}<h1 className="text-3xl font-bold tracking-tight text-slate-900">{activeTab ? programTabs.find(tab => tab.key === activeTab)?.label : 'Regular Programs'}</h1><p className="mt-2 text-sm text-slate-500">{activeTab ? 'Manage activities and related records.' : 'Feeding, family support and child health services.'}</p></div>
          {!activeTab && <Link to={`${basePath}/records`} className="lgu-button-secondary">View All Records</Link>}
        </header>
        {!activeTab && <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[
            { key: 'feeding', type: 'feeding', title: 'Feeding Program', description: 'Schedules, meals and daily attendance.', icon: 'children', count: feedingPrograms.length, label: 'programs', tone: 'bg-blue-50 text-[#0f4b94]' },
            { key: 'seminars', type: 'seminar', title: 'Parent Seminars', description: 'Sessions, participation and outcomes.', icon: 'users', count: parentSeminars.length, label: 'seminars', tone: 'bg-violet-50 text-violet-700' },
            { key: 'health', type: 'health', title: 'Health Checkups', description: 'Child checkups, referrals and follow-ups.', icon: 'health', count: childHealthRecords.length, label: 'checkups', tone: 'bg-teal-50 text-teal-700' },
          ].map(program => <section key={program.key} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
            <div className="flex items-center justify-between gap-3"><span className={`flex h-12 w-12 items-center justify-center rounded-xl ${program.tone}`}><AppIcon name={program.icon} className="h-6 w-6" /></span><span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">{loading ? 'Loading...' : `${program.count} ${program.label}`}</span></div>
            <h2 className="mt-5 text-xl font-semibold text-slate-900">{program.title}</h2><p className="mb-4 mt-2 text-sm leading-6 text-slate-500">{program.description}</p>
            <div className="mb-5 flex-1 border-t border-slate-100">{loading ? <p role="status" className="py-5 text-sm text-slate-400">Loading records...</p> : programRecords.filter(record => record.type === program.type).slice(0, 2).map(record => <div key={record.id} className="border-b border-slate-100 py-3 last:border-0"><p className="truncate text-sm font-medium text-slate-800" title={record.title}>{record.title}</p><p className="mt-1 truncate text-xs text-slate-500">{record.cdcName || 'CDC not recorded'} &middot; {record.date || 'Date not recorded'}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs ${statusBadgeClasses[record.status] || statusBadgeClasses.draft}`}>{formatProgramValue(record.status)}</span></div>)}{!loading && !program.count && <p className="py-5 text-sm text-slate-400">No records yet.</p>}</div>
            <Link to={`${basePath}/${program.key}`} aria-label={`View Details: ${program.title}`} className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-[#0f4b94] transition hover:bg-blue-100">View Details <span aria-hidden="true">&rarr;</span></Link>
          </section>)}
        </div>}
        {activeTab === 'feeding' && showWorkspace && workspaceView !== 'new' && <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-[#0f4b94]">Feeding Summary</summary>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ['Active Programs', operationsSummary.activePrograms, 'Programs currently running.'],
              ['Submitted Records', operationsSummary.totalPrograms, 'Program records in the system.'],
              ['Completed Activities', operationsSummary.completedActivities, 'Completed feeding/activity days.'],
              ['Children Served', operationsSummary.childrenServed, 'Total beneficiaries served.'],
              ['Upcoming Schedules', operationsSummary.upcomingSchedules, 'Scheduled feeding days ahead.'],
              ['Needs Review', operationsSummary.reviewNeeded, 'Draft or on-hold programs.'],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{loading ? '...' : value}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p>
              </div>
            ))}
          </div>
        </details>}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>
        ) : null}
        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">{successMessage}</div>
        ) : null}
        {warning ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">{warning}</div>
        ) : null}

        {activeTab && <nav aria-label="Program pages" className="flex flex-wrap gap-2">{programTabs.map(tab => <Link key={tab.key} to={`${basePath}/${tab.key}`} aria-current={activeTab === tab.key ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === tab.key ? 'bg-[#0f4b94] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{tab.label}</Link>)}</nav>}

        {activeTab && activeTab !== 'records' && !showWorkspace && <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input aria-label="Search program records" type="search" value={recordSearch} onChange={event => setRecordSearch(event.target.value)} placeholder="Search name, CDC or barangay" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 sm:max-w-sm" />
            <Link to={`${basePath}/${activeTab}?view=new`} className="lgu-button-primary">{activeTab === 'feeding' ? 'New Feeding Program' : activeTab === 'seminars' ? 'Record Seminar' : 'Record Checkup'}</Link>
          </div>
          {loading ? <p role="status" className="py-10 text-center text-sm text-slate-500">Loading records...</p> : <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryRecords.map(record => <article key={record.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><span className="text-xs text-slate-500">{record.date || 'Date not recorded'}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClasses[record.status] || statusBadgeClasses.draft}`}>{formatProgramValue(record.status)}</span></div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">{record.title}</h2><p className="mt-1 text-sm text-slate-500">{record.cdcName || 'CDC not recorded'}</p><p className="mb-5 mt-2 text-xs text-slate-500">{record.peopleLabel}</p>
                <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setSelectedRecordDetail(record)} className="text-sm font-semibold text-[#0f4b94]">View Details</button>{record.type === 'feeding' && <Link to={`${basePath}/feeding?view=tracker&program=${record.sourceId}`} className="ml-auto rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-[#0f4b94]">Open Tracker</Link>}</div>
              </article>)}
            </div>
            {!categoryRecords.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center"><p className="font-medium text-slate-700">{recordSearch ? 'No matching records' : 'No records yet'}</p><p className="mt-2 text-sm text-slate-500">{recordSearch ? 'Try another name or CDC.' : 'Use the button above to add a record.'}</p></div>}
          </>}
        </section>}
        {activeTab && showWorkspace && <div className="flex items-center justify-between gap-3"><Link to={`${basePath}/${activeTab}`} className="text-sm font-medium text-[#0f4b94]">&larr; Back to {programTabs.find(tab => tab.key === activeTab)?.label}</Link><span className="text-xs text-slate-500">{workspaceView === 'new' ? 'New record' : 'Program workspace'}</span></div>}

        {activeTab === 'feeding' && showWorkspace ? (
        <section className="space-y-4">
          {workspaceView !== 'new' && <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0f4b94]">Feeding Program</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Tracker and Actions</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => navigate(`${basePath}/feeding?view=new`)} className="lgu-button-primary px-4 py-2 text-xs">
                  New Feeding Program
                </button>
                <button type="button" onClick={() => setShowFeedingAlerts((current) => !current)} className="lgu-button-secondary px-4 py-2 text-xs">
                  Alerts ({monitoring?.watchlist?.length || 0})
                </button>
                <button type="button" onClick={() => setShowFeedingSchedule((current) => !current)} className="lgu-button-secondary px-4 py-2 text-xs">
                  Schedule / History
                </button>
              </div>
            </div>
          </div>

          </>}
          {showFeedingCreate || workspaceView === 'new' ? (
          <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${isFeedingFocus ? 'notification-focus-ring' : ''}`}>
            <h2 className="text-xl font-semibold text-slate-900">Create Feeding Program</h2>

            <form onSubmit={handleCreateProgram} className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Program Title</label>
                <input
                  type="text"
                  name="title"
                  value={feedingForm.title}
                  onChange={handleFeedingFormChange}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">CDC</label>
                  <select
                    name="cdc"
                    value={feedingForm.cdc}
                    onChange={handleFeedingFormChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                    required
                  >
                    <option value="">Select a CDC</option>
                    {cdcs.map((cdc) => (
                      <option key={cdc.id} value={cdc.id}>
                        {cdc.name} - {cdc.barangay_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    name="start_date"
                    value={feedingForm.start_date}
                    onChange={handleFeedingFormChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Budget Allocation</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="budget_allocation"
                    value={feedingForm.budget_allocation}
                    onChange={handleFeedingFormChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Target Beneficiaries</label>
                  <input
                    type="number"
                    min="0"
                    name="target_beneficiaries"
                    value={feedingForm.target_beneficiaries}
                    onChange={handleFeedingFormChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Schedule Type</label>
                <select
                  name="schedule_type"
                  value={feedingForm.schedule_type}
                  onChange={handleFeedingFormChange}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                >
                  {Object.entries(scheduleLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {feedingForm.schedule_type === 'custom' ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Custom Feeding Days</label>
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
                    {weekdayOptions.map((option) => {
                      const isSelected = feedingForm.custom_schedule_days.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleCustomDayToggle(option.value)}
                          className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                            isSelected
                              ? 'border-sky-500 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
                <textarea
                  name="notes"
                  value={feedingForm.notes}
                  onChange={handleFeedingFormChange}
                  rows="4"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  placeholder="Program context, resource limits, menu notes, or implementation remarks"
                />
              </div>

              <button
                type="submit"
                disabled={savingProgram}
                className="w-full rounded-2xl bg-sky-600 px-6 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {savingProgram ? 'Creating program...' : 'Create Automated Feeding Program'}
              </button>
            </form>
          </div>
          ) : null}

          {showFeedingAlerts ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Monitoring and Alerts</h2>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {monitoring?.watchlist?.length || 0} watchlist items
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Loading feeding program monitoring...
                </div>
              ) : null}

              {!loading && (monitoring?.watchlist?.length || 0) === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No urgent feeding program alerts right now.
                </div>
              ) : null}

              {(monitoring?.watchlist || []).map((program) => (
                <div key={program.id} className={`rounded-[22px] border border-slate-200 bg-slate-50 p-4 ${isFeedingFocus ? 'notification-focus-ring' : ''}`}>
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{program.title}</h3>
                      <p className="text-sm text-slate-600">{program.cdc_name} - {program.barangay_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProgramId(String(program.id))}
                      className="rounded-full bg-sky-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-800"
                    >
                      Open
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                      {program.completed_feeding_days} completed
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                      {program.remaining_feeding_days} remaining
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                      {program.missed_feeding_days} missed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          ) : null}
        </section>
        ) : null}

        {activeTab === 'feeding' && showWorkspace && workspaceView !== 'new' ? (
        <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${isFeedingFocus ? 'notification-focus-ring' : ''}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Feeding Program Tracker</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Choose a program, then record days or review progress.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedProgramId}
                onChange={(event) => setSelectedProgramId(event.target.value)}
                aria-label="Feeding program" className="w-full min-w-0 sm:w-64 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
              >
                <option value="">Select a feeding program</option>
                {feedingPrograms.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.title} - {program.cdc_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSyncSchedule}
                disabled={!selectedProgram}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sync Schedule
              </button>
              <button
                type="button"
                onClick={() => setShowDayRecordForm((current) => !current)}
                disabled={!selectedProgram}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {showDayRecordForm ? 'Hide Day Form' : 'Record Day'}
              </button>
            </div>
          </div>

          {!selectedProgram ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Select a feeding program to view progress, schedule, and daily records.
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Completed Days"
                  value={selectedMetrics?.completed_feeding_days || 0}
                  hint="Actual feeding days delivered and recorded."
                />
                <StatCard
                  label="Remaining Days"
                  value={selectedMetrics?.remaining_feeding_days || 0}
                  hint="Scheduled feeding days still needed to reach 120."
                />
                <StatCard
                  label="Completion Date"
                  value={selectedMetrics?.estimated_completion_date || 'TBD'}
                  hint="Projected completion based on the selected schedule."
                />
                <StatCard
                  label="Beneficiaries Served"
                  value={selectedMetrics?.total_beneficiaries_served || 0}
                  hint="Cumulative beneficiaries served across completed feeding days."
                />
              </div>

              <div className="mt-6 grid gap-5">
                <details open={Boolean(selectedMetrics?.alerts?.length)} className="rounded-xl border border-slate-200 bg-white p-5"><summary className="mb-4 cursor-pointer text-sm font-semibold text-[#0f4b94]">Program Details &amp; Alerts ({selectedMetrics?.alerts?.length || 0})</summary>
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{selectedProgram.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedProgram.cdc_name} - {selectedProgram.barangay_name}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {selectedProgram.status}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Start Date</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedProgram.start_date}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Schedule</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {scheduleLabels[selectedProgram.schedule_type] || selectedProgram.schedule_type}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedProgram.schedule_days_display.join(', ')}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Attendance</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedMetrics?.total_attendance || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Meals Served</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedMetrics?.total_meals_served || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Next Feeding Day</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedMetrics?.next_scheduled_feeding_day || 'None scheduled'}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Compliance Status</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedMetrics?.compliance_status || 'In Progress'}</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Alerts</h4>
                    {(selectedMetrics?.alerts || []).length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        No active alerts for this feeding program.
                      </div>
                    ) : (
                      selectedMetrics.alerts.map((alert) => (
                        <div key={`${alert.type}-${alert.message}`} className={`rounded-2xl border px-4 py-4 text-sm ${alertClasses[alert.severity] || alertClasses.low}`}>
                          {alert.message}
                        </div>
                      ))
                    )}
                  </div>
                </details>

                {showDayRecordForm ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-xl font-semibold text-slate-900">Record Feeding Day</h3>

                  <form onSubmit={handleRecordDay} className="mt-5 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Feeding Date</label>
                        <input
                          type="date"
                          name="feeding_date"
                          value={dayRecordForm.feeding_date}
                          onChange={handleDayRecordChange}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                        <select
                          name="status"
                          value={dayRecordForm.status}
                          onChange={handleDayRecordChange}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                        >
                          <option value="completed">Completed</option>
                          <option value="missed">Missed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Beneficiaries Served</label>
                        <input
                          type="number"
                          min="0"
                          name="beneficiaries_served"
                          value={dayRecordForm.beneficiaries_served}
                          onChange={handleDayRecordChange}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Attendance Count</label>
                        <input
                          type="number"
                          min="0"
                          name="attendance_count"
                          value={dayRecordForm.attendance_count}
                          onChange={handleDayRecordChange}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Meals Served</label>
                        <input
                          type="number"
                          min="0"
                          name="meals_served"
                          value={dayRecordForm.meals_served}
                          onChange={handleDayRecordChange}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
                      <textarea
                        name="notes"
                        value={dayRecordForm.notes}
                        onChange={handleDayRecordChange}
                        rows="3"
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                        placeholder="Reason for missed day, delivery remarks, attendance exceptions, or supply notes"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingDayRecord}
                      className="w-full rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {savingDayRecord ? 'Saving day record...' : 'Save Feeding Day Record'}
                    </button>
                  </form>
                </div>
                ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-xl font-semibold text-slate-900">Daily Recording</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-500">Use this when a feeding day is completed, missed, or cancelled.</p>
                  <button type="button" onClick={() => setShowDayRecordForm(true)} className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                    Record Feeding Day
                  </button>
                </div>
                )}
              </div>

              {showFeedingSchedule ? (
              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-xl font-semibold text-slate-900">Upcoming Scheduled Days</h3>
                  <div className="mt-4 space-y-3">
                    {upcomingDays.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        No upcoming scheduled feeding days.
                      </div>
                    ) : (
                      upcomingDays.map((day) => (
                        <div key={`${day.program}-${day.feeding_date}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                          <p className="text-sm font-semibold text-slate-900">{day.feeding_date}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{day.status}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-xl font-semibold text-slate-900">Recent Feeding Day History</h3>
                  <div className="mt-4 space-y-3">
                    {recentDays.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        No feeding day records have been completed or marked missed yet.
                      </div>
                    ) : (
                      recentDays.map((day) => (
                        <div key={`${day.program}-${day.feeding_date}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{day.feeding_date}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{day.status}</p>
                            </div>
                            <div className="text-right text-xs text-slate-500">
                              <p>Beneficiaries: {day.beneficiaries_served}</p>
                              <p>Attendance: {day.attendance_count}</p>
                              <p>Meals: {day.meals_served}</p>
                            </div>
                          </div>
                          {day.notes ? <p className="mt-2 text-sm text-slate-600">{day.notes}</p> : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              ) : null}
            </>
          )}
        </section>
        ) : null}

        {activeTab === 'seminars' && showWorkspace ? (
        <section className="mx-auto grid max-w-4xl gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">Parent Seminar Record</h2>
            <p className="mt-2 text-sm text-slate-500">
              Record the session details and outcomes.
            </p>

            <form onSubmit={handleSeminarSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Seminar Title</label>
                  <input
                    type="text"
                    name="seminarTitle"
                    value={seminarData.seminarTitle}
                    onChange={handleSeminarChange}
                    placeholder="Child Nutrition and Development"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">CDC / Barangay</label>
                  <select
                    name="cdc"
                    value={seminarData.cdc}
                    onChange={handleSeminarChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  >
                    <option value="">Select a CDC</option>
                    {cdcs.map((cdc) => (
                      <option key={cdc.id} value={cdc.id}>{cdc.name} - {cdc.barangay_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={seminarData.date}
                    onChange={handleSeminarChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Time</label>
                  <input
                    type="time"
                    name="time"
                    value={seminarData.time}
                    onChange={handleSeminarChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Venue</label>
                  <input
                    type="text"
                    name="venue"
                    value={seminarData.venue}
                    onChange={handleSeminarChange}
                    placeholder="CDC classroom / barangay hall"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Facilitator</label>
                  <input
                    type="text"
                    name="facilitator"
                    value={seminarData.facilitator}
                    onChange={handleSeminarChange}
                    placeholder="Assigned CDW / resource speaker"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Expected Participants</label>
                  <input
                    type="number"
                    min="0"
                    name="participants"
                    value={seminarData.participants}
                    onChange={handleSeminarChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <select
                    name="status"
                    value={seminarData.status}
                    onChange={handleSeminarChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="rescheduled">Rescheduled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Topics to Cover</label>
                <textarea
                  name="topics"
                  value={seminarData.topics}
                  onChange={handleSeminarChange}
                  rows="4"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Materials / Resources</label>
                  <textarea
                    name="materials"
                    value={seminarData.materials}
                    onChange={handleSeminarChange}
                    rows="4"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                    placeholder="Handouts, IEC materials, attendance sheets"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Outcome / Follow-up</label>
                  <textarea
                    name="outcomes"
                    value={seminarData.outcomes}
                    onChange={handleSeminarChange}
                    rows="4"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
                    placeholder="Agreements, concerns raised, next steps"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingProgram}
                className="w-full rounded-2xl bg-sky-600 px-6 py-3 font-semibold text-white transition hover:bg-sky-700"
              >
                {savingProgram ? 'Saving...' : 'Save Seminar Record'}
              </button>
            </form>
          </div>
          <details className="rounded-xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-[#0f4b94]">Review entered details</summary>
          <ProgramPreviewCard
            title="Seminar Preview"
            rows={[
              ['Program Type', 'Parent Meeting / Seminar'],
              ['CDC / Barangay', getCdcDisplayName(cdcs, seminarData.cdc)],
              ['Title', seminarData.seminarTitle || 'Not set'],
              ['Date and Time', `${seminarData.date || 'No date'} ${seminarData.time || ''}`],
              ['Venue', seminarData.venue || 'Not set'],
              ['Facilitator', seminarData.facilitator || 'Not set'],
              ['Participants', seminarData.participants || 0],
              ['Status', seminarData.status],
              ['Topics', seminarData.topics || 'No topics encoded'],
              ['Materials', seminarData.materials || 'No materials encoded'],
              ['Outcome / Follow-up', seminarData.outcomes || 'No follow-up encoded'],
            ]}
          />
          </details>
        </section>
        ) : null}

        {activeTab === 'health' && showWorkspace ? (
        <section className="mx-auto grid max-w-4xl gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0f4b94]">Child Health Record</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Health Check-ups</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Select an enrolled child, record the check-up, and it will appear in the child profile.</p>
              </div>
              <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{childHealthRecords.length} saved</span>
            </div>

            <form onSubmit={handleHealthCheckSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Enrolled Child</label>
                  <select
                    name="child"
                    value={healthCheckData.child}
                    onChange={handleHealthChildChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-sky-500"
                    required
                  >
                    <option value="">Select child</option>
                    {enrolledHealthChildren.map((child) => (
                      <option key={child.id} value={child.id}>{child.name} - {child.student_id || 'No ID'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Check-up Date</label>
                  <input
                    type="date"
                    name="screening_date"
                    value={healthCheckData.screening_date}
                    onChange={handleHealthCheckChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-sky-500"
                  />
                </div>
              </div>

              {selectedHealthChild ? (
                <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoPill label="CDC" value={selectedHealthChild.cdc_name || getCdcDisplayName(cdcs, selectedHealthChild.cdc)} />
                  <InfoPill label="Age / Sex" value={`${selectedHealthChild.computed_age ?? selectedHealthChild.age ?? 'N/A'} / ${selectedHealthChild.sex || 'N/A'}`} />
                  <InfoPill label="Guardian" value={selectedHealthChild.parent_guardian_name || selectedHealthChild.guardian_name || 'Not recorded'} />
                  <InfoPill label="Student ID" value={selectedHealthChild.student_id || 'Not recorded'} />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">
                  Only officially enrolled children are shown here.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Check-up Type</label>
                  <select
                    name="checkup_type"
                    value={healthCheckData.checkup_type}
                    onChange={handleHealthCheckChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-sky-500"
                  >
                    <option value="general">General health check-up</option>
                    <option value="nutrition">Nutrition check-up</option>
                    <option value="dental">Dental check-up</option>
                    <option value="vision">Eye / Vision check-up</option>
                    <option value="hearing">Hearing check-up</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Conducted By</label>
                  <select
                    name="conducted_by"
                    value={healthCheckData.conducted_by}
                    onChange={handleHealthCheckChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-sky-500"
                  >
                    <option value="barangay_health_worker">Barangay Health Worker</option>
                    <option value="nurse">Nurse</option>
                    <option value="midwife">Midwife</option>
                    <option value="doctor">Doctor</option>
                    <option value="dentist">Dentist</option>
                    <option value="nutrition_worker">Nutrition Worker</option>
                    <option value="cho_rhu_personnel">CHO / RHU Personnel</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Name / Position</label>
                  <input
                    name="conducted_by_name"
                    value={healthCheckData.conducted_by_name}
                    onChange={handleHealthCheckChange}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Nutrition Status</label>
                  <select
                    name="nutritional_status"
                    value={healthCheckData.nutritional_status}
                    onChange={handleHealthCheckChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-sky-500"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="normal">Normal</option>
                    <option value="underweight">Underweight</option>
                    <option value="severely_underweight">Severely underweight</option>
                    <option value="overweight">Overweight</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="0.01" name="height" value={healthCheckData.height} onChange={handleHealthCheckChange} placeholder="Height cm" className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-sky-500" />
                  <input type="number" step="0.01" name="weight" value={healthCheckData.weight} onChange={handleHealthCheckChange} placeholder="Weight kg" className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-sky-500" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <CompactTextarea label="Findings" name="health_findings" value={healthCheckData.health_findings} onChange={handleHealthCheckChange} placeholder="Main result or concern" />
                <CompactTextarea label="Advice / Recommendation" name="advice_given" value={healthCheckData.advice_given} onChange={handleHealthCheckChange} placeholder="Next step for guardian or CDC" />
                <CompactTextarea label="Symptoms Observed" name="symptoms_observed" value={healthCheckData.symptoms_observed} onChange={handleHealthCheckChange} placeholder="Optional" />
                <CompactTextarea label="Medicine / Vitamins" name="medicine_given" value={healthCheckData.medicine_given} onChange={handleHealthCheckChange} placeholder="Optional" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
                  <input type="checkbox" name="needs_referral" checked={healthCheckData.needs_referral} onChange={handleHealthCheckChange} className="mr-2" />
                  Needs referral
                </label>
                <label className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
                  <input type="checkbox" name="follow_up_needed" checked={healthCheckData.follow_up_needed} onChange={handleHealthCheckChange} className="mr-2" />
                  Needs follow-up
                </label>
              </div>

              {healthCheckData.needs_referral ? (
                <div className="grid gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-amber-900">Refer To</label>
                    <select name="referred_to" value={healthCheckData.referred_to} onChange={handleHealthCheckChange} className="w-full rounded-lg border border-amber-200 px-4 py-3 text-sm font-semibold outline-none focus:border-amber-500">
                      <option value="">Select referral</option>
                      <option value="barangay_health_center">Barangay Health Center</option>
                      <option value="rural_health_unit">Rural Health Unit</option>
                      <option value="cho">CHO</option>
                      <option value="doctor">Doctor</option>
                      <option value="dentist">Dentist</option>
                      <option value="nutrition_worker">Nutrition Worker</option>
                      <option value="specialist">Specialist</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <CompactTextarea label="Reason" name="referral_reason" value={healthCheckData.referral_reason} onChange={handleHealthCheckChange} placeholder="Why referral is needed" tone="amber" />
                </div>
              ) : null}

              {healthCheckData.follow_up_needed ? (
                <div className="grid gap-4 rounded-lg border border-sky-200 bg-sky-50 p-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-sky-900">Follow-up Date</label>
                    <input type="date" name="follow_up_date" value={healthCheckData.follow_up_date} onChange={handleHealthCheckChange} className="w-full rounded-lg border border-sky-200 px-4 py-3 text-sm font-semibold outline-none focus:border-sky-500" />
                  </div>
                  <CompactTextarea label="Instruction" name="follow_up_instruction" value={healthCheckData.follow_up_instruction} onChange={handleHealthCheckChange} placeholder="Follow-up instruction" tone="sky" />
                </div>
              ) : null}

              <button
                type="submit"
                disabled={savingProgram || !selectedHealthChild}
                className="w-full rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {savingProgram ? 'Saving...' : 'Save Health Check-up'}
              </button>
            </form>
          </div>
          <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="mb-4 cursor-pointer text-sm font-semibold text-[#0f4b94]">Recent checkups for this child</summary>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0f4b94]">Recent Records</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Health Check-up Records</h2>
              </div>
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{visibleHealthRecords.length} shown</span>
            </div>

            <div className="mt-4 space-y-3">
              {visibleHealthRecords.map((record) => (
                <article key={record.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{record.child_name || selectedHealthChild?.name || 'Child'}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{record.screening_date || 'No date'} | {record.checkup_type_label || formatProgramValue(record.checkup_type)}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{record.status_label || formatProgramValue(record.status)}</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <InfoPill label="Finding" value={record.health_findings || record.medical_notes || 'No concern noted'} />
                    <InfoPill label="Action" value={record.needs_referral ? `Referral: ${record.referred_to_label || 'Needed'}` : record.follow_up_needed ? 'Follow-up needed' : 'Monitor only'} />
                  </div>
                </article>
              ))}
              {!visibleHealthRecords.length ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                  No health check-up record yet for the selected child.
                </div>
              ) : null}
            </div>
          </details>
        </section>
        ) : null}

        {activeTab === 'records' ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-[#0f4b94]">Program Records</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Program Logbook</h2>
                <p className="mt-2 text-sm text-slate-500">Search and review recorded activities.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="search"
                  value={recordSearch}
                  onChange={(event) => setRecordSearch(event.target.value)}
                  placeholder="Search CDC, barangay, child..."
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-500"
                />
                <input
                  type="date"
                  value={recordDateFilter}
                  onChange={(event) => setRecordDateFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-500"
                />
                <select
                  value={programTypeFilter}
                  onChange={(event) => setProgramTypeFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  <option value="all">All program types</option>
                  <option value="feeding">Feeding Program</option>
                  <option value="seminar">Parent Seminar</option>
                  <option value="health">Health Checkups</option>
                </select>
                <select
                  value={recordFilter}
                  onChange={(event) => setRecordFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="verified">Verified</option>
                  <option value="completed">Completed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="returned">Returned</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[1080px] text-sm">
                <thead>
                  <tr>
                    <th>Program No.</th>
                    <th>Program Type</th>
                    <th>CDC / Barangay</th>
                    <th>Date Conducted</th>
                    <th>Child / Participants</th>
                    <th>Recorded By</th>
                    <th>Status</th>
                    <th>Reviewed By</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProgramRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="font-semibold text-slate-900">PRG-{String(record.sourceId).padStart(4, '0')}</td>
                      <td>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{record.programType}</span>
                        <p className="mt-1 font-bold text-slate-800">{record.title}</p>
                      </td>
                      <td><p className="font-bold text-slate-800">{record.cdcName || 'Not recorded'}</p><p className="text-xs text-slate-500">{record.barangayName || 'No barangay'}</p></td>
                      <td>{record.date || 'Not recorded'}</td>
                      <td>{record.peopleLabel}</td>
                      <td>{record.submittedBy}</td>
                      <td><span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusBadgeClasses[record.status] || statusBadgeClasses.active}`}>{formatProgramValue(record.status)}</span></td>
                      <td>{record.reviewedBy}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedRecordDetail(record)}
                          className="lgu-button-secondary px-3 py-2 text-xs"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleProgramRecords.length ? (
                <div className="lgu-empty-state m-4">
                  No {programTypeLabels[programTypeFilter]?.toLowerCase() || 'program'} records match the selected filters.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {selectedRecordDetail ? (
          <ProgramRecordDetailModal
            record={selectedRecordDetail}
            onClose={() => setSelectedRecordDetail(null)}
            onOpenSource={() => {
              if (selectedRecordDetail.type === 'feeding') {
                setSelectedProgramId(String(selectedRecordDetail.sourceId));
                navigate(`${basePath}/feeding?view=tracker&program=${selectedRecordDetail.sourceId}`);
              }
              if (selectedRecordDetail.type === 'seminar') {
                navigate(`${basePath}/seminars?view=new`);
              }
              if (selectedRecordDetail.type === 'health') {
                navigate(`${basePath}/health?view=new`);
              }
              setSelectedRecordDetail(null);
            }}
          />
        ) : null}

        {reviewModal ? (
          <ProgramReviewModal
            type={reviewModal.type}
            feedingForm={feedingForm}
            dayRecordForm={dayRecordForm}
            seminarData={seminarData}
            healthCheckData={healthCheckData}
            selectedHealthChild={selectedHealthChild}
            selectedProgram={selectedProgram}
            cdcs={cdcs}
            saving={savingProgram || savingDayRecord}
            onCancel={() => setReviewModal(null)}
            onConfirm={() => {
              if (reviewModal.type === 'create_program') submitCreateProgram();
              if (reviewModal.type === 'record_day') submitRecordDay();
              if (reviewModal.type === 'seminar' || reviewModal.type === 'health') confirmLocalSchedule();
            }}
          />
        ) : null}
      </div>
    </RoleLayout>
  );
}

function ProgramPreviewCard({ title, rows }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm uppercase tracking-wide text-[#0f4b94]">Official Preview</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h2>
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        {rows.map(([label, value]) => (
          <div key={label} className="grid border-b border-slate-200 last:border-b-0 sm:grid-cols-[0.38fr_0.62fr]">
            <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{label}</div>
            <div className="px-4 py-3 text-sm font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        This preview will help verify the activity details before saving the coordination record.
      </div>
    </section>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">{value || 'Not recorded'}</p>
    </div>
  );
}

function CompactTextarea({ label, name, value, onChange, placeholder, tone = 'slate' }) {
  const toneClasses = tone === 'amber'
    ? 'border-amber-200 focus:border-amber-500'
    : tone === 'sky'
      ? 'border-sky-200 focus:border-sky-500'
      : 'border-slate-300 focus:border-sky-500';

  return (
    <div>
      <label className={`mb-2 block text-sm font-semibold ${tone === 'amber' ? 'text-amber-900' : tone === 'sky' ? 'text-sky-900' : 'text-slate-700'}`}>{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows="3"
        placeholder={placeholder}
        className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold outline-none transition ${toneClasses}`}
      />
    </div>
  );
}

function getCdcDisplayName(cdcs, cdcId) {
  const selectedCdc = cdcs.find((cdc) => String(cdc.id) === String(cdcId));
  if (!selectedCdc) return 'Not selected';
  return `${selectedCdc.name}${selectedCdc.barangay_name ? ` - ${selectedCdc.barangay_name}` : ''}`;
}

function formatProgramValue(value) {
  return String(value || 'Not set').replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function ProgramRecordDetailModal({ record, onClose, onOpenSource }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0f4b94]">{record.programType}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{record.title}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              This record is shown from the original {record.programType.toLowerCase()} source.
            </p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusBadgeClasses[record.status] || statusBadgeClasses.active}`}>
            {formatProgramValue(record.status)}
          </span>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          {record.detailRows.map(([label, value]) => (
            <div key={label} className="grid border-b border-slate-200 last:border-b-0 sm:grid-cols-[0.42fr_0.58fr]">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{label}</div>
              <div className="px-4 py-3 text-sm font-semibold text-slate-900">{value || 'Not recorded'}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col justify-end gap-3 sm:flex-row">
          <button type="button" onClick={onClose} className="lgu-button-secondary">Close</button>
          <button type="button" onClick={onOpenSource} className="lgu-button-primary">Open Source Record</button>
        </div>
      </section>
    </div>
  );
}

function ProgramReviewModal({
  type,
  feedingForm,
  dayRecordForm,
  seminarData,
  healthCheckData,
  selectedHealthChild,
  selectedProgram,
  cdcs,
  saving,
  onCancel,
  onConfirm,
}) {
  const selectedCdc = cdcs.find((cdc) => String(cdc.id) === String(feedingForm.cdc));
  const modalContent = {
    create_program: {
      kicker: 'Review Program',
      title: 'Create this feeding program?',
      message: 'The system will generate the feeding schedule and add this record to the program logbook.',
      rows: [
        ['Program Type', 'Feeding Program'],
        ['CDC', selectedCdc?.name || 'Not selected'],
        ['Start Date', feedingForm.start_date || 'Not set'],
        ['Target Beneficiaries', feedingForm.target_beneficiaries || 0],
        ['Budget', feedingForm.budget_allocation || 0],
        ['Schedule', scheduleLabels[feedingForm.schedule_type] || feedingForm.schedule_type],
      ],
      confirm: 'Create Program',
    },
    record_day: {
      kicker: 'Review Activity Record',
      title: 'Save this feeding day record?',
      message: 'This activity record will update program monitoring counts and recent activity history.',
      rows: [
        ['Program', selectedProgram?.title || 'No program selected'],
        ['Feeding Date', dayRecordForm.feeding_date || 'Not set'],
        ['Status', dayRecordForm.status],
        ['Beneficiaries Served', dayRecordForm.beneficiaries_served || 0],
        ['Attendance Count', dayRecordForm.attendance_count || 0],
        ['Meals Served', dayRecordForm.meals_served || 0],
      ],
      confirm: 'Save Record',
    },
    seminar: {
      kicker: 'Review Seminar',
      title: 'Save this seminar schedule?',
      message: 'This coordination record will remain visible in the regular program workspace.',
      rows: [
        ['Program Type', 'Parent Meeting / Seminar'],
        ['CDC / Barangay', getCdcDisplayName(cdcs, seminarData.cdc)],
        ['Title', seminarData.seminarTitle || 'Not set'],
        ['Date', seminarData.date || 'Not set'],
        ['Time', seminarData.time || 'Not set'],
        ['Venue', seminarData.venue || 'Not set'],
        ['Facilitator', seminarData.facilitator || 'Not set'],
        ['Participants', seminarData.participants || 0],
        ['Status', formatProgramValue(seminarData.status)],
        ['Topics', seminarData.topics || 'No topics encoded'],
        ['Materials', seminarData.materials || 'No materials encoded'],
        ['Outcome / Follow-up', seminarData.outcomes || 'No follow-up encoded'],
      ],
      confirm: 'Save Seminar',
    },
    health: {
      kicker: 'Review Health Checkup',
      title: 'Save this child health record?',
      message: 'This check-up will be linked to the selected child profile and included in health service summaries.',
      rows: [
        ['Child', selectedHealthChild?.name || 'Not selected'],
        ['Student ID', selectedHealthChild?.student_id || 'Not recorded'],
        ['CDC / Barangay', selectedHealthChild?.cdc_name || getCdcDisplayName(cdcs, healthCheckData.cdc)],
        ['Check-up Date', healthCheckData.screening_date || 'Today'],
        ['Check-up Type', formatProgramValue(healthCheckData.checkup_type)],
        ['Conducted By', formatProgramValue(healthCheckData.conducted_by)],
        ['Nutrition Status', formatProgramValue(healthCheckData.nutritional_status)],
        ['Findings', healthCheckData.health_findings || 'No findings encoded'],
        ['Advice', healthCheckData.advice_given || 'No advice encoded'],
        ['Referral', healthCheckData.needs_referral ? (healthCheckData.referral_reason || 'Referral needed') : 'No'],
        ['Follow-up', healthCheckData.follow_up_needed ? (healthCheckData.follow_up_date || 'Needed') : 'No'],
      ],
      confirm: 'Save Health Checkup',
    },
  }[type];

  if (!modalContent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0f4b94]">{modalContent.kicker}</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">{modalContent.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{modalContent.message}</p>
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          {modalContent.rows.map(([label, value]) => (
            <div key={label} className="grid border-b border-slate-200 last:border-b-0 sm:grid-cols-[0.42fr_0.58fr]">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{label}</div>
              <div className="px-4 py-3 text-sm font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Attachments such as attendance sheets, photos, certificates, or signed forms may be kept as supporting evidence for office records.
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="lgu-button-secondary">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={saving} className="lgu-button-primary">
            {saving ? 'Saving...' : modalContent.confirm}
          </button>
        </div>
      </section>
    </div>
  );
}

export default RegularProgramsPage;
