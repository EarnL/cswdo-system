import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StudentProfilesPage from './StudentProfilesPage';
import api from '../api';
jest.mock('../api', () => ({ get: jest.fn() }));
jest.mock('./StudentAssessmentResultsPage', () => ({ AssessmentResults: () => null }));
const base = { sex: 'male', barangay: 1, barangay_name: 'Alpha', in_selected_population_basis: true, population_reporting_period: 'Wrong source period', age: 3, current_status: 'not_enrolled' };
const records = [
  { ...base, id: 1, name: 'CHO Only' },
  { ...base, id: 2, name: 'Both Sources', cdc: 7, current_status: 'enrolled', sex: 'female' },
  { ...base, id: 3, name: 'CDC Only', in_selected_population_basis: false, cdc: 7, current_status: 'enrolled' },
  { ...base, id: 4, name: 'Other Center Child', cdc: 8, cdc_name: 'Second CDC', current_status: 'enrolled', can_view_profile: false },
  { ...base, id: 5, name: 'Missing Sex', sex: '', cdc: 7 },
  { ...base, id: 6, name: 'Other Barangay', barangay: 2, barangay_name: 'Beta' },
];
const assignment = { id: 7, name: 'Alpha CDC', barangay: 1, barangay_name: 'Alpha', can_view: true, academic_year: { id: 2, name: '2026-2027', start_date: '2026-06-01' }, basis: { id: 9, title: 'Applied January data', year: '2026-2027' } };
const context = { assignments: [assignment], selected_cdc: 7, years: [{ academic_year: 1, academic_year__name: '2025-2026', academic_year__start_date: '2025-06-01', total: 5, male: 3, female: 1 }] };
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes('record-context') ? context : url.includes('transfers') ? [] : records }));
});
function mount(path = '/') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudentProfilesPage /></MemoryRouter>);
}

test('fixes barangay and reporting period to the assignment and applied basis', async () => {
  mount('/?source=cho&barangay=2&cho_place=2&cho_period=wrong');
  await screen.findByText('CHO Only');
  expect(screen.queryByRole('combobox', { name: 'Barangay' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'CHO reporting period' })).toBeNull();
  expect(screen.getByText('Applied January data')).toBeTruthy();
  expect(screen.getByText('2026-2027')).toBeTruthy();
  expect(screen.queryByText('Wrong source period')).toBeNull();
  expect(screen.queryByText('Other Barangay')).toBeNull();
  expect(within(screen.getByRole('region', { name: 'CHO records' })).getByText('Missing Sex')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Our CDC Records' }));
  await screen.findByText('CDC Only');
  const enrolled = within(screen.getByRole('region', { name: 'CDC enrollment records' }));
  expect(enrolled.getByText('CDC Only')).toBeTruthy();
  expect(enrolled.queryByText('Other Center Child')).toBeNull();
});

test('history starts with year cards, then separates that year by sex and keeps shared records private', async () => {
  mount('/?include_history=true&group=all');
  await screen.findByRole('heading', { name: 'Academic year 2025-2026' });
  expect(screen.queryByText('CHO Only')).toBeNull();
  expect(api.get.mock.calls.some(([url]) => url.startsWith('/children/?'))).toBe(false);
  fireEvent.click(screen.getByRole('link', { name: /Academic year 2025-2026/ }));
  await screen.findByText('CDC Only');
  expect(api.get).toHaveBeenCalledWith('/children/?record_cdc=7&record_scope=cdc&include_history=true&academic_year=1');
  ['Male Children', 'Female Children', 'Sex not recorded'].forEach(name => expect(screen.getByRole('region', { name })).toBeTruthy());
  expect(screen.queryByText('Other Barangay')).toBeNull();
  expect(screen.queryByText('Other Center Child')).toBeNull();
  expect(screen.queryByRole('link', { name: 'View profile for Other Center Child' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: /All academic years/ }));
  await screen.findByRole('heading', { name: 'Child Record History' });
  expect(screen.queryByText('CHO Only')).toBeNull();
});

test('loads every API page while retaining the assigned scope', async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes('record-context') ? context : url.includes('transfers') ? [] : url.includes('page=2') ? { results: records.slice(1), next: null } : { results: records.slice(0, 1), next: '/children/?record_cdc=7&page=2' } }));
  mount();
  await screen.findByText('Missing Sex');
  expect(api.get).toHaveBeenCalledWith('/children/?record_cdc=7&page=2');
  expect(screen.queryByText('Other Barangay')).toBeNull();
});

test('assigned CDC is fixed with no center switcher', async () => {
  mount();
  await screen.findByText('CDC Only');
  expect(screen.queryByRole('combobox', { name: 'Viewing CDC' })).toBeNull();
});

test('unavailable years never expose records', async () => {
  mount('/?include_history=true&academic_year=999');
  await screen.findByRole('alert');
  expect(screen.queryByText('CHO Only')).toBeNull();
  expect(api.get.mock.calls.some(([url]) => url.startsWith('/children/?'))).toBe(false);
});

test('fixed labels remain visible with an empty roster', async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes('record-context') ? context : [] }));
  mount();
  await screen.findByText('Applied January data');
  expect(screen.getByText('2026-2027')).toBeTruthy();
});
