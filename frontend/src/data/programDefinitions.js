export const programDefinitions = [
  {
    id: 'feeding',
    title: 'Feeding Program',
    subtitle: 'Meal and nutrition support',
    description: 'Automated day counting, progress monitoring, and scheduling alerts.',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
    type: 'feeding',
    filter: (program) => Boolean(program.id),
    buildItem: (program) => ({
      id: `feeding-${program.id}`,
      cdcName: program.cdc_name,
      barangay: program.barangay_name || 'Unassigned barangay',
      infoA: `Completed: ${program.metrics?.completed_feeding_days || 0} of 120 days`,
      infoB: `Remaining: ${program.metrics?.remaining_feeding_days || 0}`,
      infoC: `Estimated completion: ${program.metrics?.estimated_completion_date || 'TBD'}`,
      status: program.status === 'completed' ? 'Completed' : program.metrics?.missed_feeding_days > 0 ? 'Needs review' : 'Active',
      source: program,
    }),
    detailFields: (program) => [
      ['Program Title', program.title],
      ['CDC', program.cdc_name],
      ['Barangay', program.barangay_name],
      ['Status', program.status],
      ['Start Date', program.start_date],
      ['Schedule Type', program.schedule_type],
      ['Schedule Days', program.schedule_days_display],
      ['Target Feeding Days', program.target_feeding_days],
      ['Target Beneficiaries', program.target_beneficiaries],
      ['Budget Allocation', program.budget_allocation],
      ['Completed Days', program.metrics?.completed_feeding_days],
      ['Remaining Days', program.metrics?.remaining_feeding_days],
      ['Missed Days', program.metrics?.missed_feeding_days],
      ['Progress', `${program.metrics?.completion_percentage || 0}%`],
      ['Estimated Completion', program.metrics?.estimated_completion_date],
      ['Compliance Status', program.metrics?.compliance_status],
      ['Created By', program.created_by_name],
      ['Notes', program.notes],
    ],
    detailSections: (program) => [
      {
        title: 'Daily Feeding Records',
        rows: (program.feeding_days || []).map((day) => [
          ['Date', day.feeding_date],
          ['Status', day.status],
          ['Beneficiaries Served', day.beneficiaries_served],
          ['Attendance', day.attendance_count],
          ['Meals Served', day.meals_served],
          ['Recorded By', day.recorded_by_name],
          ['Notes', day.notes],
        ]),
      },
    ],
  },
  {
    id: 'health',
    title: 'Health Services',
    subtitle: 'Checkups and child wellness',
    description: 'Health check-up records grouped by CDC, with referrals, follow-ups, and verification status.',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80',
    type: 'child_health_records',
    filter: (summary) => Boolean(summary.id),
    buildItem: (summary) => ({
      id: `health-${summary.id}`,
      cdcName: summary.cdcName,
      barangay: summary.barangay || 'Unassigned barangay',
      infoA: `${summary.totalChildren} children checked`,
      infoB: `${summary.totalCheckups} check-up records`,
      infoC: `${summary.referralCount} referrals | ${summary.followUpCount} follow-ups`,
      status: summary.status,
      source: summary,
    }),
    detailFields: (summary) => [
      ['CDC', summary.cdcName],
      ['Barangay', summary.barangay],
      ['Children Checked', summary.totalChildren],
      ['Total Check-ups', summary.totalCheckups],
      ['Referrals', summary.referralCount],
      ['Follow-ups', summary.followUpCount],
      ['Latest Check-up', summary.latestDate],
      ['Verification Status', summary.status],
    ],
    detailSections: (summary) => [
      {
        title: 'Child Health Check-up Records',
        rows: (summary.records || []).map((record) => [
          ['Child', record.child_name],
          ['Student ID', record.student_id],
          ['Date', record.screening_date],
          ['Check-up Type', record.checkup_type_label || record.checkup_type],
          ['Nutrition', record.nutritional_status_label || record.nutritional_status],
          ['Findings', record.health_findings || record.medical_notes],
          ['Referral', record.needs_referral ? (record.referred_to_label || 'Needed') : 'No'],
          ['Follow-up', record.follow_up_needed ? (record.follow_up_date || 'Needed') : 'No'],
          ['Status', record.status_label || record.status],
          ['Recorded By', record.recorded_by_name],
          ['Remarks', record.review_remarks],
        ]),
      },
    ],
  },
  {
    id: 'preschool',
    title: 'Preschool Program',
    subtitle: '3-4 years old',
    description: 'For older daycare children.',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
    type: 'cdc',
    filter: (cdc) => Boolean(cdc.offers_preschool),
    buildItem: (cdc) => ({
      id: `preschool-${cdc.id}`,
      cdcName: cdc.name,
      barangay: cdc.barangay_name || 'Unassigned barangay',
      infoA: `Enrollment: ${cdc.current_enrollment || 0}`,
      infoB: `Capacity: ${cdc.max_capacity || 0}`,
      infoC: cdc.contact_number ? `Phone: ${cdc.contact_number}` : 'Phone: Not set',
      status: cdc.is_accredited ? 'Accredited' : 'Needs review',
      source: cdc,
    }),
    detailFields: (cdc) => [
      ['CDC', cdc.name],
      ['Barangay', cdc.barangay_name],
      ['Preschool Offered', cdc.offers_preschool],
      ['Current Enrollment', cdc.current_enrollment],
      ['Maximum Capacity', cdc.max_capacity],
      ['Operating Days', cdc.operating_days],
      ['Operating Hours', cdc.operating_hours],
      ['Contact Number', cdc.contact_number],
    ],
  },
  {
    id: 'snp',
    title: 'SNP (Supervised Neighborhood Play)',
    subtitle: 'Barangay-based SNP monitoring',
    description: 'Barangays with active Supervised Neighborhood Play records.',
    image: 'https://images.unsplash.com/photo-1607453998774-d533f65dac99?auto=format&fit=crop&w=900&q=80',
    type: 'snp',
    filter: (program) => Boolean(program.is_active),
    buildItem: (program) => ({
      id: `snp-${program.id}`,
      cdcName: program.barangay_name || 'Unnamed barangay',
      barangay: program.barangay_name || 'Unnamed barangay',
      infoA: `Children served: ${program.total_children || 0}`,
      infoB: `Sessions/week: ${program.sessions_per_week || 0}`,
      infoC: `Remaining children: ${program.remaining_children || 0}`,
      status: program.certificate_issued ? 'Certificate ready' : 'Active',
      source: program,
    }),
    detailFields: (program) => [
      ['Barangay', program.barangay_name],
      ['Status', program.status],
      ['Active', program.is_active],
      ['Total Children Served', program.total_children],
      ['Target Children', program.target_children],
      ['Remaining Children', program.remaining_children],
      ['Sessions Per Week', program.sessions_per_week],
      ['Hours Per Session', program.hours_per_session],
      ['Participants Identified', program.participants_identified],
      ['Volunteers Involved', program.volunteers_involved],
      ['Certificate Issued', program.certificate_issued],
      ['Barangay Population', program.barangay_population],
      ['Current Enrollment', program.current_enrollment],
      ['Public CDC Gap Basis', program.public_cdc_gap_basis],
      ['Planning Note', program.planning_note],
    ],
  },
  {
    id: 'special-needs',
    title: 'Special Needs Assessment',
    subtitle: 'ECCD assessment results',
    description: 'Assessment summaries grouped per CDC, with child results, status, and development indicators.',
    image: 'https://images.unsplash.com/photo-1604881991720-f91add269bed?auto=format&fit=crop&w=900&q=80',
    type: 'special_needs',
    filter: (assessment) => Boolean(assessment.id),
    buildItem: (assessment) => ({
      id: `special-needs-${assessment.id}`,
      cdcName: assessment.child_name || 'Unnamed child',
      barangay: assessment.cdc_name || 'Unassigned CDC',
      infoA: `Result: ${assessment.result_label || assessment.result || 'Not set'}`,
      infoB: `Assessment: ${assessment.assessment_type || 'Not set'}`,
      infoC: `Date: ${assessment.assessment_date || 'No date'}`,
      status: assessment.status === 'submitted' ? 'Submitted' : 'Draft',
      source: assessment,
    }),
    detailFields: (assessment) => [
      ['Child', assessment.child_name],
      ['Age', assessment.child_age],
      ['CDC', assessment.cdc_name],
      ['Barangay', assessment.barangay_name],
      ['Assessment Type', assessment.assessment_type],
      ['Assessment Date', assessment.assessment_date],
      ['Result', assessment.result_label || assessment.result],
      ['Status', assessment.status_label || assessment.status],
      ['Examiner', assessment.examiner_name || assessment.assessed_by_name],
      ['Place Administered', assessment.place_administered],
      ['Remarks', assessment.remarks],
    ],
    detailSections: (assessment) => [
      {
        title: 'Domain Scores',
        rows: Object.entries(assessment.domain_scores || {})
          .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
          .map(([domain, score]) => [
            ['Domain', domain],
            ['Raw Score', score.raw_score],
            ['Unable', score.unable_score],
            ['Total Items', score.total],
            ['Percent', `${score.percent || 0}%`],
          ]),
      },
    ],
  },
];

