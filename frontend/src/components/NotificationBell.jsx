import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { useNotifications } from './NotificationContext';
import BellIcon from './BellIcon';
import { normalizeNotificationLink } from '../utils/notificationLinks';

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, setData, loading, refreshNotifications } = useNotifications();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await api.post(`/notifications/${notification.id}/mark-read/`);
        refreshNotifications();
        setData((current) => ({
          ...current,
          unread_count: Math.max(0, current.unread_count - 1),
          notifications: current.notifications.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item
          ),
        }));
      }
    } catch (error) {
      console.error('Failed to update notification status', error);
    } finally {
      setOpen(false);
      if (notification.link) {
        navigate(normalizeNotificationLink(notification.link, undefined, notification));
      }
    }
  };

  const basePath = location.pathname.startsWith('/admin') ? '/admin' : `/${location.pathname.split('/')[1] || 'staff'}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Notifications"
        className="motion-press relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-brand-navy hover:text-brand-navy"
      >
        <BellIcon />
        {data.unread_count > 0 ? (
          <span className="motion-loading absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">
            {data.unread_count > 9 ? '9+' : data.unread_count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="motion-popover absolute right-0 z-50 mt-3 w-[360px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {data.unread_count} unread
              </span>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-4">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Loading...
              </div>
            ) : null}

            {!loading && data.notifications.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                You're all caught up.
              </div>
            ) : null}

            <div className="space-y-3">
              {data.notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`motion-lift block w-full rounded-2xl border px-4 py-4 text-left transition hover:border-sky-300 hover:bg-sky-50 ${
                    notification.is_read
                      ? 'border-slate-200 bg-white text-slate-700'
                      : 'border-blue-200 bg-blue-50 text-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm ${notification.is_read ? 'font-semibold' : 'font-black'}`}>{notification.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs opacity-80">{notification.message}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${notification.is_read ? 'bg-slate-100 text-slate-500' : 'bg-blue-600 text-white'}`}>
                      {notification.is_read ? 'Seen' : 'Unread'}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{notification.category}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            <Link
              to={`${basePath}/notifications`}
              onClick={() => setOpen(false)}
              className="block rounded-xl bg-brand-navy px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-hover"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default NotificationBell;
