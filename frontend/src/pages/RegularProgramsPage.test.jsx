import React from 'react';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RegularProgramsPage from './RegularProgramsPage';
import api from '../api';
jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../components/RoleLayout', () => ({ children }) => <div>{children}</div>);
configure({ asyncUtilTimeout: 10000 });
jest.setTimeout(30000);
const program = { id: 4, title: 'Existing Feeding Program', cdc_name: 'Assigned CDC', status: 'active', start_date: '2026-10-01', target_beneficiaries: 20, schedule_type: 'daily', schedule_days_display: ['Monday'], feeding_days: [], metrics: {} };
beforeEach(() => {
  localStorage.setItem('role', 'cdw');
  api.get.mockImplementation(url => Promise.resolve({ data: url.startsWith('/cdcs/') ? [{ id: 1, name: 'Assigned CDC' }] : url === '/feeding-programs/' ? [program] : url.includes('monitoring_summary') ? { summary: {}, programs: [program], watchlist: [] } : [] }));
});
function mount(path = '/cdw/regular-programs') { render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/cdw/regular-programs" element={<RegularProgramsPage />} /><Route path="/cdw/regular-programs/:programSection" element={<RegularProgramsPage />} /></Routes></MemoryRouter>); }
test('landing shows real previews and clear links without placing forms on the main page', async () => {
  mount();
  await screen.findByText('Existing Feeding Program');
  expect(screen.getByText('1 programs')).toBeTruthy();
  expect(screen.getAllByText('No records yet.')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: 'New Feeding Program' })).toBeNull();
  expect(screen.getByRole('link', { name: 'View Details: Feeding Program' }).getAttribute('href')).toBe('/cdw/regular-programs/feeding');
  fireEvent.click(screen.getByRole('link', { name: 'View Details: Feeding Program' }));
  expect(screen.getByRole('link', { name: 'New Feeding Program' })).toBeTruthy();
  expect(screen.queryByText('Feeding Program Tracker')).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'New Feeding Program' }));
  expect(screen.getByText('Create Feeding Program')).toBeTruthy();
  fireEvent.click(screen.getByText(/Back to Regular Programs/));
  expect(screen.getByRole('link', { name: 'View Details: Health Checkups' })).toBeTruthy();
});
test.each([['seminars', 'Parent Seminar Record'], ['health', 'Health Check-ups'], ['records', 'Program Logbook']])('%s page opens directly with existing content', async (section, title) => {
  mount(`/cdw/regular-programs/${section}${section === 'records' ? '' : '?view=new'}`);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/cdcs/?assigned_to_me=true'));
  expect(screen.getByText(title)).toBeTruthy();
  expect(screen.getByText(/Back to Regular Programs/)).toBeTruthy();
});
test('existing tab links and feeding notifications still open their intended page', async () => {
  mount('/cdw/regular-programs?tab=feeding&notification_focus=feeding_missed');
  await screen.findByRole('button', { name: 'New Feeding Program' });
  expect(screen.getByRole('navigation', { name: 'Program pages' })).toBeTruthy();
});

test.each([['seminars', 'Record Seminar', 'Parent Seminar Record'], ['health', 'Record Checkup', 'Health Check-ups']])('%s starts with records and opens a focused form', async (section, action, formHeading) => {
  mount(`/cdw/regular-programs/${section}`);
  await screen.findByText('No records yet');
  expect(screen.queryByText(formHeading)).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: action }));
  expect(screen.getByText(formHeading)).toBeTruthy();
});
test('feeding record opens its own tracker without displaying the creation form', async () => {
  mount('/cdw/regular-programs/feeding');
  fireEvent.click(await screen.findByRole('link', { name: 'Open Tracker' }));
  expect(screen.getByText('Feeding Program Tracker')).toBeTruthy();
  expect(screen.queryByText('Create Feeding Program')).toBeNull();
  expect(screen.getByText(/Program Details & Alerts/)).toBeTruthy();
});
