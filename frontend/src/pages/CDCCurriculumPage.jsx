import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';

const normalizeList = (payload) => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];

const lrpFiles = [
  {
    id: 'complete',
    title: 'Learning Resource Packages (LRPs) for Pre-Kindergarten',
    subtitle: 'Complete file containing all 8 LRPs',
    filename: 'LRPs.pdf',
    url: '/curriculum/LRPs.pdf',
  },
  { id: 'lrp-1', title: 'LRP No. 1', subtitle: 'Separate official LRP file', filename: 'LRP-1-28-pages-in-all.pdf', url: '/curriculum/LRP-1-28-pages-in-all.pdf' },
  { id: 'lrp-2', title: 'LRP No. 2', subtitle: 'Separate official LRP file', filename: 'LRP-2-35-pages-in-all.pdf', url: '/curriculum/LRP-2-35-pages-in-all.pdf' },
  { id: 'lrp-3', title: 'LRP No. 3', subtitle: 'Separate official LRP file', filename: 'LRP-3-134-pages-in-all.pdf', url: '/curriculum/LRP-3-134-pages-in-all.pdf' },
  { id: 'lrp-4', title: 'LRP No. 4', subtitle: 'Separate official LRP file', filename: 'LRP-4-18-pages-in-all.pdf', url: '/curriculum/LRP-4-18-pages-in-all.pdf' },
  { id: 'lrp-5', title: 'LRP No. 5', subtitle: 'Separate official LRP file', filename: 'LRP-5-Q1-267-pages-in-all.pdf', url: '/curriculum/LRP-5-Q1-267-pages-in-all.pdf' },
  { id: 'lrp-6', title: 'LRP No. 6', subtitle: 'Separate official LRP file', filename: 'LRP-6-Q2-285-pages-in-all.pdf', url: '/curriculum/LRP-6-Q2-285-pages-in-all.pdf' },
  { id: 'lrp-7', title: 'LRP No. 7', subtitle: 'Separate official LRP file', filename: 'LRP-7-123-pages-in-all.pdf', url: '/curriculum/LRP-7-123-pages-in-all.pdf' },
  { id: 'lrp-8', title: 'LRP No. 8', subtitle: 'Separate official LRP file', filename: 'LRP-8-221-pages-in-all.pdf', url: '/curriculum/LRP-8-221-pages-in-all.pdf' },
];

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${tones[tone] || tones.slate}`}>{children}</span>;
}

function FileIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function DocumentList({ selectedFileId, onSelect }) {
  return (
    <div className="grid gap-3">
      {lrpFiles.map((file) => {
        const active = selectedFileId === file.id;
        return (
          <button
            key={file.id}
            type="button"
            onClick={() => onSelect(file)}
            className={`flex min-h-[96px] w-full items-start gap-3 rounded-2xl border bg-white p-4 text-left transition hover:border-[#0f4b94] hover:shadow-md ${active ? 'border-[#0f4b94] ring-4 ring-sky-100' : 'border-slate-200'}`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0f4b94]">
              <FileIcon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-950">{file.title}</span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{file.subtitle}</span>
              <span className="mt-2 block truncate text-xs font-black uppercase tracking-wide text-slate-400">{file.filename}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DocumentViewer({ file }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f4b94]">Official Attached Document</p>
          <h2 className="mt-1 truncate text-xl font-black text-slate-950">{file.title}</h2>
          <p className="mt-1 truncate text-sm font-semibold text-slate-500">{file.filename}</p>
        </div>
        <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#0f4b94] px-4 py-2 text-xs font-black text-white transition hover:bg-[#0b3b73]">
          <FileIcon className="h-4 w-4" />
          Open Full File
        </a>
      </div>
      <iframe title={file.title} src={file.url} className="h-[72vh] min-h-[620px] w-full bg-slate-100" />
    </section>
  );
}

