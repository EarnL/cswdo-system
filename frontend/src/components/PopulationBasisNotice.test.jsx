import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PopulationBasisNotice from './PopulationBasisNotice';
import api from '../api';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
const oldBasis = { id: 1, title: 'January data', year: '2026–2027', population: 80, academic_year: 1 };
const available = { id: 2, title: 'October data', year: '2026–2027', population: 92, approved_by: 'Admin Reyes', approved_at: '2026-10-30T02:00:00Z' };
const data = { current: oldBasis, working_year: '2026–2027', history: [], updates: [{ current: oldBasis, available, is_applied: false, new_year: false, added: 14, needs_review: 2, review_children: [{ id: 5, name: 'Ana Cruz' }] }] };
beforeEach(() => {
  jest.clearAllMocks(); api.get.mockResolvedValue({ data });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
const mount = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PopulationBasisNotice cdcId={4} /></MemoryRouter>);
test('keeps update unapplied until explicit review and apply', async () => {
  api.post.mockResolvedValue({ data: { ...data, updates: [] } });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Review update' }));
  expect(screen.getByText('92')).toBeInTheDocument();
  expect(screen.getByText(/Approved by Admin Reyes/)).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Later' }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Review update' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply update' }));
  await screen.findByText('Update applied. All child records are retained.');
  expect(api.post).toHaveBeenCalledWith('/cdcs/4/population-basis/', { submission: 2 });
});
test('shows failed apply without pretending it succeeded', async () => {
  api.post.mockRejectedValue({ response: { data: ['A newer update is available.'] } });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Review update' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply update' })); });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('A newer update is available.'), { timeout: 10000 });
  expect(screen.getByRole('button', { name: 'Apply update' })).toBeEnabled();
});
test('new academic year uses distinct wording and preserves previous-year records', async () => {
  api.get.mockResolvedValue({ data: { ...data, updates: [{ ...data.updates[0], new_year: true }] } });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Review update' }));
  expect(screen.getByRole('button', { name: 'Open academic year' })).toBeInTheDocument();
  expect(screen.getByText(/Previous-year records stay in history/)).toBeInTheDocument();
});

test('applied card has no dropdown and links to the year-first history', async () => {
  api.get.mockResolvedValue({ data: { ...data, updates: [] } });
  const { container } = mount();
  await screen.findByText('Population Data');
  expect(screen.getByText('January data')).toBeInTheDocument();
  expect(container.querySelector('details')).toBeNull();
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.getByText('Up to date')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /View Dataset History/ }));
  expect(screen.getByRole('dialog', { name: 'Dataset History' })).toBeInTheDocument();
});

test('previous dataset is the last applied dataset, not the pending update', async () => {
  const previous = { id: 8, title: 'Previous applied data', year: '2025-2026' };
  api.get.mockResolvedValue({ data: { ...data, history: [
    { id: 2, basis: oldBasis, applied_by: 'CDW', applied_at: '2026-06-01' },
    { id: 1, basis: previous, applied_by: 'CDW', applied_at: '2025-06-01' },
  ] } });
  mount();
  await screen.findByText('Population Data');
  expect(screen.getAllByText('Previous applied data').some(node => !node.closest('dialog'))).toBe(true);
  expect(screen.getAllByText('October data').some(node => !node.closest('dialog'))).toBe(true);
  expect(screen.queryByText('Up to date')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /View Dataset History/ }));
  expect(screen.getByRole('dialog', { name: 'Dataset History' })).toHaveTextContent('Previous applied data');
  expect(screen.getByRole('dialog', { name: 'Dataset History' })).not.toHaveTextContent('October data');
});
