import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import AppIcon from '../components/AppIcon';

const initialProfile = {
  first_name: '',
  last_name: '',
  email: '',
  bio: '',
  phone_number: '',
  date_of_birth: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_number: '',
  department: '',
  position: '',
  employee_id: '',
  profile_picture: null,
  profile_picture_url: null,
  username: '',
  role: '',
};

const completionFields = [
  'first_name',
  'last_name',
  'email',
  'phone_number',
  'address',
  'department',
  'position',
  'emergency_contact_name',
  'emergency_contact_number',
];

const roleLabels = {
  admin: 'CSWDO Admin',
  staff: 'CSWDO Staff',
  cdw: 'Child Development Worker',
  cho: 'City Health Office',
  planning: 'City Planning Office',
  city_planning: 'City Planning Office',
};

const roleHome = {
  admin: '/admin',
  staff: '/staff',
  cdw: '/cdw',
  cho: '/cho',
  planning: '/planning',
  city_planning: '/planning',
};

const syncStoredProfile = (profileData) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem('profile_summary', JSON.stringify(profileData));
  } catch (error) {
    console.error('Failed to store profile summary', error);
  }

  window.dispatchEvent(new CustomEvent('profile-updated', { detail: profileData }));
};

const getDisplayName = (profile) => {
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  return fullName || profile.username || 'User Profile';
};

const getInitials = (profile) => {
  const first = String(profile.first_name || '').trim()[0];
  const last = String(profile.last_name || '').trim()[0];
  const fallback = String(profile.username || 'U').trim()[0];
  return `${first || ''}${last || ''}`.trim().toUpperCase() || fallback.toUpperCase();
};

