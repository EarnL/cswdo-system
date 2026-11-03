import ReportCdcField from '../components/ReportCdcField';
import { loadReportCdcs } from '../utils/reportCdcs';
import useReportChanges from '../hooks/useReportChanges';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import RoleLayout from '../components/RoleLayout';
import api from '../api';
import ReportCardsPanel from '../components/ReportCardsPanel';
import DraftsPanel from '../components/DraftsPanel';

const defaultFormData = {
  // Personal Information
  lastName: '',
  firstName: '',
  middleName: '',
  age: '',
  sex: '',
  birthday: '',
  religion: '',
  ethnicity: '',
  civilStatus: '',
  noChildren: '',
  address: '',
  homeNo: '',
  officeNo: '',
  mobileNo: '',
  faxNo: '',
  email: '',
  educationLevel: '',
  eligibility: '',

  // Work-Related Information
  yearsAsWorker: '',
  cdcName: '',
  salary: '',
  honoraria: '',
  allowance: '',
  parentsContribution: '',
  totalCompensation: '',
  barangayAmount: '',
  cityAmount: '',
  ngosAmount: '',
  parentsAmount: '',
  othersCompensation: '',
  termsOfEmployment: '',
  status: '',
  dateAccredited: '',
  accreditationNo: '',
  accreditationLevel: '',

  // Working Conditions
  totalChildren: '',
  sessionsPerDay: '',
  hoursPerSession: '',
  ageGroups: [],
  hoursInCenter: '',
  withReferenceMaterials: '',
};

function getCurrentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

function getQuarterDueDate(quarter, year) {
  const dueMonth = quarter * 3 + 1;
  if (dueMonth > 12) {
    return new Date(year + 1, 0, 15);
  }
  return new Date(year, dueMonth - 1, 15);
}

