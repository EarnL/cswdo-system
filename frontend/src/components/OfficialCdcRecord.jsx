import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import AppIcon from './AppIcon';
import './OfficialCdcRecord.css';
import { downloadCdcRecord, groupCdcRecord, recordLabel, recordText } from '../utils/cdcRecord';

const sectionId = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');

const sectionDesign = {
  'CDC Information': ['building', 'Center profile', 'Contact details and daily operations', 'blue'],
  Location: ['map', 'Find this center', 'Address and geographic information', 'blue'],
  'CDW Information & Staffing': ['users', 'People', 'Assigned worker and staffing records', 'violet'],
  'Accreditation & Compliance': ['shield', 'Accreditation', 'Licenses, permits and verification', 'green'],
  'Capacity & Enrollment': ['children', 'Enrollment', 'Child slots and session capacity', 'blue'],
  'Programs & Facilities': ['building', 'Facilities', 'Services, utilities and environment', 'green'],
  'Health & Safety': ['shield', 'Wellbeing', 'Health, safety and protection records', 'rose'],
  'Curriculum & Interactions': ['curriculum', 'Learning', 'Plans, assessments and observations', 'violet'],
  'Record Activity': ['reports', 'History', 'Updates and recorded changes', 'slate'],
  'Validated Population & SNP Planning': ['analytics', 'Planning', 'Population and service coverage', 'blue'],
  'Related Records & Reports': ['reports', 'Documents', 'Supporting records and recent reports', 'slate'],
};
const designFor = (title) => sectionDesign[title] || ['reports', 'Records', 'Additional center information', 'slate'];

const previewFields = {
  'CDC Information': ['contact_person', 'contact_number', 'operating_days', 'operating_hours'],
  Location: ['barangay_name', 'address'],
  'CDW Information & Staffing': ['assigned_cdw_name', 'total_staff', 'qualified_staff_profiles_count'],
  'Accreditation & Compliance': ['accreditation_status', 'license_number', 'license_expiry_date'],
  'Capacity & Enrollment': ['current_enrollment', 'max_capacity', 'capacity_per_session', 'sessions_per_day'],
  'Programs & Facilities': ['building_type', 'has_water_supply', 'has_sanitation'],
  'Health & Safety': ['child_health_records_count', 'safety_incidents_count', 'child_protection_records_count'],
  'Curriculum & Interactions': ['curriculum_plans_count', 'child_assessment_records_count', 'interaction_observations_count'],
  'Record Activity': ['updated_at', 'created_at'],
  'Validated Population & SNP Planning': ['population_children_3_4', 'population_children_3_4', 'public_cdc_gap_children_3_4'],
};

