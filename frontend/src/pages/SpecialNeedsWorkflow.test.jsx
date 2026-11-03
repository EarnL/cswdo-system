import React from 'react';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import api from '../api';
import SpecialNeedsAssessmentPage from './SpecialNeedsAssessmentPage';
import SpecialNeedsSummaryPage from './SpecialNeedsSummaryPage';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
configure({ asyncUtilTimeout: 15000 });
jest.setTimeout(40000);
const child = { id: 1, name: 'Saved Child', current_status: 'enrolled', cdc: 2, cdc_name: 'Assigned Center', assigned_cdw_name: 'Assigned Worker' };
const assessment = { id: 7, child: 1, child_name: 'Saved Child', cdc: 2, cdc_name: 'Assigned Center', assessment_type: 'first', assessment_date: '2026-10-01', status: 'draft', result: 'needs_monitoring', child_profile: {}, checklist: {}, domain_scores: {} };
function open(path, component = <SpecialNeedsAssessmentPage />) {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
    <Route path="/cdw/special-needs" element={component} />
    <Route path="/cdw/special-needs/new" element={component} />
    <Route path="/cdw/special-needs/:assessmentId" element={component} />
    <Route path="/cdw/reports/special-needs-summary" element={component} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('role', 'cdw');
  api.get.mockImplementation(url => {
    if (url.startsWith('/children/')) return Promise.resolve({ data: [child] });
    if (url === '/special-needs-assessments/') return Promise.resolve({ data: [assessment] });
    if (url === '/special-needs-assessments/7/') return Promise.resolve({ data: assessment });
    if (url === '/cdcs/') return Promise.resolve({ data: [{ id: 2, name: 'Assigned Center' }] });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
});
test('landing page lists saved assessments and links to dedicated pages', async () => {
  open('/cdw/special-needs');
  expect(await screen.findByRole('link', { name: 'View Assessment' })).toHaveAttribute('href', '/cdw/special-needs/7');
  expect(screen.getByRole('link', { name: 'New Assessment' })).toHaveAttribute('href', '/cdw/special-needs/new');
  expect(screen.queryByText('Submit Summary to CSWDO Staff')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument();
});
test('new form prefills examiner and CDC and blocks incomplete submission', async () => {
  open('/cdw/special-needs/new');
  expect(await screen.findByLabelText('Examiner / CDW Name')).toHaveValue('Assigned Worker');
  expect(screen.getByLabelText('Place Where Test is Administered')).toHaveValue('Assigned Center');
  expect(screen.getByRole('button', { name: 'Domain Results' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Submit Completed Assessment' }));
  expect(await screen.findByText(/Answer the remaining 109 checklist items/)).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
test('saved assessment opens read-only with an explicit edit action', async () => {
  open('/cdw/special-needs/7');
  const input = await screen.findByLabelText('Examiner / CDW Name');
  expect(input).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Assessment' }));
  expect(input).not.toBeDisabled();
});
test('summary reviews server-selected records before submitting the same snapshot', async () => {
  const defaultGet = api.get.getMockImplementation();
  const preview = { cdc_name: 'Assigned Center', quarter: 4, year: 2026, counts: { no_concern: 1 }, fingerprint: 'saved-snapshot', selection_rule: 'Latest complete assessment per child.', incomplete_count: 1,
    children: [{ assessment_id: 7, name: 'Saved Child', assessment_date: '2026-10-01', result: 'Average development' }],
    excluded: [{ assessment_id: 8, name: 'Incomplete Child', reason: 'Incomplete checklist', answered: 3, total: 109 }] };
  api.get.mockImplementation(url => url.includes('summary-preview') ? Promise.resolve({ data: preview }) : defaultGet(url));
  api.post.mockResolvedValue({ data: { report: 42 } });
  open('/cdw/reports/special-needs-summary', <SpecialNeedsSummaryPage />);
  await screen.findByText('Assigned Center');
  expect(screen.queryByRole('button', { name: 'Submit Report' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Generate Preview' }));
  await screen.findByText('Incomplete Child');
  fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/special-needs-assessments/submit-summary/', expect.objectContaining({ cdc: '2', fingerprint: 'saved-snapshot' })));
  expect(await screen.findByRole('link', { name: 'View submitted report' })).toHaveAttribute('href', '/cdw/reports/submissions/42');
});
