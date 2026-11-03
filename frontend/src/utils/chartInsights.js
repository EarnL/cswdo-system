export const formatInsightNumber = (value) => Number(value || 0).toLocaleString();

export function getExtremes(items = [], valueGetter = (item) => item.value) {
  const usable = items
    .map((item) => ({ item, value: Number(valueGetter(item) || 0) }))
    .filter(({ value }) => Number.isFinite(value));

  if (!usable.length) {
    return { highest: null, lowest: null };
  }

  return usable.reduce((acc, current) => ({
    highest: !acc.highest || current.value > acc.highest.value ? current : acc.highest,
    lowest: !acc.lowest || current.value < acc.lowest.value ? current : acc.lowest,
  }), { highest: null, lowest: null });
}

export function simpleFinding({ highest, lowest, labelGetter = (item) => item.label, unit = '' }) {
  const findings = [];
  if (highest?.item) {
    findings.push(`${labelGetter(highest.item)} has the highest value at ${formatInsightNumber(highest.value)}${unit}. This should be checked first because it shows the strongest pressure in the graph.`);
  }
  if (lowest?.item && lowest.item !== highest?.item) {
    findings.push(`${labelGetter(lowest.item)} has the lowest value at ${formatInsightNumber(lowest.value)}${unit}. This may mean lower demand, more available support, or missing records that should be verified.`);
  }
  return findings;
}

export function describeSelectedBar({ label, value, highLabel = 'high', lowLabel = 'low', threshold = 0, unit = '', action }) {
  const numeric = Number(value || 0);
  const pressure = threshold && numeric >= threshold ? highLabel : lowLabel;
  return `${label} shows ${formatInsightNumber(numeric)}${unit}. This is a ${pressure} signal. ${action || 'Review this item and compare it with the rest of the graph before deciding what support is needed.'}`;
}

export function trendFindings(labels = [], values = [], unit = '') {
  const numbers = values.map((value) => Number(value || 0));
  if (!numbers.length) return [];

  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  const maxValue = Math.max(...numbers);
  const minValue = Math.min(...numbers);
  const maxIndex = numbers.indexOf(maxValue);
  const minIndex = numbers.indexOf(minValue);
  const findings = [];

  if (last > first) {
    findings.push(`The trend rises from ${formatInsightNumber(first)}${unit} to ${formatInsightNumber(last)}${unit}. This means demand or pressure may increase if no action is taken.`);
  } else if (last < first) {
    findings.push(`The trend goes down from ${formatInsightNumber(first)}${unit} to ${formatInsightNumber(last)}${unit}. This may mean pressure is easing, but the cause should still be checked.`);
  } else {
    findings.push(`The trend stays almost the same at ${formatInsightNumber(last)}${unit}. Keep monitoring because a flat line can still hide local pressure in some CDCs.`);
  }

  findings.push(`${labels[maxIndex] || 'One point'} is the highest point at ${formatInsightNumber(maxValue)}${unit}.`);
  if (minIndex !== maxIndex) findings.push(`${labels[minIndex] || 'One point'} is the lowest point at ${formatInsightNumber(minValue)}${unit}.`);
  return findings;
}

export function sliceInsight({ label, value, total, action }) {
  const share = total > 0 ? Math.round((Number(value || 0) / total) * 100) : 0;
  return `${label} represents ${formatInsightNumber(value)} records, or about ${share}% of this chart. ${action || 'A larger slice means this group needs more planning attention.'}`;
}
