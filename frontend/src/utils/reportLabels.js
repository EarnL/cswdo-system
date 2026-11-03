export function reportDisplayName(value = '') {
  return String(value).replace(/\bform\s*6\b(?:\s*[-:]\s*child development worker profile)?/gi, 'Child Development Worker Profile').replace(/\bform\s*7\b(?:\s*[-:]\s*child development center profile)?/gi, 'Child Development Center Profile');
}
