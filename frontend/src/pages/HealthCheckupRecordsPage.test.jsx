import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import HealthCheckupRecordsPage from './HealthCheckupRecordsPage';
import api from '../api';

jest.mock('../api', () => ({ get: jest.fn() }));
const student = { id: 1, name: 'Enrolled Student', enrollment_match_status: { value: 'enrolled' }, allergies: 'Peanuts' };
function mount(path = '/cdw/students/health-records') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/cdw/students/health-records" element={<HealthCheckupRecordsPage />} />
    <Route path="/cdw/students/:childId/health-records" element={<HealthCheckupRecordsPage />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => jest.clearAllMocks());

test('selects only enrolled students and shows their complete paginated history', async () => {
  api.get.mockImplementation(async (path) => ({ data: path === '/children/' ? [student, { id: 2, name: 'Not Enrolled' }] : path === '/child-health-records/' ? {
    results: [{ id: 1, child: 1, screening_date: '2026-10-01', health_findings: 'First finding' }, { id: 3, child: 2, health_findings: 'Other student finding' }], next: '/child-health-records/?page=2',
  } : { results: [{ id: 2, child: 1, screening_date: '2026-09-01', health_findings: 'Older finding' }], next: null } }));
  mount();
  await screen.findByText('Enrolled students (1)');
  expect(screen.queryByText('Not Enrolled')).toBeNull();
  fireEvent.change(screen.getByLabelText('Enrolled student'), { target: { value: '1' } });
  await screen.findByText('Check-up history (2)');
  expect(screen.getByText('Peanuts')).toBeTruthy();
  expect(screen.getByText('First finding')).toBeTruthy();
  expect(screen.getByText('Older finding')).toBeTruthy();
  expect(screen.queryByText('Other student finding')).toBeNull();
});

test('shows an empty history without implying a healthy result', async () => {
  api.get.mockImplementation(async (path) => ({ data: path === '/children/' ? [student] : [] }));
  mount('/cdw/students/1/health-records');
  await screen.findByText('No health check-ups have been recorded for this student.');
});

test('supports retry after a failed load', async () => {
  api.get.mockRejectedValue(new Error('Offline'));
  mount();
  await screen.findByRole('alert');
  api.get.mockResolvedValue({ data: [] });
  fireEvent.click(screen.getByText('Try again'));
  await screen.findByText('No enrolled students are available.');
});