export function statusClasses(status) {
  const value = String(status || '').toLowerCase();

  if (value.includes('accredited') || value.includes('active') || value.includes('ready') || value.includes('completed')) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  }

  if (value.includes('review')) {
    return 'bg-amber-50 text-amber-700 border border-amber-200';
  }

  return 'bg-slate-100 text-slate-700 border border-slate-200';
}

function buildHealthServiceSummaries(records) {
  const groups = new Map();
  records.forEach((record) => {
    const key = record.cdc || record.cdc_name || 'unknown';
    const group = groups.get(key) || {
      id: key,
      cdcName: record.cdc_name || 'Unassigned CDC',
      barangay: record.barangay_name || 'No barangay',
      records: [],
      childIds: new Set(),
      referralCount: 0,
      followUpCount: 0,
      latestDate: '',
      status: 'Verified',
    };
    group.records.push(record);
    if (record.child || record.child_name) {
      group.childIds.add(record.child || record.child_name);
    }
    if (record.needs_referral) group.referralCount += 1;
    if (record.follow_up_needed) group.followUpCount += 1;
    if (!group.latestDate || String(record.screening_date || '') > String(group.latestDate || '')) {
      group.latestDate = record.screening_date || group.latestDate;
    }
    groups.set(key, group);
  });

  return Array.from(groups.values()).map((group) => {
    const statuses = new Set(group.records.map((record) => record.status));
    let status = 'Verified';
    if (statuses.has('returned')) status = 'Returned';
    else if (statuses.has('submitted') || statuses.has('under_review') || statuses.has('draft')) status = 'Needs review';
    return {
      ...group,
      totalChildren: group.childIds.size,
      totalCheckups: group.records.length,
      status,
    };
  });
}

export function buildProgramCards({ cdcs = [], snpPrograms = [], feedingPrograms = [], specialNeedsAssessments = [], childHealthRecords = [] }) {
  return programDefinitions.map((definition) => {
    const source = definition.type === 'snp'
      ? snpPrograms
      : definition.type === 'feeding'
        ? feedingPrograms
        : definition.type === 'special_needs'
          ? specialNeedsAssessments
          : definition.type === 'child_health_records'
            ? buildHealthServiceSummaries(childHealthRecords)
            : cdcs;
    const matchingRecords = source.filter(definition.filter);
    const items = matchingRecords.map(definition.buildItem);
    const barangayCount = new Set(items.map((item) => item.barangay)).size;

    return {
      ...definition,
      items,
      count: items.length,
      barangayCount,
    };
  });
}
