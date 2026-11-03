import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../api';
import { downloadCdcRecord } from '../utils/cdcRecord';
import OfficialCdcRecord from './OfficialCdcRecord';

jest.mock('../api', () => ({ get: jest.fn() }));
jest.mock('../utils/cdcRecord', () => ({ ...jest.requireActual('../utils/cdcRecord'), downloadCdcRecord: jest.fn() }));

const setup = (entry = '/admin/daycare-centers/7') => render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><OfficialCdcRecord
  cdc={{ id: 7, name: 'Sample CDC', barangay_name: 'Sample Barangay', latitude: 13.5, accreditation_status: 'pending', current_enrollment: 0 }}
  directoryPath="/admin/daycare-centers" workspacePath="/admin/daycare-centers/7/papers" relatedRecords={{ reports: [] }} populationBasis={null}
/></MemoryRouter>);

beforeEach(() => jest.clearAllMocks());

test('shows concise cards and navigates to full section details and back', () => {
  setup();
  expect(screen.getByRole('heading', { name: 'Sample CDC' })).toBeVisible();
  expect(screen.getByText('Pending')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Expand all' })).not.toBeInTheDocument();
  const viewLocation = screen.getByRole('link', { name: 'View all Location' });
  expect(viewLocation).toHaveAttribute('href', '/admin/daycare-centers/7?recordSection=location');
  fireEvent.click(viewLocation);
  expect(screen.getByRole('heading', { name: 'Location' })).toHaveFocus();
  expect(screen.getByText('13.5')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'View all CDC Information' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Back to CDC Overview' }));
  expect(screen.getByRole('link', { name: 'View all Location' })).toBeInTheDocument();
});

test('supports direct section links and preserves other query parameters', () => {
  setup('/admin/daycare-centers/7?source=directory&recordSection=location');
  expect(screen.getByRole('heading', { name: 'Location' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to CDC Overview' })).toHaveAttribute('href', '/admin/daycare-centers/7?source=directory');
});

test('provides a way back from an unknown section', () => {
  setup('/admin/daycare-centers/7?recordSection=unknown');
  expect(screen.getByRole('heading', { name: 'Section not found' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Back to CDC Overview' }));
  expect(screen.getByRole('link', { name: 'View all Location' })).toBeInTheDocument();
});

test('downloads full endpoint data regardless of the selected section', async () => {
  const payload = { cdc: { id: 7 }, records: { reports: ['full history'] } };
  api.get.mockResolvedValue({ data: payload });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Download Complete Record' }));
  await waitFor(() => expect(downloadCdcRecord).toHaveBeenCalledWith(payload));
  expect(api.get).toHaveBeenCalledWith('/cdcs/7/complete-record/');
});

test('shows an error instead of downloading an incomplete record', async () => {
  api.get.mockRejectedValue(new Error('Unavailable'));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Download Complete Record' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be downloaded');
  expect(downloadCdcRecord).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Download Complete Record' })).toBeEnabled();
});
