"""Add a small, linked demonstration dataset without replacing existing records."""
from collections import Counter
from datetime import date, datetime, time, timedelta
import csv
import io
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core import models as m
from core.report_definitions import REPORT_TYPE_CHOICES, QUARTERLY_REPORT_DEFINITIONS
from core.services.analytics_service import compute_performance_score
from core.services.data_integration_service import DataIntegrationService as Integration
from core.services.report_file_service import ReportFileService


TAG = '[SAMPLE]'


class Command(BaseCommand):
    help = 'Add linked sample data; preserve existing data and skip previously created samples.'

    def add_arguments(self, parser):
        parser.add_argument('--as-of', default='2026-10-07', help='Reference date (YYYY-MM-DD).')
        parser.add_argument('--manifest', default='output/sample-data-manifest.json')
        parser.add_argument('--admin-username', help='Use an existing administrator instead of creating sample_admin.')

    def put(self, model, lookup, **values):
        obj = model.objects.filter(**lookup).first()
        if obj:
            return obj
        obj = model(**lookup, **values)
        obj.full_clean()
        obj.save()
        self.created[model.__name__] += 1
        self.records.append({'model': model.__name__, 'id': obj.pk})
        return obj

    def pdf(self, obj, field, label):
        if getattr(obj, field):
            return
        content = ReportFileService._build_pdf_from_pages([
            ['SAMPLE DATA - NOT AN OFFICIAL DOCUMENT', label,
             'Fictional demonstration evidence for interface testing.',
             f'Reference date: {self.today.isoformat()}']
        ])
        name = f'sample_{obj._meta.model_name}_{obj.pk}_{field}.pdf'
        getattr(obj, field).save(name, ContentFile(content), save=True)

    def handle(self, *args, **options):
        self.today = date.fromisoformat(options['as_of'])
        self.now = timezone.make_aware(datetime.combine(self.today, time(9)), ZoneInfo('Asia/Manila'))
        self.created = Counter()
        self.records = []
        with transaction.atomic():
            self.year = m.AcademicYear.objects.filter(start_date__lte=self.today, end_date__gte=self.today).first()
            if not self.year:
                start = self.today.year if self.today.month >= 6 else self.today.year - 1
                self.year = self.put(m.AcademicYear, {'name': f'{start}-{start + 1}'}, start_year=start,
                    end_year=start + 1, start_date=date(start, 6, 1), end_date=date(start + 1, 5, 31),
                    is_active=not m.AcademicYear.objects.filter(is_active=True).exists())
            self.users = {}
            for role, first, last in [('admin', 'Andrea', 'Reyes'), ('staff', 'Miguel', 'Santos'),
                                     ('cho', 'Elena', 'Cruz'), ('planning', 'Paolo', 'Ramos'),
                                     ('cdw', 'Liza', 'Mendoza'), ('cdw_empty', 'Nina', 'Garcia')]:
                if role == 'admin' and options.get('admin_username'):
                    self.users[role] = m.User.objects.get(username=options['admin_username'], role='admin', is_active=True)
                    continue
                actual_role = 'cdw' if role == 'cdw_empty' else role
                user = m.User.objects.filter(username=f'sample_{role}').first()
                if not user:
                    user = m.User(username=f'sample_{role}', first_name=first, last_name=last,
                        email=f'sample.{role}@example.test', role=actual_role,
                        office_source={'cho': 'cho', 'planning': 'city_planning'}.get(role, 'cswdo'),
                        bio='Fictional sample account for local system testing.',
                        address='Sample office, Lucena City', department='Sample ECCD Services',
                        position=actual_role.upper(), employee_id=f'DEMO-{role.upper()}',
                        phone_number='00000000000')
                    user.set_password('SampleDemo!2026')
                    user.full_clean()
                    user.save()
                    self.created['User'] += 1
                self.users[role] = user
            self.admin, self.staff, self.cdw = (self.users[k] for k in ['admin', 'staff', 'cdw'])
            self.centers = []
            # Existing geographic names keep sample markers connected to the map polygons.
            scenarios = [('Maligaya Learning Center', 'Barangay 3 (Pob.)', 12, 20, 13.9379, 121.6125),
                         ('Pag-asa Learning Center', 'Barangay 4 (Pob.)', 9, 8, 13.9348, 121.6120),
                         ('Bayanihan Learning Center', 'Barangay 5 (Pob.)', 6, 15, 13.9323, 121.6150),
                         ('New Center - Empty Scenario', 'Barangay 6 (Pob.)', 0, 20, 13.9314, 121.6115)]
            self.guide = self.put(m.CurriculumGuide, {'title': f'{TAG} Learning through play'},
                school_year=self.year.name, learning_framework='NELF and ELDS',
                description='Sample guide: language, counting, movement and cooperative play.',
                learning_domains=['physical', 'cognitive', 'language', 'socio_emotional'],
                weekly_focus='Our family and community', required_activities='Story circle; sorting; outdoor play',
                materials_guidance='Picture cards, blocks and washable crayons',
                assessment_guidance='Observe participation and document progress weekly.',
                adaptation_guidance='Use visual cues and allow additional response time.', created_by=self.staff)
            self.pdf(self.guide, 'attachment', self.guide.title)
            self.put(m.CurriculumGuide, {'title': f'{TAG} Previous learning guide'},
                school_year=f'{self.year.start_year-1}-{self.year.start_year}', status='archived',
                description='Archived sample guide retained for history.', created_by=self.staff)
            for index, (name, barangay_name, count, capacity, lat, lng) in enumerate(scenarios):
                barangay = self.put(m.Barangay, {'name': barangay_name}, population_children_3_4=0)
                cdc = self.put(m.CDC, {'name': f'{TAG} {name}'}, barangay=barangay,
                    assigned_cdw=self.users['cdw_empty'] if index == 3 else self.cdw,
                    latitude=lat, longitude=lng, max_capacity=capacity, capacity_per_session=capacity,
                    sessions_per_day=1, current_enrollment=0,
                    address=f'Sample learning site, {barangay_name}, Lucena City',
                    contact_person='Liza Mendoza (sample)', contact_number='00000000000',
                    email=f'sample.center{index+1}@example.test', operating_days='Monday to Friday',
                    operating_hours='08:00 AM - 11:00 AM', has_water_supply=True,
                    has_sanitation=True, has_electricity=True, building_type='barangay', total_area=65,
                    offers_preschool=True, has_feeding_program=index < 3, has_health_services=index < 3,
                    establishment_date=date(2022, 6, 1), special_notes='Fictional SAMPLE center; approximate demonstration location.',
                    registration_purpose='Sample ECCD service delivery and workflow testing.',
                    total_staff=2 if count else 0, qualified_caregivers=1 if count else 0,
                    volunteers=1 if count else 0, is_accredited=index == 0,
                    accreditation_status=['accredited', 'under_review', 'pending', 'pending'][index],
                    license_number=f'SAMPLE-LICENSE-{index+1}' if index == 0 else None,
                    accreditation_date=self.today-timedelta(days=40) if index == 0 else None,
                    license_expiry_date=self.today+timedelta(days=700) if index == 0 else None,
                    accredited_by=self.admin if index == 0 else None)
                self.centers.append(cdc)
                if count:
                    self.seed_center(cdc, index, count)
                else:
                    self.put(m.CDCAuditLog, {'cdc': cdc, 'summary': f'{TAG} New center registered; records not yet submitted'},
                        actor=self.admin, action='created')
            self.seed_population_workflows()
            self.refresh_derived_data()
            self.seed_notifications()
            self.verify()
        manifest = {'reference_date': str(self.today), 'academic_year': self.year.name,
                    'created_this_run': dict(self.created), 'new_records': self.records,
                    'centers': [{'id': c.pk, 'name': c.name, 'enrollment': c.current_enrollment} for c in self.centers],
                    'accounts': [u.username for u in self.users.values()],
                    'empty_center': self.centers[-1].name}
        path = Path(options['manifest'])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'Sample data ready. Created {sum(self.created.values())} records. Manifest: {path}'))
        self.stdout.write(json.dumps(dict(self.created), indent=2))

    def seed_center(self, cdc, index, count):
        children = []
        names = ['Amira', 'Mateo', 'Sofia', 'Lucas', 'Isabel', 'Gabriel', 'Maya', 'Noah', 'Ana', 'Elias', 'Clara', 'Rafael']
        surnames = ['Mendoza','Santos','Reyes','Cruz','Ramos','Garcia','Flores','Torres','Aquino','Castillo','Bautista','Navarro','Lopez','Rivera','Dela Pena','Valdez']
        for n in range(count + 4):
            surname=surnames[(n+index*5)%len(surnames)]
            status = 'enrolled' if n < count else ['graduated', 'transferred', 'dropped', 'not_enrolled'][n-count]
            age = 3 + n % 2
            child = self.put(m.Child, {'student_id': f'SAMPLE-{self.year.start_year}-{index+1:02}-{n+1:03}'},
                cdc=cdc, barangay=cdc.barangay, academic_year=self.year,
                name=f'{names[n%12]} Sample {surname}', first_name=names[n%12], middle_name='Sample',
                last_name=surname, sex='female' if n % 2 == 0 else 'male',
                date_of_birth=date(self.year.start_year-age, 1, 15), place_of_birth='Lucena City',
                complete_address=f'Sample household {n+1}, {cdc.barangay.name}',
                enrollment_date=self.year.start_date+timedelta(days=n*3) if status != 'not_enrolled' else None,
                current_status=status, father_name=f'Marco Sample {surname}',
                mother_name=f'Rosa Sample {surname}', guardian_name=f'Rosa Sample {surname}',
                guardian_relationship='Mother', contact_number='00000000000', occupation='Sample vendor',
                emergency_contact_person=f'Marco Sample {surname}', emergency_contact_number='00000000000',
                height=98+n%5, weight=12 if n == 0 else 16+n%3,
                immunization_status='complete' if n % 4 else 'partial',
                nutritional_status='underweight' if n == 0 else 'normal',
                allergies='None reported', medical_conditions='None reported', blood_type='O+',
                health_remarks='Fictional sample measurements for software testing.',
                is_special_needs=n == 1, type_of_special_need='Language support' if n == 1 else '',
                areas_needing_support='Expressive communication' if n == 1 else '',
                recommended_intervention='Visual prompts and guided storytelling' if n == 1 else '',
                special_needs_assessment_date=self.today-timedelta(days=14) if n == 1 else None,
                special_needs_assessed_by='Elena Cruz (sample)' if n == 1 else '',
                follow_up_notes='Review learning progress next month.' if n == 1 else '')
            children.append(child)
        cdc.current_enrollment = m.Child.objects.filter(cdc=cdc, academic_year=self.year, current_status='enrolled').count()
        cdc.save(update_fields=['current_enrollment'])
        for n, child in enumerate(children[:4]):
            self.put(m.ChildHealthRecord, {'child': child, 'medical_notes': f'{TAG} Routine check-up {n+1}'},
                cdc=cdc, screening_date=self.today-timedelta(days=14-n), checkup_type=['nutrition','general','dental','vision'][n],
                conducted_by='nurse', conducted_by_name='Elena Cruz (sample)', height=child.height, weight=child.weight,
                immunization_status=child.immunization_status, nutritional_status=child.nutritional_status,
                health_findings='Weight monitoring advised.' if n == 0 else 'No concerns observed in sample screening.',
                advice_given='Balanced meals, daily activity and regular check-ups.', allergies=child.allergies,
                needs_referral=n == 0, referred_to='nutrition_worker' if n == 0 else '',
                referral_reason='Review sample growth measurements.' if n == 0 else '',
                follow_up_needed=n == 0, follow_up_date=self.today+timedelta(days=14) if n == 0 else None,
                status=['verified', 'submitted', 'under_review', 'returned'][n], recorded_by=self.cdw,
                verified_by=self.staff if n == 0 else None, verified_on=self.now if n == 0 else None,
                review_remarks='Add the screening signature.' if n == 3 else '')
            self.put(m.ChildAssessmentRecord, {'child': child, 'observation_notes': f'{TAG} Participated in sorting and story circle.'},
                cdc=cdc, assessment_date=self.today-timedelta(days=7), assessment_method='observation',
                domain='language', checklist_result='Developing' if n == 1 else 'Age-appropriate participation',
                follow_up_actions='Repeat guided storytelling next week.', assessed_by=self.cdw)
            domains = json.loads((Path(__file__).resolve().parents[2] / 'sample_data' / 'developmental_domains.json').read_text())
            checklist = {d['key']: [{'id': f"{d['key']}_{k+1}", 'label': label,
                'present': 'unable' if (k+n)%7 == 0 else 'present', 'comments': 'Sample observation.'}
                for k, label in enumerate(d['items'])] for d in domains}
            domain_scores = {key: {'raw_score': sum(i['present']=='present' for i in items),
                'unable_score': sum(i['present']=='unable' for i in items), 'total': len(items),
                'percent': round(sum(i['present']=='present' for i in items)/len(items)*100)}
                for key,items in checklist.items()}
            domain_scores['standard_score'] = [100,70,125,0][n]
            self.put(m.SpecialNeedsAssessment, {'child': child, 'remarks': f'{TAG} Fictional developmental screening; not a diagnosis.'},
                cdc=cdc, assessed_by=self.cdw, assessment_date=self.today-timedelta(days=7),
                examiner_name='Liza Mendoza (sample)', place_administered=cdc.name,
                child_profile={'child_name': child.name, 'sex': child.sex, 'date_of_birth': str(child.date_of_birth),
                    'address':child.complete_address,'presently_studying':'Yes','school_name':cdc.name,
                    'father_name':child.father_name,'mother_name':child.mother_name,
                    'father_occupation':'Vendor','mother_occupation':'Home-based worker',
                    'siblings_count':'1','birth_order':'1','family_environment':'Supportive fictional household.',
                    'parent_stimulation':'Shared reading and play.','home_environment':'Dedicated play corner.'},
                checklist=checklist, domain_scores=domain_scores,
                result=['no_concern','needs_monitoring','for_referral','needs_further_assessment'][n],
                status='draft' if n == 3 else 'submitted', submitted_on=None if n == 3 else self.now)
        for n, (person, role) in enumerate([('Liza Mendoza (sample)', 'cdw'), ('Mario Santos (sample)', 'volunteer')]):
            staff = self.put(m.StaffProfile, {'cdc': cdc, 'full_name': person}, role_type=role,
                linked_user=self.cdw if n == 0 else None, highest_education='bachelors' if n == 0 else 'high_school',
                hire_date=date(2024, 6, 1), has_eccd_training=n == 0, is_qualified=n == 0,
                is_primary_caregiver=n == 0, first_aid_certified=n == 0, recorded_by=self.staff,
                notes=f'{TAG} Fictional center staff profile.')
            self.put(m.StaffTrainingRecord, {'staff_profile': staff, 'title': f'{TAG} ECCD and first aid orientation'},
                cdc=cdc, training_type='eccd', provider='Sample Training Office',
                completed_on=self.today-timedelta(days=90), valid_until=self.today+timedelta(days=365) if n == 0 else self.today-timedelta(days=7),
                hours=16, certificate_number=f'SAMPLE-TRAIN-{cdc.pk}-{n}', recorded_by=self.staff)
        self.put(m.StaffSchedule, {'cdc': cdc, 'notes': f'{TAG} Morning session staffing'},
            effective_from=self.year.start_date, effective_to=self.year.end_date,
            teacher_count=1, assistant_count=1, trained_adult_count=1,
            schedule_payload=[{'day': day, 'time': '08:00-11:00', 'staff': 'Liza Mendoza and Mario Santos (sample)'}
                              for day in ['Monday','Tuesday','Wednesday','Thursday','Friday']], recorded_by=self.cdw)
        self.put(m.EmergencyReadiness, {'cdc': cdc, 'notes': f'{TAG} Quarterly emergency readiness review'},
            assessment_date=self.today-timedelta(days=10), has_first_aid_kit=True,
            first_aid_kit_checked_on=self.today-timedelta(days=10), fire_safety_equipment_available=index != 1,
            last_drill_date=self.today-timedelta(days=30), drills_this_year=2,
            emergency_contact_name='Sample barangay response desk', emergency_contact_number='00000000000', assessed_by=self.staff)
        self.put(m.SafetyIncident, {'cdc': cdc, 'description': f'{TAG} Minor playground trip during supervised play.'},
            child=children[2], incident_date=self.today-timedelta(days=5), incident_type='injury',
            action_taken='First aid provided and guardian informed (fictional).', status=['closed','monitoring','open'][index],
            resolved_on=self.today-timedelta(days=4) if index == 0 else None, reported_by=self.cdw)
        self.put(m.ChildProtectionRecord, {'cdc': cdc, 'notes': f'{TAG} Policy and orientation review; no individual allegation.'},
            review_date=self.today-timedelta(days=8), written_policy_available=True,
            staff_training_last_date=self.today-timedelta(days=90), parent_orientation_last_date=self.today-timedelta(days=25),
            case_status='none', reviewed_by=self.staff)
        self.put(m.PhysicalEnvironmentAssessment, {'cdc': cdc, 'notes': f'{TAG} Facility walk-through; repair handrail.' if index == 1 else f'{TAG} Facility walk-through completed.'},
            assessment_date=self.today-timedelta(days=10), has_safe_water_supply=True, has_functional_sanitation=True,
            has_stable_electricity=True, classroom_area=65, building_type_observed='barangay',
            building_condition='minor_repairs' if index == 1 else 'safe', handwashing_station_available=True,
            outdoor_play_area_available=True, outdoor_area_fenced=index != 1, proper_drainage=True,
            fire_safety_equipment_available=index != 1, assessed_by=self.staff)
        self.put(m.InteractionObservation, {'cdc': cdc, 'notes': f'{TAG} Morning circle observation'},
            observation_date=self.today-timedelta(days=6), staff_child_interaction_rating=['supportive','developing','needs_support'][index],
            child_child_interaction_rating='supportive', fairness_and_inclusion_observed=True,
            independence_support_observed=True, positive_behavior_guidance_observed=True,
            routines_and_transitions_supportive=index != 2, strengths='Children share materials and take turns.',
            concerns='Provide clearer transition cues.' if index else 'No immediate concerns.',
            follow_up_actions='Use picture schedules.', observed_by=self.staff)
        self.put(m.CurriculumDistribution, {'cdc': cdc}, sent_by=self.staff, sent_at=self.now-timedelta(days=30), notes=f'{TAG} Learning resources distributed.')
        plan = self.put(m.CurriculumPlan, {'cdc': cdc, 'curriculum_title': f'{TAG} Our family and community'},
            guide=self.guide, school_year=self.year.name, implementation_period=self.today.strftime('%B %Y'),
            nelf_aligned=True, elds_aligned=True, play_based=True, learning_domains=self.guide.learning_domains,
            daily_schedule='08:00 arrival; 08:30 story circle; 09:00 play; 10:00 snack; 10:30 reflection',
            activity_areas_description='Reading corner, art table and outdoor movement area.',
            materials_used='Picture cards, blocks, crayons', child_participation=f'{count} enrolled children participate in small groups.',
            special_needs_adaptations='Picture prompts and flexible response time.', evidence_notes='Sample activity log attached.',
            parent_shared=True, status=['verified','under_review','returned'][index], recorded_by=self.cdw,
            submitted_on=self.now-timedelta(days=3), reviewed_by=self.staff if index != 1 else None,
            reviewed_on=self.now if index != 1 else None, review_remarks='Add differentiated activities.' if index == 2 else '')
        self.pdf(plan, 'evidence_attachment', plan.curriculum_title)
        self.seed_compliance(cdc, index)
        self.seed_programs(cdc, count, index)
        self.seed_reports(cdc, children, index)
        self.put(m.CDCAuditLog, {'cdc': cdc, 'summary': f'{TAG} Linked sample records added'},
            action='created', actor=self.admin, field_changes={'sample_data': {'old': None, 'new': True}})
        self.put(m.ActivityLog, {'summary': f'{TAG} Demonstration records prepared for {cdc.name}'},
            actor=self.staff, actor_role='staff', action='sample_data_created', target_type='cdc', target_id=cdc.pk,
            metadata={'sample': True, 'cdc_id': cdc.pk})

    def seed_compliance(self, cdc, index):
        doc = self.put(m.AuthorityDocument, {'cdc': cdc, 'document_number': f'SAMPLE-GTO-{index+1}'},
            document_type='authority_to_operate', title=f'{TAG} Grant to operate - demonstration only',
            issued_on=self.today-timedelta(days=60), expires_on=self.today+timedelta(days=365),
            notes='Fictional authority document; not valid for official use.', verified_by=self.admin)
        self.pdf(doc, 'file', doc.title)
        permit = self.put(m.PermitRecord, {'cdc': cdc, 'notes': f'{TAG} Demonstration operating permit'},
            application_date=self.today-timedelta(days=65), permit_type='initial', status='issued',
            issued_on=self.today-timedelta(days=60), expires_on=self.today+timedelta(days=365), issued_by=self.admin)
        self.pdf(permit, 'inspection_report_file', f'{TAG} Inspection report')
        self.put(m.AnnualEvaluation, {'cdc': cdc, 'school_year': self.year.name},
            evaluation_date=self.today-timedelta(days=12), strengths='Consistent parent engagement and safe indoor spaces.',
            stakeholder_inputs_summary='Sample parent and worker feedback collected.',
            areas_for_improvement='Increase learning materials and follow-up documentation.',
            readiness_status=['ready','progressing','needs_support'][index], evaluated_by=self.staff)
        self.put(m.SupervisoryVisit, {'cdc': cdc, 'findings': f'{TAG} Review classroom routines and records.'},
            visit_date=self.today+timedelta(days=7) if index == 2 else self.today-timedelta(days=4),
            supervisor=self.staff, recommendations='Complete outstanding evidence and review transitions.',
            follow_up_due=self.today+timedelta(days=14), status=['completed','follow_up_needed','scheduled'][index])
        from core.accreditation_checklist import ACCREDITATION_CHECKLIST
        from core.serializers.accreditation_serializer import compute_checklist_scores
        answers = {item['id']: {'compliance': 'yes' if index == 0 or n % 4 else 'no', 'remarks': 'Sample evidence reviewed.'}
                   for section in ACCREDITATION_CHECKLIST['sections'] for n, item in enumerate(section['items'])}
        scores = compute_checklist_scores(answers)
        allowed = {field.name for field in m.AccreditationRequest._meta.fields}
        scores = {key: value for key, value in scores.items() if key in allowed}
        self.put(m.AccreditationRequest, {'cdc': cdc, 'remarks': f'{TAG} Recognition application'},
            requested_by=self.cdw, status=['approved','under_evaluation','needs_revision'][index],
            checklist_snapshot=ACCREDITATION_CHECKLIST, checklist_answers=answers,
            header_answers={'application_status':'New application','cdc_lc_name':cdc.name,'address':cdc.address,
                            'email_address':cdc.email, 'source_of_funds':['Local Government Unit (LGU)']},
            staff_evaluator=self.staff, staff_remarks='Sample evidence reviewed.', staff_evaluated_at=self.now,
            admin_approver=self.admin if index == 0 else None, final_decision_at=self.now if index == 0 else None,
            admin_remarks='Approved for demonstration only.' if index == 0 else '', **scores)

    def seed_programs(self, cdc, count, index):
        program = self.put(m.FeedingProgram, {'cdc': cdc, 'title': f'{TAG} October nutrition support'},
            created_by=self.cdw, start_date=self.today+timedelta(days=1) if index==2 else self.today-timedelta(days=7), target_feeding_days=10,
            budget_allocation=count*10*25, target_beneficiaries=count, status=['active','on_hold','draft'][index],
            notes='Fictional program. Sample meals and attendance demonstrate monitoring.')
        from core.services.feeding_program_service import FeedingProgramService
        for n, day in enumerate(FeedingProgramService().build_schedule_dates(program)):
            status = 'scheduled' if index==2 or day>=self.today else ['completed','completed','missed','cancelled'][min(n,3)]
            self.put(m.FeedingDay, {'program': program, 'feeding_date': day}, status=status,
                beneficiaries_served=count-1 if status == 'completed' else 0,
                attendance_count=count-1 if status == 'completed' else 0,
                meals_served=count-1 if status == 'completed' else 0, auto_generated=False,
                recorded_by=self.cdw if status != 'scheduled' else None,
                recorded_at=self.now if status != 'scheduled' else None,
                notes='Vegetable rice and fruit (sample).' if status == 'completed' else f'{TAG} {status.title()} session')
        for n, status in enumerate(['completed','scheduled','rescheduled','cancelled']):
            self.put(m.ParentSeminar, {'cdc': cdc, 'seminar_title': f'{TAG} {status.title()} - '+['Positive parenting','Healthy packed meals','Home reading','Family play day'][n]},
                date_conducted=self.today-timedelta(days=20) if n == 0 else self.today+timedelta(days=7+n),
                time_conducted=time(13,30), venue=cdc.name, facilitator='Miguel Santos (sample)',
                participants_count=count-2 if n == 0 else 0, topics='Responsive care, nutrition and learning at home.',
                materials='Sample parent handout', remarks='Demonstration event.', status=status, recorded_by=self.cdw)
        self.put(m.Budget, {'cdc': cdc, 'year': self.today.year, 'source': 'LGU'},
            amount=float(program.budget_allocation), created_by=self.admin)
        self.put(m.SNP, {'barangay': cdc.barangay, 'notes': f'{TAG} Neighborhood play outreach'},
            handled_by=self.staff, total_children=4+index, target_children=10, sessions_per_week=2,
            hours_per_session=2, orientation_date=self.today-timedelta(days=25), participants_identified=4+index,
            volunteers_involved=2, parent_orientation_count=4+index, certificate_issued=index == 0,
            is_active=index != 2, deleted_at=self.now if index == 2 else None)

    def seed_reports(self, cdc, children, index):
        enrolled = [c for c in children if c.current_status == 'enrolled']
        count = len(enrolled)
        statuses = ['approved','submitted','under_review','needs_revision','rejected','draft']
        for n, (kind, label) in enumerate(REPORT_TYPE_CHOICES):
            definition = QUARTERLY_REPORT_DEFINITIONS.get(kind, {})
            fields = {f['key']: 0 if f.get('type') == 'number' else 'Sample observation: activities implemented with follow-up documented.'
                      for section in definition.get('sections', []) for f in section['fields']}
            fields.update(total_enrolled=count, male=sum(c.sex=='male' for c in enrolled),
                female=sum(c.sex=='female' for c in enrolled), new_enrollees=count, dropouts=1,
                age_3=sum(c.age==3 for c in enrolled), age_4=sum(c.age==4 for c in enrolled),
                average_attendance=f'{round((count-1)/count*100,1)}%', absentee_rate=f'{round(100/count,1)}%',
                total_children_assessed=4, number_with_delay=1, number_normal=3,
                children_weighed=4, children_measured=4, nutrition_normal=3, nutrition_underweight=1,
                nutrition_severely_underweight=0, active_parents=count-2, inactive_parents=2,
                building_status='Needs minor repairs' if index == 1 else 'Safe', water_supply='Available',
                toilet_condition='Functional', emergency_exits='Clearly marked',
                first_aid_kit_availability='Available', chairs=str(cdc.max_capacity), tables='4')
            period_type = 'monthly' if kind == 'cdc_monthly_report' else 'annual' if kind == 'cdc_annual_report' else 'quarterly'
            payload = {'sample':True, 'fields':fields,
                'report_meta':{'center_name':cdc.name,'barangay_name':cdc.barangay.name,'cdw_name':self.cdw.get_full_name()},
                'formData':{'totalChildren':count,'currentEnrollment':count,'cdcName':cdc.name,
                    'barangay':cdc.barangay.name,'district':'Lucena City','address':cdc.address,
                    'contactPerson':cdc.contact_person,'contactNo':cdc.contact_number,
                    'toddlers':0,'preschoolers':count,'totalCaregivers':1,'totalVolunteers':1,
                    'enrollmentCapacity':cdc.max_capacity,'operatingDays':cdc.operating_days,
                    'hoursOpen':cdc.operating_hours,'waterSource':'Piped water','toiletType':'Flush toilet',
                    'feedingProgram':'Yes','remarks':'Fictional sample profile.',
                    'firstName':'Liza','lastName':'Mendoza','middleName':'Sample','age':34,'sex':'Female',
                    'birthday':'1992-04-15','civilStatus':'Married','noChildren':2,
                    'email':self.cdw.email,'mobileNo':'00000000000','officeNo':'00000000000',
                    'educationLevel':"Bachelor's Degree",'eligibility':'Sample ECCD training',
                    'yearsAsWorker':4,'salary':12000,'honoraria':1000,'allowance':500,
                    'parentsContribution':0,'totalCompensation':13500,'barangayAmount':1000,
                    'cityAmount':12500,'ngosAmount':0,'parentsAmount':0,'othersCompensation':0,
                    'termsOfEmployment':'Contractual','status':'Active','sessionsPerDay':1,
                    'hoursPerSession':3,'ageGroups':['3','4'],'hoursInCenter':4,'withReferenceMaterials':'Yes'},
                'trainings':[{'title':'Sample ECCD orientation','dates':str(self.today-timedelta(days=90)),
                              'hours':16,'sponsor':'Sample Training Office'}],
                'otherCourses':[{'course':'Sample inclusive learning workshop','year':self.today.year}],
                'period':{'label':f'Q4 {self.today.year}'},
                'auto_calculated':{'enrollment':count,'capacity':cdc.effective_capacity,'utilization':round(count/cdc.effective_capacity*100,1),
                                   'total_enrolled':count,'current_enrollment':count,'total_staff':2},
                'template_sections':[{'title':'Enrollment and operations','autoText':f'{count} active child profiles.',
                    'notes':'Sample operational snapshot as of '+str(self.today),
                    'table':[['Enrolled children',count],['Capacity',cdc.max_capacity],['Staff',2]]}],
                'charts':[{'label':'Attendance','value':round((count-1)/count*100,1)}]}
            status = statuses[(n+index)%len(statuses)]
            report = self.put(m.Report, {'cdc':cdc,'title':f'{TAG} {label}'},
                academic_year=self.year, submitted_by=self.cdw, report_type=kind,
                period_type=period_type, month=self.today.month if period_type=='monthly' else 0,
                quarter=(self.today.month-1)//3+1, year=self.today.year, payload=payload,
                summary='Fictional sample report linked to this center and its child records.',
                status=status, is_complete=status not in ['draft','needs_revision'], is_on_time=n%4!=0,
                review_remarks='Attach the remaining sample evidence.' if status=='needs_revision' else 'Sample review decision.' if status in ['approved','rejected'] else '',
                staff_reviewed_by=self.staff if status in ['approved','rejected','needs_revision'] else None,
                staff_reviewed_on=self.now if status in ['approved','rejected','needs_revision'] else None,
                admin_reviewed_by=self.admin if status=='approved' else None,
                admin_reviewed_on=self.now if status=='approved' else None)
            if not report.pdf_attachment:
                ReportFileService.attach_generated_report_file(report)
                report.save()
                if not report.pdf_attachment:
                    self.pdf(report,'pdf_attachment',report.title)
            if kind == 'health_nutrition':
                self.put(m.HealthNutrition, {'report':report}, total_children=4, malnourished=1, normal=3)
            if kind == 'facility_status':
                self.put(m.Sanitation, {'report':report}, has_clean_water=True, has_toilet=True, waste_disposal=True)
        for month in [6,7,8]:
            period_end=date(self.today.year,month+1,1)-timedelta(days=1)
            historical_count=sum(c.enrollment_date<=period_end for c in enrolled)
            history=self.put(m.Report,{'cdc':cdc,'title':f'{TAG} Enrollment history {self.today.year}-{month:02}'},
                academic_year=self.year,submitted_by=self.cdw,report_type='cdc_monthly_report',
                period_type='monthly',month=month,quarter=(month-1)//3+1,year=self.today.year,
                status='approved',is_complete=True,is_on_time=True,
                payload={'sample':True,'formData':{'totalChildren':historical_count},
                         'period':{'label':f'{self.today.year}-{month:02}'},
                         'auto_calculated':{'enrollment':historical_count,'capacity':cdc.effective_capacity},
                         'template_sections':[{'title':'Enrollment snapshot','notes':'Sample historical count from enrollment dates.',
                                               'table':[['Enrolled children',historical_count]]}]})
            if not history.pdf_attachment:
                ReportFileService.attach_generated_report_file(history)
                history.save()
        self.put(m.ReportDraft, {'user':self.cdw,'cdc':cdc,'report_type':'child_profile','period_type':'quarterly',
                               'month':0,'quarter':4,'year':self.today.year,'academic_year':self.year},
            title=f'{TAG} Enrollment report in progress', payload={'fields':{'total_enrolled':count},'sample':True})

    def seed_population_workflows(self):
        cho, planning = self.users['cho'], self.users['planning']
        schedule = self.put(m.PopulationRequestSchedule, {'title':f'{TAG} Quarterly population refresh'},
            purpose='Demonstrate recurring population requests.', instructions='Use fictional sample records only.',
            assigned_to=cho, created_by=self.admin, frequency='quarterly',
            next_period_start=date(self.today.year+1,1,1), due_days=14)
        for n, status in enumerate(['awaiting_submission','under_review','needs_revision','completed','cancelled']):
            request = self.put(m.PopulationDataRequest, {'title':f'{TAG} Population request - {status}'},
                purpose='Demonstrate population submission, review and revision workflows.',
                instructions='Fictional sample subset; does not replace the validated population basis.',
                period_start=date(self.today.year,7,1), period_end=date(self.today.year,9,30),
                due_date=self.today+timedelta(days=3) if n==0 else self.today-timedelta(days=5),
                revision_due_date=self.today-timedelta(days=1) if n==2 else None,
                academic_year=self.year, assigned_to=cho, created_by=self.admin, status=status,
                completed_at=self.now if n==3 else None,
                cancellation_reason='Duplicate sample request cancelled.' if n==4 else '')
            if status in ['awaiting_submission','cancelled']:
                continue
            submission_status = {'under_review':'under_planning_review','needs_revision':'returned_to_cho','completed':'archived'}[status]
            rows = [{'name':c.name,'age':c.age,'gender':c.sex,'barangay':c.barangay.name}
                    for c in m.Child.objects.filter(student_id__startswith='SAMPLE-',cdc__in=self.centers[:3],current_status='enrolled').select_related('barangay')]
            sexes = Counter(r['gender'] for r in rows)
            ages = Counter(str(r['age']) for r in rows)
            breakdown = Counter(r['barangay'] for r in rows)
            sub = self.put(m.PopulationDataSubmission, {'data_request':request},
                submitted_by=cho, academic_year=self.year, title=f'{TAG} Population subset - {status}',
                description='Fictional 27-child sample extract for review only; existing validated basis is preserved.',
                data_payload={'records':rows}, status=submission_status,
                total_population=len(rows), total_records=len(rows), data_sources=1,
                age_distribution=dict(ages), gender_distribution=dict(sexes), barangay_breakdown=dict(breakdown),
                processed_by_planning=planning, processed_on=self.now-timedelta(days=2),
                revision_reason='incomplete_fields' if n==2 else '',
                revision_remarks='Confirm household addresses before resubmission.' if n==2 else '',
                returned_to_cho_by=planning if n==2 else None, returned_to_cho_on=self.now if n==2 else None,
                sent_to_cswdo_by=planning if n==3 else None, sent_to_cswdo_on=self.now-timedelta(days=1) if n==3 else None,
                received_by_cswdo_on=self.now if n==3 else None)
            if not sub.data_file:
                stream=io.StringIO()
                writer=csv.DictWriter(stream,fieldnames=['name','age','gender','barangay'])
                writer.writeheader(); writer.writerows(rows)
                sub.data_file.save(f'sample_population_{status}.csv',ContentFile(stream.getvalue().encode()),save=True)
            self.put(m.PopulationDataHistory, {'submission':sub,'action':'sample_workflow'}, status=submission_status,
                message=f'{TAG} Demonstration workflow: {sub.get_status_display()}', acted_by=planning,
                remarks=sub.revision_remarks, current_location='CHO' if n==2 else 'City Planning')

    def refresh_derived_data(self):
        for cdc in self.centers[:3]:
            barangay = cdc.barangay
            metric = Integration.get_current_population_metrics(barangay,self.year)
            # Preserve an existing validated denominator. In a new database provide a small basis.
            if not metric:
                sub = self.put(m.PopulationDataSubmission, {'title':f'{TAG} Validated demonstration basis - {barangay.name}'},
                    submitted_by=self.users['cho'],academic_year=self.year,status='current_basis',
                    total_population=40,total_records=40,data_sources=1,
                    description='Sample aggregate: 40 eligible children, including the enrolled sample profiles.',
                    data_payload={'rows': [{'barangay':barangay.name,'age':3+i%2} for i in range(40)]},
                    age_distribution={'3':20,'4':20},gender_distribution={'male':20,'female':20},
                    barangay_breakdown={barangay.name:40}, received_by_cswdo_on=self.now)
                metric=self.put(m.BarangayPopulationMetrics,{'barangay':barangay,'academic_year':self.year},
                    source_submission=sub,total_population=40,children_3_5=40,children_3_4=40,male_population=20,female_population=20,
                    children_with_disabilities=1,data_quality_score=100)
                barangay.population_children_3_4=40
                barangay.save(update_fields=['population_children_3_4'])
            Integration._calculate_gap_analysis(barangay,self.year)
            Integration._generate_snp_recommendation(barangay,self.year)
            compute_performance_score(cdc)
            gap=Integration.get_current_gap_analysis(barangay,self.year)
            self.put(m.Analytics, {'cdc':cdc}, enrollment_rate=round(cdc.current_enrollment/cdc.effective_capacity*100,2),
                attendance_rate=round((cdc.current_enrollment-1)/cdc.current_enrollment*100,2),
                coverage_rate=gap.eligible_coverage_rate_3_4,service_gap=gap.public_cdc_gap_children_3_4,
                overcrowded=cdc.current_enrollment>cdc.effective_capacity)
            self.put(m.DataIntegrationLog, {'barangay':barangay,'message':f'{TAG} Sample enrollment refreshed from child records.'},
                academic_year=self.year,source_submission=metric.source_submission,integration_type='enrollment_update',
                affected_records_count=cdc.current_enrollment,status='success')
            # Use the application's own summary builder after all linked records exist.
            new_report_ids=[r['id'] for r in self.records if r['model']=='Report']
            annual=m.Report.objects.filter(cdc=cdc,report_type='cdc_annual_report',pk__in=new_report_ids).first()
            if annual:
                from core.services.cdc_annual_report_service import CDCAnnualReportService
                annual.payload=CDCAnnualReportService.build_payload(cdc,self.today.year,self.year)
                annual.payload['sample']=True
                annual.payload['formData']={'totalChildren':cdc.current_enrollment}
                ReportFileService.attach_generated_report_file(annual)
                annual.save()

    def seed_notifications(self):
        from core.services.notification_service import NotificationService
        for user in self.users.values():
            # Use real notification keys and links so normal synchronization keeps them active.
            for n, item in enumerate(NotificationService._build_generated_notifications(user)):
                self.put(m.Notification, {'user':user,'source_key':item['source_key']},
                    title=item['title'],message=item['message'],category=item['category'],
                    priority=item['priority'],link=item['link'],is_read=n==0,
                    read_at=self.now if n==0 else None)

    def verify(self):
        for cdc in self.centers:
            actual=m.Child.objects.filter(cdc=cdc,academic_year=self.year,current_status='enrolled').count()
            if cdc.current_enrollment!=actual:
                raise CommandError(f'Enrollment mismatch in {cdc.name}')
        for cdc in self.centers[:3]:
            gap=Integration.get_current_gap_analysis(cdc.barangay,self.year)
            actual=m.Child.objects.filter(barangay=cdc.barangay,academic_year=self.year,current_status='enrolled',cdc__isnull=False)
            eligible=sum(2<=c.age_for_academic_year(self.year)<=5 for c in actual)
            if gap.public_cdc_enrollment_children_3_4!=eligible:
                raise CommandError(f'Gap calculation mismatch in {cdc.barangay.name}')
