import React from 'react';
import HeatmapMap from '../components/HeatmapMap';

function CoverageMapPage() {
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : 'admin';
  const exitHref = role === 'planning' || role === 'city_planning' ? '/planning' : '/admin';

  return <HeatmapMap expanded expandHref="" exitHref={exitHref} />;
}

export default CoverageMapPage;
