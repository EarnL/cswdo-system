import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ServiceGapAnalyticsPage from './ServiceGapAnalyticsPage';
import api from '../api';
jest.mock('../api', () => ({ get: jest.fn() }));
jest.mock('react-chartjs-2', () => ({ Bar: () => <div />, Doughnut: () => <div /> }));
test('uses shared age-specific coverage, includes no-CDC barangays and hides planning follow-up', async () => {
  localStorage.setItem('role', 'planning');
  api.get.mockImplementation(url => Promise.resolve({ data: url === '/public-map/' ? [
    { academic_year: { name: '2026-2027' }, barangay: {id: 1, name: 'North'}, population: {has_current_basis: true, source: {}}, public_cdc: {centers: 0, enrollment_3_4: 4, capacity: 0, gap_3_4: 6, coverage_rate_3_4: 40}, service_signal: {need_score: 60, need_level: 'elevated'} },
    { academic_year: { name: '2026-2027' }, barangay: {id: 2, name: 'South'}, population: {has_current_basis: false}, public_cdc: {centers: 0, enrollment_3_4: 0, capacity: 0, gap_3_4: null, coverage_rate_3_4: null}, service_signal: {need_score: null, need_level: 'no_data'} },
  ] : [] }));
  render(<ServiceGapAnalyticsPage />);
  await screen.findByText('Academic year: 2026-2027');
  expect(api.get).not.toHaveBeenCalledWith('/children/', expect.anything());
  expect(screen.queryByRole('button', { name: /^Follow-up/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Barangays/ }));
  expect(screen.getByText('40%')).toBeInTheDocument();
  expect(screen.getAllByText('No data').length).toBeGreaterThan(0);
  expect(screen.getAllByText('No CDC')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: /^Priority Barangays/ }));
  expect(screen.getByRole('dialog')).toHaveTextContent('North: 6 coverage gap');
  localStorage.clear();
});
