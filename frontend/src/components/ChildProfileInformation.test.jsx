import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChildProfileInformation from './ChildProfileInformation';
import api from '../api';

jest.mock('../api', () => ({ patch: jest.fn() }));
const child = { id: 7, name: 'Existing Child', first_name: 'Existing', last_name: 'Child', student_id: 'RECORD-7', date_of_birth: '2023-03-15', sex: 'female', current_status: 'enrolled', guardian_name: 'Original Guardian', height: 0, follow_up_notes: 'Keep existing follow-up', can_edit: false };
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  URL.createObjectURL = jest.fn(() => 'blob:preview');
  URL.revokeObjectURL = jest.fn();
});
function mount(record = child, onUpdated = jest.fn()) {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ChildProfileInformation child={record} onUpdated={onUpdated} backTo="/cdw/students?group=female" /></MemoryRouter>);
}
test('shows existing fields and neutral missing data without unauthorized actions', () => {
  mount();
  expect(screen.queryByRole('button', { name: 'Edit Profile' })).toBeNull();
  expect(screen.getByRole('img', { name: 'No child photo available' })).toBeTruthy();
  expect(screen.getByText('Keep existing follow-up')).toBeTruthy();
  expect(screen.getByText('0')).toBeTruthy();
  expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
  expect(within(screen.getByRole('region', { name: 'Child profile summary' })).getByText(/\d+ years, \d+ months?/)).toBeTruthy();
  expect(screen.getByRole('link', { name: /Back to Records/ }).getAttribute('href')).toBe('/cdw/students?group=female');
});
test('sends only changed fields and retains the editor on server validation errors', async () => {
  mount({ ...child, can_edit: true });
  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  fireEvent.change(screen.getByLabelText('Guardian name'), { target: { value: 'Updated Guardian' } });
  api.patch.mockRejectedValue({ response: { data: { guardian_name: ['Invalid guardian.'] } } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })); });
  expect(api.patch).toHaveBeenCalledWith('/children/7/', { guardian_name: 'Updated Guardian' });
  expect(screen.getByRole('alert').textContent).toContain('Invalid guardian.');
  expect(screen.getByRole('dialog')).toBeTruthy();
});
test('uploads a photo with multipart data and renders the saved result through callback', async () => {
  const onUpdated = jest.fn();
  const updated = { ...child, photo: '/media/children/portrait.png' };
  mount({ ...child, can_edit: true }, onUpdated);
  fireEvent.click(screen.getByRole('button', { name: 'Add photo' }));
  const file = new File(['image'], 'portrait.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText(/Child photo/), { target: { files: [file] } });
  api.patch.mockResolvedValue({ data: updated });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })); });
  const body = api.patch.mock.calls[0][1];
  expect(body.get('photo')).toBe(file);
  expect([...body.keys()]).toEqual(['photo']);
  expect(onUpdated).toHaveBeenCalledWith(updated);
  expect(screen.queryByRole('dialog')).toBeNull();
});
