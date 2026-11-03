import React from 'react';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportFormReviewPage from './ReportFormReviewPage';
import CDCPeriodicReportsPage from './CDCPeriodicReportsPage';
import CDWReportForm from './CDWReportForm';
import CDCProfileForm from './CDCProfileForm';
import api from '../api';
configure({ asyncUtilTimeout: 10000 });
jest.setTimeout(30000);
jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('../components/RoleLayout', () => ({ children }) => <div>{children}</div>);
const centerPreview = { summary_version: 2, period: { label: '2026' }, report_header: { center: 'Center Alpha' }, key_figures: [], template_sections: [], charts: [] };
const report = { id: 8, report_type: 'form6', cdc: 3, cdc_name: 'Center Alpha', title: 'Saved worker profile', status: 'submitted', payload: { formData: { firstName: 'Saved Name' }, trainings: [{ title: 'Saved Training', hours: 8 }] }, pdf_attachment_url: '/saved.pdf', review_remarks: 'Saved remarks' };
beforeEach(() => { localStorage.setItem('role', 'cdw'); api.get.mockImplementation(url => Promise.resolve({ data: url === '/reports/center-summary-preview/' ? centerPreview : url.startsWith('/reports/8') ? report : url === '/cdcs/' ? [{ id: 3, name: 'Center Alpha' }] : [] })); });
afterEach(() => jest.restoreAllMocks());
function mount(page, path, route) { render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path={route} element={page} /><Route path="/cdw/reports" element={<p>Monitoring hub</p>} /></Routes></MemoryRouter>); }
test('CDW detail preserves saved profile values, trainings, remarks and downloads without review permissions', async () => {
  mount(<ReportFormReviewPage />, '/cdw/reports/submissions/8', '/cdw/reports/submissions/:reportId');
  await screen.findByText('Saved Name');
  expect(screen.getByText('Saved Training')).toBeTruthy();
  expect(screen.getByText('Saved remarks')).toBeTruthy();
  expect(screen.getByText('Download PDF').getAttribute('href')).toBe('/saved.pdf');
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  expect(screen.getByText('Back to Monitoring Reports').getAttribute('href')).toBe('/cdw/reports');
});
test('staff retains existing review actions and comment validation', async () => {
  localStorage.setItem('role', 'staff');
  mount(<ReportFormReviewPage />, '/staff/reports/cdc/3/forms/8', '/staff/reports/cdc/:cdcId/forms/:reportId');
  await screen.findByText('Saved Name');
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
  expect(screen.getByText('Please add a short comment before returning or rejecting this form.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
});
test.each(['monthly', 'quarterly', 'annual'])('CDC %s report has a dedicated page with existing actions', async mode => {
  mount(<CDCPeriodicReportsPage />, `/cdw/cdc-reports/${mode}`, '/cdw/cdc-reports/:reportMode');
  await screen.findByText('Back to Monitoring Reports');
  expect(screen.getAllByText(mode === 'annual' ? 'CDC Report Summary' : `Automated CDC ${mode === 'monthly' ? 'Monthly' : 'Quarterly'} Report`).length).toBeGreaterThan(0);
});
test.each(['monthly', 'quarterly'])('CDC %s editor protects unsaved narratives', async mode => {
    mount(<CDCPeriodicReportsPage />, `/cdw/cdc-reports/${mode}`, '/cdw/cdc-reports/:reportMode');
    await screen.findByText('Back to Monitoring Reports');
    expect(screen.getByLabelText('Executive Summary')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Executive Summary'), { target: { value: 'Unsaved narrative' } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByText('Back to Monitoring Reports'));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText('Executive Summary').value).toBe('Unsaved narrative');
});
test.each([['Child Development Worker Profile', CDWReportForm], ['Child Development Center Profile', CDCProfileForm]])('%s preserves profile form initialization without false unsaved warnings', async (title, Page) => {
  mount(<Page />, '/form', '/form');
  expect(screen.getByText(title)).toBeTruthy();
  await waitFor(() => expect(screen.getAllByDisplayValue('Center Alpha').length).toBeGreaterThan(0));
  await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
  expect(screen.getByText('Back to Monitoring Reports')).toBeTruthy();
});

test('CDW generates for the assigned CDC without a selector or restricted heatmap request', async () => {
  api.get.mockImplementation(url => url === '/heatmap/' ? Promise.reject({ response: { status: 403 } }) : Promise.resolve({ data: url === '/reports/center-summary-preview/' ? centerPreview : url === '/cdcs/' ? [{ id: 3, name: 'Center Alpha', barangay_name: 'Alpha' }] : [] }));
  api.get.mockClear();
  api.post.mockResolvedValue({ data: { id: 8 } });
  mount(<CDCPeriodicReportsPage />, '/cdw/cdc-reports/annual', '/cdw/cdc-reports/:reportMode');
  await screen.findByText('Back to Monitoring Reports');
  expect(screen.queryByRole('combobox', { name: 'Assigned CDC' })).toBeNull();
  expect(api.get).toHaveBeenCalledWith('/cdcs/', { params: { assigned_to_me: 'true' } });
  expect(api.get).not.toHaveBeenCalledWith('/heatmap/');
  await waitFor(() => expect(screen.queryByText('Preparing report preview...')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Generate CDC Report/i }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reports/generate-cdc-annual/', expect.objectContaining({ cdc: 3 })));
  await screen.findByText('CDC annual report generated. CSWDO staff can open it here and download the PDF.');
});
