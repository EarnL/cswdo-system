import React from 'react';
import { act, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../api';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import NotificationsPage from '../pages/NotificationsPage';
import { NotificationProvider } from './NotificationContext';

configure({ asyncUtilTimeout: 10000 });

const notification = { id: 1, title: 'New report', message: 'Ready for review', is_read: false, category: 'report', priority: 'low', is_active: true, created_at: '2026-09-27T00:00:00Z' };
const navItems = [{ section: 'Main', label: 'Notifications', href: '/staff/notifications', icon: 'bell' }];

beforeEach(() => {
  jest.clearAllMocks();
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
});

async function setup({ count = 1, collapsed = false, page = false, enabled = true } = {}) {
  let unread = count;
  api.get.mockImplementation(() => Promise.resolve({ data: { unread_count: unread, notifications: [{ ...notification, is_read: unread === 0 }], total: 1 } }));
  api.post.mockImplementation((url) => {
    unread = url.endsWith('/mark-unread/') ? 1 : 0;
    return Promise.resolve({ data: {} });
  });
  await act(async () => { render(<MemoryRouter initialEntries={['/staff/notifications']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <NotificationProvider enabled={enabled}>
      <Sidebar navItems={navItems} collapsed={collapsed} />
      <NotificationBell />
      {page && <NotificationsPage />}
    </NotificationProvider>
  </MemoryRouter>); });
}

test('shows the shared unread count and clears it when read through the bell', async () => {
  await setup();
  expect(await screen.findByLabelText('1 unread notifications')).toHaveTextContent('1');
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  fireEvent.click(await screen.findByRole('button', { name: /New report/ }));
  await waitFor(() => expect(screen.queryByLabelText('1 unread notifications')).not.toBeInTheDocument());
  expect(within(screen.getByRole('button', { name: 'Notifications' })).queryByText('1')).not.toBeInTheDocument();
});

test('shows a compact badge with the full accessible count when collapsed', async () => {
  await setup({ count: 120, collapsed: true });
  expect(await screen.findByLabelText('120 unread notifications')).toHaveTextContent('99+');
});

test('refreshes the navigation badge after read, unread, and mark-all actions on the page', async () => {
  await setup({ page: true });
  await screen.findByLabelText('1 unread notifications');
  fireEvent.click(await screen.findByRole('button', { name: 'Mark Seen', exact: true }));
  await waitFor(() => expect(screen.queryByLabelText('1 unread notifications')).not.toBeInTheDocument());
  fireEvent.click(await screen.findByRole('button', { name: 'Mark Unread', exact: true }));
  await screen.findByLabelText('1 unread notifications');
  fireEvent.click(screen.getByRole('button', { name: /mark all/i }));
  await waitFor(() => expect(screen.queryByLabelText('1 unread notifications')).not.toBeInTheDocument());
});

test('does not request notifications for roles without notification access', async () => {
  await setup({ enabled: false });
  expect(api.get).not.toHaveBeenCalled();
});
