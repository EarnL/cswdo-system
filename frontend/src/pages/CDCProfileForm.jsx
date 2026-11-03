import ReportCdcField from '../components/ReportCdcField';
import { loadReportCdcs } from '../utils/reportCdcs';
import useReportChanges from '../hooks/useReportChanges';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import RoleLayout from '../components/RoleLayout';
import api from '../api';
import ReportCardsPanel from '../components/ReportCardsPanel';

const defaultFormData = {
  cdcName: '',
  barangay: '',
  district: '',
  address: '',
  contactPerson: '',
  contactNo: '',
  totalChildren: '',
  toddlers: '',
  preschoolers: '',
  totalCaregivers: '',
  totalVolunteers: '',
  enrollmentCapacity: '',
  operatingDays: '',
  hoursOpen: '',
  waterSource: '',
  toiletType: '',
  feedingProgram: '',
  remarks: '',
};

function getCurrentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

function CDCProfileForm() {
  const [formData, setFormData] = useState(defaultFormData);
  const [availableCdcs, setAvailableCdcs] = useState([]);
  const [selectedCdcId, setSelectedCdcId] = useState('');
  const [reports, setReports] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ready, setReady] = useState(false);
  const { dirty, markSaved, acceptNextChange, confirmDiscard } = useReportChanges({ formData, selectedCdcId, selectedFile: selectedFile ? [selectedFile.name, selectedFile.size, selectedFile.lastModified] : null }, ready);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [cdcRes, reportRes] = await Promise.all([
          loadReportCdcs(),
          api.get('/reports/'),
        ]);

        if (!isMounted) {
          return;
        }

        const filteredCdcs = cdcRes.data;
        const nextReports = Array.isArray(reportRes.data)
          ? reportRes.data.filter((report) => report.report_type === 'form7')
          : [];

        setAvailableCdcs(filteredCdcs);
        setReports(nextReports);
        setActiveReportId(nextReports[0]?.id ?? null);

        if (filteredCdcs[0]) {
          const firstCdc = filteredCdcs[0];
          setSelectedCdcId(String(firstCdc.id));
          setFormData((current) => ({
            ...current,
            cdcName: firstCdc.name || '',
            barangay: firstCdc.barangay_name || '',
            contactPerson: current.contactPerson || firstCdc.contact_person || '',
            contactNo: current.contactNo || firstCdc.contact_number || '',
            totalChildren: current.totalChildren || String(firstCdc.current_enrollment ?? ''),
            enrollmentCapacity: current.enrollmentCapacity || String(firstCdc.max_capacity ?? ''),
            operatingDays: current.operatingDays || firstCdc.operating_days || '',
            hoursOpen: current.hoursOpen || firstCdc.operating_hours || '',
          }));
        }
        setReady(true);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        console.log(err);
        setReady(true);
        setLoadError('Failed to load assigned CDCs or Child Development Center Profile history.');
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
      ? response.data.filter((report) => report.report_type === 'form7')
      : [];

    setReports(nextReports);
    setActiveReportId(nextReports[0]?.id ?? null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCdcChange = (e) => {
    const nextId = e.target.value;
    const selectedCdc = availableCdcs.find((cdc) => String(cdc.id) === String(nextId));

    setSelectedCdcId(nextId);
    setFormData((prev) => ({
      ...prev,
      cdcName: selectedCdc?.name || '',
      barangay: selectedCdc?.barangay_name || '',
      contactPerson: prev.contactPerson || selectedCdc?.contact_person || '',
      contactNo: prev.contactNo || selectedCdc?.contact_number || '',
      totalChildren: prev.totalChildren || String(selectedCdc?.current_enrollment ?? ''),
      enrollmentCapacity: prev.enrollmentCapacity || String(selectedCdc?.max_capacity ?? ''),
      operatingDays: prev.operatingDays || selectedCdc?.operating_days || '',
      hoursOpen: prev.hoursOpen || selectedCdc?.operating_hours || '',
    }));
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] || null);
  };

  const resetForm = () => {
    const selectedCdc = availableCdcs.find((cdc) => String(cdc.id) === String(selectedCdcId));
    setFormData({
      ...defaultFormData,
      cdcName: selectedCdc?.name || '',
      barangay: selectedCdc?.barangay_name || '',
      contactPerson: selectedCdc?.contact_person || '',
      contactNo: selectedCdc?.contact_number || '',
      totalChildren: String(selectedCdc?.current_enrollment ?? ''),
      enrollmentCapacity: String(selectedCdc?.max_capacity ?? ''),
      operatingDays: selectedCdc?.operating_days || '',
      hoursOpen: selectedCdc?.operating_hours || '',
    });
    setSelectedFile(null);
  };

  const submitForm = async () => {
    if (!selectedCdcId) {
      setStatusMessage('Please select the CDC for this submission.');
      return;
    }

    const selectedCdc = availableCdcs.find((cdc) => String(cdc.id) === String(selectedCdcId));

    setSaving(true);
    setStatusMessage('');

    try {
      const payload = new FormData();
      payload.append('cdc', String(Number(selectedCdcId)));
      payload.append('report_type', 'form7');
      payload.append('title', `Child Development Center Profile - ${selectedCdc?.name || formData.cdcName || 'CDC Profile'}`);
      payload.append('summary', `${selectedCdc?.name || formData.cdcName || 'CDC'} profile was submitted for ${selectedCdc?.barangay_name || formData.barangay || 'the assigned barangay'}.`);
      payload.append('quarter', String(getCurrentQuarter()));
      payload.append('year', String(new Date().getFullYear()));
      payload.append('is_complete', 'true');
      payload.append('is_on_time', 'true');
      payload.append('payload', JSON.stringify(formData));
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
      setStatusMessage('Child Development Center Profile submitted successfully to CSWDO.');
    } catch (err) {
      console.log(err.response?.data || err);
      setStatusMessage('Failed to submit Child Development Center Profile. Please check your assigned CDC and try again.');
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
          <div className="border-b-4 border-blue-600 pb-4 mb-6">
            <h1 className="text-3xl font-bold text-center text-gray-800">Child Development Center Profile</h1>
            <p className="text-center text-gray-600 text-sm mt-2">To be submitted to CSWDO for monitoring and accreditation</p>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned CDC for this profile</label>
              <ReportCdcField
                value={selectedCdcId}
                onChange={handleCdcChange}
                className="w-full rounded-lg border border-blue-200 bg-white px-4 py-3 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
               cdcs={availableCdcs} />
              <p className="mt-3 text-xs text-slate-600">This submission will be recorded in your report history and in the CSWDO reports page.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reporting Period</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">Q{getCurrentQuarter()} {new Date().getFullYear()}</p>
              <p className="mt-2 text-sm text-slate-600">Previous Child Development Center Profile submissions are listed below as clickable history cards.</p>
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
            <section className="border border-gray-200 rounded-lg p-6 bg-slate-50">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Attached Report File</h3>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Child Development Center Profile file</label>
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

            <section className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">I. CDC Information</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="cdcName" className="block text-sm font-semibold text-gray-700 mb-2">CDC Name</label>
                  <input id="cdcName"
                    type="text"
                    name="cdcName"
                    value={formData.cdcName}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="barangay" className="block text-sm font-semibold text-gray-700 mb-2">Barangay</label>
                  <input id="barangay"
                    type="text"
                    name="barangay"
                    value={formData.barangay}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="district" className="block text-sm font-semibold text-gray-700 mb-2">District/Zone</label>
                  <input id="district"
                    type="text"
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">Full Address</label>
                  <input id="address"
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            <section className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">II. Contact and Management</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="contactPerson" className="block text-sm font-semibold text-gray-700 mb-2">Contact Person</label>
                  <input id="contactPerson"
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="contactNo" className="block text-sm font-semibold text-gray-700 mb-2">Contact Number</label>
                  <input id="contactNo"
                    type="text"
                    name="contactNo"
                    value={formData.contactNo}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            <section className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">III. Enrollment and Capacity</h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <label htmlFor="totalChildren" className="block text-sm font-semibold text-gray-700 mb-2">Total Children Enrolled</label>
                  <input id="totalChildren"
                    type="number"
                    name="totalChildren"
                    value={formData.totalChildren}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="toddlers" className="block text-sm font-semibold text-gray-700 mb-2">Toddler Care (2-3)</label>
                  <input id="toddlers"
                    type="number"
                    name="toddlers"
                    value={formData.toddlers}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-3 mt-6">
                <div>
                  <label htmlFor="preschoolers" className="block text-sm font-semibold text-gray-700 mb-2">Preschool Program (3-4)</label>
                  <input id="preschoolers"
                    type="number"
                    name="preschoolers"
                    value={formData.preschoolers}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="totalCaregivers" className="block text-sm font-semibold text-gray-700 mb-2">Total Caregivers</label>
                  <input id="totalCaregivers"
                    type="number"
                    name="totalCaregivers"
                    value={formData.totalCaregivers}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="totalVolunteers" className="block text-sm font-semibold text-gray-700 mb-2">Total Volunteers</label>
                  <input id="totalVolunteers"
                    type="number"
                    name="totalVolunteers"
                    value={formData.totalVolunteers}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            <section className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">IV. Facility Details</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="enrollmentCapacity" className="block text-sm font-semibold text-gray-700 mb-2">Enrollment Capacity</label>
                  <input id="enrollmentCapacity"
                    type="number"
                    name="enrollmentCapacity"
                    value={formData.enrollmentCapacity}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="operatingDays" className="block text-sm font-semibold text-gray-700 mb-2">Operating Days</label>
                  <input id="operatingDays"
                    type="text"
                    name="operatingDays"
                    value={formData.operatingDays}
                    onChange={handleChange}
                    placeholder="e.g. Monday to Friday"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="hoursOpen" className="block text-sm font-semibold text-gray-700 mb-2">Hours Open</label>
                  <input id="hoursOpen"
                    type="text"
                    name="hoursOpen"
                    value={formData.hoursOpen}
                    onChange={handleChange}
                    placeholder="e.g. 8:00 AM - 5:00 PM"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="waterSource" className="block text-sm font-semibold text-gray-700 mb-2">Water Source</label>
                  <input id="waterSource"
                    type="text"
                    name="waterSource"
                    value={formData.waterSource}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="toiletType" className="block text-sm font-semibold text-gray-700 mb-2">Toilet Type</label>
                  <input id="toiletType"
                    type="text"
                    name="toiletType"
                    value={formData.toiletType}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="feedingProgram" className="block text-sm font-semibold text-gray-700 mb-2">Feeding Program</label>
                  <input id="feedingProgram"
                    type="text"
                    name="feedingProgram"
                    value={formData.feedingProgram}
                    onChange={handleChange}
                    placeholder="e.g. Breakfast, Lunch"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            <section className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">V. Additional Notes</h3>
              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  rows="4"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </section>

            <div className="flex flex-col gap-4 sm:flex-row justify-center mt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                {saving ? 'Submitting...' : 'Review and Submit'}
              </button>
              <button
                type="reset"
                onClick={(event) => { if (!confirmDiscard()) { event.preventDefault(); return; } acceptNextChange(); resetForm(); }}
                className="w-full sm:w-auto px-8 py-3 bg-gray-400 text-white rounded-lg font-semibold hover:bg-gray-500 transition"
              >
                Clear Form
              </button>
            </div>
          </form>
        </div>

        <ReportCardsPanel
          title="My Submitted Files"
          description="Open any submitted Child Development Center Profile card to review your CDC profile submission history."
          reports={reports}
          activeReportId={activeReportId}
          onSelect={setActiveReportId}
          detailBase="/cdw/reports/submissions"
          emptyMessage="You have not submitted any Child Development Center Profile files yet."
          countLabel="files"
        />
        {showConfirm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <section className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Confirm Child Development Center Profile Submission</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Submit this CDC profile to CSWDO?</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">CDC</p><p className="mt-1 font-bold text-slate-900">{formData.cdcName || 'Not selected'}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Barangay</p><p className="mt-1 font-bold text-slate-900">{formData.barangay || 'Not set'}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Enrollment</p><p className="mt-1 font-bold text-slate-900">{formData.totalChildren || 0} / {formData.enrollmentCapacity || 0}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Attachment</p><p className="mt-1 font-bold text-slate-900">{selectedFile ? selectedFile.name : 'No file selected'}</p></div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">After submission, this CDC profile will be sent for CSWDO review and monitoring.</p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setShowConfirm(false)} className="lgu-button-secondary">Cancel</button>
                <button type="button" onClick={submitForm} disabled={saving} className="lgu-button-primary">{saving ? 'Submitting...' : 'Submit Child Development Center Profile'}</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </RoleLayout>
  );
}

export default CDCProfileForm;
