import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CityPlanningDashboard from './CityPlanningDashboard';
import api from '../api';
jest.mock('../api', () => ({get:jest.fn(),post:jest.fn()}));
test('separates active review, returned, forwarded and historical requests', async () => {
 api.get.mockResolvedValue({data:[
  {id:1,title:'Annual file',status:'under_planning_review',data_request:8,academic_year_name:'2026-2027',history:[{id:1,action:'revised_by_cho',message:'Corrected'}],data_payload:{reporting_period_start:'2026-01-01',reporting_period_end:'2026-12-31'}},
  {id:2,title:'Returned file',status:'returned_to_cho',history:[]},
  {id:3,title:'Old file',status:'archived',history:[]}
 ]});
 render(<MemoryRouter><CityPlanningDashboard /></MemoryRouter>);
 await screen.findByRole('heading',{name:'Population Submissions'});
 expect(screen.getByText(/Version 2/)).toBeInTheDocument();
 expect(screen.queryByText('Returned file')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Awaiting CHO'}));
 expect(screen.getByText('Returned file')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'History'}));
 expect(screen.getByText('Old file')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Forward to CSWDO'})).not.toBeInTheDocument();
});
jest.setTimeout(60000);
