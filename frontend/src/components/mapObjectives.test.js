import { capacityStatus, capacityVisual, objectiveVisual, underservedReasons, ratioVisual } from './mapObjectives';

test('an overloaded center remains visible despite spare capacity elsewhere', () => {
  const overloaded = { enrollment: 70, effective_capacity: 60 };
  const spare = { enrollment: 5, effective_capacity: 100 };
  expect(capacityStatus(overloaded)).toBe('service_gap');
  expect(capacityStatus(spare)).toBe('stable');
  expect(objectiveVisual('utilization', { centers: [spare, overloaded] })).toEqual(capacityVisual(overloaded));
  expect(capacityStatus({ enrollment: 60, effective_capacity: 60 })).toBe('near_capacity');
  expect(capacityStatus({ enrollment: 10, effective_capacity: 0 })).toBe('no_data');
});

test('underserved reasons distinguish center absence, slots and enrollment coverage', () => {
  const row = { basis: { public_cdc: { centers: 0 } }, has_population_data: true, children_3_4: 100, effective_capacity: 0, need_score: 100 };
  expect(underservedReasons(row)).toEqual(['No CDC in barangay', 'Insufficient CDC capacity', 'Low recorded enrollment coverage']);
  expect(underservedReasons({ ...row, has_population_data: false })).toEqual(['No CDC in barangay']);
  expect(underservedReasons({ ...row, children_3_4: 0, need_score: 0, basis: { public_cdc: { centers: 1 } } })).toEqual([]);
});

test('distribution does not depend on a population submission', () => {
  expect(objectiveVisual('distribution', { centers: [{}] }).label).toBe('CDC present');
  expect(objectiveVisual('distribution', { basis: { public_cdc: { centers: 0 } } }).label).toBe('No CDC in barangay');
  expect(objectiveVisual('distribution', {}).label).toBe('No center data');
});

test('ratios use local center enrollment and do not conceal missing staffing', () => {
  const row = { enrollment: 999, teacher_count: 2, centers: [{ enrollment: 20, teacher_count: 2 }] };
  expect(objectiveVisual('ratio', row)).toEqual(ratioVisual(20, 2));
  expect(objectiveVisual('ratio', { ...row, centers: [...row.centers, { enrollment: 10, teacher_count: 0 }] }).marker).toBe('#64748b');
  expect(ratioVisual(20, 0).label).toContain('unavailable');
});
