// Map thresholds describe monitoring bands, not regulatory compliance.
const visual = (label, marker, value = 50) => ({ label, marker, glow: marker, value });
export const centerCount = row => row?.basis?.public_cdc?.centers ?? row?.centers?.length ?? 0;
export const capacityStatus = center => {
  const capacity = Number(center.effective_capacity);
  const enrolled = Number(center.enrollment);
  if (!(capacity > 0)) return 'no_data';
  return enrolled > capacity ? 'service_gap' : enrolled >= capacity * 0.85 ? 'near_capacity' : 'stable';
};
export const capacityVisual = center => ({
  service_gap: visual('Overpopulated', '#dc2626', 90),
  near_capacity: visual('Near Capacity', '#d97706', 65),
  stable: visual('Within capacity', '#0f766e', 30),
  no_data: visual('Capacity not recorded', '#64748b'),
}[capacityStatus(center)]);
export const underservedReasons = row => {
  const reasons = [];
  if (centerCount(row) === 0 && row?.basis) reasons.push('No CDC in barangay');
  if (!row?.has_population_data) return reasons;
  if (Number(row.children_3_4 ?? row.children_0_5) > Number(row.effective_capacity)) reasons.push('Insufficient CDC capacity');
  if (Number(row.need_score) >= 35) reasons.push('Low recorded enrollment coverage');
  return reasons;
};
export const ratioVisual = (enrolled, teachers, complete = true) => {
  if (!complete || !(teachers > 0)) return visual('Teacher data unavailable or incomplete', '#64748b');
  const ratio = enrolled / teachers;
  return visual('Aggregate children per teacher', ratio > 25 ? '#dc2626' : ratio > 10 ? '#d97706' : '#0f766e', 55);
};
export const objectiveVisual = (mode, row) => {
  if (mode === 'demand') {
    const reasons = underservedReasons(row);
    if (reasons.includes('No CDC in barangay')) return visual(reasons[0], '#be123c', 90);
    if (!row?.has_population_data) return visual('No validated population data', '#64748b');
    if (reasons.includes('Insufficient CDC capacity')) return visual('Insufficient CDC capacity', '#ea580c', 75);
    if (reasons.length) return visual('Low recorded enrollment coverage', '#d97706', 55);
    return visual('No shortage flagged', '#0f766e', 25);
  }
  if (mode === 'distribution') {
    if (!row?.basis && !row?.centers?.length) return visual('No center data', '#64748b');
    return centerCount(row) ? visual('CDC present', '#0284c7', 40) : visual('No CDC in barangay', '#be123c', 70);
  }
  if (mode === 'utilization') {
    const centers = row?.centers || [];
    if (!centers.length) return visual('No center capacity data', '#64748b');
    const worst = ['service_gap', 'no_data', 'near_capacity', 'stable'].find(status => centers.some(c => capacityStatus(c) === status));
    return capacityVisual(centers.find(c => capacityStatus(c) === worst));
  }
  if (mode === 'ratio') {
    const centers = row?.centers || [];
    return ratioVisual(centers.reduce((n, c) => n + c.enrollment, 0), row?.teacher_count,
      centers.length > 0 && centers.length === centerCount(row) && centers.every(c => c.teacher_count > 0));
  }
  return null;
};
export const objectiveLegends = {
  demand: [['#be123c', 'No CDC'], ['#ea580c', 'Capacity shortage'], ['#d97706', 'Enrollment coverage below 65%'], ['#0f766e', 'No shortage flagged'], ['#64748b', 'No population data']],
  utilization: [['#dc2626', 'Over capacity (>100%)'], ['#d97706', 'Near capacity (85–100%)'], ['#0f766e', 'Within capacity (<85%)'], ['#64748b', 'No capacity data']],
  ratio: [['#0f766e', 'Up to 10 children / teacher'], ['#d97706', '>10–25 children / teacher'], ['#dc2626', '>25 children / teacher'], ['#64748b', 'Missing or incomplete staffing']],
  distribution: [['#0284c7', 'CDC present'], ['#be123c', 'No CDC'], ['#64748b', 'No center data']],
};
