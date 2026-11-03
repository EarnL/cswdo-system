import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportsPage from './ReportsPage';
import CdcReportsPage from './CdcReportsPage';
import api from '../api';

test('center list opens a dedicated report page with historical records and review links', async () => {
  localStorage.setItem('role', 'staff');
  const center = { id: 1, name: 'Test CDC', barangay_name: 'Test Barangay' };
  const report = { id: 7, cdc: 1, title: 'Saved quarterly report', status: 'approved', status_label: 'Approved', year: 2025, quarter: 1, submitted_on: '2025-04-01', staff_reviewed_on: '2025-04-02', staff_reviewed_by_name: 'Reviewer', pdf_attachment_url: '/media/report.pdf' };
  api.get.mockImplementation((url) => Promise.resolve({ data: url === '/cdcs/' ? [center, { id: 2, name: 'Empty CDC' }] : url === '/cdcs/1/' ? center : [report] }));
  render(<MemoryRouter initialEntries={['/staff/reports']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/staff/reports" element={<ReportsPage />} /><Route path="/staff/reports/cdc/:cdcId" element={<CdcReportsPage />} /></Routes></MemoryRouter>);
  const centerLink = await screen.findByRole('link', { name: /Test CDC/ });
  expect(screen.queryByText('Saved quarterly report')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Empty CDC/ })).toBeInTheDocument();
  fireEvent.click(centerLink);
  await screen.findByRole('button', { name: 'Report History' });
  expect(api.get).toHaveBeenCalledWith('/reports/', { params: { cdc: '1', include_history: 'true' } });
  expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/staff/reports/cdc/1/forms/7');
  expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute('href', '/media/report.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Report History' }));
  expect(screen.getByText(/Staff review recorded/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Monitoring Reports' })).toHaveAttribute('href', '/staff/reports');
});
