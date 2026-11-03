import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { beginRequest, endRequest } from '../requestActivity';
import AppIcon from '../components/AppIcon';
import lucenaBarangays from '../data/lucenaBarangays_simplified.json';

const initialFormData = {
  offers_toddler_care: false, offers_preschool: false, has_feeding_program: false, has_health_services: false,
  name: '',
  barangay_id: '',
  address: '',
  contact_person: '',
  contact_number: '',
  email: '',
  latitude: '',
  longitude: '',
  current_enrollment: 0,
  capacity_per_session: '',
  sessions_per_day: '',
  operating_days: '',
  operating_hours: '',
  has_water_supply: false,
  has_sanitation: false,
  has_electricity: false,
  building_type: '',
  total_area: '',
  establishment_date: '',
  program_coordinator_name: '',
  program_coordinator_contact: '',
  program_coordinator_qualification: '',
  special_notes: '',
};

const DEFAULT_MAP_CENTER = [13.9411, 121.6177];
const LUCENA_BOUNDS = L.geoJSON(lucenaBarangays).getBounds();

const normalizeBarangayName = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/\(pob\.\)/g, '')
    .replace(/\bpoblacion\b/g, '')
    .replace(/\bbrgy\.?\b/g, 'barangay')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function LocationMapController({ onUpdate, onCenterChange, searchTarget }) {
  const map = useMap();

  useMapEvents({
    click(e) {
      onUpdate(e.latlng);
    },
    moveend() {
      const center = map.getCenter();
      onCenterChange(center);
    },
  });

  useEffect(() => {
    if (!searchTarget) return;
    map.flyTo(searchTarget, 16, { duration: 0.8 });
    onCenterChange({ lat: searchTarget[0], lng: searchTarget[1] });
  }, [map, onCenterChange, searchTarget]);

  return null;
}

const FormSection = ({ icon, title, children }) => (
  <section className="cdc-form-section">
    <div className="cdc-form-section-header">
      <span><AppIcon name={icon} className="h-5 w-5" /></span>
      <h2>{title}</h2>
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const Field = ({ label, error, children }) => (
  <fieldset className="cdc-form-field min-w-0">
    <legend className="mb-2 text-sm font-semibold text-slate-700">{label}</legend>
    {React.Children.map(children, child => React.isValidElement(child) && ['input', 'select', 'textarea'].includes(child.type)
      ? React.cloneElement(child, { 'aria-label': child.props['aria-label'] || label, 'aria-invalid': Boolean(error) }) : child)}
    {error ? <p className="cdc-form-error">{error}</p> : null}
  </fieldset>
);

const Toggle = ({ label, name, checked, onChange }) => (
  <label className={`cdc-form-toggle ${checked ? 'is-on' : ''}`}>
    <input type="checkbox" name={name} checked={checked} onChange={onChange} />
    <span><AppIcon name={checked ? 'shield' : 'registration'} className="h-4 w-4" /></span>
    {label}
  </label>
);

const steps = ['Center Details', 'Location', 'Operations', 'Review'];
const fieldStep = name => ['latitude', 'longitude'].includes(name) ? 1 : ['name','barangay_id','barangay','address','contact_person','contact_number','email'].includes(name) ? 0 : 2;
const insideRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x,y] = ring[i], [a,b] = ring[j];
    const cross = (point[0]-x)*(b-y)-(point[1]-y)*(a-x);
    if (Math.abs(cross) < 1e-10 && point[0] >= Math.min(x,a) && point[0] <= Math.max(x,a) && point[1] >= Math.min(y,b) && point[1] <= Math.max(y,b)) return true;
    if ((y > point[1]) !== (b > point[1]) && point[0] < (a-x)*(point[1]-y)/(b-y)+x) inside = !inside;
  }
  return inside;
};
export const insideBarangay = (point, geometry) => {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  return polygons.some(rings => insideRing(point, rings[0]) && !rings.slice(1).some(ring => insideRing(point, ring)));
};
function FitBarangay({ feature }) {
  const map = useMap();
  useEffect(() => { if (feature) map.fitBounds(L.geoJSON(feature).getBounds(), { padding: [20,20] }); }, [feature,map]);
  return null;
}

