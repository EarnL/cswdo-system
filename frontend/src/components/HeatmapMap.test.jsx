import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeatmapMap from './HeatmapMap';
import api from '../api';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn() } }));

jest.mock('react-leaflet', () => {
  const React = require('react');
  const container = global.document.createElement('div');
  const map = { invalidateSize: jest.fn(), getSize: () => ({ x: 900, y: 600 }), setMinZoom: jest.fn(), fitBounds: jest.fn(), getZoom: () => 12, getContainer: () => container };
  const passthrough = ({ children }) => <div>{children}</div>;
  return { MapContainer: passthrough, Circle: passthrough, GeoJSON: () => null, Marker: passthrough, Pane: passthrough, Popup: passthrough, TileLayer: () => null, useMap: () => map };
});

beforeAll(() => { global.ResizeObserver = class { observe() {} disconnect() {} }; });
beforeEach(() => { api.get.mockResolvedValue({ data: [] }); });

it('loads both map layers for the selected academic year and returns to current data', async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === '/academic-years/' ? [{ id: 9, name: '2022-2023' }] : [] }));
  render(<MemoryRouter><HeatmapMap /></MemoryRouter>);
  await screen.findByRole('option', { name: '2022-2023' });
  fireEvent.change(screen.getByLabelText('Academic year'), { target: { value: '9' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/public-map/?academic_year=9'));
  expect(api.get).toHaveBeenCalledWith('/heatmap/?academic_year=9');
  await screen.findByRole('heading', { name: 'Population & Center Map' });
  api.get.mockClear();
  fireEvent.change(screen.getByLabelText('Academic year'), { target: { value: '' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/public-map/'));
  expect(api.get).toHaveBeenCalledWith('/heatmap/');
});

it('preserves the analysis and status filter through full screen and detail panels', async () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HeatmapMap /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Population & Center Map' });
  expect(screen.queryByRole('region', { name: 'Map information' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Center status'), { target: { value: 'service_gap' } });
  fireEvent.click(screen.getByRole('button', { name: 'Teacher-To-Child Ratios' }));
  expect(screen.getByRole('button', { name: 'Teacher-To-Child Ratios' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
  fireEvent.click(within(screen.getByLabelText('Barangay search results')).getAllByRole('button')[0]);
  expect(screen.getByRole('complementary', { name: 'Barangay details' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Expand map' }));
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Center status')).toHaveValue('service_gap');
  expect(screen.getByRole('button', { name: 'Teacher-To-Child Ratios' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }));
  expect(document.body.style.overflow).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Barangay details' }));
  expect(screen.getByRole('complementary')).toBeInTheDocument();
});

it('provides five analysis choices and resets filters without changing the layer', async () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HeatmapMap /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Population & Center Map' });
  expect(within(screen.getByRole('group', { name: 'Analysis layers' })).getAllByRole('button')).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'CDC Distribution' }));
  fireEvent.change(screen.getByLabelText('Center status'), { target: { value: 'near_capacity' } });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no such barangay' } });
  expect(screen.getByText('No matching barangays. Try a different name.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByLabelText('Center status')).toHaveValue('all');
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'CDC Distribution' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument();
});

