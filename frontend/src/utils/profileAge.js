// Calendar dates avoid timezone shifts in date-of-birth calculations.
export function profileAge(child, referenceDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })) {
  if (child.date_of_birth) {
    const birth = String(child.date_of_birth);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || birth > referenceDate) return null;
    const [year, month, day] = birth.split('-').map(Number);
    const parsed = new Date(`${birth}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birth) return null;
    const [nowYear, nowMonth, nowDay] = referenceDate.split('-').map(Number);
    const months = (nowYear - year) * 12 + nowMonth - month - (nowDay < day ? 1 : 0);
    return { years: Math.floor(months / 12), months, exact: true };
  }
  if (child.age === null || child.age === undefined || child.age === '') return null;
  const years = Number(child.age);
  return Number.isInteger(years) && years >= 0 ? { years, months: years * 12, exact: false } : null;
}

export function matchesAge(age, unit, min, max) {
  if (min === '' && max === '') return true;
  if (!age) return false;
  const lower = min === '' ? 0 : Number(min);
  const upper = max === '' ? Infinity : Number(max);
  if (lower < 0 || upper < 0 || lower > upper) return false;
  const start = unit === 'months' ? age.months : age.years;
  const end = start + (unit === 'months' && !age.exact ? 11 : 0);
  return end >= lower && start <= upper;
}
