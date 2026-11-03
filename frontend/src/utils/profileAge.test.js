import { profileAge, matchesAge } from './profileAge';

test('calculates completed calendar months and years at birthday boundaries', () => {
  expect(profileAge({ date_of_birth: '2023-10-22' }, '2026-10-21')).toEqual({ years: 2, months: 35, exact: true });
  expect(profileAge({ date_of_birth: '2023-10-22' }, '2026-10-22')).toEqual({ years: 3, months: 36, exact: true });
  expect(profileAge({ date_of_birth: '2026-10-22' }, '2026-10-22').months).toBe(0);
  expect(profileAge({ date_of_birth: '2024-02-29' }, '2025-02-28').months).toBe(11);
});

test('rejects future and invalid dates without fabricating a reported age', () => {
  expect(profileAge({ date_of_birth: '2026-10-23', age: 0 }, '2026-10-22')).toBeNull();
  expect(profileAge({ date_of_birth: '2026-02-30' }, '2026-10-22')).toBeNull();
  expect(profileAge({ age: null })).toBeNull();
});

test('preserves reported CHO age as a range when month precision is unavailable', () => {
  const age = profileAge({ age: 3, computed_age: 4, population_source_submission: 1 });
  expect(age).toEqual({ years: 3, months: 36, exact: false });
  expect(matchesAge(age, 'months', '40', '42')).toBe(true);
  expect(matchesAge(age, 'months', '48', '')).toBe(false);
  expect(matchesAge(age, 'years', '3', '3')).toBe(true);
  expect(matchesAge(age, 'years', '4', '3')).toBe(false);
  expect(matchesAge(null, 'years', '', '')).toBe(true);
  expect(matchesAge(null, 'years', '0', '')).toBe(false);
});
