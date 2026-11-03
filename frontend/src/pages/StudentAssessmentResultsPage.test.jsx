import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import StudentAssessmentResultsPage, { AssessmentResults } from './StudentAssessmentResultsPage';
import api from '../api';

jest.mock('../api', () => ({ get: jest.fn() }));
const first = { id: 7, assessment_type: 'first', result_label: 'Needs monitoring', status: 'submitted', status_label: 'Submitted', assessment_date: '2026-10-01' };
const child = { id: 1, name: 'Sample Child', enrollment_match_status: { value: 'enrolled' }, latest_special_needs_assessment: first, assessment_history: [first] };

test('keeps results visible until the follow-up assessment button is clicked', () => {
  render(<MemoryRouter><Routes><Route path="/" element={<AssessmentResults child={child} />} /><Route path="/cdw/special-needs" element={<p>Assessment form destination</p>} /></Routes></MemoryRouter>);
  expect(screen.getByText('Latest recorded result')).toBeTruthy();
  expect(screen.queryByText('Assessment form destination')).toBeNull();
  const action = screen.getByRole('link', { name: /Begin second assessment/ });
  expect(action.getAttribute('href')).toBe('/cdw/special-needs?child=1');
  fireEvent.click(action);
  expect(screen.getByText('Assessment form destination')).toBeTruthy();
});

test('offers the third assessment after the first two have been submitted', () => {
  render(<MemoryRouter><AssessmentResults child={{ ...child, assessment_history: [first, { ...first, id: 8, assessment_type: 'second' }] }} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: /Begin third assessment/ })).toBeTruthy();
});

test('opens the selected child results from the records directory without opening the assessment form', async () => {
  api.get.mockImplementation(async (path) => ({ data: path === '/children/1/' ? child : [child] }));
  render(<MemoryRouter initialEntries={['/cdw/students/assessment-results']}><Routes>
    <Route path="/cdw/students/assessment-results" element={<StudentAssessmentResultsPage />} />
    <Route path="/cdw/students/:childId/assessment-results" element={<StudentAssessmentResultsPage />} />
    <Route path="/cdw/special-needs" element={<p>Assessment form destination</p>} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('link', { name: /View results/ }));
  await screen.findByText('Latest recorded result');
  expect(screen.getByRole('heading', { name: 'Sample Child' })).toBeTruthy();
  expect(screen.queryByText('Assessment form destination')).toBeNull();
});
