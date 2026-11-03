import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, Popup, GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import PopulationBasisNotice from '../components/PopulationBasisNotice';
import lucenaBarangays from '../data/lucenaBarangays_simplified.json';
import 'leaflet/dist/leaflet.css';
import './LandingPage.css';

const DEFAULT_CENTER = [13.9411, 121.6177];
const MAP_BOUNDS = L.geoJSON(lucenaBarangays).getBounds();

const normalizeBarangayKey = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/\(pob\.\)/g, '')
    .replace(/\bpoblacion\b/g, '')
    .replace(/\bbrgy\.?\b/g, 'barangay')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatNumber = (value) => value == null ? 'Not available' : toNumber(value).toLocaleString();
const formatPercent = (value) => value == null ? 'Not available' : `${Math.max(0, Math.min(100, toNumber(value))).toFixed(1)}%`;

const emptyPublicRow = (barangay) => ({
  key: normalizeBarangayKey(barangay),
  barangay,
  hasCurrentBasis: false,
  children34: null,
  totalPopulation: null,
  centers: 0,
  publicCdcEnrollment34: 0,
  publicCdcGap34: null,
  coverageRate34: null,
  locations: [],
  needScore: 0,
  signalLabel: 'No Available Data',
  sourceTitle: '',
  receivedByCswdoOn: null,
});

const getSignalTone = (score, hasCurrentBasis) => {
  if (!hasCurrentBasis) return { fill: '#d8e0ea', border: '#94a3b8', label: 'No validated population data' };
  if (score >= 70) return { fill: '#be123c', border: '#9f1239', label: 'Low recorded enrollment coverage' };
  if (score >= 35) return { fill: '#d97706', border: '#b45309', label: 'Enrollment coverage needs attention' };
  return { fill: '#0f766e', border: '#115e59', label: 'Higher recorded enrollment coverage' };
};

function FitMapToLucena() {
  const map = useMap();

  useEffect(() => {
    if (MAP_BOUNDS?.isValid?.()) {
      map.fitBounds(MAP_BOUNDS, { padding: [24, 24], maxZoom: 12, animate: false });
    }
  }, [map]);

  return null;
}

function PublicBarangayMap({ rows, selectedKey, onSelect }) {
  const rowByKey = useMemo(() => {
    const lookup = new Map();
    rows.forEach((row) => lookup.set(row.key, row));
    return lookup;
  }, [rows]);

  const getFeatureRow = (feature) => {
    const barangay = feature?.properties?.brgy_name || 'Unmapped Barangay';
    return rowByKey.get(normalizeBarangayKey(barangay)) || emptyPublicRow(barangay);
  };

  return (
    <MapContainer
      className="public-landing-map"
      center={DEFAULT_CENTER}
      zoom={12}
      minZoom={11}
      maxZoom={15}
      scrollWheelZoom={false}
      style={{ width: '100%', height: '100%', minHeight: 440 }}
    >
      <FitMapToLucena />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        key={`public-map-${selectedKey || 'all'}-${rows.length}`}
        data={lucenaBarangays}
        style={(feature) => {
          const row = getFeatureRow(feature);
          const tone = getSignalTone(row.needScore, row.hasCurrentBasis);
          const selected = row.key === selectedKey;

          return {
            color: selected ? '#111827' : tone.border,
            weight: selected ? 3 : 1.3,
            fillColor: tone.fill,
            fillOpacity: selected ? 0.76 : 0.58,
          };
        }}
        onEachFeature={(feature, layer) => {
          const row = getFeatureRow(feature);
          const tone = getSignalTone(row.needScore, row.hasCurrentBasis);

          layer.bindTooltip(
            `<strong>${row.barangay}</strong><br/>${tone.label}<br/>Children Aged 3-4: ${formatNumber(row.children34)}<br/>Enrollment gap: ${formatNumber(row.publicCdcGap34)}`,
            { sticky: true, className: 'public-map-tooltip' }
          );
          layer.bindPopup(`
            <div class="public-map-popup">
              <strong>${row.barangay}</strong>
              <span>${row.signalLabel}</span>
              <dl>
                <dt>Children Aged 3-4</dt><dd>${formatNumber(row.children34)}</dd>
                <dt>CDC Enrollment</dt><dd>${formatNumber(row.publicCdcEnrollment34)}</dd>
                <dt>Not recorded in CDC enrollment</dt><dd>${formatNumber(row.publicCdcGap34)}</dd>
                <dt>Coverage Rate</dt><dd>${formatPercent(row.coverageRate34)}</dd>
              </dl>
            </div>
          `);
          layer.on({
            click: () => onSelect(row.key),
            mouseover: () => layer.setStyle({ weight: 3, fillOpacity: 0.78 }),
            mouseout: () => {
              const selected = row.key === selectedKey;
              layer.setStyle({ weight: selected ? 3 : 1.3, fillOpacity: selected ? 0.76 : 0.58 });
            },
          });
        }}
      />
      {rows.flatMap(row => (row.locations || []).filter(cdc => cdc.lat != null && cdc.lng != null && Number.isFinite(Number(cdc.lat)) && Number.isFinite(Number(cdc.lng))).map(cdc => (
        <CircleMarker key={cdc.id} center={[Number(cdc.lat), Number(cdc.lng)]} radius={6} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#1d4ed8', fillOpacity: 1 }}>
          <Popup><div className="space-y-1 text-sm"><strong>{cdc.name}</strong><p>{row.barangay}</p><p>{cdc.address || 'Address not recorded'}</p><p>Recorded capacity: {formatNumber(cdc.capacity)}</p><p>{cdc.operating_days} {cdc.operating_hours}</p><button type="button" className="font-semibold text-blue-700" onClick={() => onSelect(row.key)}>View barangay summary</button></div></Popup>
        </CircleMarker>
      )))}
    </MapContainer>
  );
}

