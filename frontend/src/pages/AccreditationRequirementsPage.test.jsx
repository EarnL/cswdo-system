import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AccreditationRequirementsPage from './AccreditationRequirementsPage';
import api from '../api';

jest.mock('../api', () => ({ get: jest.fn(), put: jest.fn() }));

const workspace = {
  cdc: { id: 4, name: 'New center', barangay: 'Test barangay' },
  completedCount: 0, readiness: 0, complete: false,
  groups: [{ key: 'staff', title: 'Staff readiness', description: 'Prepare your proposed team.', status: 'Not started', done: false }],
  sections: [{ key: 'staff', title: 'Staff readiness', description: 'Prepare your proposed team.',
    fields: [['staff_names', 'Names and roles of proposed staff', 'textarea']], data: {}, filename: '' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: workspace });
  api.put.mockResolvedValue({ data: workspace });
});

function open(path, review = false) {
  render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route path="/requirements/:cdcId/:section?" element={<AccreditationRequirementsPage review={review} />} /></Routes>
  </MemoryRouter>);
}

test('preparation hub links to dedicated forms without an operating grant', async () => {
  open('/requirements/4');
  expect(await screen.findByRole('heading', { name: 'Prepare to open' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Open form/ })).toHaveAttribute('href', '/cdw/accreditation-requirements/4/staff');
  expect(screen.getByText(/You do not need enrolled children/)).toBeInTheDocument();
});

test('saves a partial preparation as multipart data and confirms success', async () => {
  open('/requirements/4/staff');
  fireEvent.change(await screen.findByLabelText('Names and roles of proposed staff'), { target: { value: 'Proposed worker' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save preparation' }));
  expect(await screen.findByText(/Saved. You can return/)).toBeInTheDocument();
  expect(api.put.mock.calls[0][0]).toBe('/cdcs/4/pre-opening/staff/');
  expect(JSON.parse(api.put.mock.calls[0][1].get('data'))).toEqual({ staff_names: 'Proposed worker' });
});

test('save errors keep the entered draft available', async () => {
  api.put.mockRejectedValue({ response: { data: { detail: 'Please try again' } } });
  open('/requirements/4/staff');
  fireEvent.change(await screen.findByLabelText('Names and roles of proposed staff'), { target: { value: 'Draft worker' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save preparation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
  expect(screen.getByLabelText('Names and roles of proposed staff')).toHaveValue('Draft worker');
});

test('reviewers see saved content without edit controls', async () => {
  open('/requirements/4', true);
  await screen.findByRole('heading', { name: 'Prepare to open' });
  expect(screen.getByText('Names and roles of proposed staff')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save preparation' })).not.toBeInTheDocument();
  await waitFor(() => expect(api.put).not.toHaveBeenCalled());
});
