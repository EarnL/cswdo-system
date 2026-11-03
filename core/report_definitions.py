QUARTERLY_REPORT_DEFINITIONS = {
    'eccd_checklist': {
        'label': 'ECCD Checklist Summary Report',
        'description': 'Quarterly developmental screening summary for children assessed in the center.',
        'sections': [
            {
                'title': 'Assessment Overview',
                'fields': [
                    {'key': 'total_children_assessed', 'label': 'Total Children Assessed', 'type': 'number'},
                ],
            },
            {
                'title': 'Developmental Results',
                'fields': [
                    {'key': 'gross_motor', 'label': 'Gross Motor'},
                    {'key': 'fine_motor', 'label': 'Fine Motor'},
                    {'key': 'language', 'label': 'Language'},
                    {'key': 'cognitive', 'label': 'Cognitive'},
                    {'key': 'socio_emotional', 'label': 'Socio-emotional'},
                ],
            },
            {
                'title': 'Summary',
                'fields': [
                    {'key': 'number_with_delay', 'label': 'Number of Children with Delay', 'type': 'number'},
                    {'key': 'number_normal', 'label': 'Number of Children Normal', 'type': 'number'},
                    {'key': 'summary_notes', 'label': 'Summary Notes', 'type': 'textarea'},
                ],
            },
            {
                'title': 'Recommendations',
                'fields': [
                    {'key': 'intervention_plan', 'label': 'Intervention Plan', 'type': 'textarea'},
                    {'key': 'referral_needed', 'label': 'Referral Needed', 'type': 'textarea'},
                ],
            },
        ],
    },
    'child_profile': {
        'label': 'Child Profile and Enrollment Report',
        'description': 'Quarterly enrollment, age distribution, and attendance profile for the center.',
        'sections': [
            {
                'title': 'Enrollment Summary',
                'fields': [
                    {'key': 'total_enrolled', 'label': 'Total Enrolled', 'type': 'number'},
                    {'key': 'male', 'label': 'Male', 'type': 'number'},
                    {'key': 'female', 'label': 'Female', 'type': 'number'},
                    {'key': 'new_enrollees', 'label': 'New Enrollees', 'type': 'number'},
                    {'key': 'dropouts', 'label': 'Dropouts', 'type': 'number'},
                ],
            },
            {
                'title': 'Age Distribution',
                'fields': [
                    {'key': 'age_3', 'label': 'Pre-K1: 3 years old', 'type': 'number'},
                    {'key': 'age_4', 'label': 'Pre-K2: 4 years old', 'type': 'number'},
                ],
            },
            {
                'title': 'Attendance',
                'fields': [
                    {'key': 'average_attendance', 'label': 'Average Attendance'},
                    {'key': 'absentee_rate', 'label': 'Absentee Rate'},
                ],
            },
        ],
    },
    'health_nutrition': {
        'label': 'Health and Nutrition Report',
        'description': 'Quarterly weight, nutrition, and health service updates for enrolled children.',
        'sections': [
            {
                'title': 'Weight and Height Monitoring',
                'fields': [
                    {'key': 'children_weighed', 'label': 'Number of Children Weighed', 'type': 'number'},
                    {'key': 'children_measured', 'label': 'Number of Children Measured', 'type': 'number'},
                ],
            },
            {
                'title': 'Nutrition Status',
                'fields': [
                    {'key': 'nutrition_normal', 'label': 'Normal', 'type': 'number'},
                    {'key': 'nutrition_underweight', 'label': 'Underweight', 'type': 'number'},
                    {'key': 'nutrition_severely_underweight', 'label': 'Severely Underweight', 'type': 'number'},
                ],
            },
            {
                'title': 'Programs',
                'fields': [
                    {'key': 'feeding_program', 'label': 'Feeding Program'},
                    {'key': 'vitamin_supplementation', 'label': 'Vitamin Supplementation'},
                ],
            },
            {
                'title': 'Health Services',
                'fields': [
                    {'key': 'deworming', 'label': 'Deworming'},
                    {'key': 'immunization', 'label': 'Immunization'},
                ],
            },
        ],
    },
    'activities': {
        'label': 'Activities and Accomplishment Report',
        'description': 'Quarterly summary of classroom activities, materials used, and implementation challenges.',
        'sections': [
            {
                'title': 'Activities Conducted',
                'fields': [
                    {'key': 'daily_lessons', 'label': 'Daily Lessons', 'type': 'textarea'},
                    {'key': 'play_activities', 'label': 'Play Activities', 'type': 'textarea'},
                    {'key': 'special_events', 'label': 'Special Events', 'type': 'textarea'},
                ],
            },
            {
                'title': 'Learning Materials Used',
                'fields': [
                    {'key': 'books', 'label': 'Books', 'type': 'textarea'},
                    {'key': 'visual_aids', 'label': 'Visual Aids', 'type': 'textarea'},
                    {'key': 'toys', 'label': 'Toys', 'type': 'textarea'},
                ],
            },
            {
                'title': 'Summary',
                'fields': [
                    {'key': 'objectives_achieved', 'label': 'Objectives Achieved', 'type': 'textarea'},
                    {'key': 'challenges_encountered', 'label': 'Challenges Encountered', 'type': 'textarea'},
                ],
            },
        ],
    },
    'parent_community': {
        'label': 'Parent and Community Involvement Report',
        'description': 'Quarterly summary of parent meetings, community activities, and participation levels.',
        'sections': [
            {
                'title': 'Parent Meetings',
                'fields': [
                    {'key': 'meeting_dates', 'label': 'Dates Conducted', 'type': 'textarea'},
                    {'key': 'meeting_attendees', 'label': 'Number of Attendees', 'type': 'number'},
                ],
            },
            {
                'title': 'Community Activities',
                'fields': [
                    {'key': 'events_conducted', 'label': 'Events Conducted', 'type': 'textarea'},
                    {'key': 'support_received', 'label': 'Support Received', 'type': 'textarea'},
                ],
            },
            {
                'title': 'Participation',
                'fields': [
                    {'key': 'active_parents', 'label': 'Active Parents', 'type': 'number'},
                    {'key': 'inactive_parents', 'label': 'Inactive Parents', 'type': 'number'},
                ],
            },
        ],
    },
    'cdw_accomplishment': {
        'label': 'CDW Accomplishment Report',
        'description': 'Quarterly summary of the CDW’s activities, reports, trainings, issues, and recommendations.',
        'sections': [
            {
                'title': 'Accomplishments',
                'fields': [
                    {'key': 'activities_conducted', 'label': 'Activities Conducted', 'type': 'textarea'},
                    {'key': 'reports_submitted', 'label': 'Reports Submitted', 'type': 'textarea'},
                ],
            },
            {
                'title': 'Trainings Attended',
                'fields': [
                    {'key': 'seminars', 'label': 'Seminars', 'type': 'textarea'},
                    {'key': 'workshops', 'label': 'Workshops', 'type': 'textarea'},
                ],
            },
            {
                'title': 'Issues and Recommendations',
                'fields': [
                    {'key': 'issues_encountered', 'label': 'Issues Encountered', 'type': 'textarea'},
                    {'key': 'recommendations', 'label': 'Recommendations', 'type': 'textarea'},
                ],
            },
        ],
    },
    'facility_status': {
        'label': 'Facility and Center Status Report',
        'description': 'Quarterly facility condition, sanitation, safety, and materials availability report.',
        'sections': [
            {
                'title': 'Center Condition',
                'fields': [
                    {'key': 'building_status', 'label': 'Building Status'},
                    {'key': 'cleanliness', 'label': 'Cleanliness'},
                ],
            },
            {
                'title': 'Sanitation',
                'fields': [
                    {'key': 'water_supply', 'label': 'Water Supply'},
                    {'key': 'toilet_condition', 'label': 'Toilet Condition'},
                ],
            },
            {
                'title': 'Safety',
                'fields': [
                    {'key': 'emergency_exits', 'label': 'Emergency Exits'},
                    {'key': 'first_aid_kit_availability', 'label': 'First Aid Kit Availability'},
                ],
            },
            {
                'title': 'Available Materials',
                'fields': [
                    {'key': 'chairs', 'label': 'Chairs'},
                    {'key': 'tables', 'label': 'Tables'},
                    {'key': 'learning_materials', 'label': 'Learning Materials'},
                ],
            },
        ],
    },
}

