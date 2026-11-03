import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import useReportChanges, { installReportGuard } from './useReportChanges';
function Form() {
  const [value, setValue] = React.useState('');
  const { dirty, markSaved } = useReportChanges({ value });
  return <><input aria-label="Notes" value={value} onChange={e => setValue(e.target.value)} /><p>{dirty ? 'Unsaved' : 'Saved'}</p><button onClick={markSaved}>Save</button><Link to="/reports">Back to Monitoring Reports</Link></>;
}
afterEach(() => jest.restoreAllMocks());
test('cancel keeps edits, saving removes the navigation warning', () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<Form />} /><Route path="/reports" element={<p>Report hub</p>} /></Routes></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Keep these notes' } });
  fireEvent.click(screen.getByText('Back to Monitoring Reports'));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Notes').value).toBe('Keep these notes');
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByText('Save'));
  fireEvent.click(screen.getByText('Back to Monitoring Reports'));
  expect(screen.getByText('Report hub')).toBeTruthy();
  expect(confirm).toHaveBeenCalledTimes(1);
});
test('browser Back cancellation restores the current history entry and cleans listeners', () => {
  window.history.replaceState({ idx: 3 }, '');
  const navigator = { push: jest.fn(), replace: jest.fn() };
  const original = navigator.push;
  const go = jest.spyOn(window.history, 'go').mockImplementation(() => {});
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  const cleanup = installReportGuard(navigator, () => true);
  act(() => window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 2 } })));
  expect(go).toHaveBeenCalledWith(1);
  cleanup();
  expect(navigator.push).toBe(original);
});