function CdcRow({ cdc, distribution, selected, onToggle }) {
  return (
    <label className={`grid cursor-pointer gap-3 border-b border-slate-200 p-4 last:border-b-0 lg:grid-cols-[32px_1fr_160px_150px] lg:items-center ${distribution ? 'bg-slate-50' : 'bg-white hover:bg-blue-50/40'}`}>
      <input
        type="checkbox"
        checked={selected}
        disabled={Boolean(distribution)}
        onChange={() => onToggle(cdc.id)}
        className="mt-1 h-4 w-4"
      />
      <span>
        <span className="block font-black text-slate-950">{cdc.name}</span>
        <span className="mt-1 block text-sm font-semibold text-slate-500">{cdc.barangay_name || 'No barangay'} | CDW: {cdc.assigned_cdw_name || 'Not assigned'}</span>
        {cdc.has_valid_grant_to_operate ? (
          <span className="mt-2 block text-sm font-semibold text-emerald-700">This CDC is now accredited and ready to operate. Curriculum Guides / Learning Resource Packages must now be provided to this CDC.</span>
        ) : null}
      </span>
      <span className="text-sm font-semibold text-slate-600">{cdc.license_number || 'Grant recorded'}</span>
      {distribution ? <Badge tone="green">LRPs Sent</Badge> : <Badge tone="amber">Needs LRPs</Badge>}
    </label>
  );
}

