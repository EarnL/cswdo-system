import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const emptyData = { unread_count: 0, notifications: [] };
const NotificationContext = createContext({
  data: emptyData, loading: false, setData: () => {}, refreshNotifications: () => {},
});

// One request stream keeps the sidebar badge and header bell in sync.
export function NotificationProvider({ children, enabled = true }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) { setData(emptyData); setLoading(false); return; }
    let mounted = true;
    let pending = false;
    async function fetchNotifications() {
      if (pending) return;
      pending = true;
      try {
        const response = await api.get('/notifications/');
        if (mounted) setData({ ...emptyData, ...response.data });
      } catch (error) {
        // Preserve the last known count during a temporary connection failure.
        console.error('Failed to load notifications', error);
      } finally {
        pending = false;
        if (mounted) setLoading(false);
      }
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    window.addEventListener('focus', fetchNotifications);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', fetchNotifications);
    };
  }, [enabled, revision]);

  return <NotificationContext.Provider value={{ data, setData, loading, refreshNotifications: () => setRevision((value) => value + 1) }}>
    {children}
  </NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
