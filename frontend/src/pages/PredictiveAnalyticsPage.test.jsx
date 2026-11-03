import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PredictiveAnalyticsPage from './PredictiveAnalyticsPage';
import api from '../api';

jest.mock('../api', () => ({ get: jest.fn() }));
jest.mock('../components/PredictionChart', () => function MockChart({ datasets }) {
  return <div data-testid="forecast-chart">{JSON.stringify(datasets)}</div>;
});

test('shows incomplete coverage and constant scenarios without invented historical curves', async () => {
  api.get.mockResolvedValue({ data: {
    summary: { total_barangays: 1, barangays_with_population_basis: 0 },
    chart_series: { labels: ['2026', '2027'], enrollment: [10, 10], capacity_gap: [0, 0], predicted_unenrolled: [null, null], required_cdcs: [null, null] },
    barangay_forecasts: [{ barangay_id: 1, barangay: 'Test barangay', evidence_level: 'not recorded', forecast_points: [{ eligible_children: null, projected_enrollment: 10, capacity: 30, coverage_gap: null }] }],
  } });
  render(<PredictiveAnalyticsPage />);
  expect(await screen.findByText('Test barangay')).toBeInTheDocument();
  expect(screen.getByText('Complete population data to estimate the citywide gap.')).toBeInTheDocument();
  expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
  expect(screen.getByText(/Constant scenarios hold the current count unchanged/)).toBeInTheDocument();
  screen.getAllByTestId('forecast-chart').forEach(chart => expect(chart.textContent).not.toContain('Historical Enrollment'));
});


test('switches chart topics and combines CDC search with risk filtering', async () => {
  api.get.mockResolvedValue({ data: {
    summary: {},
    chart_series: { labels: ['2026', '2030'], enrollment: [20, 30], capacity_gap: [0, 10] },
    cdc_forecasts: [
      { cdc_id: 1, cdc_name: 'North Center', barangay: 'North', risk_level: 'high', history: [{}, {}] },
      { cdc_id: 2, cdc_name: 'South Center', barangay: 'South', risk_level: 'low', history: [] },
    ],
  } });
  render(<PredictiveAnalyticsPage />);
  await screen.findByText('North Center');
  expect(screen.getAllByTestId('forecast-chart')).toHaveLength(1);
  fireEvent.click(screen.getByRole('tab', { name: 'Barangay Demand' }));
  expect(screen.getAllByTestId('forecast-chart')).toHaveLength(2);
  fireEvent.click(screen.getByRole('tab', { name: 'Capacity' }));
  expect(screen.getAllByTestId('forecast-chart')).toHaveLength(1);
  expect(screen.getByText('2 historical records')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filter by risk'), { target: { value: 'high' } });
  expect(screen.queryByText('South Center')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search CDC or barangay'), { target: { value: 'South' } });
  expect(screen.getByText('No CDCs match your search or risk filter.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filter by risk'), { target: { value: 'all' } });
  expect(screen.getByText('South Center')).toBeInTheDocument();
});

test('opens CDC results at viewport level and caps current use without hiding overload', async () => {
  api.get.mockResolvedValue({ data: {
    summary: { high_risk_cdcs: 1 },
    chart_series: { labels: ['2026', '2030'], enrollment: [12, 15.5] },
    cdc_forecasts: [{ cdc_id: 1, cdc_name: 'Overloaded Center', barangay: 'North', risk_level: 'high', current_utilization: 120, effective_capacity: 10, projected_enrollment_final_year: 15.5, history: [] }],
  } });
  render(<PredictiveAnalyticsPage />);
  await screen.findByText('Overloaded Center');
  expect(screen.getByText('100.0%')).toBeInTheDocument();
  expect(screen.getByText('Over capacity')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /CDCs Over Capacity/ }));
  const dialog = screen.getByRole('dialog', { name: 'CDCs Over Capacity' });
  expect(dialog.parentElement).toBe(document.body);
  expect(dialog).toHaveTextContent('Overloaded Center (North)');
  expect(dialog).toHaveTextContent('16 projected / 10 capacity');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
