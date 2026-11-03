import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FloatingReviewPanel from './FloatingReviewPanel';

test('collapses by default and preserves review content when closed and reopened', () => {
  render(<FloatingReviewPanel><input aria-label="Review note" /></FloatingReviewPanel>);
  const trigger = screen.getByRole('button', { name: 'Open review summary' });
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.getByRole('region', { name: 'Review Summary' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Review note'), { target: { value: 'Keep this note' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  expect(screen.getByLabelText('Review note')).toHaveValue('Keep this note');
  fireEvent.click(screen.getByRole('button', { name: 'Close review summary' }));
  expect(trigger).toHaveFocus();
});

test('moves with arrow keys and stays within the viewport', () => {
  render(<FloatingReviewPanel>Result</FloatingReviewPanel>);
  const trigger = screen.getByRole('button', { name: 'Open review summary' });
  const initialLeft = parseFloat(trigger.style.left);
  fireEvent.keyDown(trigger, { key: 'ArrowLeft' });
  expect(parseFloat(trigger.style.left)).toBe(initialLeft - 24);
  for (let step = 0; step < 60; step += 1) fireEvent.keyDown(trigger, { key: 'ArrowLeft' });
  expect(parseFloat(trigger.style.left)).toBe(12);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('anchors the open summary beside the icon and follows movement in both directions', () => {
  render(<FloatingReviewPanel>Result</FloatingReviewPanel>);
  const trigger = screen.getByRole('button', { name: 'Open review summary' });
  fireEvent.click(trigger);
  const panel = screen.getByRole('region', { name: 'Review Summary' });
  expect(parseFloat(panel.style.left) + 380 + 12).toBe(parseFloat(trigger.style.left));
  const initialLeft = parseFloat(panel.style.left);
  const initialTop = parseFloat(panel.style.top);
  fireEvent.keyDown(trigger, { key: 'ArrowLeft' });
  fireEvent.keyDown(trigger, { key: 'ArrowUp' });
  expect(parseFloat(panel.style.left)).toBe(initialLeft - 24);
  expect(parseFloat(panel.style.top)).toBe(initialTop - 24);
  for (let step = 0; step < 60; step += 1) fireEvent.keyDown(trigger, { key: 'ArrowLeft' });
  expect(parseFloat(panel.style.left)).toBe(parseFloat(trigger.style.left) + 68);
});

test('opens above the icon on a narrow screen and stays on screen after resizing', () => {
  const originalWidth = window.innerWidth;
  window.innerWidth = 375;
  try {
    render(<FloatingReviewPanel>Result</FloatingReviewPanel>);
    const trigger = screen.getByRole('button', { name: 'Open review summary' });
    fireEvent.click(trigger);
    const panel = screen.getByRole('region', { name: 'Review Summary' });
    expect(parseFloat(panel.style.left)).toBe(12);
    expect(parseFloat(panel.style.top) + 560 + 12).toBe(parseFloat(trigger.style.top));
    window.innerWidth = 320;
    fireEvent(window, new Event('resize'));
    expect(parseFloat(panel.style.left)).toBe(12);
    expect(parseFloat(trigger.style.left) + 56).toBeLessThanOrEqual(308);
  } finally {
    window.innerWidth = originalWidth;
  }
});

test('opens at a fixed size from the bubble and remembers manual resizing after collapse', () => {
  render(<FloatingReviewPanel>Result</FloatingReviewPanel>);
  const trigger = screen.getByRole('button', { name: 'Open review summary' });
  fireEvent.click(trigger);
  const panel = screen.getByRole('region', { name: 'Review Summary' });
  expect(panel).toHaveStyle({ width: '380px', height: '560px' });
  expect(panel.style.transformOrigin).toBe(`${parseFloat(trigger.style.left) + 28 - parseFloat(panel.style.left)}px ${parseFloat(trigger.style.top) + 28 - parseFloat(panel.style.top)}px`);
  const resize = screen.getByRole('button', { name: 'Resize review summary' });
  fireEvent.keyDown(resize, { key: 'ArrowRight' });
  fireEvent.keyDown(resize, { key: 'ArrowDown' });
  expect(panel).toHaveStyle({ width: '404px', height: '584px' });
  fireEvent.click(trigger);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(panel).toHaveAttribute('inert');
  fireEvent.click(trigger);
  expect(panel).toHaveStyle({ width: '404px', height: '584px' });
  for (let step = 0; step < 60; step += 1) {
    fireEvent.keyDown(resize, { key: 'ArrowRight' });
    fireEvent.keyDown(resize, { key: 'ArrowDown' });
  }
  expect(parseFloat(panel.style.left) + parseFloat(panel.style.width)).toBeLessThanOrEqual(window.innerWidth - 12);
  expect(parseFloat(panel.style.top) + parseFloat(panel.style.height)).toBeLessThanOrEqual(window.innerHeight - 12);
});
