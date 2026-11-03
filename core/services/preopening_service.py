SECTIONS = [
    {'key': 'basic', 'title': 'Center details', 'description': 'Tell us where the center will operate and how families can contact you.',
     'fields': [('address', 'Center address', 'text'), ('contact_person', 'Contact person', 'text'),
                ('contact_number', 'Contact number', 'text'), ('operating_days', 'Proposed operating days', 'text'),
                ('operating_hours', 'Proposed opening hours', 'text'), ('capacity', 'Proposed number of children', 'number')]},
    {'key': 'staff', 'title': 'Staff readiness', 'description': 'Describe the proposed team and its qualifications. No child records are needed.',
     'fields': [('staff_names', 'Names and roles of proposed staff', 'textarea'), ('qualifications', 'Qualifications', 'textarea'),
                ('training', 'Completed training and training still needed', 'textarea'), ('schedule', 'Proposed staff schedule', 'textarea')]},
    {'key': 'facility', 'title': 'Facility readiness', 'description': 'Describe the space as it is today, including any work still needed.',
     'fields': [('classroom', 'Classroom space and ventilation', 'textarea'), ('play_area', 'Play area and safe access', 'textarea'),
                ('utilities', 'Water, toilets, electricity and sanitation', 'textarea'), ('inspection', 'Inspection findings or arrangements for inspection', 'textarea')]},
    {'key': 'safety', 'title': 'Safety and protection plans', 'description': 'Prepare procedures for a safe opening. Do not enter actual incident or child health records.',
     'fields': [('emergency_contacts', 'Emergency contacts', 'textarea'), ('evacuation', 'Evacuation procedure', 'textarea'),
                ('first_aid', 'First-aid supplies and responsible person', 'textarea'), ('child_protection', 'Child protection and safe collection procedure', 'textarea'),
                ('illness', 'Procedure for illness and health referrals', 'textarea')]},
    {'key': 'program', 'title': 'Proposed program', 'description': 'Describe what you plan to provide after authorization. Attendance and completed assessments are not required.',
     'fields': [('curriculum', 'Proposed learning activities', 'textarea'), ('routine', 'Proposed daily routine', 'textarea'),
                ('nutrition', 'Proposed nutrition or feeding arrangements', 'textarea'), ('assessment', 'Plan for observing and assessing development', 'textarea'),
                ('families', 'Plan for communicating with families', 'textarea')]},
    {'key': 'documents', 'title': 'Supporting documents', 'description': 'List available ownership, organization or LGU documents. A previous accreditation or an already-issued operating grant is not required here.',
     'fields': [('inventory', 'Documents available and what each supports', 'textarea'), ('pending', 'Documents still being arranged (or “None”)', 'textarea')]},
]


def section_status(section, record):
    data = record.data if record else {}
    missing = [label for key, label, kind in section['fields'] if not str(data.get(key, '')).strip()]
    if section['key'] == 'documents' and not (record and record.evidence):
        missing.append('Supporting file')
    return {'done': not missing, 'missing': missing}


def preparation_summary(cdc):
    records = {record.section: record for record in cdc.preopening_requirements.all()}
    groups = []
    for section in SECTIONS:
        record = records.get(section['key'])
        state = section_status(section, record)
        groups.append({'key': section['key'], 'label': section['title'], 'title': section['title'],
                       'description': section['description'], 'next': section['description'], **state,
                       'status': 'Prepared' if state['done'] else 'Draft' if record else 'Not started'})
    completed = sum(group['done'] for group in groups)
    return {'groups': groups, 'completedCount': completed, 'readiness': round(completed / len(groups) * 100),
            'complete': completed == len(groups)}
