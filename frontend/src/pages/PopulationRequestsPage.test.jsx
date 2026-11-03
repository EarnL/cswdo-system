import React from 'react';
import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PopulationRequestsPage from './PopulationRequestsPage';
import api from '../api';

configure({ asyncUtilTimeout: 10000 });
const item = { id: 4, title: 'Quarterly child population', purpose: 'Update coverage planning.', instructions: 'Include all barangays.', coverage: 'Children aged 0-5', period_start: '2026-01-01', period_end: '2026-03-31', due_date: '2026-04-15', assigned_to_name: 'CHO Officer', created_by_name: 'CSWDO', academic_year_name: '2025-2026', created_at: '2026-04-01', status: 'awaiting_submission', deadline_status: 'overdue', submission: null };
async function setup(role = 'cho', data = item, path = '/cho/data-requests/4') {
  api.get.mockImplementation((url) => Promise.resolve({ data: url === '/population-requests/' ? [data] : [] }));
  await act(async () => { render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/:role/data-requests/:requestId" element={<PopulationRequestsPage role={role} />} /><Route path="/:role" element={<PopulationRequestsPage role={role} mode="dashboard" />} /></Routes></MemoryRouter>); });
}
beforeEach(() => jest.clearAllMocks());

test('CHO sees the reporting period, deadline, and separate progress and urgency labels', async () => {
  await setup();
  expect(screen.getByText('Awaiting submission')).toBeInTheDocument();
  expect(screen.getByText('Overdue')).toBeInTheDocument();
  expect(screen.getByText('Reporting period')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send to City Planning' })).toBeDisabled();
});

test('CHO must pass file preview before sending a response linked to the request', async () => {
  await setup();
  api.post.mockImplementation((url) => {
    if (url.includes('preview_upload')) return Promise.resolve({ data: { valid: true, row_count: 1, missing_required_columns: [], detected_columns: ['child_full_name'], preview_rows: [{ child_full_name: 'Ana' }] } });
    api.get.mockResolvedValue({ data: [{ ...item, status: 'under_review', deadline_status: null, submission: { id: 12, history: [] } }] });
    return Promise.resolve({ data: {} });
  });
  const file = new File(['child_full_name\nAna'], 'population.csv', { type: 'text/csv' });
  await act(async () => { fireEvent.change(screen.getByLabelText(/CSV or Excel file/), { target: { files: [file] } }); });
  expect(screen.getByRole('button', { name: 'Send to City Planning' })).toBeEnabled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send to City Planning' })); });
  expect(api.post).toHaveBeenCalledWith('/population-requests/4/submit/', expect.any(FormData));
  expect(screen.getByText('Your file was sent to City Planning for review.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Send to City Planning' })).not.toBeInTheDocument();
  expect(screen.getByText('Under review')).toBeInTheDocument();
});

test('planning can start review and cannot approve until review has started', async () => {
  await setup('planning', { ...item, status: 'under_review', deadline_status: null, submission: { id: 12, status: 'submitted', history: [] } }, '/planning/data-requests/4');
  expect(screen.queryByRole('button', { name: 'Approve & send to CSWDO' })).not.toBeInTheDocument();
  api.post.mockResolvedValue({ data: {} });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start review' })); });
  expect(api.post).toHaveBeenCalledWith('/population-data/12/mark_received/', {});
});

test('CHO dashboard puts correction requests in the attention section', async () => {
  await setup('cho', { ...item, status: 'needs_revision', deadline_status: 'due_soon' }, '/cho');
  expect(screen.getByRole('heading', { name: 'Needs your attention' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByRole('link', { name: /Quarterly child population/ })).toHaveLength(2));
});

test('CHO status cards separate new submissions from corrections and filter the request list', async () => {
  api.get.mockResolvedValue({ data: [item, { ...item, id: 5, title: 'Corrected population file', status: 'needs_revision' }] });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PopulationRequestsPage role="cho" mode="dashboard" /></MemoryRouter>);
  const awaiting = await screen.findByRole('button', { name: /Awaiting submission 1 View requests/ });
  expect(screen.getByRole('button', { name: /Needs correction 1 View requests/ })).toBeInTheDocument();
  fireEvent.click(awaiting);
  expect(awaiting).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('1 results')).toBeInTheDocument();
  fireEvent.click(awaiting);
  expect(screen.getByText('2 results')).toBeInTheDocument();
});


test('CSWDO sends requests to the CHO office without choosing an account', async () => {
  await setup('admin', item, '/admin');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /New data request/i })); });
  expect(screen.getByText('City Health Office (CHO)')).toBeInTheDocument();
  expect(screen.queryByText('Choose a CHO user')).not.toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalledWith('/population-requests/recipients/');
  expect(screen.getByRole('button', { name: 'Send request to CHO' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Request frequency'), { target: { value: 'recurring' } });
  expect(screen.getByText('City Health Office (CHO)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create schedule' })).toBeEnabled();
});
