import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useNotifications } from '../components/NotificationContext';
import { LoadingState } from '../components/LoadingState';
import { normalizeNotificationLink } from '../utils/notificationLinks';

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'active', label: 'Active' },
];

const priorityClasses = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
};

const notificationShell = {
  unread: 'border-blue-200 bg-blue-50/80 shadow-sm',
  read: 'border-slate-200 bg-white',
};

function NotificationCard({ notification, saving, onOpen, onMarkRead, onMarkUnread }) {
  const isUnread = !notification.is_read;

  return (
    <article className={`rounded-lg border p-5 transition ${isUnread ? notificationShell.unread : notificationShell.read}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          onClick={() => onOpen(notification)}
          className="max-w-3xl text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {notification.category}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${priorityClasses[notification.priority] || priorityClasses.low}`}>
              {notification.priority}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${isUnread ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {isUnread ? 'Unread' : 'Seen'}
            </span>
            {!notification.is_active ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Archived
              </span>
            ) : null}
          </div>
          <h3 className={`mt-4 text-xl text-slate-900 ${isUnread ? 'font-black' : 'font-semibold'}`}>{notification.title}</h3>
          <p className={`mt-2 text-sm leading-6 ${isUnread ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{notification.message}</p>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            {new Date(notification.created_at).toLocaleString()}
          </p>
        </button>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          {notification.link ? (
            <button type="button" onClick={() => onOpen(notification)} className="lgu-button-primary">
              Open Link
            </button>
          ) : null}
          {notification.is_read ? (
            <button
              type="button"
              onClick={() => onMarkUnread(notification.id)}
              disabled={saving}
              className="lgu-button-secondary"
            >
              Mark Unread
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              disabled={saving}
              className="lgu-button-secondary"
            >
              Mark Seen
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function NotificationsPage({ compact = false }) {
  const navigate = useNavigate();
  const { refreshNotifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({ notifications: [], unread_count: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;

    async function fetchNotifications() {
      setLoading(true);
      try {
        const response = await api.get('/notifications/all/', {
          params: {
            status: statusFilter,
          },
        });
        if (isMounted) {
          setData(response.data || { notifications: [], unread_count: 0, total: 0 });
        }
      } catch (error) {
        console.error('Failed to load notifications page', error);
        if (isMounted) {
          setData({ notifications: [], unread_count: 0, total: 0 });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchNotifications();

    return () => {
      isMounted = false;
    };
  }, [statusFilter]);

  const counts = useMemo(() => {
    const notifications = data.notifications || [];
    return {
      total: data.total || notifications.length,
      unread: data.unread_count || notifications.filter((item) => !item.is_read).length,
      high: notifications.filter((item) => item.priority === 'high').length,
      visible: notifications.length,
    };
  }, [data]);

  const groupedNotifications = useMemo(() => {
    const notifications = data.notifications || [];
    return {
      unread: notifications.filter((item) => !item.is_read),
      read: notifications.filter((item) => item.is_read),
    };
  }, [data.notifications]);

  const handleMarkRead = async (notificationId) => {
    const notification = data.notifications.find((item) => item.id === notificationId);
    if (notification?.is_read) return;
    setSaving(true);
    try {
      await api.post(`/notifications/${notificationId}/mark-read/`);
      refreshNotifications();
      setData((current) => ({
        ...current,
        unread_count: Math.max(0, current.unread_count - 1),
        notifications: current.notifications.map((item) =>
          item.id === notificationId ? { ...item, is_read: true, read_at: new Date().toISOString() } : item
        ),
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleMarkUnread = async (notificationId) => {
    const notification = data.notifications.find((item) => item.id === notificationId);
    if (notification && !notification.is_read) return;
    setSaving(true);
    try {
      await api.post(`/notifications/${notificationId}/mark-unread/`);
      refreshNotifications();
      setData((current) => ({
        ...current,
        unread_count: current.unread_count + 1,
        notifications: current.notifications.map((item) =>
          item.id === notificationId ? { ...item, is_read: false, read_at: null } : item
        ),
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllRead = async () => {
    setSaving(true);
    try {
      await api.post('/notifications/mark-all-read/');
      refreshNotifications();
      setData((current) => ({
        ...current,
        unread_count: 0,
        notifications: current.notifications.map((item) => ({ ...item, is_read: true })),
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenNotification = async (notification) => {
    if (!notification.is_read) {
      await handleMarkRead(notification.id);
    }
    if (notification.link) {
      navigate(normalizeNotificationLink(notification.link, undefined, notification));
    }
  };

  return (
    <div className={compact ? "cho-notifications mx-auto max-w-6xl space-y-5" : "space-y-5"}>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc,#eff6ff)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="lgu-kicker">Notifications</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Notification Center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {compact ? 'Updates on your requests and submissions.' : 'Review urgent updates, open related pages, and clear items when done.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            {[
              ['Visible', counts.visible],
              ['Unread', counts.unread],
              ['High Priority', counts.high],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
              </div>
            ))}
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={saving || data.unread_count === 0}
              className="lgu-button-primary"
            >
              {saving ? 'Updating...' : 'Mark All Read'}
            </button>
          </div>
        </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition ${statusFilter === option.value ? 'bg-[#0f4b94] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {option.label}
            </button>
          ))}
        </div>


        <div className="mt-6 space-y-6">
          {loading ? (
            <LoadingState title="Loading notifications..." message="Checking your latest notifications and action items." />
          ) : null}

          {!loading && data.notifications.length === 0 ? (
            <div className="lgu-empty-state">
              No notifications match the current filters.
            </div>
          ) : null}

          {!loading && groupedNotifications.unread.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">New Notifications</h2>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{groupedNotifications.unread.length} unread</span>
              </div>
              {groupedNotifications.unread.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  saving={saving}
                  onOpen={handleOpenNotification}
                  onMarkRead={handleMarkRead}
                  onMarkUnread={handleMarkUnread}
                />
              ))}
            </section>
          ) : null}

          {!loading && groupedNotifications.read.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">Seen Notifications</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{groupedNotifications.read.length} seen</span>
              </div>
              {groupedNotifications.read.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  saving={saving}
                  onOpen={handleOpenNotification}
                  onMarkRead={handleMarkRead}
                  onMarkUnread={handleMarkUnread}
                />
              ))}
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default NotificationsPage;