function CDCRegistrationForm() {
  const { cdcId } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(cdcId);

  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [sameContact, setSameContact] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEditMode);
  const [errors, setErrors] = useState({});
  const [mapPosition, setMapPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSearchStatus, setLocationSearchStatus] = useState('');

  const [searchTarget, setSearchTarget] = useState(null);

  useEffect(() => {
    fetchBarangays();
  }, []);

  useEffect(() => {
    if (!isEditMode) {
      setPageLoading(false);
      return;
    }

    const fetchCdc = async () => {
      try {
        setPageLoading(true);
        const response = await api.get(`/cdcs/${cdcId}/`);
        const cdc = response.data;
        setFormData({
          offers_toddler_care: Boolean(cdc.offers_toddler_care), offers_preschool: Boolean(cdc.offers_preschool),
          has_feeding_program: Boolean(cdc.has_feeding_program), has_health_services: Boolean(cdc.has_health_services),
          name: cdc.name || '',
          barangay_id: String(cdc.barangay || ''),
          address: cdc.address || '',
          contact_person: cdc.contact_person || '',
          contact_number: cdc.contact_number || '',
          email: cdc.email || '',
          latitude: cdc.latitude ?? '',
          longitude: cdc.longitude ?? '',
          current_enrollment: cdc.current_enrollment ?? 0,
          capacity_per_session: cdc.capacity_per_session ?? '',
          sessions_per_day: cdc.sessions_per_day ?? '',
          operating_days: cdc.operating_days || '',
          operating_hours: cdc.operating_hours || '',
          has_water_supply: Boolean(cdc.has_water_supply),
          has_sanitation: Boolean(cdc.has_sanitation),
          has_electricity: Boolean(cdc.has_electricity),
          building_type: cdc.building_type || '',
          total_area: cdc.total_area ?? '',
          establishment_date: cdc.establishment_date || '',
          program_coordinator_name: cdc.program_coordinator_name || '',
          program_coordinator_contact: cdc.program_coordinator_contact || '',
          program_coordinator_qualification: cdc.program_coordinator_qualification || '',
          special_notes: cdc.special_notes || '',
        });
      } catch (error) {
        console.error('Failed to load CDC details:', error);
        setLoadFailed(true);
        setMessage('Could not load this center. Please reopen it before editing.');
      } finally {
        setPageLoading(false);
      }
    };

    fetchCdc();
  }, [cdcId, isEditMode, navigate]);

  const fetchBarangays = async () => {
    try {
      const response = await api.get('/barangays/');
      setBarangays(response.data);
    } catch (error) {
      console.error('Failed to fetch barangays:', error);
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  useEffect(() => {
    if (sameContact) setFormData(current => ({ ...current, program_coordinator_name: current.contact_person, program_coordinator_contact: current.contact_number }));
  }, [sameContact, formData.contact_person, formData.contact_number]);
  useEffect(() => { document.getElementById('registration-step')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }, [step]);

  const selectedBarangay = useMemo(
    () => barangays.find((barangay) => String(barangay.id) === String(formData.barangay_id)),
    [barangays, formData.barangay_id]
  );

  const selectedBarangayFeature = useMemo(() => {
    if (!selectedBarangay?.name) return null;
    const selectedName = normalizeBarangayName(selectedBarangay.name);
    return lucenaBarangays.features.find((feature) => {
      const featureName = feature?.properties?.brgy_name || feature?.properties?.name || '';
      return normalizeBarangayName(featureName) === selectedName;
    }) || null;
  }, [selectedBarangay]);

  const barangayLocationWarning = useMemo(() => {
    if (!mapPosition || !selectedBarangayFeature) return '';
    return insideBarangay([mapPosition[1], mapPosition[0]], selectedBarangayFeature.geometry) ? '' : 'The selected point may be outside the selected barangay. Please check the location.';
  }, [mapPosition, selectedBarangayFeature]);

  const updateSelectedLocation = (latlng) => {
    const lat = Number(latlng.lat).toFixed(6);
    const lng = Number(latlng.lng).toFixed(6);
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    setMapPosition([Number(lat), Number(lng)]);

    setErrors((prev) => ({ ...prev, latitude: '', longitude: '' }));
  };

  const handleMapClick = (latlng) => {
    updateSelectedLocation(latlng);
  };

  const handleMarkerDrag = (event) => {
    updateSelectedLocation(event.target.getLatLng());
  };

  const handleMapCenterChange = useCallback((center) => {
    setMapCenter([center.lat, center.lng]);
  }, []);

  const handleUseMapCenter = () => {
    updateSelectedLocation({ lat: mapCenter[0], lng: mapCenter[1] });
  };

  const handleLocationSearch = async () => {
    const query = locationSearch.trim();
    if (!query) return;

    setLocationSearchStatus('Searching...');
    const activity = beginRequest();
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${query}, Lucena City, Quezon, Philippines`)}`);
      const results = await response.json();
      if (!Array.isArray(results) || !results.length) {
        setLocationSearchStatus('No matching location found.');
        return;
      }

      const lat = Number(results[0].lat);
      const lng = Number(results[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationSearchStatus('No matching location found.');
        return;
      }

      setSearchTarget([lat, lng]);
      updateSelectedLocation({ lat, lng });
      setLocationSearchStatus('Location found. Adjust the pin if needed.');
    } catch (error) {
      console.error('Location search failed:', error);
      setLocationSearchStatus('Search is unavailable right now.');
    } finally {
      endRequest(activity);
    }
  };

  useEffect(() => {
    if (formData.latitude !== '' && formData.longitude !== '') {
      setMapPosition([Number(formData.latitude), Number(formData.longitude)]);
    }
  }, [formData.latitude, formData.longitude]);

  const validateForm = (onlyStep = null) => {
    const newErrors = {};

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Enter a valid email';
    if (formData.capacity_per_session && !Number.isInteger(Number(formData.capacity_per_session))) newErrors.capacity_per_session = 'Use a whole number';
    if (formData.sessions_per_day && !Number.isInteger(Number(formData.sessions_per_day))) newErrors.sessions_per_day = 'Use a whole number';
    if (!formData.name.trim()) newErrors.name = 'CDC name is required';
    if (!formData.barangay_id) newErrors.barangay_id = 'Barangay is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.contact_person.trim()) newErrors.contact_person = 'Contact person is required';
    if (!formData.contact_number.trim()) newErrors.contact_number = 'Contact number is required';
    if (!formData.capacity_per_session || Number(formData.capacity_per_session) <= 0) newErrors.capacity_per_session = 'Valid capacity per session is required';
    if (!formData.sessions_per_day || Number(formData.sessions_per_day) <= 0) newErrors.sessions_per_day = 'Number of sessions per day is required';
    if (!formData.program_coordinator_name.trim()) newErrors.program_coordinator_name = 'Program coordinator name is required';
    if (!formData.program_coordinator_contact.trim()) newErrors.program_coordinator_contact = 'Coordinator contact number is required';
    if (!formData.latitude && formData.latitude !== 0) newErrors.latitude = 'Location pin is required';
    if (!formData.longitude && formData.longitude !== 0) newErrors.longitude = 'Location pin is required';

    const relevant = Object.fromEntries(Object.entries(newErrors).filter(([name]) => onlyStep == null || fieldStep(name) === onlyStep));
    setErrors(relevant);
    if (Object.keys(relevant).length) {
      const first = Object.keys(relevant)[0];
      setStep(fieldStep(first));
      setTimeout(() => document.querySelector(`[name="${first}"]`)?.focus(), 0);
      setMessage('Please complete the highlighted fields.');
      return false;
    }
    setMessage('');
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loadFailed) return;
    if (step < 3) { if (validateForm(step)) setStep(step + 1); return; }
    if (!validateForm()) return;

    setLoading(true);
    try {
      const totalCenterCapacity = Number(formData.capacity_per_session) * Number(formData.sessions_per_day);
      const payload = {
        name: formData.name,
        barangay: Number(formData.barangay_id),
        address: formData.address,
        contact_person: formData.contact_person,
        contact_number: formData.contact_number,
        email: formData.email,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        current_enrollment: Number(formData.current_enrollment || 0),
        capacity_per_session: Number(formData.capacity_per_session),
        sessions_per_day: Number(formData.sessions_per_day),
        max_capacity: totalCenterCapacity,
        operating_days: formData.operating_days,
        operating_hours: formData.operating_hours,
        has_water_supply: formData.has_water_supply,
        has_sanitation: formData.has_sanitation,
        has_electricity: formData.has_electricity,
        building_type: formData.building_type,
        total_area: formData.total_area === '' ? null : Number(formData.total_area),
        offers_toddler_care: formData.offers_toddler_care,
        offers_preschool: formData.offers_preschool,
        has_feeding_program: formData.has_feeding_program,
        has_health_services: formData.has_health_services,
        establishment_date: formData.establishment_date || null,
        program_coordinator_name: formData.program_coordinator_name,
        program_coordinator_contact: formData.program_coordinator_contact,
        program_coordinator_qualification: formData.program_coordinator_qualification,
        special_notes: formData.special_notes,
      };

      if (isEditMode) {
        await api.put(`/cdcs/${cdcId}/`, payload);
        setMessage('Center updated.');
        navigate(`/admin/daycare-centers/${cdcId}`);
      } else {
        await api.post('/cdcs/', payload);
        setScheduleStart(''); setScheduleEnd('');
        setMessage('Center registered successfully.');
        setFormData(initialFormData);
        setMapPosition(null);
        setStep(0);
        setSameContact(false);
      }
      setErrors({});
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'register'} CDC:`, error);
      if (error.response?.data) {
        setErrors(error.response.data);
        const first = Object.keys(error.response.data).find(key => key in initialFormData || key === 'barangay');
        if (first) setStep(fieldStep(first));
        setMessage('Could not save. Check the highlighted fields.');
      } else {
        setMessage('Could not save. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (name) => `cdc-form-input ${errors[name] ? 'has-error' : ''}`;
  const totalCenterCapacity = Number(formData.capacity_per_session || 0) * Number(formData.sessions_per_day || 0);

  if (pageLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="cdc-registration-page">
      <section className="cdc-registration-hero">
        <div>
          {isEditMode ? (
            <Link to={`/admin/daycare-centers/${cdcId}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#0f4b94]">
              <AppIcon name="chevronLeft" className="h-4 w-4" />
              Back to CDC Profile
            </Link>
          ) : null}
          <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#0f4b94]">{isEditMode ? 'Update Record' : 'New Registration'}</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
            {isEditMode ? 'Edit CDC Profile' : 'Register Child Development Center'}
          </h1>
        </div>
      </section>

      <nav aria-label="Registration steps" className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{steps.map((label,index) => <div key={label} aria-current={index === step ? 'step' : undefined} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${index === step ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>{index + 1}. {label}</div>)}</nav>
      {message && <div role="status" className="my-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">{message}</div>}
      <form id="registration-step" noValidate onSubmit={handleSubmit} className="mt-4 grid gap-4">
        {step === 0 && <>
        <FormSection icon="building" title="Basic Information">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="CDC Name *" error={errors.name}>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass('name')} placeholder="Enter CDC name" />
            </Field>
            <Field label="Barangay *" error={errors.barangay_id}>
              <select name="barangay_id" value={formData.barangay_id} onChange={handleChange} className={inputClass('barangay_id')}>
                <option value="">Select Barangay</option>
                {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
              </select>
            </Field>
            <Field label="Full Address *" error={errors.address}>
              <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClass('address')} placeholder="Enter complete address" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="cdc-form-input" placeholder="Enter email address" />
            </Field>
            <Field label="Contact Person *" error={errors.contact_person}>
              <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} className={inputClass('contact_person')} placeholder="Contact person name" />
            </Field>
            <Field label="Contact Number *" error={errors.contact_number}>
              <input type="tel" name="contact_number" value={formData.contact_number} onChange={handleChange} className={inputClass('contact_number')} placeholder="Contact number" />
            </Field>

          </div>
        </FormSection>

        </>}
        {step === 1 && <FormSection icon="map" title="Center Location">            <Field label="Select Location on Map *" error={errors.latitude || errors.longitude}>
              <div className="cdc-map-wrapper">
                <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    type="search"
                    value={locationSearch}
                    onChange={(event) => setLocationSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleLocationSearch();
                      }
                    }}
                    className="cdc-form-input"
                    placeholder="Search CDC address, barangay, or nearby landmark"
                  />
                  <button type="button" onClick={handleLocationSearch} className="lgu-button-secondary justify-center">
                    Search
                  </button>
                </div>
                <p className="mb-3 text-xs font-semibold text-slate-500">Click or drag the pin to mark the exact CDC location.</p>
                <MapContainer
                  center={mapPosition || DEFAULT_MAP_CENTER}
                  zoom={13}
                  style={{ height: '320px', width: '100%' }}
                  bounds={LUCENA_BOUNDS}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <GeoJSON data={lucenaBarangays} style={{ color: '#2563eb', weight: 1, fillOpacity: 0.05 }} />
                  <FitBarangay feature={selectedBarangayFeature} />
                  <LocationMapController onUpdate={handleMapClick} onCenterChange={handleMapCenterChange} searchTarget={searchTarget} />
                  {mapPosition ? (
                    <Marker position={mapPosition} draggable eventHandlers={{ dragend: handleMarkerDrag }}>
                      <Tooltip direction="top" offset={[0, -16]} permanent>
                        Selected CDC Location
                      </Tooltip>
                    </Marker>
                  ) : null}
                </MapContainer>
                <details className="mt-3"><summary className="cursor-pointer text-sm text-slate-600">View coordinates</summary>                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Latitude
                    <input type="number" name="latitude" value={formData.latitude} readOnly className="cdc-form-input mt-1" placeholder="Latitude" />
                  </label>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Longitude
                    <input type="number" name="longitude" value={formData.longitude} readOnly className="cdc-form-input mt-1" placeholder="Longitude" />
                  </label>
                </div>
