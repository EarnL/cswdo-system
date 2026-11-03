import { createPortal } from 'react-dom';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api';
import AppIcon from './AppIcon';
import PopulationBasisNotice from './PopulationBasisNotice';
import { capacityStatus, capacityVisual, centerCount, underservedReasons, ratioVisual, objectiveVisual, objectiveLegends } from './mapObjectives';
import lucenaBarangays from '../data/lucenaBarangays_simplified.json';
import { LoadingState } from './LoadingState';

const DEFAULT_CENTER = [13.9411, 121.6177];
const LUCENA_CITY_BOUNDS = [
  [13.89, 121.56],
  [13.99, 121.71],
];
const LUCENA_CITY_BOUNDS_OBJECT = L.latLngBounds(LUCENA_CITY_BOUNDS);
const LUCENA_GEOJSON_BOUNDS = L.geoJSON(lucenaBarangays).getBounds();
const getSafeLucenaBounds = () => {
  if (LUCENA_GEOJSON_BOUNDS?.isValid?.() && LUCENA_GEOJSON_BOUNDS.contains(DEFAULT_CENTER)) {
    return LUCENA_GEOJSON_BOUNDS;
  }

  return LUCENA_CITY_BOUNDS_OBJECT;
};

const STATUS_STYLES = {
  stable: {
    label: 'Within capacity',
    marker: '#1d8f6a',
    glow: '#6ee7b7',
    panel: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-900',
  },
  near_capacity: {
    label: 'Near Capacity',
    marker: '#d97706',
    glow: '#fdba74',
    panel: 'border-amber-200 bg-amber-50 text-amber-900',
    badge: 'bg-amber-100 text-amber-900',
  },
  service_gap: {
    label: 'Overpopulated',
    marker: '#dc2626',
    glow: '#fca5a5',
    panel: 'border-rose-200 bg-rose-50 text-rose-900',
    badge: 'bg-rose-100 text-rose-900',
  },
  no_cdc: {
    label: 'No CDC Available',
    marker: '#b91c1c',
    glow: '#fca5a5',
    panel: 'border-red-200 bg-red-50 text-red-900',
    badge: 'bg-red-100 text-red-900',
  },
  no_data: {
    label: 'No Available Data',
    marker: '#64748b',
    glow: '#cbd5e1',
    panel: 'border-slate-200 bg-slate-50 text-slate-700',
    badge: 'bg-slate-100 text-slate-700',
  },
};

const VIEW_MODES = {
  population: {
    title: 'Child Population & Enrollment',
    description: 'Compare child population with recorded CDC enrollment.',
  },
  demand: {
    title: 'Underserved Barangays',
    description: 'Identify missing centers, capacity shortages and low enrollment coverage.',
  },
  utilization: {
    title: 'Overpopulated Centers',
    description: 'Identify individual centers exceeding their total session capacity.',
  },
  ratio: {
    title: 'Teacher-To-Child Ratios',
    description: 'Compare aggregate enrollment per teacher. Session assignments are not recorded.',
  },
  distribution: {
    title: 'CDC Distribution',
    description: 'See CDC locations and capacity by barangay.',
  },
};

const getStatusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.stable;

const getEligibleChildren = (row) => toNumber(row?.children_3_4 ?? row?.children_0_5);
const getEnrollmentGap = (row) => Math.max(0, getEligibleChildren(row) - toNumber(row?.enrollment), toNumber(row?.total_gap_0_5));

const getBarangayNeedStatus = (row) => {
  if (!row || !row.has_population_data) {
    return { ...STATUS_STYLES.no_data, reason: 'No current population basis is available for this barangay.' };
  }
  const eligibleChildren = getEligibleChildren(row);
  const centerCount = row.basis?.public_cdc?.centers ?? row.centers?.length ?? 0;
  const capacity = toNumber(row.effective_capacity);

  if (eligibleChildren > 0 && centerCount === 0) {
    return {
      ...STATUS_STYLES.no_cdc,
      reason: 'This barangay has eligible children aged 3-4 but no registered CDC in the barangay.',
    };
  }
  if (capacity > 0 && eligibleChildren > capacity) {
    return {
      ...STATUS_STYLES.service_gap,
      reason: 'Eligible children aged 3-4 are higher than the total CDC capacity.',
    };
  }
  if (capacity > 0 && eligibleChildren >= capacity * 0.85) {
    return {
      ...STATUS_STYLES.near_capacity,
      reason: 'CDC capacity is close to the eligible child population.',
    };
  }
  return {
    ...STATUS_STYLES.stable,
    reason: 'CDC capacity can accommodate most eligible children in this barangay.',
  };
};

const getCombinedTone = (score) => {
  if (score >= 75) return '#b91c1c';
  if (score >= 45) return '#c2410c';
  return '#0f766e';
};

