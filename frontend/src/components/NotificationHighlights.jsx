import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api';
import { normalizeNotificationLink } from '../utils/notificationLinks';

function NotificationHighlights({ title = 'Attention Now', compact = false }) {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : `/${location.pathname.split('/')[1] || 'staff'}`;

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      try {
        setLoading(true);
        const response = await api.get('/notifications/');
        if (!isMounted) {
          return;
        }
        setNotifications((response.data?.notifications || []).slice(0, compact ? 3 : 5));
        setUnreadCount(response.data?.unread_count || 0);
      } catch (error) {
        console.error('Failed to load notification highlights', error);
        if (isMounted) {
          setNotifications([]);
          setUnreadCount(0);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [compact]);

  const markRead = async (notification) => {
    if (notification.is_read) return;
    try {
      await api.post(`/notifications/${notification.id}/mark-read/`);
      setUnreadCount((current) => Math.max(0, current - 1));
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item
      )));
    } catch (error) {
      console.error('Failed to mark notification as seen', error);
    }
  };

  return (
    <section className="lgu-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">Recent items that may need follow-up.</p>
        </div>
        <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          {unreadCount} unread
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="lgu-empty-state">
            Loading...
          </div>
        ) : null}

        {!loading && notifications.length === 0 ? (
          <div className="lgu-empty-state">
            Nothing urgent right now.
          </div>
        ) : null}

        {notifications.map((notification) => (
          <Link
            key={notification.id}
            to={normalizeNotificationLink(notification.link || '#', undefined, notification)}
            onClick={() => markRead(notification)}
            className={`block rounded-lg border px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50 ${
              notification.is_read ? 'border-slate-200 bg-white text-slate-700' : 'border-blue-200 bg-blue-50 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm ${notification.is_read ? 'font-semibold' : 'font-black'}`}>{notification.title}</p>
                <p className="mt-1 line-clamp-2 text-sm opacity-90">{notification.message}</p>
              </div>
              <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide ${notification.is_read ? 'bg-slate-100 text-slate-500' : 'bg-blue-600 text-white'}`}>
                {notification.is_read ? 'Seen' : 'Unread'}
              </span>
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{notification.category}</p>
          </Link>
        ))}
      </div>

      <div className="mt-5">
        <Link
          to={`${basePath}/notifications`}
          className="lgu-button-primary"
        >
          Open Notices
        </Link>
      </div>
    </section>
  );
}

export default NotificationHighlights;