function CDCCurriculumPage() {
  const role = localStorage.getItem('role') || '';
  const isStaff = role === 'staff';
  const isAdmin = role === 'admin';
  const isCdw = role === 'cdw';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cdcs, setCdcs] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [selectedCdcIds, setSelectedCdcIds] = useState([]);
  const [selectedFile, setSelectedFile] = useState(lrpFiles[0]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const cdcQuery = isCdw ? '?assigned_to_me=true' : '';
      const [cdcRes, distributionRes] = await Promise.all([
        api.get(`/cdcs/${cdcQuery}`),
        api.get('/curriculum-distributions/'),
      ]);
      setCdcs(normalizeList(cdcRes.data));
      setDistributions(normalizeList(distributionRes.data));
    } catch (err) {
      console.error(err);
      setError('Unable to load Curriculum Guide / LRP distribution records.');
    } finally {
      setLoading(false);
    }
  }, [isCdw]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const distributionByCdc = useMemo(() => {
    const map = new Map();
    distributions.forEach((item) => map.set(String(item.cdc), item));
    return map;
  }, [distributions]);

  const grantCdcs = useMemo(() => cdcs.filter((cdc) => cdc.has_valid_grant_to_operate), [cdcs]);
  const pendingCdcs = useMemo(() => grantCdcs.filter((cdc) => !distributionByCdc.has(String(cdc.id))), [grantCdcs, distributionByCdc]);
  const distributedCdcs = useMemo(() => grantCdcs.filter((cdc) => distributionByCdc.has(String(cdc.id))), [grantCdcs, distributionByCdc]);
  const myDistribution = isCdw ? distributions[0] : null;
  const hasCdwGrant = isCdw && grantCdcs.length > 0;
  const canViewFiles = isStaff || isAdmin || Boolean(myDistribution);

  const toggleCdc = (cdcId) => {
    setSelectedCdcIds((current) => (
      current.includes(cdcId) ? current.filter((id) => id !== cdcId) : [...current, cdcId]
    ));
  };

  const selectAllPending = () => {
    setSelectedCdcIds(pendingCdcs.map((cdc) => cdc.id));
  };

  const sendSelected = async () => {
    if (!selectedCdcIds.length) {
      setError('Select at least one accredited CDC that needs LRPs.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await api.post('/curriculum-distributions/bulk-send/', { cdc_ids: selectedCdcIds });
      const createdCount = response.data?.created_count || 0;
      const skippedCount = response.data?.skipped?.length || 0;
      setSelectedCdcIds([]);
      setNotice(`Official Curriculum Guide / LRP files sent to ${createdCount} CDC(s). ${skippedCount ? `${skippedCount} CDC(s) were skipped because they already had LRPs or lacked an active Grant to Operate.` : ''}`);
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to send Curriculum Guide / LRP files.');
    } finally {
      setSaving(false);
    }
  };

  if (!['cdw', 'staff', 'admin'].includes(role)) {
    return <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 font-semibold text-amber-800">Curriculum is not available for this role.</section>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Curriculum</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              {isStaff ? 'Curriculum Guide / LRP Distribution' : isAdmin ? 'Curriculum Guide / LRP Review' : 'Curriculum Guide / LRPs'}
            </h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">
              Official Learning Resource Package files are stored as original PDF documents. Staff sends them to accredited CDCs with an active Grant to Operate; Admin reviews distribution; CDWs view the files after they are sent.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Official Files" value={lrpFiles.length} />
            <Stat label="With Grant" value={grantCdcs.length} />
            <Stat label="LRPs Sent" value={distributions.length} />
          </div>
        </div>
      </section>

      {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</section> : null}
      {notice ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</section> : null}
      {loading ? <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">Loading Curriculum Guide / LRP records...</section> : null}

      {!loading && isStaff ? (
        <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f4b94]">Staff Sending</p>
                <h2 className="text-xl font-black text-slate-950">Accredited CDCs Ready for LRPs</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Select one or more accredited CDCs and send the unchanged official files.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={selectAllPending} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 hover:border-[#0f4b94] hover:text-[#0f4b94]">Select Pending</button>
                <button type="button" disabled={saving || !selectedCdcIds.length} onClick={sendSelected} className="rounded-xl bg-[#0f4b94] px-4 py-2 text-xs font-black text-white disabled:opacity-50">{saving ? 'Sending...' : 'Send LRPs'}</button>
              </div>
            </div>
            <div className="overflow-hidden">
              {grantCdcs.map((cdc) => (
                <CdcRow
                  key={cdc.id}
                  cdc={cdc}
                  distribution={distributionByCdc.get(String(cdc.id))}
                  selected={selectedCdcIds.includes(cdc.id)}
                  onToggle={toggleCdc}
                />
              ))}
              {!grantCdcs.length ? <div className="p-8 text-center text-sm font-semibold text-slate-500">No CDC currently has an active Grant to Operate.</div> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f4b94]">Official Files</p>
                <h2 className="text-xl font-black text-slate-950">LRP Library</h2>
              </div>
              <Badge tone="blue">Read Only</Badge>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Staff only sends these files. File contents are not edited, summarized, or rewritten.</p>
            <div className="mt-4">
              <DocumentList selectedFileId={selectedFile.id} onSelect={setSelectedFile} />
            </div>
          </section>
        </section>
      ) : null}

      {!loading && isAdmin ? (
        <section className="grid gap-5 xl:grid-cols-[0.85fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f4b94]">Admin Review</p>
                <h2 className="text-xl font-black text-slate-950">CDCs With Curriculum Guides / LRPs</h2>
              </div>
              <Badge tone="green">{distributedCdcs.length} CDC(s)</Badge>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              {distributedCdcs.map((cdc) => {
                const distribution = distributionByCdc.get(String(cdc.id));
                return (
                  <div key={cdc.id} className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 lg:grid-cols-[1fr_140px] lg:items-center">
                    <div>
                      <p className="font-black text-slate-950">{cdc.name}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{cdc.barangay_name || 'No barangay'} | CDW: {cdc.assigned_cdw_name || 'Not assigned'}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">Sent by {distribution?.sent_by_name || 'Staff'} on {distribution?.sent_at ? new Date(distribution.sent_at).toLocaleDateString() : 'recorded date'}</p>
                    </div>
                    <Badge tone="green">Provided</Badge>
                  </div>
                );
              })}
              {!distributedCdcs.length ? <div className="p-8 text-center text-sm font-semibold text-slate-500">No CDC has received LRPs yet.</div> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f4b94]">Official Files</p>
                <h2 className="text-xl font-black text-slate-950">Review LRP Documents</h2>
              </div>
              <Badge tone="blue">View Only</Badge>
            </div>
            <div className="mt-4">
              <DocumentList selectedFileId={selectedFile.id} onSelect={setSelectedFile} />
            </div>
          </section>
        </section>
      ) : null}

      {!loading && isCdw ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {hasCdwGrant && myDistribution ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">
              Official Curriculum Guide / Learning Resource Packages have been provided to your CDC. You may open and review the original attached files below.
            </div>
          ) : null}
          {hasCdwGrant && !myDistribution ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              This CDC is now accredited and ready to operate. Curriculum Guides / Learning Resource Packages must now be provided to this CDC by CSWDO Staff.
            </div>
          ) : null}
          {!hasCdwGrant ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
              Curriculum Guide / LRP files become available after the CDC has an active Grant to Operate.
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && canViewFiles ? (
        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f4b94]">Document Attachments</p>
                <h2 className="text-xl font-black text-slate-950">Official LRPs</h2>
              </div>
              <Badge tone="blue">{lrpFiles.length} PDFs</Badge>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">These documents are displayed as the actual attached PDF files.</p>
            <div className="mt-4">
              <DocumentList selectedFileId={selectedFile.id} onSelect={setSelectedFile} />
            </div>
          </section>
          <DocumentViewer file={selectedFile} />
        </section>
      ) : null}
    </div>
  );
}

export default CDCCurriculumPage;