</details>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={handleUseMapCenter} className="lgu-button-secondary">
                    Use Map Center
                  </button>

                </div>
                {locationSearchStatus ? <p className="mt-2 text-xs font-semibold text-slate-500">{locationSearchStatus}</p> : null}
                {mapPosition && <p className="mt-2 text-sm text-emerald-700">Location selected</p>}

                {barangayLocationWarning ? <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">{barangayLocationWarning}</p> : null}
              </div>
            </Field></FormSection>}
        {step === 2 && <>
        <FormSection icon="analytics" title="Capacity and Operations">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Capacity per Session *" error={errors.capacity_per_session}>
              <input type="number" name="capacity_per_session" value={formData.capacity_per_session} onChange={handleChange} min="1" className={inputClass('capacity_per_session')} />
            </Field>
            <Field label="Sessions per Day *" error={errors.sessions_per_day}>
              <input type="number" name="sessions_per_day" value={formData.sessions_per_day} onChange={handleChange} min="1" className={inputClass('sessions_per_day')} />
            </Field>
            <Field label="Establishment Date">
              <input type="date" name="establishment_date" value={formData.establishment_date} onChange={handleChange} className="cdc-form-input" />
            </Field>
            <Field label="Operating Days"><div className="mb-2 flex flex-wrap gap-1">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <button key={day} type="button" aria-pressed={formData.operating_days.split(', ').includes(day)} onClick={() => setFormData(current => { const days = current.operating_days.split(', ').filter(value => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(value)); return {...current, operating_days: (days.includes(day) ? days.filter(value => value !== day) : [...days,day]).join(', ')}; })} className={`rounded-lg border px-2 py-1 text-xs ${formData.operating_days.split(', ').includes(day) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200'}`}>{day}</button>)}</div>
              <input type="text" name="operating_days" value={formData.operating_days} onChange={handleChange} className="cdc-form-input" placeholder="e.g. Monday-Friday" />
            </Field>
            <Field label="Operating Hours"><div className="mb-2 flex gap-2"><input aria-label="Opening time" type="time" className="cdc-form-input" value={scheduleStart} onChange={event => {setScheduleStart(event.target.value); if (scheduleEnd) setFormData(current => ({...current, operating_hours: `${event.target.value} - ${scheduleEnd}`}));}} /><input aria-label="Closing time" type="time" className="cdc-form-input" value={scheduleEnd} onChange={event => {setScheduleEnd(event.target.value); if (scheduleStart) setFormData(current => ({...current, operating_hours: `${scheduleStart} - ${event.target.value}`}));}} /></div>
              <input type="text" name="operating_hours" value={formData.operating_hours} onChange={handleChange} className="cdc-form-input" placeholder="Or enter a custom schedule" />
            </Field>
            <Field label="Total Center Capacity">
              <input
                type="text"
                value={`${totalCenterCapacity.toLocaleString()} child${totalCenterCapacity === 1 ? '' : 'ren'}`}
                readOnly
                className="cdc-form-input bg-slate-50 font-black text-slate-900"
                aria-label="Total Center Capacity, automatically calculated"
              />
              <p className="mt-1 text-xs font-semibold text-slate-500">Sessions per day x capacity per session</p>
            </Field>
          </div>
        </FormSection>

        <FormSection icon="shield" title="Facilities">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Building Type">
              <select name="building_type" value={formData.building_type} onChange={handleChange} className="cdc-form-input">
                <option value="">Select Building Type</option>
                <option value="owned">Owned Building</option>
                <option value="rented">Rented Building</option>
                <option value="barangay">Barangay Hall</option>
                <option value="school">School Facility</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Total Area (sqm)">
              <input type="number" name="total_area" value={formData.total_area} onChange={handleChange} min="0" className="cdc-form-input" />
            </Field>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <Toggle label="Water Supply" name="has_water_supply" checked={formData.has_water_supply} onChange={handleChange} />
            <Toggle label="Sanitation" name="has_sanitation" checked={formData.has_sanitation} onChange={handleChange} />
            <Toggle label="Electricity" name="has_electricity" checked={formData.has_electricity} onChange={handleChange} />
          </div>
        </FormSection>

        <FormSection icon="programs" title="Available Services">
          <div className="grid gap-2 sm:grid-cols-2">{[['offers_toddler_care','Toddler care'],['offers_preschool','Preschool'],['has_feeding_program','Feeding program'],['has_health_services','Health services']].map(([name,label]) => <Toggle key={name} name={name} label={label} checked={formData[name]} onChange={handleChange} />)}</div>
        </FormSection>

        <FormSection icon="users" title="Coordinator"><label className="mb-3 flex gap-2 text-sm"><input type="checkbox" checked={sameContact} onChange={event => setSameContact(event.target.checked)} />Same as contact person</label>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Coordinator Name *" error={errors.program_coordinator_name}>
              <input type="text" name="program_coordinator_name" readOnly={sameContact} value={formData.program_coordinator_name} onChange={handleChange} className={inputClass('program_coordinator_name')} placeholder="Full name" />
            </Field>
            <Field label="Contact Number *" error={errors.program_coordinator_contact}>
              <input type="tel" name="program_coordinator_contact" readOnly={sameContact} value={formData.program_coordinator_contact} onChange={handleChange} className={inputClass('program_coordinator_contact')} placeholder="Contact number" />
            </Field>
            <Field label="Qualifications/Certifications">
              <input type="text" name="program_coordinator_qualification" value={formData.program_coordinator_qualification} onChange={handleChange} className="cdc-form-input" placeholder="e.g. ECE Certified, TESDA Trained" />
            </Field>
          </div>
        </FormSection>

        <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">Additional details</summary><FormSection icon="reports" title="Notes">
          <div className="grid gap-3">
            <Field label="Special Notes">
              <textarea name="special_notes" value={formData.special_notes} onChange={handleChange} rows="3" className="cdc-form-input" />
            </Field>
          </div>
        </FormSection>

        </details></>}
        {step === 3 && <FormSection icon="registration" title="Review Center">
          <div className="grid gap-4 sm:grid-cols-2">{[
            ['Center Details', 0, [formData.name, selectedBarangay?.name, formData.address, `${formData.contact_person} | ${formData.contact_number}`, formData.email]],
            ['Location', 1, [`${formData.latitude}, ${formData.longitude}`, barangayLocationWarning || 'Location selected']],
            ['Operations', 2, [`${formData.capacity_per_session} children x ${formData.sessions_per_day} sessions = ${totalCenterCapacity} slots`, formData.operating_days, formData.operating_hours, `Coordinator: ${formData.program_coordinator_name}`, `Contact: ${formData.program_coordinator_contact}`]],
            ['Services', 2, [['offers_toddler_care','Toddler care'],['offers_preschool','Preschool'],['has_feeding_program','Feeding program'],['has_health_services','Health services']].map(([key,label]) => `${label}: ${formData[key] ? 'Yes' : 'No'}`)],
          ].map(([title,index,values]) => <section key={title} className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex justify-between"><h3 className="font-semibold">{title}</h3><button type="button" onClick={() => setStep(index)} className="text-sm font-semibold text-blue-700">Edit</button></div>{values.filter(Boolean).map((value,index) => <p key={index} className="break-words text-sm leading-6 text-slate-600">{value}</p>)}</section>)}</div>
        </FormSection>}
        <div className="sticky bottom-0 z-[1000] flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <Link to={isEditMode ? `/admin/daycare-centers/${cdcId}` : '/admin/daycare-centers'} className="lgu-button-secondary">Cancel</Link>
          <div className="flex gap-2">{step > 0 && <button type="button" disabled={loading} onClick={() => setStep(step-1)} className="lgu-button-secondary">Back</button>}
          <button type="submit" disabled={loading || loadFailed} className="lgu-button-primary">{loading ? 'Saving...' : step < 3 ? 'Next' : isEditMode ? 'Save Changes' : 'Register Center'}</button></div>
        </div>
      </form>
    </div>
  );
}

export default CDCRegistrationForm;
