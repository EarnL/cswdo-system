import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CDCRegistrationForm, { insideBarangay } from './CDCRegistrationForm';
import api from '../api';
jest.mock('leaflet', () => ({ geoJSON: () => ({getBounds: () => ({})}) }));
jest.mock('../api', () => ({get: jest.fn(), post: jest.fn()}));
jest.mock('react-leaflet', () => ({ MapContainer: ({children}) => <div>{children}</div>, TileLayer: () => null, GeoJSON: () => null, Marker: () => null, Tooltip: () => null, useMap: () => ({ fitBounds: jest.fn() }), useMapEvents: jest.fn() }));
test('polygon check excludes concave gaps and holes', () => {
  const geometry = {type:'Polygon',coordinates:[[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4],[0,0]]]};
  expect(insideBarangay([3,3],geometry)).toBe(false);
  expect(insideBarangay([0.5,3],geometry)).toBe(true);
  expect(insideBarangay([2,2],{type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[3,1],[3,3],[1,3],[1,1]]]})).toBe(false);
});
test('validates first step and does not save before review', async () => {
  api.get.mockResolvedValue({data:[{id:1,name:'Domoit'}]});
  await act(async () => { render(<MemoryRouter><CDCRegistrationForm /></MemoryRouter>); });
  expect(api.get).toHaveBeenCalledWith('/barangays/');
  expect(document.querySelector('[name="barangay_id"]')).toHaveTextContent('Domoit');
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  expect(screen.getByText('CDC name is required')).toBeInTheDocument();
  for (const [name,value] of Object.entries({name:'Test center',barangay_id:'1',address:'Test address',contact_person:'Test contact',contact_number:'09123456789'})) {
    fireEvent.change(document.querySelector(`[name="${name}"]`),{target:{value}});
  }
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  expect(screen.getByRole('heading',{name:'Center Location'})).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Back'}));
  expect(document.querySelector('[name="name"]')).toHaveValue('Test center');
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  fireEvent.click(screen.getByRole('button',{name:'Use Map Center'}));
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  fireEvent.change(document.querySelector('[name="capacity_per_session"]'),{target:{value:'30'}});
  fireEvent.change(document.querySelector('[name="sessions_per_day"]'),{target:{value:'2'}});
  fireEvent.click(screen.getByRole('checkbox',{name:'Same as contact person'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Preschool'}));
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  expect(screen.getByRole('heading',{name:'Review Center'})).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
  api.post.mockResolvedValue({data:{id:3}});
  fireEvent.click(screen.getByRole('button',{name:'Register Center'}));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/cdcs/', expect.objectContaining({max_capacity:60, offers_preschool:true, has_health_services:false, has_feeding_program:false, program_coordinator_name:'Test contact'})));
  await screen.findByText('Center registered successfully.');
});

jest.setTimeout(60000);