const getPopulationTone = (score) => {
  if (score >= 70) return '#be123c';
  if (score >= 35) return '#d97706';
  return '#0f766e';
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getFirstNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${clamp(toNumber(value), 0, 100).toFixed(1)}%`;
const formatRatio = (value) => (value === null || value === undefined ? 'No teacher data' : `1 : ${toNumber(value).toFixed(1)}`);

const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return parsed.toLocaleDateString();
};

const getMarkerRadius = (effectiveCapacity) => {
  const capacity = Math.max(0, toNumber(effectiveCapacity));
  if (!capacity) return 10;
  return clamp(Math.round(Math.sqrt(capacity) * 1.8), 10, 24);
};

const createHeatMarkerIcon = ({ color, selected }) => {
  const width = selected ? 38 : 32;
  const height = selected ? 48 : 40;
  return L.divIcon({
    className: 'cdc-heatmap-div-icon',
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4],
    html: `<svg class="cdc-location-pin" width="${width}" height="${height}" viewBox="0 0 32 40" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 38C13 34 2 25 2 16a14 14 0 1 1 28 0c0 9-11 18-14 22Z" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      <g fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 15l8-6 8 6M10 14v10h12V14M8 24h16M14 24v-6h4v6"/>
        <path d="M16 9V5h5l-1.5 1.5L21 8h-5M12 16h.01M20 16h.01"/>
      </g>
    </svg>`,
  });
};

const normalizeBarangayKey = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/\(pob\.\)/g, '')
    .replace(/\bpoblacion\b/g, '')
    .replace(/\bbrgy\.?\b/g, 'barangay')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getBarangayFeatureName = (feature) => feature?.properties?.brgy_name || 'Unmapped Barangay';

const getBarangayFeatureKey = (feature) => normalizeBarangayKey(getBarangayFeatureName(feature));

const normalizeBarangayGap = (gap = {}) => ({
  total_gap_0_5: getFirstNumber(gap.total_gap_0_5, gap.total_gap_children_0_5),
  gap_3_4: toNumber(gap.gap_3_4),
  gap_6_12: toNumber(gap.gap_6_12),
  population_children_3_4: getFirstNumber(gap.population_children_3_4, gap.population_metrics?.children_3_4),
  public_cdc_enrollment_3_4: getFirstNumber(gap.public_cdc_enrollment_3_4, gap.public_cdc_enrollment_children_3_4),
  public_cdc_gap_3_4: getFirstNumber(gap.public_cdc_gap_3_4, gap.public_cdc_gap_children_3_4),
  vulnerable_unenrolled: getFirstNumber(gap.vulnerable_unenrolled, gap.vulnerable_children_unenrolled),
  working_children_unenrolled: getFirstNumber(gap.working_children_unenrolled, gap.working_children_unenrolled_count),
  enrollment_rate_0_5: clamp(toNumber(gap.enrollment_rate_0_5), 0, 100),
  cdc_has_service_gap: Boolean(gap.cdc_has_service_gap),
});

const normalizeBarangayPopulation = (population = {}, gap = {}) => {
  const metrics = population.population_metrics || gap.population_metrics || {};
  const children34 = getFirstNumber(population.children_3_4, metrics.children_3_4);
  const totalChildren05 = getFirstNumber(population.children_3_4, gap.population_children_3_4, metrics.children_3_4);
  const totalPopulation = getFirstNumber(population.total_population, metrics.total_population, population.population_total);
  const hasPopulationData = Boolean(population.has_population_data || totalPopulation > 0 || totalChildren05 > 0);

  return {
    has_population_data: hasPopulationData,
    source: population.source || null,
    total_population: totalPopulation,
    children_3_4: children34,
    children_6_12: getFirstNumber(population.children_6_12, metrics.children_6_12),
    adolescents_13_17: getFirstNumber(population.adolescents_13_17, metrics.adolescents_13_17),
    total_children_0_5: totalChildren05,
    male_population: getFirstNumber(population.male_population, metrics.male_population),
    female_population: getFirstNumber(population.female_population, metrics.female_population),
    single_parent_households: getFirstNumber(population.single_parent_households, metrics.single_parent_households),
    children_with_disabilities: getFirstNumber(population.children_with_disabilities, metrics.children_with_disabilities),
    working_children: getFirstNumber(population.working_children, metrics.working_children),
    vulnerable_children: getFirstNumber(population.vulnerable_children, metrics.vulnerable_children),
    data_quality_score: clamp(toNumber(population.data_quality_score), 0, 100),
    last_updated: population.last_updated || null,
  };
};

const normalizeUnderservedIndicators = (indicators = {}) => ({
  priority_label: indicators.priority_label || 'No underserved indicator available',
  need_score: clamp(toNumber(indicators.need_score), 0, 100),
  need_level: indicators.need_level || 'watch',
  population_data_connected: Boolean(indicators.population_data_connected),
  public_cdc_gap_3_4: toNumber(indicators.public_cdc_gap_3_4),
  total_gap_0_5: toNumber(indicators.total_gap_0_5),
  vulnerable_unenrolled: toNumber(indicators.vulnerable_unenrolled),
  working_children_unenrolled: toNumber(indicators.working_children_unenrolled),
  enrollment_rate_0_5: clamp(toNumber(indicators.enrollment_rate_0_5), 0, 100),
  recommended_snp_enrollment: toNumber(indicators.recommended_snp_enrollment),
  recommended_budget: toNumber(indicators.recommended_budget),
  named_snp_candidates_count: toNumber(indicators.named_snp_candidates_count),
  named_snp_candidates: Array.isArray(indicators.named_snp_candidates) ? indicators.named_snp_candidates : [],
  status_notes: Array.isArray(indicators.status_notes) ? indicators.status_notes : [],
});

const normalizePublicBarangayRow = (row = {}) => {
  const population = row.population || {};
  const publicCdc = row.public_cdc || {};
  const signal = row.service_signal || {};
  const needScore = clamp(toNumber(signal.need_score), 0, 100);

  return {
    key: normalizeBarangayKey(row.barangay?.name || row.barangay_name || row.name),
    barangay: row.barangay?.name || row.barangay_name || row.name || 'Unknown Barangay',
    population_total: toNumber(population.total_population),
    children_0_5: getFirstNumber(population.children_3_4),
    enrollment: getFirstNumber(publicCdc.enrollment_3_4),
    effective_capacity: getFirstNumber(publicCdc.capacity, publicCdc.effective_capacity),
    total_gap_0_5: toNumber(signal.total_gap_0_5),
    public_cdc_gap_3_4: getFirstNumber(publicCdc.gap_3_4),
    coverage_rate: getFirstNumber(publicCdc.coverage_rate_3_4),
    need_score: needScore,
    need_level: needScore >= 70 ? 'critical' : needScore >= 35 ? 'elevated' : 'watch',
    basis: row,
    has_population_data: Boolean(population.has_current_basis),
  };
};

const normalizeCdcPoint = (cdc) => {
  const lat = cdc.lat == null ? null : toNumber(cdc.lat, null);
  const lng = cdc.lng == null ? null : toNumber(cdc.lng, null);

  const hasLocation = lat !== null && lng !== null && LUCENA_CITY_BOUNDS_OBJECT.contains(L.latLng(lat, lng));

  const effectiveCapacity = Math.max(0, toNumber(cdc.effective_capacity));
  const enrollment = Math.max(0, toNumber(cdc.enrollment));
  const utilization = effectiveCapacity ? (enrollment / effectiveCapacity) * 100 : 0;
  const needScore = clamp(toNumber(cdc.need_score), 0, 100);
  const teacherCount = Math.max(0, toNumber(cdc.teacher_count, 0));
  const childrenPerTeacher = teacherCount > 0 ? enrollment / teacherCount : null;

  return {
    ...cdc,
    hasLocation,
    status: capacityStatus(cdc),
    lat,
    lng,
    enrollment,
    effective_capacity: effectiveCapacity,
    available_slots: Math.max(0, toNumber(cdc.available_slots)),
    excess_children: effectiveCapacity > 0 ? Math.max(0, enrollment - effectiveCapacity) : 0,
    capacity_per_session: Math.max(0, toNumber(cdc.capacity_per_session)),
    sessions_per_day: Math.max(0, toNumber(cdc.sessions_per_day)),
    sessions_needed: Math.max(0, toNumber(cdc.sessions_needed)),
    utilization,
    need_score: needScore,
    teacher_count: teacherCount,
    assistant_count: Math.max(0, toNumber(cdc.assistant_count, 0)),
    children_per_teacher: childrenPerTeacher,
    teacher_ratio_compliant: Boolean(cdc.teacher_ratio_compliant !== false),
    barangay_gap: normalizeBarangayGap(cdc.barangay_gap),
    barangay_population: normalizeBarangayPopulation(cdc.barangay_population, cdc.barangay_gap),
    underserved_indicators: normalizeUnderservedIndicators(cdc.underserved_indicators),
  };
};

const FitToData = () => {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    const bounds = getSafeLucenaBounds();
    if (!bounds?.isValid?.()) return;

    const fitCityOnce = () => {
      if (fittedRef.current) return;
      map.fitBounds(bounds, { padding: [24, 24], animate: false });
      fittedRef.current = true;
    };

    fitCityOnce();
    let resizeFrame = null;
    const observer = new ResizeObserver(() => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        // The details panel changes the map width. Leaflet only needs its
        // viewport refreshed here; fitting or constraining again can trigger
        // a recursive pan-inside-bounds loop.
        map.invalidateSize({ pan: false, animate: false });
      });
    });
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
    };
  }, [map]);

  return null;
};

const HeatmapMap = ({ expanded = false, exitHref = '', dashboard = false }) => {
  const [cdcs, setCdcs] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [academicYear, setAcademicYear] = useState('');
  useEffect(() => {
    let active = true;
    api.get('/academic-years/').then(({ data }) => {
      if (active) setAcademicYears(Array.isArray(data) ? data : data.results || []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [publicBarangays, setPublicBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState('population');
  const [barangaySearch, setBarangaySearch] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(!expanded);
  const [fullScreen, setFullScreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const isExpanded = expanded || fullScreen;
  const controlClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
  const selectBarangay = (key) => { setSelectedId(key); setDetailsOpen(true); };

  useEffect(() => {
    if (!isExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEscape = (event) => {
      if (event.key === 'Escape') { setFullScreen(false); setDetailsOpen(false); }
    };
    window.addEventListener('keydown', onEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onEscape); };
  }, [isExpanded]);

  const role = typeof window !== 'undefined' ? localStorage.getItem('role') || 'admin' : 'admin';
  const isPlanningMonitor = role === 'planning' || role === 'city_planning';
  const cdcBaseHref = role === 'staff' ? '/staff/daycare-centers' : '/admin/daycare-centers';

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = academicYear ? `?academic_year=${encodeURIComponent(academicYear)}` : '';
    Promise.allSettled([
      api.get(`/heatmap/${query}`),
      api.get(`/public-map/${query}`),
    ])
      .then(([heatmapResponse, publicMapResponse]) => {
        if (!active) return;
        setLoadError(heatmapResponse.status === 'rejected' || publicMapResponse.status === 'rejected');
        const nextCdcs = heatmapResponse.status === 'fulfilled' && Array.isArray(heatmapResponse.value.data)
          ? heatmapResponse.value.data.map(normalizeCdcPoint).filter(Boolean)
          : [];
        const nextPublicBarangays = publicMapResponse.status === 'fulfilled' && Array.isArray(publicMapResponse.value.data)
          ? publicMapResponse.value.data.map(normalizePublicBarangayRow).filter((row) => row.key)
          : [];

        setCdcs(nextCdcs);
        setPublicBarangays(nextPublicBarangays);
      })
      .catch((err) => {
        console.log(err);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey, academicYear]);

  const enrichedCdcs = useMemo(() => {
    const items = cdcs;

    return [...items]
      .map((cdc) => ({
        ...cdc,
        combined_priority: Number(
          clamp((toNumber(cdc.utilization) * 0.45) + (toNumber(cdc.need_score) * 0.55), 0, 100).toFixed(1)
        ),
      }))
      .sort((left, right) => {
        if (right.combined_priority !== left.combined_priority) {
          return right.combined_priority - left.combined_priority;
        }
        return left.name.localeCompare(right.name);
      });
  }, [cdcs]);

  const barangayRows = useMemo(() => {
    const rows = new Map();
    const publicByKey = new Map(publicBarangays.map((row) => [row.key, row]));

    lucenaBarangays.features.forEach((feature) => {
      const barangay = getBarangayFeatureName(feature);
      const key = normalizeBarangayKey(barangay);
      const publicRow = publicByKey.get(key);
      const seededEnrollment = toNumber(publicRow?.enrollment);
      const seededCapacity = toNumber(publicRow?.effective_capacity);
      const seededGap = toNumber(publicRow?.public_cdc_gap_3_4);
      const seededNeedScore = toNumber(publicRow?.need_score);
      rows.set(key, {
        key,
        barangay: publicRow?.barangay || barangay,
        basis: publicRow?.basis,
        centers: [],
        enrollment: seededEnrollment,
        effective_capacity: seededCapacity,
        available_slots: 0,
        excess_children: 0,
        total_gap_0_5: toNumber(publicRow?.total_gap_0_5),
        public_cdc_gap_3_4: seededGap,
        vulnerable_gap: 0,
        working_children_gap: 0,
        named_snp_candidates_count: 0,
        named_snp_candidates: [],
        population_total: toNumber(publicRow?.population_total),
        children_0_5: toNumber(publicRow?.children_0_5),
        children_3_4: toNumber(publicRow?.children_0_5),
        non_enrolled_children: 0,
        teacher_count: 0,
        children_per_teacher: 0,
        accessibility_score: 38,
        need_score: seededNeedScore,
        combined_priority: seededNeedScore,
        utilization: seededCapacity ? clamp((seededEnrollment / seededCapacity) * 100, 0, 100) : 0,
        status: seededCapacity && seededEnrollment > seededCapacity ? 'service_gap' : seededCapacity && seededEnrollment >= seededCapacity * 0.85 ? 'near_capacity' : 'stable',
        need_level: publicRow?.need_level || 'watch',
        has_population_data: Boolean(publicRow?.has_population_data),
        has_public_rollup: Boolean(publicRow),
      });
    });

    enrichedCdcs.forEach((cdc) => {
      const key = normalizeBarangayKey(cdc.barangay);
      if (!key) return;

      if (!rows.has(key)) {
        rows.set(key, {
          key,
          barangay: cdc.barangay,
          centers: [],
          enrollment: 0,
          effective_capacity: 0,
          available_slots: 0,
          excess_children: 0,
          total_gap_0_5: 0,
          public_cdc_gap_3_4: 0,
          vulnerable_gap: 0,
          working_children_gap: 0,
          named_snp_candidates_count: 0,
          named_snp_candidates: [],
          population_total: 0,
          children_0_5: 0,
          children_3_4: 0,
          non_enrolled_children: 0,
          teacher_count: 0,
          children_per_teacher: 0,
          accessibility_score: 0,
          need_score: 0,
          combined_priority: 0,
          utilization: 0,
          status: 'stable',
          need_level: 'watch',
          has_population_data: false,
          has_public_rollup: false,
        });
      }

      const row = rows.get(key);
      row.centers.push(cdc);
      if (!row.has_public_rollup) {
        row.enrollment += toNumber(cdc.enrollment);
        row.effective_capacity += toNumber(cdc.effective_capacity);
        row.total_gap_0_5 = Math.max(row.total_gap_0_5, toNumber(cdc.barangay_gap?.total_gap_0_5));
        row.public_cdc_gap_3_4 = Math.max(row.public_cdc_gap_3_4, toNumber(cdc.barangay_gap?.public_cdc_gap_3_4));
      }
      row.available_slots += toNumber(cdc.available_slots);
      row.excess_children += toNumber(cdc.excess_children);
      row.vulnerable_gap = Math.max(row.vulnerable_gap, toNumber(cdc.barangay_gap?.vulnerable_unenrolled));
      row.working_children_gap = Math.max(row.working_children_gap, toNumber(cdc.barangay_gap?.working_children_unenrolled));
      row.named_snp_candidates_count = Math.max(row.named_snp_candidates_count, toNumber(cdc.underserved_indicators?.named_snp_candidates_count));
      (cdc.underserved_indicators?.named_snp_candidates || []).forEach((child) => {
        if (!row.named_snp_candidates.some((item) => Number(item.id) === Number(child.id))) {
          row.named_snp_candidates.push(child);
        }
      });
      if (!row.has_public_rollup) {
        row.population_total = Math.max(row.population_total, toNumber(cdc.barangay_population?.total_population));
        row.children_0_5 = Math.max(row.children_0_5, toNumber(cdc.barangay_population?.total_children_0_5));
        row.children_3_4 = Math.max(row.children_3_4, toNumber(cdc.barangay_population?.total_children_0_5));
      }
      row.teacher_count += toNumber(cdc.teacher_count);
      if (!row.has_public_rollup) {
        row.need_score = Math.max(row.need_score, toNumber(cdc.need_score));
        row.combined_priority = Math.max(row.combined_priority, toNumber(cdc.combined_priority));
        row.has_population_data = row.has_population_data || Boolean(cdc.barangay_population?.has_population_data);
      }

      if (cdc.status === 'service_gap') row.status = 'service_gap';
      if (cdc.status === 'near_capacity' && row.status !== 'service_gap') row.status = 'near_capacity';
      if (cdc.need_level === 'critical') row.need_level = 'critical';
      if (cdc.need_level === 'elevated' && row.need_level !== 'critical') row.need_level = 'elevated';
    });

    return [...rows.values()]
      .map((row) => {
        const utilization = clamp(row.effective_capacity ? (row.enrollment / row.effective_capacity) * 100 : 0, 0, 100);
        const eligibleChildren = getEligibleChildren(row);
        const capacityGap = Math.max(0, eligibleChildren - toNumber(row.effective_capacity));
        const enrollmentGap = Math.max(getEnrollmentGap(row), toNumber(row.total_gap_0_5));
        const accessibilityScore = clamp(
          (row.centers.length === 0 ? 38 : 0)
            + (row.public_cdc_gap_3_4 > 0 ? Math.min(row.public_cdc_gap_3_4, 80) * 0.55 : 0)
            + (row.available_slots === 0 && eligibleChildren > 0 ? 18 : 0)
            + (row.excess_children > 0 ? Math.min(row.excess_children, 80) * 0.35 : 0),
          0,
          100
        );
        const needScore = toNumber(row.need_score);
        const rowWithGaps = {
          ...row,
          utilization,
          capacity_gap: capacityGap,
          enrollment_gap: enrollmentGap,
          non_enrolled_children: enrollmentGap,
          children_per_teacher: row.teacher_count && row.centers.length === centerCount(row) && row.centers.every(c => c.teacher_count > 0) ? row.centers.reduce((n, c) => n + c.enrollment, 0) / row.teacher_count : null,
          accessibility_score: accessibilityScore,
          need_score: needScore,
          combined_priority: clamp((utilization * 0.25) + (needScore * 0.75), 0, 100),
        };
        const status = getBarangayNeedStatus(rowWithGaps);

        return {
          ...rowWithGaps,
          status: status.label === 'No CDC Available' ? 'no_cdc' : status.label === 'No Available Data' ? 'no_data' : status.label === 'High Service Need' ? 'service_gap' : status.label === 'Near Capacity' ? 'near_capacity' : 'stable',
          need_level: needScore >= 70 ? 'critical' : needScore >= 35 ? 'elevated' : 'watch',
        };
      })
      .sort((left, right) => {
        if (right.combined_priority !== left.combined_priority) {
          return right.combined_priority - left.combined_priority;
        }
        return left.barangay.localeCompare(right.barangay);
      });
  }, [enrichedCdcs, publicBarangays]);

  useEffect(() => {
    if (selectedId && !barangayRows.some((item) => item.key === selectedId)) {
      setSelectedId(null);
    }
  }, [barangayRows, selectedId]);

  const focusBarangay = selectedId
    ? barangayRows.find((item) => item.key === selectedId) || null
    : null;
  
  

  const visibleBarangayRows = useMemo(() => {
    const normalizedSearch = barangaySearch.trim().toLowerCase();
    if (!normalizedSearch) return barangayRows;
    return barangayRows.filter((row) => row.barangay.toLowerCase().includes(normalizedSearch));
  }, [barangayRows, barangaySearch]);

  const barangayByKey = useMemo(() => {
    const lookup = new Map();
    barangayRows.forEach((row) => lookup.set(row.key, row));
    return lookup;
  }, [barangayRows]);

  const getVisualStyle = (row) => {
    const objective = objectiveVisual(viewMode, row);
    if (objective) return objective;
    if (viewMode === 'population') {
      const score = toNumber(row?.need_score);
      const marker = !row?.has_population_data ? '#64748b' : getPopulationTone(score);
      return { marker, glow: marker, value: score,
        label: row?.basis?.service_signal?.label || 'No validated population data' };
    }

    return {
      marker: getCombinedTone(row?.combined_priority),
      glow: row?.combined_priority >= 75 ? '#fca5a5' : row?.combined_priority >= 45 ? '#fdba74' : '#5eead4',
      label: 'Combined Priority',
      value: toNumber(row?.combined_priority),
      tone: getCombinedTone(row?.combined_priority),
    };
  };

  const getBarangayVisualStyle = (feature) => {
    const row = barangayByKey.get(getBarangayFeatureKey(feature));
    const visual = getVisualStyle(row);
    const isActive = selectedId && row?.key === selectedId;
    const value = toNumber(visual.value);
    const opacity = clamp((value / 100) * 0.34 + 0.12, 0.12, 0.48);

    return {
      fillColor: visual.marker,
      fillOpacity: isActive ? Math.min(opacity + 0.16, 0.62) : opacity,
      color: isActive ? '#0369a1' : '#94a3b8',
      weight: isActive ? 2.5 : 1,
      opacity: isActive ? 1 : 0.96,
    };
  };

  const coverageLegend = [
    { key: 'low', marker: '#be123c', label: 'Low recorded enrollment coverage' },
    { key: 'attention', marker: '#d97706', label: 'Enrollment coverage needs attention' },
    { key: 'higher', marker: '#0f766e', label: 'Higher recorded enrollment coverage' },
    { key: 'missing', marker: '#64748b', label: 'No validated population data' },
  ];
  const legendEntries = viewMode === 'population' ? coverageLegend : objectiveLegends[viewMode].map(([marker, label]) => ({ marker, label }));
  const mappedCdcs = enrichedCdcs.filter(c => c.hasLocation && (selectedStatus === 'all' || c.status === selectedStatus));
  const missingLocations = enrichedCdcs.filter(c => !c.hasLocation).length;

  const infoSource = focusBarangay
    ? focusBarangay.basis?.population?.source
    : publicBarangays.find(row => row.has_population_data)?.basis?.population?.source;
  const infoPeriod = infoSource?.period_start && infoSource?.period_end
    ? `${formatDate(infoSource.period_start)} – ${formatDate(infoSource.period_end)}`
    : 'Not recorded';

  const renderMapCanvas = (height, minHeight) => (
    <div className="relative" style={{ height, minHeight, width: '100%' }}>
      <MapContainer
        className="lucena-focus-map"
        center={DEFAULT_CENTER}
        zoom={12}
        zoomSnap={0.25}
        maxZoom={15}
        style={{ height: '100%', minHeight, width: '100%', background: '#dbeafe' }}
        scrollWheelZoom
      >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FitToData />
      <Pane name="lucena-boundary-glow" style={{ zIndex: 405 }} />
      <Pane name="lucena-boundary" style={{ zIndex: 415 }} />
      <Pane name="cdc-halo" style={{ zIndex: 430 }} />
      <Pane name="cdc-markers" style={{ zIndex: 460 }} />
      <GeoJSON
        key={`lucena-city-boundary-${viewMode}-${selectedStatus}-${selectedId || 'none'}-${refreshKey}`}
        data={lucenaBarangays}
        pane="lucena-boundary"
        style={getBarangayVisualStyle}
        smoothFactor={0}
        onEachFeature={(feature, layer) => {
          const featureKey = getBarangayFeatureKey(feature);
          const row = barangayByKey.get(featureKey);
          layer.bindTooltip(getBarangayFeatureName(feature), {
            sticky: true,
            direction: 'top',
            opacity: 0.88,
          });
          layer.on({
            click: () => selectBarangay(featureKey),
          });
          layer.bindPopup(`
            <div class="text-sm">
              <strong>${getBarangayFeatureName(feature)}</strong><br/>
              CDCs: ${centerCount(row)}<br/>
              Children 3-4: ${row?.has_population_data ? formatNumber(row.children_3_4 ?? row.children_0_5) : 'Not available'}<br/>
              Enrolled: ${formatNumber(row?.enrollment || 0)}
            </div>
          `);
        }}
      />

      {mappedCdcs.map((cdc) => {
        const visual = viewMode === 'utilization' ? capacityVisual(cdc) : viewMode === 'ratio' ? ratioVisual(cdc.enrollment, cdc.teacher_count) : getVisualStyle(barangayByKey.get(normalizeBarangayKey(cdc.barangay)) || cdc);
        const statusStyle = getStatusStyle(cdc.status);
        const barangayKey = normalizeBarangayKey(cdc.barangay);
        const isSelected = selectedId === barangayKey;
        const markerRadius = getMarkerRadius(cdc.effective_capacity);
        const heatIcon = createHeatMarkerIcon({
          color: visual.marker,
          glow: visual.glow,
          radius: markerRadius,
          selected: isSelected,
        });

        return (
          <React.Fragment key={cdc.id}>
            <Marker
              position={[cdc.lat, cdc.lng]}
              title={cdc.name}
              alt={`CDC: ${cdc.name}`}
              icon={heatIcon}
              pane="cdc-markers"
              eventHandlers={{ click: () => selectBarangay(barangayKey) }}
            >
              <Popup minWidth={220} maxWidth={300} autoPan keepInView>
                <div className="space-y-3 text-sm text-slate-700">
                  <div><strong className="text-base text-slate-950">{cdc.name}</strong><p className="text-xs text-slate-500">{cdc.barangay}</p></div>
                  <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${statusStyle.badge}`}>{capacityVisual(cdc).label}</span>
                  <p><strong>{formatNumber(cdc.enrollment)}</strong> enrolled / <strong>{formatNumber(cdc.effective_capacity)}</strong> slots</p>
                  {cdc.excess_children > 0 && <p className="font-semibold text-red-700">{cdc.excess_children} children above capacity</p>}
                  <p className="text-xs">{cdc.capacity_per_session} slots x {cdc.sessions_per_day} sessions | Teacher : child {formatRatio(cdc.children_per_teacher)} (aggregate)</p>
                  {!isPlanningMonitor && <Link className="block font-semibold text-sky-700" to={`${cdcBaseHref}/${cdc.id}`}>View center details</Link>}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
      </MapContainer>



    </div>
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,#f8fafc,#e2e8f0)] p-4">
        <div className={`flex ${expanded ? 'h-[78vh] min-h-[720px]' : dashboard ? 'h-[420px]' : 'h-[620px]'} items-center justify-center`}>
          <LoadingState title="Loading map data..." message="Preparing barangay coverage and CDC markers." />
        </div>
      </div>
    );
  }

  const mapContent = (
    <section className={`${isExpanded ? 'fixed inset-0 z-[2000] flex flex-col' : 'relative rounded-2xl'} overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/40`} aria-label="Lucena City service map">
      <header className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-4 sm:p-5">
        {loadError && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Some map data could not be loaded. Refresh to try again.</p>}
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-700">Lucena City</p>
            <h3 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Population &amp; Center Map</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-600"><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{publicBarangays[0]?.basis?.academic_year?.name || 'Current academic year'}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">Ages 3-4</span></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={controlClass} onClick={() => setRefreshKey(key => key + 1)}><span className="inline-flex items-center gap-2"><AppIcon name="reports" className="h-4 w-4" />Refresh data</span></button>
            {focusBarangay && !detailsOpen && <button type="button" className={controlClass} onClick={() => setDetailsOpen(true)}>Barangay details</button>}
            {expanded && exitHref ? <Link className={controlClass} to={exitHref}>Back to dashboard</Link> :
              <button type="button" className={controlClass} onClick={() => { setFullScreen(!fullScreen); setDetailsOpen(false); setLegendOpen(false); }}>{fullScreen ? 'Exit full screen' : 'Expand map'}</button>}
          </div>
        </div>
        <div className="mt-4" role="group" aria-label="Analysis layers">
          <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/70 bg-slate-100/70 p-1.5">
            {Object.entries(VIEW_MODES).map(([key, value]) => <button key={key} type="button" aria-label={value.title} aria-pressed={viewMode === key} onClick={() => setViewMode(key)} className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 ${viewMode === key ? 'bg-white text-sky-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/60 hover:text-slate-900'}`}>
              <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] ${viewMode === key ? 'bg-sky-100 text-sky-700' : 'bg-slate-200/70 text-slate-500'}`}><AppIcon name={{ population: 'children', demand: 'gap', utilization: 'building', ratio: 'users', distribution: 'map' }[key]} className="h-4 w-4" /></span>
              {{ population: 'Enrollment', demand: 'Coverage Gaps', utilization: 'Capacity', ratio: 'Staffing', distribution: 'Locations' }[key]}
            </button>)}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{VIEW_MODES[viewMode].description}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="min-w-[180px] flex-1 text-xs font-medium text-slate-600">Barangay search
            <div className="relative mt-1">
              <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
              <input type="search" value={barangaySearch} onChange={event => setBarangaySearch(event.target.value)} placeholder="Search barangay name..." className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-normal text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
            </div>
          </label>
          <label className="w-full text-xs font-medium text-slate-600 sm:w-48">Academic year
            <select aria-label="Academic year" value={academicYear} onChange={event => { setAcademicYear(event.target.value); setSelectedId(null); setDetailsOpen(false); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
              <option value="">Current year</option>
              {academicYears.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </label>
          <label className="w-full text-xs font-medium text-slate-600 sm:w-48">Center status (pins)
            <select aria-label="Center status" value={selectedStatus} onChange={event => setSelectedStatus(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100">
              <option value="all">All centers</option>
              {Object.entries(STATUS_STYLES).filter(([key]) => key !== 'no_cdc').map(([key, value]) => <option key={key} value={key}>{key === 'no_data' ? 'Capacity not recorded' : value.label}</option>)}
            </select>
          </label>
          {(selectedStatus !== 'all' || barangaySearch) && <button type="button" className="rounded-lg px-3 py-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600" onClick={() => { setSelectedStatus('all'); setBarangaySearch(''); }}>Reset filters</button>}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span><strong className="font-semibold text-slate-700">{mappedCdcs.length}</strong> CDC locations shown{selectedStatus !== 'all' ? ' (filtered)' : ''}</span>
          <span>Status filters pins only.</span>
        </div>
        {barangaySearch.trim() && <div className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-white" aria-label="Barangay search results">
          {visibleBarangayRows.length ? visibleBarangayRows.map(row => <button type="button" key={row.key} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-sky-50 focus:bg-sky-50" onClick={() => { selectBarangay(row.key); setBarangaySearch(''); }}><span>{row.barangay}</span><span className="text-xs text-slate-400">View details</span></button>) : <p className="p-3 text-sm text-slate-500">No matching barangays. Try a different name.</p>}
        </div>}
      </header>
      <div className={`min-h-0 ${isExpanded ? 'flex-1 overflow-auto' : ''} grid ${detailsOpen && focusBarangay ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1'}`}>
        <div className="min-w-0">{renderMapCanvas(isExpanded ? '100%' : dashboard ? '440px' : '620px', isExpanded ? '260px' : '340px')}</div>
        {detailsOpen && focusBarangay && <aside aria-label="Barangay details" className="max-h-[70vh] overflow-y-auto border-t border-slate-200 bg-slate-50 p-4 lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-medium text-slate-500">Barangay details</p><h3 className="mt-1 text-xl font-semibold text-slate-950">{focusBarangay.barangay}</h3></div>
            <button type="button" className={controlClass} aria-label="Close barangay details" onClick={() => setDetailsOpen(false)}>Close</button>
          </div>
          <p className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold shadow-sm" style={{ color: getVisualStyle(focusBarangay).marker }}>{getVisualStyle(focusBarangay).label}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {(viewMode === 'population' ? [
              ['Children aged 3-4', focusBarangay.has_population_data ? formatNumber(getEligibleChildren(focusBarangay)) : 'Not available'],
              ['Recorded CDC enrollment', formatNumber(focusBarangay.enrollment)],
              ['Enrollment gap', focusBarangay.has_population_data ? formatNumber(focusBarangay.enrollment_gap) : 'Not available'],
              ['Enrollment coverage', focusBarangay.has_population_data ? formatPercent(focusBarangay.basis?.public_cdc?.coverage_rate_3_4) : 'Not available'],
            ] : viewMode === 'demand' ? [
              ['CDC centers', centerCount(focusBarangay)],
              ['Total slots', formatNumber(focusBarangay.effective_capacity)],
              ['Capacity shortage', focusBarangay.has_population_data ? formatNumber(focusBarangay.capacity_gap) : 'Not available'],
              ['Enrollment gap', focusBarangay.has_population_data ? formatNumber(focusBarangay.enrollment_gap) : 'Not available'],
            ] : viewMode === 'utilization' ? [
              ['Overpopulated centers', focusBarangay.centers.filter(c => capacityStatus(c) === 'service_gap').length],
              ['Excess children across centers', formatNumber(focusBarangay.excess_children)],
              ['Near capacity', focusBarangay.centers.filter(c => capacityStatus(c) === 'near_capacity').length],
            ] : viewMode === 'ratio' ? [
              ['Teacher : child (aggregate)', formatRatio(focusBarangay.children_per_teacher)],
              ['Recorded teachers', focusBarangay.teacher_count],
              ['Centers missing teacher data', focusBarangay.centers.filter(c => !c.teacher_count).length],
            ] : [
              ['Registered centers', centerCount(focusBarangay)],
              ['Mapped locations', focusBarangay.centers.filter(c => c.hasLocation).length],
              ['Locations needing review', focusBarangay.centers.filter(c => !c.hasLocation).length],
            ]).map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"><dt className="text-xs leading-5 text-slate-500">{label}</dt><dd className="mt-1 break-words text-lg font-bold text-slate-900">{value}</dd></div>)}
          </dl>
          {viewMode === 'demand' && <div className="mt-3 space-y-2 text-sm">{underservedReasons(focusBarangay).map(reason => <p key={reason} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{reason}</p>)}<p className="text-xs leading-5 text-slate-500">Low recorded enrollment is a planning signal. Children may attend private or other services.</p></div>}
          {viewMode === 'ratio' && <p className="mt-3 text-xs leading-5 text-slate-500">Total enrollment at local centers divided by their recorded teachers. These monitoring bands are not compliance ratings. Session attendance and staffing assignments are not recorded.</p>}
          {viewMode === 'utilization' && <p className="mt-3 text-xs leading-5 text-slate-500">Capacity = slots per session x sessions per day. Each center is assessed separately; spare slots elsewhere do not offset an overloaded center.</p>}
          <details className="mt-5 border-t border-slate-200 pt-4" open={['distribution', 'utilization', 'ratio'].includes(viewMode)} key={viewMode}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Centers ({centerCount(focusBarangay)})</summary>
            <div className="mt-3 space-y-2">{focusBarangay.centers.map(center => <div key={center.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
              {isPlanningMonitor ? <strong>{center.name}</strong> : <Link className="font-semibold text-sky-800 hover:underline" to={`${cdcBaseHref}/${center.id}`}>{center.name}</Link>}
              <p className="mt-1 text-xs text-slate-500">{center.enrollment} enrolled / {center.effective_capacity} slots</p>
              {viewMode === 'utilization' && <p className="mt-1 text-xs font-medium" style={{ color: capacityVisual(center).marker }}>{capacityVisual(center).label}{center.excess_children > 0 ? ` | ${center.excess_children} excess children` : ''}</p>}
              {viewMode === 'ratio' && <p className="mt-1 text-xs">Teacher : child {formatRatio(center.children_per_teacher)} | {center.teacher_count} teachers</p>}
              {viewMode === 'distribution' && <p className="mt-1 text-xs text-slate-500">{center.address || 'Address not recorded'} | {center.hasLocation ? 'Mapped' : 'Location needs review'}</p>}
            </div>)}{!focusBarangay.centers.length && <p className="text-sm text-slate-500">{centerCount(focusBarangay) ? 'Center details unavailable. Refresh data.' : 'No registered CDC in this barangay.'}</p>}</div>
          </details>
          <details className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500"><summary className="cursor-pointer font-medium">Data source & reporting period</summary><p className="mt-2">{focusBarangay.basis?.population?.source?.title || 'No validated population source'}</p><p className="mt-1">{infoPeriod} | {focusBarangay.basis?.academic_year?.name || 'Current academic year'}</p></details>
        </aside>}
      </div>
      <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">Ages 3-4 | {publicBarangays[0]?.basis?.academic_year?.name || 'Current academic year'} | {mappedCdcs.length} mapped CDCs{missingLocations > 0 ? ` | ${missingLocations} locations need review` : ''}</span><button type="button" className={controlClass} aria-expanded={legendOpen} onClick={() => setLegendOpen(!legendOpen)}>{legendOpen ? 'Hide legend' : 'Show legend'}</button></div>
        {legendOpen && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 pb-1" aria-label="Map legend">{legendEntries.map(item => <span key={item.key || item.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"><span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.marker }} />{item.label.replace(/^(Green|Yellow|Orange|Red|Gray) - /, '')}</span>)}</div>}
        <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer w-fit">Population data basis</summary><div className="mt-2"><PopulationBasisNotice rows={publicBarangays.map(row => row.basis).filter(Boolean)} /></div></details>
      </footer>
    </section>
  );
  return isExpanded ? createPortal(mapContent, document.body) : mapContent;
};

export default HeatmapMap;
