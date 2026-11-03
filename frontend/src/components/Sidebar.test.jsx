import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

const items = [
  { section: 'Main', label: 'Dashboard', href: '/staff', icon: 'dashboard' },
  { section: 'Main', label: 'Notifications', href: '/staff/notifications', icon: 'bell' },
  { section: 'Analytics', label: 'Population & Center Map', href: '/staff/map', icon: 'map' },
  { section: 'Programs', label: 'Program Overview', href: '/staff/operations', icon: 'programs' },
  { section: 'Programs', label: 'Special Needs Results', href: '/staff/operations/special-needs', icon: 'children' },
];
const setup = (path = '/staff', props = {}, mobile = false) => {
  window.matchMedia = jest.fn(() => ({ matches: mobile, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  return render(<MemoryRouter initialEntries={[path]}><Sidebar navItems={items} {...props} /></MemoryRouter>);
};

test('keeps primary links visible and reveals grouped pages on demand', () => {
  setup();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Notifications' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Population & Center Map' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
  expect(screen.getByRole('link', { name: 'Population & Center Map' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
  expect(screen.queryByRole('link', { name: 'Population & Center Map' })).not.toBeInTheDocument();
});

test('opens the current group and selects only the most specific route', () => {
  const { container } = setup('/staff/operations/special-needs');
  expect(screen.getByRole('button', { name: 'Programs' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('link', { name: 'Special Needs Results' })).toHaveAttribute('aria-current', 'page');
  expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
});

test('expands a compact desktop sidebar when a group is selected', () => {
  const onToggle = jest.fn();
  setup('/staff', { collapsed: true, onToggle });
  fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test('opens readable submenus on mobile and closes after navigation', () => {
  setup('/staff', {}, true);
  fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
  expect(screen.getByRole('link', { name: 'Population & Center Map' })).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'Population & Center Map' }));
  expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
  expect(screen.getByRole('link', { name: 'Population & Center Map' })).toHaveAttribute('aria-current', 'page');
  fireEvent.keyDown(screen.getByRole('complementary'), { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveFocus();
});
