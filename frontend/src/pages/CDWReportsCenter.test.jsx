import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CDWReportsCenter from './CDWReportsCenter';
import { quarterlyReportCards } from '../data/quarterlyReportDefinitions';
import api from '../api';

jest.mock('../components/RoleLayout', () => ({ children }) => <div>{children}</div>);

test('all report cards remain directly accessible in the original sections', async () => {
  api.get.mockImplementation((url) => Promise.resolve({ data: url === '/reminders/' ? { reminders: [] } : [] }));
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CDWReportsCenter /></MemoryRouter>);
  await waitFor(() => expect(screen.queryAllByText('Loading...')).toHaveLength(0));
  expect(screen.getByRole('link', { name: /Child Development Worker Profile/ })).toHaveAttribute('href', '/cdw/report');
  expect(screen.queryByText('Missing Q1 2026 submissions')).not.toBeInTheDocument();
  for (const card of quarterlyReportCards) {
    expect(screen.getByRole('link', { name: new RegExp(card.heading) })).toHaveAttribute('href', card.route);
  }
  expect(screen.queryByRole('button', { name: 'Profiles & summaries' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Generate report/ })).toHaveAttribute('href', '/cdw/cdc-reports');
});
