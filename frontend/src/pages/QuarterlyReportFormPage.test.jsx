import React from 'react';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import QuarterlyReportFormPage from './QuarterlyReportFormPage';
import { quarterlyReportDefinitions } from '../data/quarterlyReportDefinitions';
import api from '../api';
configure({ asyncUtilTimeout: 10000 });
jest.setTimeout(30000);
jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('../components/RoleLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/ReportCardsPanel', () => () => null);
beforeEach(() => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === '/cdcs/' ? [{ id: 3, name: 'Assigned CDC', barangay_name: 'Alpha' }] : [] }));
  api.post.mockResolvedValue({ data: { id: 9 } });
});
function mount(type) { render(<MemoryRouter initialEntries={[`/forms/${type}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/forms/:reportType" element={<QuarterlyReportFormPage />} /></Routes></MemoryRouter>); }
test.each(Object.values(quarterlyReportDefinitions))('$heading retains every field in its sections', async definition => {
  mount(definition.id);
  await screen.findAllByText('Assigned CDC');
  await waitFor(() => expect(screen.queryByText('No CDC assigned')).toBeNull());
  expect(screen.queryByText('Unsaved changes')).toBeNull();
  for (let index = 0; index < definition.sections.length; index += 1) {
    for (const field of definition.sections[index].fields) expect(screen.getByLabelText(text => text.replace(/\s/g, '') === `${field.label}Required`.replace(/\s/g, ''))).toBeTruthy();
    if (index < definition.sections.length - 1) fireEvent.click(screen.getByText('Next Section'));
  }
  expect(screen.getByText('Back to Monitoring Reports')).toBeTruthy();
});
test('draft saves the existing payload and failed save retains unsaved status', async () => {
  mount('eccd_checklist');
  await waitFor(() => expect(screen.queryByText('No CDC assigned')).toBeNull());
  fireEvent.change(screen.getByLabelText(/Total Children Assessed/), { target: { value: '12' } });
  api.post.mockRejectedValueOnce(new Error('offline'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  fireEvent.click(screen.getByText('Save Draft'));
  await screen.findByText('Failed to save this draft. Please try again.');
  expect(screen.getByText('Unsaved changes')).toBeTruthy();
  fireEvent.click(screen.getByText('Save Draft'));
  await screen.findByText('Draft saved successfully.');
  expect(api.post).toHaveBeenLastCalledWith('/report-drafts/', expect.objectContaining({ cdc: 3, report_type: 'eccd_checklist', payload: expect.objectContaining({ fields: expect.objectContaining({ total_children_assessed: '12' }) }) }));
  expect(screen.queryByText('Unsaved changes')).toBeNull();
  log.mockRestore();
});
