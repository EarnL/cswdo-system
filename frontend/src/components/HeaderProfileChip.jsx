import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const STORAGE_KEY = 'profile_summary';

const readStoredProfile = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    console.error('Failed to read stored profile summary', error);
    return null;
  }
};

const writeStoredProfile = (profile) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Failed to store profile summary', error);
  }
};

const buildInitials = (profile, fallbackTitle) => {
  const first = String(profile?.first_name || '').trim();
  const last = String(profile?.last_name || '').trim();
  if (first || last) {
    return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || String(fallbackTitle || 'U').charAt(0).toUpperCase();
  }

  const username = String(profile?.username || '').trim();
  if (username) {
    return username.charAt(0).toUpperCase();
  }

  return String(fallbackTitle || 'U').charAt(0).toUpperCase();
};

const buildDisplayName = (profile, fallbackTitle) => {
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  return fullName || profile?.username || fallbackTitle;
};

function HeaderProfileChip({ href, fallbackTitle, fallbackSubtitle }) {
  const [profile, setProfile] = useState(() => readStoredProfile());

  useEffect(() => {
    let isMounted = true;

    const syncProfile = (nextProfile) => {
      if (!isMounted || !nextProfile) {
        return;
      }
      setProfile(nextProfile);
      writeStoredProfile(nextProfile);
    };

    const loadProfile = async () => {
      try {
        const response = await api.get('/profile/');
        syncProfile(response.data);
      } catch (error) {
        console.error('Failed to load header profile summary', error);
      }
    };

    const handleProfileUpdated = (event) => {
      if (event.detail) {
        syncProfile(event.detail);
        return;
      }

      const storedProfile = readStoredProfile();
      if (storedProfile) {
        syncProfile(storedProfile);
      }
    };

    loadProfile();
    window.addEventListener('profile-updated', handleProfileUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('profile-updated', handleProfileUpdated);
    };
  }, []);

  const displayName = useMemo(() => buildDisplayName(profile, fallbackTitle), [profile, fallbackTitle]);
  const initials = useMemo(() => buildInitials(profile, fallbackTitle), [profile, fallbackTitle]);
  const subtitle = useMemo(() => {
    const position = String(profile?.position || '').trim();
    const department = String(profile?.department || '').trim();
    if (position && department) {
      return `${position} - ${department}`;
    }
    return position || department || fallbackSubtitle;
  }, [fallbackSubtitle, profile]);

  return (
    <Link
      to={href}
      className="motion-lift group flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-slate-300 hover:bg-white"
    >
      <div className="hidden text-right md:block">
        <p className="text-sm font-semibold text-slate-800 group-hover:text-[#0f4b94]">{displayName}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-[#0f4b94] font-semibold text-white">
        {profile?.profile_picture_url ? (
          <img
            src={profile.profile_picture_url}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    </Link>
  );
}

export default HeaderProfileChip;
