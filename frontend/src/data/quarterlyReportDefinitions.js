export const quarterlyReportDefinitions = {
  eccd_checklist: {
    id: 'eccd_checklist',
    title: 'ECCD Checklist',
    heading: 'ECCD Checklist Summary Report',
    description: 'Developmental screening summary for children assessed during the quarter.',
    badge: 'EC',
    tone: 'from-sky-700 to-blue-500',
    sections: [
      {
        title: 'Assessment Overview',
        fields: [
          { key: 'total_children_assessed', label: 'Total Children Assessed', type: 'number', placeholder: '0' },
        ],
      },
      {
        title: 'Developmental Results',
        fields: [
          { key: 'gross_motor', label: 'Gross Motor', type: 'textarea', placeholder: 'Summary of gross motor findings' },
          { key: 'fine_motor', label: 'Fine Motor', type: 'textarea', placeholder: 'Summary of fine motor findings' },
          { key: 'language', label: 'Language', type: 'textarea', placeholder: 'Summary of language findings' },
          { key: 'cognitive', label: 'Cognitive', type: 'textarea', placeholder: 'Summary of cognitive findings' },
          { key: 'socio_emotional', label: 'Socio-emotional', type: 'textarea', placeholder: 'Summary of socio-emotional findings' },
        ],
      },
      {
        title: 'Summary',
        fields: [
          { key: 'number_with_delay', label: 'Number of Children with Delay', type: 'number', placeholder: '0' },
          { key: 'number_normal', label: 'Number of Children Normal', type: 'number', placeholder: '0' },
          { key: 'summary_notes', label: 'Summary Notes', type: 'textarea', placeholder: 'Overall assessment summary' },
        ],
      },
      {
        title: 'Recommendations',
        fields: [
          { key: 'intervention_plan', label: 'Intervention Plan', type: 'textarea', placeholder: 'Planned interventions' },
          { key: 'referral_needed', label: 'Referral Needed', type: 'textarea', placeholder: 'Referral details if needed' },
        ],
      },
    ],
  },
  child_profile: {
    id: 'child_profile',
    title: 'Enrollment Profile',
    heading: 'Child Profile and Enrollment Report',
    description: 'Enrollment totals, age distribution, and attendance profile for the quarter.',
    badge: 'CP',
    tone: 'from-emerald-700 to-teal-500',
    sections: [
      {
        title: 'Enrollment Summary',
        fields: [
          { key: 'total_enrolled', label: 'Total Enrolled', type: 'number', placeholder: '0' },
          { key: 'male', label: 'Male', type: 'number', placeholder: '0' },
          { key: 'female', label: 'Female', type: 'number', placeholder: '0' },
          { key: 'new_enrollees', label: 'New Enrollees', type: 'number', placeholder: '0' },
          { key: 'dropouts', label: 'Dropouts', type: 'number', placeholder: '0' },
        ],
      },
      {
        title: 'Age Distribution',
        fields: [
          { key: 'age_3', label: 'Pre-K1: 3 years old', type: 'number', placeholder: '0' },
          { key: 'age_4', label: 'Pre-K2: 4 years old', type: 'number', placeholder: '0' },
        ],
      },
      {
        title: 'Attendance',
        fields: [
          { key: 'average_attendance', label: 'Average Attendance', placeholder: 'Example: 34 children per day' },
          { key: 'absentee_rate', label: 'Absentee Rate', placeholder: 'Example: 8%' },
        ],
      },
    ],
  },
  health_nutrition: {
    id: 'health_nutrition',
    title: 'Health & Nutrition',
    heading: 'Health and Nutrition Report',
    description: 'Weight, nutrition status, and health service coverage for the quarter.',
    badge: 'HN',
    tone: 'from-rose-700 to-orange-500',
    sections: [
      {
        title: 'Weight and Height Monitoring',
        fields: [
          { key: 'children_weighed', label: 'Number of Children Weighed', type: 'number', placeholder: '0' },
          { key: 'children_measured', label: 'Number of Children Measured', type: 'number', placeholder: '0' },
        ],
      },
      {
        title: 'Nutrition Status',
        fields: [
          { key: 'nutrition_normal', label: 'Normal', type: 'number', placeholder: '0' },
          { key: 'nutrition_underweight', label: 'Underweight', type: 'number', placeholder: '0' },
          { key: 'nutrition_severely_underweight', label: 'Severely Underweight', type: 'number', placeholder: '0' },
        ],
      },
      {
        title: 'Programs',
        fields: [
          { key: 'feeding_program', label: 'Feeding Program', type: 'textarea', placeholder: 'Describe feeding program status' },
          { key: 'vitamin_supplementation', label: 'Vitamin Supplementation', type: 'textarea', placeholder: 'Describe supplementation support' },
        ],
      },
      {
        title: 'Health Services',
        fields: [
          { key: 'deworming', label: 'Deworming', type: 'textarea', placeholder: 'Deworming updates' },
          { key: 'immunization', label: 'Immunization', type: 'textarea', placeholder: 'Immunization updates' },
        ],
      },
    ],
  },
  activities: {
    id: 'activities',
    title: 'Activities',
    heading: 'Activities and Accomplishment Report',
    description: 'Learning activities, materials, achievements, and implementation challenges.',
    badge: 'AA',
    tone: 'from-violet-700 to-fuchsia-500',
    sections: [
      {
        title: 'Activities Conducted',
        fields: [
          { key: 'daily_lessons', label: 'Daily Lessons', type: 'textarea', placeholder: 'Lessons conducted this quarter' },
          { key: 'play_activities', label: 'Play Activities', type: 'textarea', placeholder: 'Play activities conducted' },
          { key: 'special_events', label: 'Special Events', type: 'textarea', placeholder: 'Special events and celebrations' },
        ],
      },
      {
        title: 'Learning Materials Used',
        fields: [
          { key: 'books', label: 'Books', type: 'textarea', placeholder: 'Books used' },
          { key: 'visual_aids', label: 'Visual Aids', type: 'textarea', placeholder: 'Visual aids used' },
          { key: 'toys', label: 'Toys', type: 'textarea', placeholder: 'Toys and manipulatives used' },
        ],
      },
      {
        title: 'Summary',
        fields: [
          { key: 'objectives_achieved', label: 'Objectives Achieved', type: 'textarea', placeholder: 'Objectives met this quarter' },
          { key: 'challenges_encountered', label: 'Challenges Encountered', type: 'textarea', placeholder: 'Challenges and delays encountered' },
        ],
      },
    ],
  },
  parent_community: {
    id: 'parent_community',
    title: 'Parent & Community',
    heading: 'Parent and Community Involvement Report',
    description: 'Parent meetings, community support, and participation updates.',
    badge: 'PC',
    tone: 'from-amber-700 to-yellow-500',
    sections: [
      {
        title: 'Parent Meetings',
        fields: [
          { key: 'meeting_dates', label: 'Dates Conducted', type: 'textarea', placeholder: 'List meeting dates' },
          { key: 'meeting_attendees', label: 'Number of Attendees', type: 'number', placeholder: '0' },
        ],
      },
      {
        title: 'Community Activities',
        fields: [
          { key: 'events_conducted', label: 'Events Conducted', type: 'textarea', placeholder: 'Community activities held' },
          { key: 'support_received', label: 'Support Received', type: 'textarea', placeholder: 'Support from barangay, parents, or partners' },
        ],
      },
      {
        title: 'Participation',
        fields: [
          { key: 'active_parents', label: 'Active Parents', type: 'number', placeholder: '0' },
          { key: 'inactive_parents', label: 'Inactive Parents', type: 'number', placeholder: '0' },
        ],
      },
    ],
  },
  cdw_accomplishment: {
    id: 'cdw_accomplishment',
    title: 'CDW Accomplishment',
    heading: 'CDW Accomplishment Report',
    description: 'CDW accomplishments, submitted reports, trainings, issues, and recommendations.',
    badge: 'CA',
    tone: 'from-cyan-700 to-sky-500',
    sections: [
      {
        title: 'Accomplishments',
        fields: [
          { key: 'activities_conducted', label: 'Activities Conducted', type: 'textarea', placeholder: 'Key accomplishments this quarter' },
          { key: 'reports_submitted', label: 'Reports Submitted', type: 'textarea', placeholder: 'Reports completed and submitted' },
        ],
      },
      {
        title: 'Trainings Attended',
        fields: [
          { key: 'seminars', label: 'Seminars', type: 'textarea', placeholder: 'Seminars attended' },
          { key: 'workshops', label: 'Workshops', type: 'textarea', placeholder: 'Workshops attended' },
        ],
      },
      {
        title: 'Issues and Recommendations',
        fields: [
          { key: 'issues_encountered', label: 'Issues Encountered', type: 'textarea', placeholder: 'Issues encountered this quarter' },
          { key: 'recommendations', label: 'Recommendations', type: 'textarea', placeholder: 'Recommended actions or support' },
        ],
      },
    ],
  },
  facility_status: {
    id: 'facility_status',
    title: 'Facility Status',
    heading: 'Facility and Center Status Report',
    description: 'Center condition, sanitation, safety, and material availability report.',
    badge: 'FS',
    tone: 'from-slate-700 to-slate-500',
    sections: [
      {
        title: 'Center Condition',
        fields: [
          { key: 'building_status', label: 'Building Status', placeholder: 'Example: Good, needs repair, under maintenance' },
          { key: 'cleanliness', label: 'Cleanliness', placeholder: 'Example: Clean and organized' },
        ],
      },
      {
        title: 'Sanitation',
        fields: [
          { key: 'water_supply', label: 'Water Supply', placeholder: 'Example: Available daily' },
          { key: 'toilet_condition', label: 'Toilet Condition', placeholder: 'Example: Functional and clean' },
        ],
      },
      {
        title: 'Safety',
        fields: [
          { key: 'emergency_exits', label: 'Emergency Exits', placeholder: 'Describe exit readiness' },
          { key: 'first_aid_kit_availability', label: 'First Aid Kit Availability', placeholder: 'Describe first aid kit status' },
        ],
      },
      {
        title: 'Available Materials',
        fields: [
          { key: 'chairs', label: 'Chairs', placeholder: 'Count or condition' },
          { key: 'tables', label: 'Tables', placeholder: 'Count or condition' },
          { key: 'learning_materials', label: 'Learning Materials', type: 'textarea', placeholder: 'Materials currently available' },
        ],
      },
    ],
  },
};

export const quarterlyReportCards = Object.values(quarterlyReportDefinitions).map((definition) => ({
  id: definition.id,
  title: definition.title,
  heading: definition.heading,
  description: definition.description,
  route: `/cdw/quarterly-reports/${definition.id}`,
  badge: definition.badge,
  tone: definition.tone,
}));

export function buildInitialFields(definition) {
  return definition.sections.reduce((accumulator, section) => {
    section.fields.forEach((field) => {
      accumulator[field.key] = '';
    });
    return accumulator;
  }, {});
}
