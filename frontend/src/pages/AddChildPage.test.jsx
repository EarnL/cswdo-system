import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AddChildPage from './AddChildPage';
import api from '../api';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
const options = { academic_year: { id: 1, name: '2026-2027', start_date: '2026-06-01', end_date: '2027-05-31' }, cdcs: [{ id: 3, name: 'Assigned CDC', barangay_name: 'Alpha', can_enroll: true }] };
const child = { id: 8, name: 'Existing Child', sex: 'female', date_of_birth: '2023-01-02', computed_age: 3, barangay_name: 'Alpha', guardian_name: 'Original guardian', contact_number: '09123456789', current_status: 'not_enrolled', cdc: null };
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });
async function mount(matches = [child]) {
  api.get.mockImplementation(path => Promise.resolve({ data: path === '/children/enrollment-options/' ? options : { results: matches, has_more: false } }));
  await act(async () => { render(<MemoryRouter initialEntries={['/cdw/students/add']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/cdw/students/add" element={<AddChildPage />} /><Route path="/cdw/students/:childId" element={<p>Existing profile opened</p>} /></Routes></MemoryRouter>); });
}
async function search(name = 'Existing') {
  fireEvent.change(screen.getByRole('combobox', { name: "Child's name" }), { target: { value: name } });
  await act(async () => { jest.advanceTimersByTime(350); });
}
test('selects a CHO identity, requires confirmation, and enrolls by record ID', async () => {
  await mount();
  await search();
  expect(screen.getByRole('listbox')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('combobox', { name: "Child's name" }), { key: 'ArrowDown' });
  fireEvent.keyDown(screen.getByRole('combobox', { name: "Child's name" }), { key: 'Enter' });
  expect(screen.getByLabelText('Parent / guardian').value).toBe('Original guardian');
  expect(screen.getByRole('button', { name: 'Enroll Child' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  api.post.mockResolvedValue({ data: { ...child, cdc: 3, current_status: 'enrolled' } });
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Enroll Child' }).closest('form')); });
  expect(api.post).toHaveBeenCalledWith('/children/enroll/', expect.objectContaining({ child_id: 8, cdc: 3, academic_year: 1 }));
  expect(api.post.mock.calls[0][1].name).toBeUndefined();
  expect(screen.getByText('Existing profile opened')).toBeTruthy();
});
test('already enrolled child exposes existing enrollment and disables duplicate submission', async () => {
  await mount([{ ...child, cdc: 3, cdc_name: 'Assigned CDC', academic_year_name: '2026-2027', current_status: 'enrolled' }]);
  await search();
  fireEvent.click(screen.getByRole('option', { name: /Existing Child/ }));
  expect(screen.getByText(/This child already has an enrollment/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Enroll Child' }).disabled).toBe(true);
  expect(screen.getByRole('link', { name: 'View existing profile' }).getAttribute('href')).toBe('/cdw/students/8');
  expect(api.post).not.toHaveBeenCalled();
});
test('no matches allows manual entry and server duplicate conflicts preserve the entered form', async () => {
  await mount([]);
  await search('New Child');
  expect(screen.getByText(/No matching child found/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Add manually/ }));
  expect(screen.getByLabelText('Full name').value).toBe('New Child');
  fireEvent.change(screen.getByLabelText('Reported age (years)'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Parent / guardian'), { target: { value: 'Guardian' } });
  fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '09123456789' } });
  fireEvent.click(screen.getByRole('checkbox'));
  api.post.mockRejectedValue({ response: { status: 409, data: { error: 'A matching child record already exists.', child_id: 8 } } });
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Enroll Child' }).closest('form')); });
  expect(api.post.mock.calls[0][1]).toEqual(expect.objectContaining({ name: 'New Child', age: 3, cdc: 3 }));
  expect(screen.getByLabelText('Full name').value).toBe('New Child');
  expect(screen.getByRole('alert').textContent).toContain('already exists');
  expect(screen.getByRole('button', { name: 'Enroll Child' }).disabled).toBe(true);
});
test('search failure does not masquerade as no matching records', async () => {
  await mount();
  api.get.mockRejectedValue(new Error('Unavailable'));
  await search();
  expect(screen.getByRole('button', { name: 'Retry search' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Add manually/ })).toBeNull();
});
test('late search responses cannot replace newer matches', async () => {
  await mount();
  let resolveFirst;
  api.get.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
  await search('First');
  api.get.mockResolvedValueOnce({ data: { results: [{ ...child, name: 'Second Child' }], has_more: false } });
  await search('Second');
  await act(async () => { resolveFirst({ data: { results: [{ ...child, name: 'First Child' }], has_more: false } }); });
  expect(screen.getByRole('option', { name: /Second Child/ })).toBeTruthy();
  expect(screen.queryByRole('option', { name: /First Child/ })).toBeNull();
});

test('another center shows status only and offers a confirmed transfer request', async () => {
  await mount([{ id: 8, name: 'Existing Child', computed_age: 3, cdc: 9, cdc_name: 'Other CDC', academic_year_name: '2026-2027', current_status: 'enrolled', can_view_profile: false }]);
  await search();
  expect(screen.getByText('Enrolled at Other CDC')).toBeTruthy();
  fireEvent.click(screen.getByRole('option', { name: /Existing Child/ }));
  expect(screen.queryByRole('link', { name: 'View existing profile' })).toBeNull();
  expect(screen.queryByLabelText('Parent / guardian')).toBeNull();
  expect(screen.getByRole('button', { name: 'Enroll Child' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Request transfer' }));
  api.post.mockResolvedValueOnce({ data: { id: 1, status: 'pending' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send request' })); });
  expect(api.post).toHaveBeenCalledWith('/children/transfers/', { child_id: 8, cdc: 3 });
  expect(screen.getByText(/Transfer requested/)).toBeTruthy();
});
