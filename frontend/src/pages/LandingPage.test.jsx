import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../api';
import LandingPage from './LandingPage';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn() } }));

it('shows the published period, public CDC locations and missing-data wording', async () => {
  api.get.mockResolvedValue({ data: [{
    barangay: { id: 1, name: 'Cotta' },
    population: { has_current_basis: true, children_3_4: 25, total_population: 100,
      source: { id: 7, period_start: '2026-01-01', period_end: '2026-03-31', received_by_cswdo_on: '2026-04-10T00:00:00Z' } },
    public_cdc: { centers: 1, capacity: 30, enrollment_3_4: 5, gap_3_4: 20, coverage_rate_3_4: 20,
      locations: [{ id: 1, name: 'Public Test CDC', lat: 13.93, lng: 121.61, capacity: 30 }] },
    service_signal: { need_score: 80 },
  }] });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><LandingPage /></MemoryRouter>);
  expect(await screen.findAllByText('Public Test CDC')).not.toHaveLength(0);
  expect(screen.getAllByText('Children Aged 3-4').length).toBeGreaterThan(0);
  expect(screen.queryByText('Children Aged 2-5')).not.toBeInTheDocument();
  const basis = screen.getByLabelText('Population data basis');
  expect(within(basis).getByText(/Jan 1, 2026/)).toBeInTheDocument();
  const select = screen.getByRole('combobox', { name: 'Find your barangay' });
  const missing = within(select).getAllByRole('option').find(option => option.textContent !== 'Cotta');
  fireEvent.change(select, { target: { value: missing.value } });
  expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
});