function MyProfile() {
  const [profile, setProfile] = useState(initialProfile);
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/profile/');
      setProfile(response.data);
      setSavedProfile(response.data);
      setPreviewImage(response.data.profile_picture_url || null);
      syncStoredProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setMessageTone('error');
      setMessage('Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  const profileCompletion = useMemo(() => {
    const completed = completionFields.filter((field) => String(profile[field] || '').trim()).length;
    return Math.round((completed / completionFields.length) * 100);
  }, [profile]);

  const missingFields = useMemo(
    () => completionFields.filter((field) => !String(profile[field] || '').trim()),
    [profile]
  );

  const displayName = getDisplayName(profile);
  const roleLabel = roleLabels[profile.role] || profile.role || 'Not set';
  const homeHref = roleHome[profile.role] || '/';

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setProfile((current) => ({
      ...current,
      profile_picture: file,
    }));

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setPreviewImage(loadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleEditClick = () => {
    setMessage('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setProfile(savedProfile);
    setPreviewImage(savedProfile.profile_picture_url || null);
    setMessage('');
    setIsEditing(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const formData = new FormData();

      Object.keys(profile).forEach((key) => {
        if (!['profile_picture', 'profile_picture_url', 'id', 'username', 'role'].includes(key)) {
          formData.append(key, profile[key] ?? '');
        }
      });

      if (profile.profile_picture instanceof File) {
        formData.append('profile_picture', profile.profile_picture);
      }

      const response = await api.patch('/profile/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setProfile(response.data);
      setSavedProfile(response.data);
      setPreviewImage(response.data.profile_picture_url || previewImage || null);
      syncStoredProfile(response.data);
      setMessageTone('success');
      setMessage('Profile updated successfully.');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessageTone('error');
      setMessage('Failed to update profile. Please review the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClassName = `w-full rounded-lg border px-4 py-3 text-sm font-semibold outline-none transition ${
    isEditing
      ? 'border-slate-300 bg-white text-slate-900 focus:border-[#0f4b94] focus:ring-4 focus:ring-sky-100'
      : 'border-slate-200 bg-slate-50 text-slate-600'
  }`;

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#0f4b94]" />
          <p className="font-semibold text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className={`grid gap-0 lg:grid-cols-[1.15fr_0.85fr] ${profile.role === 'cho' ? 'cho-profile-header' : ''}`}>
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <ProfileAvatar profile={profile} previewImage={previewImage} initials={getInitials(profile)} isEditing={isEditing} onImageChange={handleImageChange} />
              <div className="min-w-0">
                <p className="lgu-kicker">My Profile</p>
                <h1 className="mt-2 truncate text-3xl font-black text-slate-950 sm:text-4xl">{displayName}</h1>
                <p className="mt-2 text-sm font-semibold text-slate-500">@{profile.username || 'username'} | {roleLabel}</p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  {profile.role === 'cho' ? 'Your contact and office details.' : 'Manage your contact details, office information, and emergency contact used across the CSWDO system.'}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-[#0f4b94] p-6 text-white lg:border-l lg:border-t-0 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Profile Completion</p>
                <p className="mt-2 text-4xl font-black">{profileCompletion}%</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/10">
                <AppIcon name="profile" className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/18">
              <div className={`h-full rounded-full ${profile.role === 'cho' ? 'bg-brand-navy' : 'bg-white'}`} style={{ width: `${profileCompletion}%` }} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <SummaryPill label="Mode" value={isEditing ? 'Editing' : 'View only'} />
              <SummaryPill label="Office" value={profile.department || 'Not set'} />
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className={messageTone === 'error' ? 'lgu-alert-error' : 'lgu-alert-success'}>
          {message}
        </div>
      ) : null}

      {profile.role === 'cho' && <div className="flex flex-wrap items-center justify-between gap-3"><a href={homeHref} className="text-sm font-medium text-brand-navy">&larr; Dashboard</a><div className="flex gap-2">{isEditing ? <><button type="button" onClick={handleCancelEdit} disabled={saving} className="lgu-button-secondary">Cancel</button><button type="submit" form="account-profile-form" disabled={saving} className="lgu-button-primary">{saving ? 'Saving...' : 'Save Changes'}</button></> : <button type="button" onClick={handleEditClick} className="lgu-button-primary">Edit Profile</button>}</div></div>}
      <form id="account-profile-form" onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1fr_0.38fr]">
        <div className="space-y-5">
          <ProfileSection title="Personal Information" description="Basic identity and contact details.">
            <ProfileField label="First Name" name="first_name" value={profile.first_name} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
            <ProfileField label="Last Name" name="last_name" value={profile.last_name} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
            <ProfileField label="Email" name="email" type="email" value={profile.email} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
            <ProfileField label="Phone Number" name="phone_number" type="tel" value={profile.phone_number} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
            <ProfileField label="Date of Birth" name="date_of_birth" type="date" value={profile.date_of_birth} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
            <ProfileField label="Employee ID" name="employee_id" value={profile.employee_id} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
            <ProfileTextArea label="Address" name="address" value={profile.address} onChange={handleInputChange} disabled={!isEditing} className={`${fieldClassName} min-h-[96px] md:col-span-2`} />
            <ProfileTextArea label="Bio" name="bio" value={profile.bio} onChange={handleInputChange} disabled={!isEditing} className={`${fieldClassName} min-h-[116px] md:col-span-2`} />
          </ProfileSection>

          <ProfileSection title="Office Information" description="Role and assignment details shown in the system header.">
            <ProfileField label="Department" name="department" value={profile.department} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
            <ProfileField label="Position" name="position" value={profile.position} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
          </ProfileSection>

          <ProfileSection title="Emergency Contact" description="Contact person for urgent coordination.">
            <ProfileField label="Contact Name" name="emergency_contact_name" value={profile.emergency_contact_name} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
            <ProfileField label="Contact Number" name="emergency_contact_number" type="tel" value={profile.emergency_contact_number} onChange={handleInputChange} disabled={!isEditing} className={fieldClassName} />
          </ProfileSection>
        </div>

        <aside className={`space-y-5 self-start ${profile.role === 'cho' ? 'cho-profile-actions' : ''}`}>
          <section className={`${profile.role === 'cho' ? 'hidden' : ''} rounded-xl border border-slate-200 bg-white p-5 shadow-sm`}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0f4b94]">Actions</p>
            <div className="mt-4 space-y-3">
              {!isEditing ? (
                <button type="button" onClick={handleEditClick} className="login-primary-button w-full">
                  Edit Profile
                </button>
              ) : (
                <>
                  <button type="submit" disabled={saving} className="login-primary-button w-full">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={handleCancelEdit} className="lgu-button-secondary w-full">
                    Cancel
                  </button>
                </>
              )}
              <a href={homeHref} className="lgu-button-secondary w-full">
                Back to Workspace
              </a>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Account Details</h3>
            <div className="mt-4 space-y-3">
              <DetailRow label="Username" value={profile.username} />
              <DetailRow label="Role" value={roleLabel} />
              <DetailRow label="Department" value={profile.department} />
              <DetailRow label="Position" value={profile.position} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Missing Details</h3>
            {missingFields.length === 0 ? (
              <p className="mt-3 rounded-lg bg-sky-50 px-4 py-3 text-sm font-semibold text-[#0f4b94]">
                Profile details are complete.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {missingFields.slice(0, 6).map((field) => (
                  <span key={field} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                    {field.replaceAll('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </section>
        </aside>
      </form>
    </div>
  );
}

function ProfileAvatar({ profile, previewImage, initials, isEditing, onImageChange }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
        {previewImage ? (
          <img src={previewImage} alt={`${getDisplayName(profile)} profile`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl font-black text-[#0f4b94]">{initials}</span>
        )}
      </div>
      {isEditing ? (
        <label className="lgu-button-secondary cursor-pointer">
          Change Photo
          <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
        </label>
      ) : null}
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-sky-100">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function ProfileSection({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function ProfileField({ label, name, value, onChange, disabled, className, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <input type={type} name={name} value={value || ''} onChange={onChange} disabled={disabled} className={className} />
    </label>
  );
}

function ProfileTextArea({ label, name, value, onChange, disabled, className }) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <textarea name={name} value={value || ''} onChange={onChange} disabled={disabled} rows={4} className={className} />
    </label>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value || 'Not set'}</p>
    </div>
  );
}

export default MyProfile;
