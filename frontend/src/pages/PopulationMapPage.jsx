import React from 'react';
import HeatmapMap from '../components/HeatmapMap';

const getExitHref = () => {
  const role = localStorage.getItem('role');

  if (role === 'staff') return '/staff';
  if (role === 'planning' || role === 'city_planning') return '/planning';
  if (role === 'admin') return '/admin';
  return '/admin';
};

const PopulationMapPage = () => (
  <HeatmapMap exitHref={getExitHref()} />
);

export default PopulationMapPage;
