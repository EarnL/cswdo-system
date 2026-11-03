import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CDCPapersWorkspace from './CDCPapersWorkspace';
import api from '../api';

const setup = () => {
  localStorage.setItem('role', 'staff');
  api.get.mockImplementation((url) => Promise.resolve({ data: url.startsWith('/reports/') ? Array.from({ length: 10 }, (_, index) => ({ id: index + 1, cdc: 1, title: `Document ${index + 1}`, report_type: 'training_records', status: index === 9 ? 'approved' : 'under_review' })) : url === '/cdcs/1/' ? { name: 'Test Center', barangay_name: 'Test Barangay' } : [] }));
  render(<MemoryRouter initialEntries={['/staff/daycare-centers/1/papers']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/staff/daycare-centers/:cdcId/papers" element={<CDCPapersWorkspace />} /></Routes></MemoryRouter>);
};

test('all submitted documents remain accessible through pagination and filters', async () => {
  setup();
  await screen.findByRole('heading', { name: 'Submitted documents' });
  expect(screen.getAllByRole('button', { name: 'View details' })).toHaveLength(8);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('heading', { name: 'Document 10' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
  expect(screen.getAllByRole('button', { name: 'View details' })).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Document 10' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search documents'), { target: { value: 'absent' } });
  expect(screen.getByText('No documents match your search.')).toBeInTheDocument();
});

test('category navigation preserves forms and center links without repeating the document list', async () => {
  setup();
  await screen.findByRole('heading', { name: 'Submitted documents' });
  fireEvent.click(screen.getByRole('button', { name: 'Health & Safety' }));
  expect(screen.queryByRole('heading', { name: 'Submitted documents' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Health & Safety Forms' })).toHaveAttribute('href', '/staff/daycare-centers/1/papers/forms#health-safety-form');
  expect(screen.getByRole('link', { name: 'Back to center' })).toHaveAttribute('href', '/staff/daycare-centers/1');
  expect(screen.getByRole('link', { name: 'Open record forms' })).toHaveAttribute('href', '/staff/daycare-centers/1/papers/forms');
});


test('loads current document endpoints and displays compliance details without expanding', async () => {
  setup();
  await screen.findByRole('heading', { name: 'Submitted documents' });
  expect(api.get).toHaveBeenCalledWith('/reports/?cdc=1&include_history=true');
  expect(api.get).toHaveBeenCalledWith('/authority-documents/?cdc=1');
  expect(api.get).toHaveBeenCalledWith('/permit-records/?cdc=1');
  fireEvent.click(screen.getByRole('button', { name: 'Compliance' }));
  expect(screen.getByText('Document Number')).toBeVisible();
  expect(screen.queryByText('What is included?')).not.toBeInTheDocument();
});


test('shows partial failure and retries without hiding the loaded center', async () => {
  setup();
  await screen.findByRole('heading', { name: 'Submitted documents' });
  api.get.mockImplementation((url) => url.startsWith('/reports/') ? Promise.reject(new Error('Unavailable')) : Promise.resolve({ data: url === '/cdcs/2/' ? { name: 'Available Center' } : [] }));
  render(<MemoryRouter initialEntries={['/staff/daycare-centers/2/papers']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/staff/daycare-centers/:cdcId/papers" element={<CDCPapersWorkspace />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load reports');
  expect(screen.getByText(/Available Center/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
});
