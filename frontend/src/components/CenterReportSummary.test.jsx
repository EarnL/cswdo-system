import React from 'react';
import { render, screen } from '@testing-library/react';
import CenterReportSummary from './CenterReportSummary';

test('missing values remain distinct from zero and no bar is shown for an unknown indicator', () => {
  render(<CenterReportSummary payload={{ summary_version: 2, period: { label: 'February 2024' }, key_figures: [{ label: 'Health records', value: 0, context: 'February 2024' }, { label: 'Population', value: null, context: 'No source' }], charts: [{ label: 'Coverage', value: null }], template_sections: [] }} />);
  expect(screen.getByText('0')).toBeInTheDocument();
  expect(screen.getAllByText('Not recorded')).toHaveLength(2);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

test('saved narrative and tables remain available in the historical adapter', () => {
  render(<CenterReportSummary payload={{ template_sections: [{ title: 'Saved section', autoText: 'Original generated text', notes: 'Saved observation', table: [['Existing field', 'Existing value']] }] }} />);
  expect(screen.getByText('Saved observation')).toBeInTheDocument();
  expect(screen.getByText('Existing value')).toBeInTheDocument();
  expect(screen.getByText(/Historical report:/)).toBeInTheDocument();
});

test('CDW notes are separate from system findings and evidence remains accessible', () => {
  render(<CenterReportSummary payload={{ summary_version: 2, template_sections: [{ title: 'Report Overview', autoText: 'Saved findings' }], cdw_notes: [{ label: 'Learning programs', text: 'Staff observation' }], evidence: { supporting_file: '/media/evidence.pdf' } }} />);
  expect(screen.getByText('Saved findings')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'CDW Observations' })).toBeInTheDocument();
  expect(screen.getByText('Staff observation')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open saved evidence' })).toHaveAttribute('href', '/media/evidence.pdf');
});
