import React from 'react';
import { act, render, screen } from '@testing-library/react';
import GlobalLoadingIndicator from './GlobalLoadingIndicator';
import { beginRequest, endRequest } from '../requestActivity';

test('shows a spinner for overlapping requests until all requests finish', () => {
  jest.useFakeTimers();
  const view = render(<GlobalLoadingIndicator />);
  let one; let two;
  act(() => { one = beginRequest(); two = beginRequest(); });
  act(() => jest.advanceTimersByTime(150));
  expect(screen.getByRole('status').textContent).toContain('Loading');
  act(() => endRequest(one));
  expect(screen.getByRole('status')).toBeTruthy();
  act(() => jest.advanceTimersByTime(10000));
  expect(screen.getByRole('status').textContent).toContain('Still working');
  act(() => endRequest(two));
  act(() => jest.advanceTimersByTime(200));
  expect(screen.queryByRole('status')).toBeNull();
  view.unmount();
  jest.useRealTimers();
});