function LandingPage() {
  const [publicRows, setPublicRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);

    api
      .get('/public-map/')
      .then((response) => {
        if (active) setPublicRows(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        if (active) setLoadError(true);
        console.error('Unable to load public map data:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const rows = useMemo(() => {
    const lookup = new Map();

    lucenaBarangays.features.forEach((feature) => {
      const barangay = feature?.properties?.brgy_name || 'Unmapped Barangay';
      lookup.set(normalizeBarangayKey(barangay), emptyPublicRow(barangay));
    });

    publicRows.forEach((item) => {
      const barangay = item.barangay?.name || 'Unmapped Barangay';
      const key = normalizeBarangayKey(barangay);
      const population = item.population || {};
      const publicCdc = item.public_cdc || {};
      const serviceSignal = item.service_signal || {};
      const needScore = toNumber(serviceSignal.need_score);
      const hasCurrentBasis = Boolean(population.has_current_basis);

      lookup.set(key, {
        key,
        barangay,
        hasCurrentBasis,
        children34: hasCurrentBasis ? toNumber(population.children_3_4) : null,
        totalPopulation: hasCurrentBasis ? toNumber(population.total_population) : null,
        locations: publicCdc.locations || [],
        capacity: publicCdc.capacity,
        centers: toNumber(publicCdc.centers),
        publicCdcEnrollment34: toNumber(publicCdc.enrollment_3_4),
        publicCdcGap34: hasCurrentBasis ? toNumber(publicCdc.gap_3_4) : null,
        coverageRate34: hasCurrentBasis ? toNumber(publicCdc.coverage_rate_3_4) : null,
        needScore,
        signalLabel: getSignalTone(needScore, hasCurrentBasis).label,
        sourceTitle: population.source?.title || '',
        receivedByCswdoOn: population.source?.received_by_cswdo_on || null,
      });
    });

    return [...lookup.values()].sort((left, right) => {
      if (right.needScore !== left.needScore) return right.needScore - left.needScore;
      return right.children34 - left.children34 || left.barangay.localeCompare(right.barangay);
    });
  }, [publicRows]);

  const stats = useMemo(() => {
    const rowsWithBasis = rows.filter((row) => row.hasCurrentBasis);
    return {
      barangaysWithBasis: rowsWithBasis.length,
      children34: rowsWithBasis.reduce((sum, row) => sum + row.children34, 0),
      publicCdcGap34: rowsWithBasis.reduce((sum, row) => sum + row.publicCdcGap34, 0),
      centers: rows.reduce((sum, row) => sum + row.centers, 0),
    };
  }, [rows]);

  const selectedBarangay = rows.find((row) => row.key === selectedKey) || rows.find((row) => row.hasCurrentBasis) || rows[0];
  const priorityRows = rows.filter((row) => row.hasCurrentBasis).slice(0, 6);

  return (
    <div className="landing-page lp-page" id="top">
      <a className="lp-skip" href="#public-map">Skip to coverage map</a>
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link to="/" className="lp-brand" aria-label="CSWDO Lucena City home">
            <img src="/cswdo_logo.png" alt="" />
            <span><strong>CSWDO <span>Lucena City</span></strong><small>City Social Welfare & Development Office</small></span>
          </Link>
          <nav className="lp-nav" aria-label="Main navigation">
            <a href="#public-map">Coverage map</a>
            <a href="#data-flow">About the data</a>
            <a href="#secure-portal">Staff portal</a>
          </nav>
          <Link to="/login" className="lp-button lp-button-dark lp-login">Sign in <Icon name="arrow" /></Link>
        </div>
      </header>

      <main>
        <section className="lp-hero lp-container" aria-labelledby="landing-title">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow"><span className="lp-eyebrow-line" /> PUBLIC DAYCARE DASHBOARD</p>
            <h1 id="landing-title">A clearer view of<br /><span>daycare in Lucena.</span></h1>
            <p className="lp-lead">Explore the centers supporting our youngest learners. See local daycare coverage and understand the needs of every barangay.</p>
            <div className="lp-actions">
              <a href="#public-map" className="lp-button lp-button-primary">Explore the coverage map <Icon name="arrow" /></a>
              <a href="#data-flow" className="lp-text-link">How the data works <span aria-hidden="true">?</span></a>
            </div>
            <p className="lp-privacy"><Icon name="shield" /> Public insights. Personal child records stay private.</p>
          </div>
          <div className="lp-overview">
            <div className="lp-overview-top"><span className="lp-eyebrow">ONE CITY. EVERY BARANGAY.</span><span className="lp-public-tag"><span /> Public view</span></div>
            <CityOutline />
            <div className="lp-overview-bottom">
              <div><span className="lp-eyebrow">OUR COMMUNITY</span><h2>Better visibility.<br />More informed planning.</h2></div>
              <span className="lp-location-icon"><Icon name="pin" /></span>
            </div>
            <p className="lp-overview-caption">Barangay-level information for daycare services in Lucena City.</p>
          </div>
        </section>

        <div className="lp-container">
          <div className="lp-stats" aria-label="City daycare overview" aria-busy={loading}>
            <Metric icon="layers" label="Barangays with validated data" value={loading ? '?' : loadError && !publicRows.length ? 'Unavailable' : stats.barangaysWithBasis} />
            <Metric icon="home" label="Public daycare centers" value={loading ? '?' : loadError && !publicRows.length ? 'Unavailable' : formatNumber(stats.centers)} />
            <Metric icon="users" label="Children Aged 3-4" value={loading ? '?' : stats.barangaysWithBasis ? formatNumber(stats.children34) : 'Not available'} />
            <Metric icon="chart" label="No recorded CDC enrollment" value={loading ? '?' : stats.barangaysWithBasis ? formatNumber(stats.publicCdcGap34) : 'Not available'} />
          </div>
        </div>

        <section id="public-map" className="lp-section lp-container" aria-labelledby="map-title">
          <div className="lp-section-heading">
            <div><p className="lp-eyebrow">EXPLORE YOUR COMMUNITY</p><h2 id="map-title">Local services, in view.</h2><p>Choose a barangay to explore its daycare centers and enrollment coverage.</p></div>
            <span className="lp-section-index" aria-hidden="true">01 / COVERAGE</span>
          </div>
          <div className="lp-map-card">
            <div className="lp-map-toolbar">
              <label htmlFor="barangay-select"><Icon name="pin" /><span>Find your barangay</span>
                <select id="barangay-select" value={selectedBarangay?.key || ''} onChange={event => setSelectedKey(event.target.value)}>
                  {[...rows].sort((a, b) => a.barangay.localeCompare(b.barangay)).map(row => <option key={row.key} value={row.key}>{row.barangay}</option>)}
                </select>
              </label>
              <button type="button" disabled={loading} onClick={() => setRefreshKey(key => key + 1)} className="lp-refresh"><Icon name="refresh" />{loading ? 'Refreshing?' : 'Refresh data'}</button>
            </div>
            {loadError && <div className="lp-error" role="status">Could not refresh data. Please try again.{publicRows.length > 0 && ' Previously loaded data is shown below.'}</div>}
            <div className="lp-map-grid">
              <div className="lp-map-canvas" aria-label="Lucena barangay coverage map">
                <PublicBarangayMap rows={rows} selectedKey={selectedBarangay?.key || ''} onSelect={setSelectedKey} />
              </div>
              <aside className="lp-barangay-panel" aria-label="Selected barangay details" aria-live="polite">
                <p className="lp-eyebrow">BARANGAY SNAPSHOT</p>
                <h3>{selectedBarangay?.barangay || 'Lucena City'}</h3>
                <div className="lp-coverage-status"><span style={{ backgroundColor: getSignalTone(selectedBarangay?.needScore, selectedBarangay?.hasCurrentBasis).fill }} />{selectedBarangay?.signalLabel || 'No available data'}</div>
                <dl className="lp-small-metrics">
                  <SmallMetric label="Children Aged 3-4" value={formatNumber(selectedBarangay?.children34)} />
                  <SmallMetric label="CDC enrollment" value={formatNumber(selectedBarangay?.publicCdcEnrollment34)} />
                  <SmallMetric label="No recorded CDC enrollment" value={formatNumber(selectedBarangay?.publicCdcGap34)} />
                  <SmallMetric label="Enrollment coverage" value={formatPercent(selectedBarangay?.coverageRate34)} />
                </dl>
                <details className="lp-explainer"><summary>What does coverage mean?</summary><p>The share of children aged 3?4 recorded in CDC enrollment. Other children may attend different services.</p></details>
                <div className="lp-centers">
                  <h4>Centers in this barangay <span>{selectedBarangay?.locations?.length || 0}</span></h4>
                  <div className="lp-center-list">
                    {(selectedBarangay?.locations || []).map(cdc => <div key={cdc.id} className="lp-center"><Icon name="home" /><div><strong>{cdc.name}</strong><p>{cdc.address || 'Address not recorded'}</p><small>Recorded capacity: {formatNumber(cdc.capacity)}</small></div></div>)}
                    {!selectedBarangay?.locations?.length && <p className="lp-empty">No CDC registered in this barangay.</p>}
                  </div>
                </div>
              </aside>
            </div>
            <div className="lp-legend" aria-label="Map legend">
              <span className="lp-legend-title">ENROLLMENT COVERAGE</span>
              <Legend color="#be123c" label="Low" /><Legend color="#d97706" label="Needs attention" /><Legend color="#0f766e" label="Higher" /><Legend color="#d8e0ea" label="No validated data" /><Legend color="#1d4ed8" label="CDC location" />
            </div>
          </div>
          <div className="lp-basis"><PopulationBasisNotice rows={publicRows} /></div>
          <div className="lp-priority">
            <div className="lp-priority-heading"><h3>Where coverage needs attention</h3><p>Barangays with lower recorded CDC enrollment coverage.</p></div>
            <div className="lp-priority-grid">
              {priorityRows.map(row => <button key={row.key} type="button" aria-pressed={selectedBarangay?.key === row.key} onClick={() => { setSelectedKey(row.key); document.getElementById('public-map')?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth' }); }} className="lp-priority-row">
                <span><strong>{row.barangay}</strong><small>{formatNumber(row.children34)} children ? {formatNumber(row.centers)} CDCs</small></span>
                <span className="lp-priority-rate">{formatPercent(row.coverageRate34)}<small>enrolled</small></span><Icon name="arrow" />
              </button>)}
              {!loading && !priorityRows.length && <p className="lp-empty">No validated data yet.</p>}
            </div>
          </div>
        </section>

        <section id="data-flow" className="lp-section lp-container" aria-labelledby="data-title">
          <div className="lp-section-heading"><div><p className="lp-eyebrow">INFORMATION YOU CAN UNDERSTAND</p><h2 id="data-title">From local records to a shared picture.</h2><p>A coordinated process keeps public information grounded in validated data.</p></div><span className="lp-section-index" aria-hidden="true">02 / OUR PROCESS</span></div>
          <div className="lp-flow">
            <FlowStep number="01" icon="chart" title="CSWDO requests" text="Defines the reporting period and the barangays to include." />
            <FlowStep number="02" icon="upload" title="CHO submits" text="Provides the population records for the requested period." />
            <FlowStep number="03" icon="check" title="City Planning reviews" text="Validates the information and forwards it to CSWDO." />
            <FlowStep number="04" icon="map" title="CSWDO publishes" text="Accepts the data for use in public maps and planning." />
          </div>
        </section>

        <section id="secure-portal" className="lp-container lp-portal-section" aria-labelledby="portal-title">
          <div className="lp-portal">
            <span className="lp-portal-icon"><Icon name="lock" /></span>
            <div><p className="lp-eyebrow">FOR AUTHORIZED PERSONNEL</p><h2 id="portal-title">Your work. One connected workspace.</h2><p>Access CDC records, reports, accreditation, and planning tools in the secure staff portal.</p></div>
            <Link to="/login" className="lp-button lp-button-primary">Go to staff portal <Icon name="arrow" /></Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer lp-container">
        <div className="lp-footer-main"><div className="lp-footer-brand"><img src="/cswdo_logo.png" alt="" /><div><strong>CSWDO Lucena City</strong><p>Supporting children. Serving communities.</p></div></div><nav aria-label="Footer navigation"><a href="#public-map">Coverage map</a><a href="#data-flow">About the data</a><a href="#top">Back to top ?</a></nav></div>
        <div className="lp-footer-bottom"><p>? {new Date().getFullYear()} City Social Welfare and Development Office</p><p>Public information for informed community planning.</p></div>
      </footer>
    </div>
  );
}

function Metric({ icon, label, value }) {
  return <div className="lp-stat"><span className="lp-stat-icon"><Icon name={icon} /></span><div><p className="lp-stat-value">{value}</p><p className="lp-stat-label">{label}</p></div></div>;
}

function SmallMetric({ label, value }) {
  return <div className="lp-small-metric"><dt>{label}</dt><dd>{value}</dd></div>;
}

function Legend({ color, label }) {
  return <span className="lp-legend-item"><span style={{ backgroundColor: color }} />{label}</span>;
}

function FlowStep({ number, icon, title, text }) {
  return <article className="lp-flow-step"><div className="lp-flow-top"><span className="lp-flow-icon"><Icon name={icon} /></span><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>;
}

function CityOutline() {
  const paths = useMemo(() => {
    const polygons = lucenaBarangays.features.flatMap(feature => feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates]);
    const points = polygons.flat(2);
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min(300 / (maxX - minX), 220 / (maxY - minY));
    const offsetX = (360 - (maxX - minX) * scale) / 2;
    const offsetY = (260 - (maxY - minY) * scale) / 2;
    return polygons.map(rings => rings.map(ring => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${((x - minX) * scale + offsetX).toFixed(2)},${((maxY - y) * scale + offsetY).toFixed(2)}`).join(' ') + ' Z').join(' '));
  }, []);
  return <div className="lp-city-art" aria-hidden="true"><span className="lp-city-orbit lp-orbit-one" /><span className="lp-city-orbit lp-orbit-two" /><svg viewBox="0 0 360 260">{paths.map((d, i) => <path d={d} key={i} fillRule="evenodd" />)}</svg><span className="lp-city-label"><span /> Lucena City, Philippines</span></div>;
}

function Icon({ name, className = 'h-5 w-5' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  const paths = {
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    chart: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15v-4" /><path d="M12 15V8" /><path d="M16 15v-6" /></>,
    check: <><path d="M20 6 9 17l-5-5" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
    map: <><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" /><path d="M9 3v15" /><path d="M15 6v15" /></>,
    pin: <><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></>,
    spark: <><path d="M12 2v5" /><path d="M12 17v5" /><path d="m4.93 4.93 3.54 3.54" /><path d="m15.54 15.54 3.53 3.53" /><path d="M2 12h5" /><path d="M17 12h5" /><path d="m4.93 19.07 3.54-3.53" /><path d="m15.54 8.46 3.53-3.53" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  };

  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

export default LandingPage;