function CDWReportForm() {
  const [formData, setFormData] = useState(defaultFormData);

  const [trainings, setTrainings] = useState([{ title: '', dates: '', hours: '', sponsor: '' }]);
  const [otherCourses, setOtherCourses] = useState([{ course: '', year: '' }]);
  const [availableCdcs, setAvailableCdcs] = useState([]);
  const [selectedCdcId, setSelectedCdcId] = useState('');
  const [reports, setReports] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ready, setReady] = useState(false);
  const { dirty, markSaved, acceptNextChange, confirmDiscard } = useReportChanges({ formData, selectedCdcId, selectedFile: selectedFile ? [selectedFile.name, selectedFile.size, selectedFile.lastModified] : null, trainings, otherCourses }, ready);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [cdcRes, reportRes, draftRes] = await Promise.all([
          loadReportCdcs(),
          api.get('/reports/'),
          api.get('/report-drafts/', {
            params: {
              report_type: 'form6',
            },
          }),
        ]);

        if (!isMounted) {
          return;
        }

        const filteredCdcs = cdcRes.data;
        const nextReports = Array.isArray(reportRes.data)
          ? reportRes.data.filter((report) => report.report_type === 'form6')
          : [];

        setAvailableCdcs(filteredCdcs);
        setReports(nextReports);
        setActiveReportId(nextReports[0]?.id ?? null);
        setDrafts(Array.isArray(draftRes.data) ? draftRes.data : []);

        if (filteredCdcs[0]) {
          setSelectedCdcId(String(filteredCdcs[0].id));
          setFormData((current) => ({
            ...current,
            cdcName: current.cdcName || filteredCdcs[0].name || '',
          }));
        }
        setReady(true);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        console.log(err);
        setReady(true);
        setLoadError('Failed to load assigned CDCs or submission history.');
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshReportHistory = async () => {
    const response = await api.get('/reports/');
    const nextReports = Array.isArray(response.data)
      ? response.data.filter((report) => report.report_type === 'form6')
      : [];

    setReports(nextReports);
    setActiveReportId(nextReports[0]?.id ?? null);
  };

  const refreshDraftHistory = async () => {
    const response = await api.get('/report-drafts/', {
      params: {
        report_type: 'form6',
      },
    });
    const nextDrafts = Array.isArray(response.data) ? response.data : [];
    setDrafts(nextDrafts);
    return nextDrafts;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'ageGroups') {
        setFormData(prev => ({
          ...prev,
          ageGroups: checked
            ? [...prev.ageGroups, value]
            : prev.ageGroups.filter(age => age !== value)
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleTrainingChange = (index, field, value) => {
    const newTrainings = [...trainings];
    newTrainings[index][field] = value;
    setTrainings(newTrainings);
  };

  const addTraining = () => {
    setTrainings([...trainings, { title: '', dates: '', hours: '', sponsor: '' }]);
  };

  const handleCourseChange = (index, field, value) => {
    const newCourses = [...otherCourses];
    newCourses[index][field] = value;
    setOtherCourses(newCourses);
  };

  const addCourse = () => {
    setOtherCourses([...otherCourses, { course: '', year: '' }]);
  };

  const handleCdcChange = (e) => {
    const nextId = e.target.value;
    const selectedCdc = availableCdcs.find((cdc) => String(cdc.id) === String(nextId));

    setSelectedCdcId(nextId);
    setFormData((prev) => ({
      ...prev,
      cdcName: selectedCdc?.name || prev.cdcName,
    }));
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] || null);
  };

  const handleLoadDraft = (draft) => {
    if (!confirmDiscard()) return;
    acceptNextChange();
    setActiveDraftId(draft.id);
    setSelectedCdcId(String(draft.cdc));
    setFormData(draft.payload?.formData || defaultFormData);
    setTrainings(draft.payload?.trainings || [{ title: '', dates: '', hours: '', sponsor: '' }]);
    setOtherCourses(draft.payload?.otherCourses || [{ course: '', year: '' }]);
    setStatusMessage('Draft loaded into the form.');
  };

  const handleDeleteDraft = async (draftId) => {
    try {
      await api.delete(`/report-drafts/${draftId}/`);
      await refreshDraftHistory();
      if (activeDraftId === draftId) {
        setActiveDraftId(null);
      }
      setStatusMessage('Draft deleted successfully.');
    } catch (err) {
      console.log(err.response?.data || err);
      setStatusMessage('Failed to delete the selected draft.');
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedCdcId) {
      setStatusMessage('Please select a CDC before saving a draft.');
      return;
    }

    const quarter = getCurrentQuarter();
    const year = new Date().getFullYear();
    const selectedCdc = availableCdcs.find((cdc) => String(cdc.id) === String(selectedCdcId));

    try {
      const response = await api.post('/report-drafts/', {
        cdc: Number(selectedCdcId),
        report_type: 'form6',
        title: `Child Development Worker Profile Draft - ${selectedCdc?.name || formData.cdcName || 'CDW Profile'} - Q${quarter} ${year}`,
        quarter,
        year,
        payload: {
          selectedCdcId,
          formData,
          trainings,
          otherCourses,
        },
      });
      setActiveDraftId(response.data.id);
      await refreshDraftHistory();
      if (!selectedFile) markSaved();
      setStatusMessage(selectedFile ? 'Draft saved. The attachment will be saved when you submit; keep this page open.' : 'Draft saved successfully.');
    } catch (err) {
      console.log(err.response?.data || err);
      setStatusMessage('Failed to save the draft. Please try again.');
    }
  };

  const submitForm = async () => {
    if (!selectedCdcId) {
      setStatusMessage('Please select the CDC for this submission.');
      return;
    }

    const quarter = getCurrentQuarter();
    const year = new Date().getFullYear();
    const selectedCdc = availableCdcs.find((cdc) => String(cdc.id) === String(selectedCdcId));

    setSaving(true);
    setStatusMessage('');

    try {
      const payload = new FormData();
      payload.append('cdc', String(Number(selectedCdcId)));
      payload.append('report_type', 'form6');
      payload.append('title', `Child Development Worker Profile - ${selectedCdc?.name || formData.cdcName || 'CDW Profile'}`);
      payload.append('summary', `${formData.firstName || 'CDW'} ${formData.lastName || ''} submitted a CDW profile report for ${selectedCdc?.barangay_name || 'the assigned barangay'}.`);
      payload.append('quarter', String(quarter));
      payload.append('year', String(year));
      payload.append('is_complete', 'true');
      payload.append('is_on_time', 'true');
      payload.append('payload', JSON.stringify({
        formData,
        trainings,
        otherCourses,
      }));
      if (selectedFile) {
        payload.append('attachment', selectedFile);
      }

      await api.post('/reports/', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      markSaved();
      await refreshReportHistory();
      if (activeDraftId) {
        await api.delete(`/report-drafts/${activeDraftId}/`);
        setActiveDraftId(null);
      }
      await refreshDraftHistory();
      acceptNextChange();
      setStatusMessage('Child Development Worker Profile submitted successfully to CSWDO.');
      setFormData((current) => ({
        ...defaultFormData,
        cdcName: selectedCdc?.name || current.cdcName || '',
      }));
      setTrainings([{ title: '', dates: '', hours: '', sponsor: '' }]);
      setOtherCourses([{ course: '', year: '' }]);
      setSelectedFile(null);
    } catch (err) {
      console.log(err.response?.data || err);
      setStatusMessage('Failed to submit Child Development Worker Profile. Please check your assigned CDC and try again.');
    } finally {
      setSaving(false);
      setShowConfirm(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCdcId) {
      setStatusMessage('Please select the CDC for this submission.');
      return;
    }
    setShowConfirm(true);
  };

  return (
    <RoleLayout role="cdw">
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        <Link to="/cdw/reports" className="inline-flex text-sm font-semibold text-[#0f4b94] hover:underline">Back to Monitoring Reports</Link>
        {dirty && <p role="status" className="text-sm text-amber-700">Unsaved changes</p>}


        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
        {/* Header */}
        <div className="border-b-4 border-blue-600 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-center text-gray-800">Child Development Worker Profile</h1>
          <p className="text-center text-gray-600 text-sm mt-2">Early Childhood Care and Development Council</p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned CDC for this report (required)</label>
            <ReportCdcField
              value={selectedCdcId}
              onChange={handleCdcChange}
              className="w-full rounded-lg border border-blue-200 bg-white px-4 py-3 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
             cdcs={availableCdcs} />
            <p className="mt-3 text-xs text-slate-600">This form will be saved as a submitted report file in your history and in CSWDO reports.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reporting Period</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">Q{getCurrentQuarter()} {new Date().getFullYear()}</p>
            <p className="mt-2 text-sm text-slate-600">Submission history below will keep your previously submitted Child Development Worker Profile files.</p>
            <p className="mt-2 text-sm font-medium text-amber-700">
              Due by {getQuarterDueDate(getCurrentQuarter(), new Date().getFullYear()).toLocaleDateString()}
            </p>
          </div>
        </div>

        {loadError ? (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        ) : null}

        {statusMessage ? (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${statusMessage.includes('successfully') ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>
            {statusMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="border-2 border-gray-300 p-6 rounded-lg bg-slate-50">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Attached Report File</h3>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Child Development Worker Profile file</label>
            <input
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3"
            />
            <p className="mt-2 text-xs text-slate-500">
              Accepted files: PDF, DOC, DOCX, JPG, JPEG, PNG.
            </p>
            {selectedFile ? (
              <p className="mt-3 text-sm font-medium text-slate-700">Selected file: {selectedFile.name}</p>
            ) : null}
          </section>

          {/* Section I: Personal Information */}
          <section className="border-2 border-gray-300 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-blue-600">
              I. Child Development Worker Personal Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                <input id="lastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                <input id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="middleName" className="block text-sm font-semibold text-gray-700 mb-2">Middle Name</label>
                <input id="middleName"
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label htmlFor="age" className="block text-sm font-semibold text-gray-700 mb-2">Age</label>
                <input id="age"
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="sex" className="block text-sm font-semibold text-gray-700 mb-2">Sex</label>
                <select id="sex"
                  name="sex"
                  value={formData.sex}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label htmlFor="birthday" className="block text-sm font-semibold text-gray-700 mb-2">Birthday</label>
                <input id="birthday"
                  type="date"
                  name="birthday"
                  value={formData.birthday}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label htmlFor="religion" className="block text-sm font-semibold text-gray-700 mb-2">Religion</label>
                <input id="religion"
                  type="text"
                  name="religion"
                  value={formData.religion}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="ethnicity" className="block text-sm font-semibold text-gray-700 mb-2">Ethnicity</label>
                <input id="ethnicity"
                  type="text"
                  name="ethnicity"
                  value={formData.ethnicity}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="civilStatus" className="block text-sm font-semibold text-gray-700 mb-2">Civil Status</label>
                <select id="civilStatus"
                  name="civilStatus"
                  value={formData.civilStatus}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="separated">Separated</option>
                  <option value="widow">Widow/Widower</option>
                  <option value="live-in">Live in</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="noChildren" className="block text-sm font-semibold text-gray-700 mb-2">Number of Children</label>
              <input id="noChildren"
                type="number"
                name="noChildren"
                value={formData.noChildren}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div className="mt-6">
              <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
              <input id="address"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="No. / Street / Subdivision / Barangay / City / Province / Region"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div>
                <label htmlFor="homeNo" className="block text-sm font-semibold text-gray-700 mb-2">Home Phone</label>
                <input id="homeNo"
                  type="text"
                  name="homeNo"
                  value={formData.homeNo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="officeNo" className="block text-sm font-semibold text-gray-700 mb-2">Office Phone</label>
                <input id="officeNo"
                  type="text"
                  name="officeNo"
                  value={formData.officeNo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="mobileNo" className="block text-sm font-semibold text-gray-700 mb-2">Mobile Phone</label>
                <input id="mobileNo"
                  type="text"
                  name="mobileNo"
                  value={formData.mobileNo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label htmlFor="faxNo" className="block text-sm font-semibold text-gray-700 mb-2">Fax Number</label>
                <input id="faxNo"
                  type="text"
                  name="faxNo"
                  value={formData.faxNo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="educationLevel" className="block text-sm font-semibold text-gray-700 mb-4">Educational Background</label>
              <select id="educationLevel"
                name="educationLevel"
                value={formData.educationLevel}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="elem-undergrad">Elementary Undergraduate</option>
                <option value="elem-grad">Elementary Graduate</option>
                <option value="hs-undergrad">High School Undergraduate</option>
                <option value="hs-grad">High School Graduate</option>
                <option value="college-undergrad">College Undergraduate</option>
                <option value="college-grad">College Graduate</option>
                <option value="masteral">With Masteral Units</option>
                <option value="post-grad">Post Graduate</option>
                <option value="vocational">Vocational</option>
              </select>
            </div>

            <div className="mt-6">
              <label htmlFor="eligibility" className="block text-sm font-semibold text-gray-700 mb-4">Eligibility</label>
              <select id="eligibility"
                name="eligibility"
                value={formData.eligibility}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="cs-sub-pro">Civil Service Sub-Professional</option>
                <option value="cs-pro">Civil Service Professional</option>
                <option value="let">Licensure Examination for Teachers</option>
                <option value="none">None</option>
              </select>
            </div>
          </section>

          {/* Section II: Work-Related Information */}
          <section className="border-2 border-gray-300 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-blue-600">
              II. Work-Related Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="yearsAsWorker" className="block text-sm font-semibold text-gray-700 mb-2">Number of Years as CDW</label>
                <input id="yearsAsWorker"
                  type="number"
                  name="yearsAsWorker"
                  value={formData.yearsAsWorker}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="cdcName" className="block text-sm font-semibold text-gray-700 mb-2">Name of CDC Being Served</label>
                <input id="cdcName"
                  type="text"
                  name="cdcName"
                  value={formData.cdcName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h4 className="font-semibold text-gray-800 mb-4">Monthly Compensation</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="salary" className="block text-sm font-semibold text-gray-700 mb-2">Salary</label>
                  <input id="salary"
                    type="number"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="honoraria" className="block text-sm font-semibold text-gray-700 mb-2">Honoraria</label>
                  <input id="honoraria"
                    type="number"
                    name="honoraria"
                    value={formData.honoraria}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="allowance" className="block text-sm font-semibold text-gray-700 mb-2">Allowance</label>
                  <input id="allowance"
                    type="number"
                    name="allowance"
                    value={formData.allowance}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="parentsContribution" className="block text-sm font-semibold text-gray-700 mb-2">Parents' Contribution/Pledges</label>
                  <input id="parentsContribution"
                    type="number"
                    name="parentsContribution"
                    value={formData.parentsContribution}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="totalCompensation" className="block text-sm font-semibold text-gray-700 mb-2">Total Amount of Compensation per Month</label>
              <input id="totalCompensation"
                type="number"
                name="totalCompensation"
                value={formData.totalCompensation}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent font-bold"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mt-6 mb-6">
              <h4 className="font-semibold text-gray-800 mb-4">Source of Compensation</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="barangayAmount" className="block text-sm font-semibold text-gray-700 mb-2">Barangay Amount</label>
                  <input id="barangayAmount"
                    type="number"
                    name="barangayAmount"
                    value={formData.barangayAmount}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="cityAmount" className="block text-sm font-semibold text-gray-700 mb-2">City/Municipal Amount</label>
                  <input id="cityAmount"
                    type="number"
                    name="cityAmount"
                    value={formData.cityAmount}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="ngosAmount" className="block text-sm font-semibold text-gray-700 mb-2">NGOs/NGAs Amount</label>
                  <input id="ngosAmount"
                    type="number"
                    name="ngosAmount"
                    value={formData.ngosAmount}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="parentsAmount" className="block text-sm font-semibold text-gray-700 mb-2">Parents Amount</label>
                  <input id="parentsAmount"
                    type="number"
                    name="parentsAmount"
                    value={formData.parentsAmount}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="othersCompensation" className="block text-sm font-semibold text-gray-700 mb-2">Others (Please specify)</label>
                <input id="othersCompensation"
                  type="text"
                  name="othersCompensation"
                  value={formData.othersCompensation}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="termsOfEmployment" className="block text-sm font-semibold text-gray-700 mb-2">Terms of Employment</label>
              <select id="termsOfEmployment"
                name="termsOfEmployment"
                value={formData.termsOfEmployment}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="plantilla">Plantilla</option>
                <option value="contract">Contract of Service</option>
                <option value="casual">Casual</option>
                <option value="co-terminus">Co-Terminus w/ Hiring Authority</option>
                <option value="voluntary">Voluntary</option>
              </select>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-gray-800 mb-4">ECCD-Related Trainings</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">No.</th>
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Title of Training</th>
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Dates</th>
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Hours</th>
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Conducted/Sponsored By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainings.map((training, index) => (
                      <tr key={index}>
                        <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input
                            type="text"
                            value={training.title}
                            onChange={(e) => handleTrainingChange(index, 'title', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input
                            type="text"
                            value={training.dates}
                            onChange={(e) => handleTrainingChange(index, 'dates', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input
                            type="number"
                            value={training.hours}
                            onChange={(e) => handleTrainingChange(index, 'hours', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input
                            type="text"
                            value={training.sponsor}
                            onChange={(e) => handleTrainingChange(index, 'sponsor', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addTraining}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Training
              </button>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-gray-800 mb-4">Other Courses Attended</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherCourses.map((course, index) => (
                  <div key={index} className="border border-gray-300 p-4 rounded-lg">
                    <input
                      type="text"
                      placeholder="Course Name"
                      value={course.course}
                      onChange={(e) => handleCourseChange(index, 'course', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
                    />
                    <input
                      type="number"
                      placeholder="Year Completed"
                      value={course.year}
                      onChange={(e) => handleCourseChange(index, 'year', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addCourse}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Course
              </button>
            </div>

            <div className="mt-6 bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-4">Status as a Child Development Worker</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="accredited"
                    checked={formData.status === 'accredited'}
                    onChange={handleChange}
                    className="mr-3"
                  />
                  <label className="text-gray-700">Accredited</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="not-accredited"
                    checked={formData.status === 'not-accredited'}
                    onChange={handleChange}
                    className="mr-3"
                  />
                  <label className="text-gray-700">Not Accredited</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="expired"
                    checked={formData.status === 'expired'}
                    onChange={handleChange}
                    className="mr-3"
                  />
                  <label className="text-gray-700">Accredited but Expired</label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label htmlFor="dateAccredited" className="block text-sm font-semibold text-gray-700 mb-2">Date Accredited</label>
                  <input id="dateAccredited"
                    type="date"
                    name="dateAccredited"
                    value={formData.dateAccredited}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="accreditationNo" className="block text-sm font-semibold text-gray-700 mb-2">Accreditation No.</label>
                  <input id="accreditationNo"
                    type="text"
                    name="accreditationNo"
                    value={formData.accreditationNo}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="accreditationLevel" className="block text-sm font-semibold text-gray-700 mb-2">Level</label>
                  <select id="accreditationLevel"
                    name="accreditationLevel"
                    value={formData.accreditationLevel}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                    <option value="3">Level 3</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Section III: Working Conditions */}
          <section className="border-2 border-gray-300 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-blue-600">
              III. Working Conditions
            </h3>

            <div>
              <label htmlFor="totalChildren" className="block text-sm font-semibold text-gray-700 mb-2">Total Number of Children Being Served</label>
              <input id="totalChildren"
                type="number"
                name="totalChildren"
                value={formData.totalChildren}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label htmlFor="sessionsPerDay" className="block text-sm font-semibold text-gray-700 mb-2">No. of Sessions Conducted per Day</label>
                <select id="sessionsPerDay"
                  name="sessionsPerDay"
                  value={formData.sessionsPerDay}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>
              <div>
                <label htmlFor="hoursPerSession" className="block text-sm font-semibold text-gray-700 mb-2">No. of Hours per Session</label>
                <select id="hoursPerSession"
                  name="hoursPerSession"
                  value={formData.hoursPerSession}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="2.5">2 ½ hours</option>
                  <option value="3">3 hours</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-4">Age of Children Being Handled</label>
              <div className="space-y-2">
                {['Below 1 y/o', '1 year old', '2 years old', '3 years old', '4 years old', '5 years old'].map((age) => (
                  <div key={age} className="flex items-center">
                    <input
                      type="checkbox"
                      name="ageGroups"
                      value={age}
                      checked={formData.ageGroups.includes(age)}
                      onChange={handleChange}
                      className="mr-3"
                    />
                    <label className="text-gray-700">{age}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="hoursInCenter" className="block text-sm font-semibold text-gray-700 mb-2">No. of Hours Staying in the Center</label>
              <select id="hoursInCenter"
                name="hoursInCenter"
                value={formData.hoursInCenter}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="1-2">1-2 hours</option>
                <option value="2-3">2 ½ - 3 hours</option>
                <option value="4-5">4-5 hours</option>
                <option value="6-7">6-7 hours</option>
                <option value="8">8 hours</option>
              </select>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-4">How Sessions are Conducted</label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="withReferenceMaterials"
                    value="with-materials"
                    checked={formData.withReferenceMaterials === 'with-materials'}
                    onChange={handleChange}
                    className="mr-3"
                  />
                  <label className="text-gray-700">With reference materials</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="withReferenceMaterials"
                    value="without-materials"
                    checked={formData.withReferenceMaterials === 'without-materials'}
                    onChange={handleChange}
                    className="mr-3"
                  />
                  <label className="text-gray-700">Without reference materials</label>
                </div>
              </div>
            </div>
          </section>

          {/* Submit Section */}
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5 mt-8">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-8 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              {saving ? 'Submitting...' : 'Review and Submit'}
            </button>
            <button
              type="reset"
              onClick={(event) => {
                if (!confirmDiscard()) { event.preventDefault(); return; }
                acceptNextChange();
                const selectedCdc = availableCdcs.find((cdc) => String(cdc.id) === String(selectedCdcId));
                setActiveDraftId(null);
                setFormData({
                  ...defaultFormData,
                  cdcName: selectedCdc?.name || '',
                });
                setTrainings([{ title: '', dates: '', hours: '', sponsor: '' }]);
                setOtherCourses([{ course: '', year: '' }]);
                setSelectedFile(null);
              }}
              className="px-8 py-3 bg-gray-400 text-white font-semibold rounded-lg hover:bg-gray-500 transition"
            >
              Clear Form
            </button>
          </div>
        </form>
      </div>

        <DraftsPanel
          title="Child Development Worker Profile Drafts"
          drafts={drafts}
          activeDraftId={activeDraftId}
          emptyMessage="Save a draft when you want to continue Child Development Worker Profile later."
          onLoad={handleLoadDraft}
          onDelete={handleDeleteDraft}
        />

        <ReportCardsPanel
          title="My Submitted Files"
          description="Open any submitted Child Development Worker Profile card to review the report history you already sent to CSWDO."
          reports={reports}
          activeReportId={activeReportId}
          onSelect={setActiveReportId}
          detailBase="/cdw/reports/submissions"
          emptyMessage="You have not submitted any Child Development Worker Profile files yet."
          countLabel="files"
        />
        {showConfirm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <section className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Confirm Child Development Worker Profile Submission</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Submit this CDW profile to CSWDO?</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">CDC</p><p className="mt-1 font-bold text-slate-900">{availableCdcs.find((cdc) => String(cdc.id) === String(selectedCdcId))?.name || formData.cdcName || 'Not selected'}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">CDW</p><p className="mt-1 font-bold text-slate-900">{formData.firstName || 'CDW'} {formData.lastName || ''}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Draft</p><p className="mt-1 font-bold text-slate-900">{activeDraftId ? 'Loaded draft' : 'No active draft'}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Attachment</p><p className="mt-1 font-bold text-slate-900">{selectedFile ? selectedFile.name : 'No file selected'}</p></div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">After submission, this form will be sent for CSWDO review and can only be edited again if returned.</p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setShowConfirm(false)} className="lgu-button-secondary">Cancel</button>
                <button type="button" onClick={submitForm} disabled={saving} className="lgu-button-primary">{saving ? 'Submitting...' : 'Submit Child Development Worker Profile'}</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </RoleLayout>
  );
}

export default CDWReportForm;
