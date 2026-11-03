import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import generatePDF from '../utils/pdfGenerator';

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Not recorded';
}

function formatLabel(value) {
  return String(value || 'record').replace(/_/g, ' ');
}

function CDCPaperDetailPage() {
  const { cdcId, paperId } = useParams();
  const [paper, setPaper] = useState(null);
  const [cdc, setCdc] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordEditMode, setRecordEditMode] = useState(false);
  const [recordJson, setRecordJson] = useState('');
  const role = localStorage.getItem('role');
  const roleBase = role === 'cdw' ? '/cdw' : role === 'staff' ? '/staff/daycare-centers' : '/admin/daycare-centers';
  const workspacePath = role === 'cdw' ? `/cdw/papers/${cdcId}` : `${roleBase}/${cdcId}/papers`;
  const profilePath = role === 'cdw' ? `/cdw/cdc-information/${cdcId}` : `${roleBase}/${cdcId}`;
  const verificationPath = role === 'admin' ? '/admin/accreditation' : '/staff/accreditation';
  const canEditSubmittedData = role === 'cdw' && paper?.verification_status !== 'verified';
  const canManageVerification = ['admin', 'staff'].includes(role || '');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [paperRes, cdcRes, attachRes] = await Promise.all([
          api.get(`/accreditation-records/${paperId}/`),
          api.get(`/cdcs/${cdcId}/`),
          api.get(`/accreditation-records/${paperId}/attachments/`),
        ]);

        setPaper(paperRes.data);
        setCdc(cdcRes.data);
        setAttachments(Array.isArray(attachRes.data) ? attachRes.data : []);
        setRecordJson(JSON.stringify(paperRes.data.submitted_data || {}, null, 2));
      } catch (error) {
        console.error('Failed to load paper details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [cdcId, paperId]);

  const handleGeneratePDF = async () => {
    try {
      await generatePDF({
        paperId,
        paperType: paper.paper_type,
        cdcName: cdc?.name,
        cdcAddress: cdc?.address,
        cdcInfo: cdc,
        submittedDate: paper.date_submitted,
        verificationStatus: paper.verification_status,
        verifiedDate: paper.date_verified,
        verifiedBy: paper.verified_by_name,
        notes: paper.verification_notes,
        submissions: paper.submitted_data || {},
        attachments,
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    }
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSaveRecordChanges = async () => {
    try {
      const parsed = JSON.parse(recordJson);
      const updatedData = { ...paper, submitted_data: parsed };
      await api.patch(`/accreditation-records/${paperId}/`, { submitted_data: parsed });
      setPaper(updatedData);
      setRecordEditMode(false);
    } catch (error) {
      console.error('Failed to save record changes:', error);
      alert('Unable to save record changes. Please verify that the submitted data is valid JSON.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Loading record details...</p>
      </div>
    );
  }

  const statusColor = {
    verified: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', badge: 'bg-emerald-200' },
    pending_review: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', badge: 'bg-amber-200' },
    needs_revision: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', badge: 'bg-rose-200' },
    draft: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', badge: 'bg-slate-200' },
  };

  const colors = statusColor[paper?.verification_status] || statusColor.draft;

  return (
    <div className="grid gap-6">
      <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
        <Link to={workspacePath} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline">
          Back to Records and Documents
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Record Item</p>
            <h1 className="mt-2 text-3xl font-bold capitalize text-slate-900">{formatLabel(paper?.paper_type)}</h1>
            <p className="mt-2 text-slate-600">{cdc?.name}</p>
          </div>
          <span className={`w-fit rounded-full px-4 py-2 text-sm font-bold capitalize ${colors.badge} ${colors.text}`}>
            {formatLabel(paper?.verification_status || 'draft')}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className={`rounded-[18px] border-2 ${colors.border} ${colors.bg} p-6`}>
            <h2 className="text-xl font-semibold text-slate-900">Information View</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Date Submitted</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{formatDate(paper?.date_submitted)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Current Verification Status</p>
                <p className="mt-2 text-lg font-bold capitalize text-slate-900">{formatLabel(paper?.verification_status || 'draft')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Date Verified</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{formatDate(paper?.date_verified)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Verifying CSWDO Staff</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{paper?.verified_by_name || 'Not assigned'}</p>
              </div>
            </div>
          </div>

          <div id="verification-section" className="rounded-[18px] border-2 border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Verification Results</h3>
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Comments and Findings</p>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">{paper?.verification_notes || 'No verification comments or findings are available for this record.'}</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Facility assessment ratings, interaction observation results, compliance findings, and approval decisions are official CSWDO fields. CDW users can view these results but cannot edit them.
            </p>
          </div>

          <div className="rounded-[18px] border-2 border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Submitted Data</h3>
              {canEditSubmittedData ? (
                <button
                  onClick={() => setRecordEditMode((current) => !current)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {recordEditMode ? 'Cancel Edit' : 'Open/Edit Form'}
                </button>
              ) : null}
            </div>
            <div className="mt-4 overflow-auto">
              {recordEditMode ? (
                <div className="space-y-4">
                  <textarea
                    value={recordJson}
                    onChange={(e) => setRecordJson(e.target.value)}
                    className="min-h-[260px] w-full rounded-lg border border-slate-300 bg-slate-50 p-4 font-mono text-sm text-slate-700"
                  />
                  <div className="flex gap-3">
                    <button onClick={handleSaveRecordChanges} className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600">
                      Save Record
                    </button>
                    <button onClick={() => setRecordEditMode(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="max-h-[520px] overflow-auto rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                  {JSON.stringify(paper?.submitted_data || {}, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <div id="attachments-section" className="rounded-[18px] border-2 border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Supporting Documents</h3>
            {attachments.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.file}
                    download
                    className="block overflow-hidden text-ellipsis rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 hover:bg-blue-100"
                  >
                    {attachment.filename || attachment.name || 'Attachment'}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">No supporting documents have been uploaded for this record.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[18px] border-2 border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-900">CDC Profile</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</p>
                <p className="mt-1 font-semibold text-slate-900">{cdc?.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Address</p>
                <p className="mt-1 font-semibold text-slate-900">{cdc?.address || 'Not recorded'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Capacity</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {cdc?.capacity_per_session || cdc?.max_capacity || 'Not recorded'}
                </p>
              </div>
            </div>
            <Link to={profilePath} className="mt-4 block w-full rounded-lg bg-blue-500 px-3 py-2 text-center font-semibold text-white hover:bg-blue-600">
              View CDC Profile
            </Link>
          </div>

          <div className="rounded-[18px] border-2 border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-900">Actions</h3>
            <div className="mt-4 grid gap-3">
              <button onClick={() => scrollToSection('verification-section')} className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 font-semibold text-blue-900 hover:bg-blue-100">
                View Verification Results
              </button>
              {canEditSubmittedData ? (
                <button onClick={() => setRecordEditMode(true)} className="w-full rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 font-semibold text-indigo-900 hover:bg-indigo-100">
                  Open/Edit Form
                </button>
              ) : null}
              <button onClick={() => scrollToSection('attachments-section')} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                View Supporting Documents
              </button>
              <button onClick={handleGeneratePDF} className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600">
                Download PDF
              </button>
              {canManageVerification ? (
                <Link to={verificationPath} className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-center font-semibold text-amber-900 hover:bg-amber-100">
                  Open Verification Module
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            CDW access is limited to submitted source data and supporting documents. CSWDO-only verification fields are shown here for transparency and managed through authorized review workflows.
          </div>
        </div>
      </div>
    </div>
  );
}

export default CDCPaperDetailPage;
