export const requirementGroups = [
  { key: 'basic', title: 'Center details' },
  { key: 'staff', title: 'Staff readiness' },
  { key: 'facility', title: 'Facility readiness' },
  { key: 'safety', title: 'Safety and protection plans' },
  { key: 'program', title: 'Proposed program' },
  { key: 'documents', title: 'Supporting documents' },
];

export function getRequirementStatuses(cdc = {}) {
  return cdc.preopening_readiness || {
    groups: requirementGroups.map(group => ({ ...group, done: false, status: 'Not started' })),
    completedCount: 0, readiness: 0, complete: false,
  };
}

export function requirementLink(cdcId, groupKey) {
  const aliases = { profile: 'basic', curriculum: 'program' };
  const key = aliases[groupKey] || groupKey;
  return cdcId ? `/cdw/accreditation-requirements/${cdcId}/${key}` : '/cdw/accreditation-requirements';
}