CDC_PERIODIC_REPORT_DEFINITIONS = {
    'cdc_monthly_report': {
        'label': 'CDC Monthly Report',
        'description': 'Monthly enrollment, staffing, health/nutrition, and activity monitoring report.',
    },
    'cdc_quarterly_report': {
        'label': 'CDC Quarterly Report',
        'description': 'Quarterly CDC report covering barangay population, capacity pressure, underserved areas, program implementation, and teacher ratios.',
    },
    'cdc_annual_report': {
        'label': 'CDC Annual Report',
        'description': 'Annual year-end CDC report covering enrollment, outcomes, facility, staff development, program evaluation, resources, and recommendations.',
    },
}


REPORT_TYPE_CHOICES = (
    ('form6', 'CDW Profile Report'),
    ('form7', 'CDC Profile Form'),
    ('cdc_monthly_report', CDC_PERIODIC_REPORT_DEFINITIONS['cdc_monthly_report']['label']),
    ('cdc_quarterly_report', CDC_PERIODIC_REPORT_DEFINITIONS['cdc_quarterly_report']['label']),
    ('cdc_annual_report', CDC_PERIODIC_REPORT_DEFINITIONS['cdc_annual_report']['label']),
    ('eccd_checklist', QUARTERLY_REPORT_DEFINITIONS['eccd_checklist']['label']),
    ('child_profile', QUARTERLY_REPORT_DEFINITIONS['child_profile']['label']),
    ('health_nutrition', QUARTERLY_REPORT_DEFINITIONS['health_nutrition']['label']),
    ('activities', QUARTERLY_REPORT_DEFINITIONS['activities']['label']),
    ('parent_community', QUARTERLY_REPORT_DEFINITIONS['parent_community']['label']),
    ('cdw_accomplishment', QUARTERLY_REPORT_DEFINITIONS['cdw_accomplishment']['label']),
    ('facility_status', QUARTERLY_REPORT_DEFINITIONS['facility_status']['label']),
    ('special_needs', 'Special Needs Assessment Summary'),
)


def get_quarterly_report_definition(report_type):
    return QUARTERLY_REPORT_DEFINITIONS.get(report_type)


def get_cdc_periodic_report_definition(report_type):
    return CDC_PERIODIC_REPORT_DEFINITIONS.get(report_type)