function RecordValue({ value }) {
  if (Array.isArray(value)) {
    return value.length ? <div className="space-y-4">{value.map((item, index) => (
      <article key={index} className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-slate-800">{item?.title || item?.full_name || item?.name || item?.summary || `Record ${index + 1}`}</h3>
        <RecordValue value={item} />
      </article>
    ))}</div> : <p className="text-sm text-slate-500">No records</p>;
  }
  if (value && typeof value === 'object') {
    return <dl className="official-record-fields">{Object.entries(value).map(([key, item]) => (
      <div key={key} className={item && typeof item === 'object' ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
        <dt className="text-xs font-semibold text-slate-500">{recordLabel(key)}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900"><RecordValue value={item} /></dd>
      </div>
    ))}</dl>;
  }
  return recordText(value);
}

function SectionPreview({ title, fields }) {
  if (!fields || typeof fields !== 'object') return <p className="text-sm text-slate-500">{recordText(fields)}</p>;
  const keys = (previewFields[title] || Object.keys(fields).filter((key) => key !== 'id')).filter((key) => key in fields).slice(0, 3);
  return keys.length ? <dl className="official-record-preview">{keys.map((key) => {
    const value = fields[key];
    const text = Array.isArray(value) ? `${value.length} records` : value && typeof value === 'object' ? 'Available to view' : recordText(value);
    return <div key={key}><dt className="text-xs font-semibold text-slate-500">{recordLabel(key)}</dt><dd className="mt-1 line-clamp-2 break-words text-sm text-slate-900">{text}</dd></div>;
  })}</dl> : <p className="text-sm text-slate-500">View the complete section for recorded details.</p>;
}

export default function OfficialCdcRecord({ cdc, directoryPath, workspacePath, relatedRecords, populationBasis }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const detailHeadingRef = useRef(null);
  const activeSectionId = searchParams.get('recordSection');
  useEffect(() => {
    if (activeSectionId) {
      detailHeadingRef.current?.focus();
      detailHeadingRef.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [activeSectionId]);
  const groups = groupCdcRecord(cdc);
  const sections = [...groups,
    { title: 'Validated Population & SNP Planning', fields: populationBasis },
    { title: 'Related Records & Reports', fields: relatedRecords },
  ];
  const selectedSection = sections.find(({ title }) => sectionId(title) === activeSectionId);
  const sectionLink = (id) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set('recordSection', id);
    else params.delete('recordSection');
    const query = params.toString();
    return { search: query ? `?${query}` : '' };
  };
  const status = recordLabel(cdc.accreditation_status || 'Not recorded');
  const download = async () => {
    setDownloading(true);
    setError('');
    try {
      const response = await api.get(`/cdcs/${cdc.id}/complete-record/`);
      downloadCdcRecord(response.data);
    } catch {
      setError('The complete record could not be downloaded. Please try again.');
    } finally {
      setDownloading(false);
    }
  };
  return <div className="cdc-detail-page official-record">
    <div className="official-record-breadcrumb cdc-no-print">
      <Link to={directoryPath}><AppIcon name="chevronLeft" className="h-4 w-4" /> CDC Directory</Link>
      <span aria-hidden="true">/</span><span>Official record</span>
    </div>
    <section className="official-record-hero">
      <div className="official-record-identity">
        <span className="official-record-emblem"><AppIcon name="building" className="h-8 w-8" /></span>
        <div className="min-w-0">
          <p className="official-record-eyebrow">Official CDC Record</p>
          <h1>{cdc.name}</h1>
          <p className="official-record-address"><AppIcon name="map" className="h-4 w-4" />{cdc.barangay_name || 'Barangay not recorded'}</p>
        </div>
      </div>
      <div className="official-record-status">
        <span className={`official-record-badge ${cdc.accreditation_status === 'accredited' ? 'is-valid' : 'is-pending'}`}><span aria-hidden="true" />{status}</span>
        <span className="official-record-grant"><AppIcon name="shield" className="h-4 w-4" />Grant to Operate: {cdc.has_valid_grant_to_operate ? 'Valid' : 'Not active'}</span>
      </div>
      <div className="official-record-toolbar cdc-no-print">
        <div className="official-record-actions">
          <button type="button" onClick={download} disabled={downloading} className="official-record-button is-primary"><AppIcon name="reports" className="h-4 w-4" />{downloading ? 'Preparing download...' : 'Download Complete Record'}</button>
          <Link to={workspacePath} className="official-record-button">Records & Documents</Link>
          <button type="button" onClick={() => window.print()} className="official-record-button"><AppIcon name="print" className="h-4 w-4" />Print / Save PDF</button>
        </div>
        <p className="official-record-download-note">Printable HTML download ? Includes file references</p>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </section>
    {!activeSectionId ? <dl className="official-record-metrics">
      {[
        ['Enrollment', cdc.current_enrollment ?? 0, 'Children currently enrolled', 'children'],
        ['Maximum Capacity', cdc.max_capacity ?? 0, 'Total available child slots', 'building'],
        ['Assigned CDW', cdc.assigned_cdw_name || 'Not assigned', 'Center worker', 'profile'],
        ['Qualified Staff', cdc.qualified_staff_profiles_count ?? cdc.qualified_caregivers ?? 0, 'Qualified personnel', 'users'],
      ].map(([label, value, hint, icon]) => <div key={label} className="official-record-metric"><div><dt>{label}</dt><dd>{value}</dd><p>{hint}</p></div><AppIcon name={icon} className="h-5 w-5" /></div>)}
    </dl> : null}
    {selectedSection ? (
      <div className="official-record-detail-layout">
        <nav aria-label="CDC record sections" className="official-record-section-nav cdc-no-print">
          <Link to={sectionLink(null)} className="official-record-back"><AppIcon name="chevronLeft" className="h-4 w-4" />Back to CDC Overview</Link>
          <p className="official-record-eyebrow">Browse sections</p>
          {sections.map(({ title }) => <Link key={title} to={sectionLink(sectionId(title))} aria-current={title === selectedSection.title ? 'page' : undefined}><AppIcon name={designFor(title)[0]} className="h-4 w-4 shrink-0" />{title}</Link>)}
        </nav>
        <section className="official-record-detail">
          <div className="official-record-detail-heading">
            <span className={`official-record-section-icon tone-${designFor(selectedSection.title)[3]}`}><AppIcon name={designFor(selectedSection.title)[0]} className="h-5 w-5" /></span>
            <div><p className="official-record-eyebrow">{designFor(selectedSection.title)[1]}</p><h2 ref={detailHeadingRef} tabIndex={-1} className="scroll-mt-24">{selectedSection.title}</h2><p>{designFor(selectedSection.title)[2]}.</p></div>
          </div>
          <div className="official-record-detail-body"><RecordValue value={selectedSection.fields} /></div>
        </section>
      </div>
    ) : activeSectionId ? (
      <section className="official-record-detail p-6">
        <h2 ref={detailHeadingRef} tabIndex={-1} className="font-bold">Section not found</h2>
        <Link to={sectionLink(null)} className="mt-3 inline-block text-sm font-semibold text-[#0f4b94]">Back to CDC Overview</Link>
      </section>
    ) : (
      <>
        <div className="official-record-section-heading cdc-no-print"><div><p className="official-record-eyebrow">Center overview</p><h2>Explore the record</h2><p>Key information at a glance. Open a section for the complete details.</p></div><span>{sections.length} sections</span></div>
        <div className="official-record-grid cdc-no-print">
          {sections.map(({ title, fields }) => {
            const [icon, , description, tone] = designFor(title);
            return <section key={title} className="official-record-card">
              <div className="official-record-card-heading"><span className={`official-record-section-icon tone-${tone}`}><AppIcon name={icon} className="h-5 w-5" /></span><div><h2>{title}</h2><p>{description}</p></div></div>
              <div className="official-record-card-content"><SectionPreview title={title} fields={fields} /></div>
              <Link to={sectionLink(sectionId(title))} aria-label={`View all ${title}`} className="official-record-card-link"><span>View All</span><span aria-hidden="true">&rarr;</span></Link>
            </section>;
          })}
        </div>
        <div className="hidden print:block">
          {sections.map(({ title, fields }) => <section key={title} className="mb-6"><h2 className="mb-4 text-lg font-bold">{title}</h2><RecordValue value={fields} /></section>)}
        </div>
      </>
    )}
  </div>;
}
