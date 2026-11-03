import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FloatingDomainResults from './FloatingDomainResults';

beforeAll(() => {
  if (!window.PointerEvent) {
    window.PointerEvent = class extends MouseEvent {
      constructor(type, options = {}) {
        super(type, options);
        Object.defineProperties(this, {
          pointerId: { value: options.pointerId || 1 },
          isPrimary: { value: options.isPrimary !== false },
        });
      }
    };
  }
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.hasPointerCapture = () => true;
  HTMLElement.prototype.releasePointerCapture = jest.fn();
});

test('opens, receives live results, and collapses with focus returned to the circle', () => {
  const { rerender } = render(<FloatingDomainResults answered={0} total={109}><p>Raw score 0</p></FloatingDomainResults>);
  const circle = screen.getByRole('button', { name: 'Domain Results' });
  expect(circle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(circle);
  expect(screen.getByRole('region', { name: 'Domain Results' })).toBeInTheDocument();
  rerender(<FloatingDomainResults answered={1} total={109}><p>Raw score 1</p></FloatingDomainResults>);
  expect(screen.getByText('Raw score 1')).toBeInTheDocument();
  expect(screen.getByText('1/109 answered')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Collapse domain results' }));
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(circle).toHaveFocus();
});

test('dragging moves the circle without opening the panel and keeps it inside the viewport', () => {
  render(<FloatingDomainResults answered={0} total={109} />);
  const circle = screen.getByRole('button', { name: 'Domain Results' });
  fireEvent.pointerDown(circle, { pointerId: 1, isPrimary: true, button: 0, clientX: 950, clientY: 670 });
  fireEvent.pointerMove(circle, { pointerId: 1, clientX: -1000, clientY: -1000 });
  fireEvent.pointerUp(circle, { pointerId: 1 });
  fireEvent.click(circle, { detail: 1 });
  expect(circle).toHaveAttribute('aria-expanded', 'false');
  expect(circle.style.left).toBe('12px');
  expect(circle.style.top).toBe('12px');
  fireEvent.pointerDown(circle, { pointerId: 2, isPrimary: true, button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerUp(circle, { pointerId: 2 });
  fireEvent.click(circle, { detail: 1 });
  expect(circle).toHaveAttribute('aria-expanded', 'true');
});

test('supports keyboard movement and Escape, and fits a narrow resized viewport', () => {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  render(<FloatingDomainResults answered={2} total={109} />);
  const circle = screen.getByRole('button', { name: 'Domain Results' });
  const initial = parseInt(circle.style.left, 10);
  fireEvent.keyDown(circle, { key: 'ArrowLeft' });
  expect(parseInt(circle.style.left, 10)).toBe(initial - 24);
  window.innerWidth = 320;
  window.innerHeight = 480;
  fireEvent(window, new Event('resize'));
  fireEvent.click(circle);
  const panel = screen.getByRole('region', { name: 'Domain Results' });
  expect(parseInt(panel.style.left, 10) + parseInt(panel.style.width, 10)).toBeLessThanOrEqual(308);
  expect(parseInt(circle.style.top, 10)).toBeLessThanOrEqual(412);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(circle).toHaveAttribute('aria-expanded', 'false');
  window.innerWidth = originalWidth;
  window.innerHeight = originalHeight;
});
