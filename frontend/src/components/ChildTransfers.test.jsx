import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChildTransfers from './ChildTransfers';
import api from '../api';
jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
const request = { id: 2, child_name: 'Ana Cruz', from_cdc: 'CDC A', to_cdc: 'CDC B', academic_year: '2026-2027', status: 'pending', can_review: true };

test('source center confirms transfer and retains its history', async () => {
  api.get.mockResolvedValue({ data: [request] });
  api.post.mockResolvedValue({ data: { status: 'approved' } });
  const changed = jest.fn();
  render(<ChildTransfers onChanged={changed} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Review transfer' }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' }));
  await waitFor(() => expect(changed).toHaveBeenCalled());
  expect(api.post).toHaveBeenCalledWith('/children/transfers/2/review/', { decision: 'approved' });
  expect(screen.getByText('Transfer history')).toBeTruthy();
  expect(screen.getByText('approved')).toBeTruthy();
});

test('receiving center cannot approve its own request', async () => {
  api.get.mockResolvedValue({ data: [{ ...request, can_review: false }] });
  render(<ChildTransfers />);
  expect(await screen.findByText('Awaiting current center approval')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Review transfer' })).toBeNull();
});

test('failed approval stays pending and shows an error', async () => {
  api.get.mockResolvedValue({ data: [request] });
  api.post.mockRejectedValue({ response: { data: { error: 'The enrollment changed.' } } });
  render(<ChildTransfers />);
  fireEvent.click(await screen.findByRole('button', { name: 'Review transfer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The enrollment changed.');
  expect(screen.getByText('1 pending')).toBeTruthy();
});
