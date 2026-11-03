"""Connected workflow scenarios used by the backup-first demo reset."""
from copy import deepcopy
from collections import Counter
from datetime import date, timedelta
import json
from pathlib import Path

from django.apps import apps
from django.core.management.base import CommandError
from django.db import models, transaction

from core import models as records
from core.management.commands.seed_sample_data import Command as BaseSeeder
from core.services.preopening_service import SECTIONS
from core.services.report_file_service import ReportFileService


class Command(BaseSeeder):
    help = 'Seed connected demonstration scenarios; intended for an empty demo database.'

    def handle(self, *args, **options):
        if records.CDC.objects.exists():
            raise CommandError('Use reset_demo_data to back up and reset an existing dataset first.')
        with transaction.atomic():
            super().handle(*args, **options)
            self.complete_scenarios()
            self.history_and_map_scenarios()
            self.normalize_labels()
            from core.services.analytics_service import compute_performance_score
            for center in self.centers[:3]:
                compute_performance_score(center)
            self.seed_notifications()
            self.verify()
            result = self.audit()
            if result['missing_statuses']:
                raise CommandError(f"Missing demonstration statuses: {result['missing_statuses']}")
            Path(options['manifest']).write_text(json.dumps(result, indent=2), encoding='utf-8')

    def clone(self, source, **changes):
        values = {field.attname: deepcopy(getattr(source, field.attname))
                  for field in source._meta.concrete_fields
                  if not field.primary_key and not getattr(field, 'auto_now', False)
                  and not getattr(field, 'auto_now_add', False)}
        for key, value in changes.items():
            field = source._meta.get_field(key)
            values.pop(field.attname, None)
            values[key] = value
        instance = type(source)(**values)
        instance.full_clean()
        instance.save()
        return instance

    def complete_scenarios(self):
        for index, center in enumerate(self.centers[:3]):
            center.is_accredited = True
            center.accreditation_status = 'accredited'
            center.license_number = f'SAMPLE-LICENSE-{index + 1}'
            center.accreditation_date = self.today - timedelta(days=60)
            center.license_expiry_date = self.today + timedelta(days=365)
            center.accredited_by = self.admin
            center.save()
            request = records.AccreditationRequest.objects.get(cdc=center)
            if request.status != 'approved':
                request.remarks = 'Sample renewal application; the existing grant remains valid during review.'
                request.save()
        self.users['cdw'].first_name = 'Sample Liza'
        self.users['cdw'].save()
        inactive = records.User.objects.create_user(username='sample_inactive', password='SampleDemo!2026',
            first_name='Sample Inactive', last_name='Worker', role='cdw', office_source='cswdo',
            email='sample.inactive@example.test', is_active=False, deactivated_at=self.now)
        self.users['inactive'] = inactive
        self.preopening_scenarios()
        self.accreditation_scenarios()
        self.operational_scenarios()
        self.population_scenarios()

    def preopening_scenarios(self):
        center = self.centers[-1]
        content = {
            'address': center.address, 'contact_person': 'Sample Nina Garcia', 'contact_number': '00000000000',
            'operating_days': 'Monday to Friday', 'operating_hours': '08:00 to 11:00', 'capacity': '20',
            'staff_names': 'Sample Nina Garcia, proposed CDW; Sample Mario Santos, volunteer.',
            'qualifications': 'Sample CDW: bachelor degree in early childhood education.',
            'training': 'Sample ECCD orientation completed; first aid refresher planned before opening.',
            'schedule': 'Sample team: weekdays, 07:30 to 11:30.',
            'classroom': 'Sample 65 square metre ventilated classroom with low shelves and clear exits.',
            'play_area': 'Sample fenced outdoor play area with supervised access.',
            'utilities': 'Sample piped water, child-accessible toilet, handwashing and electricity checked.',
            'inspection': 'Sample pre-opening inspection booked; no children admitted yet.',
            'emergency_contacts': 'Sample emergency desk: 00000000000 (demonstration only).',
            'evacuation': 'Sample plan: leave through marked exits, assemble at the gate, check the roster.',
            'first_aid': 'Sample Nina maintains the first aid kit and checks expiry dates monthly.',
            'child_protection': 'Sample policy: authorized collectors only; document and refer concerns.',
            'illness': 'Sample plan: contact guardian, supervise separately and refer to the health center.',
            'curriculum': 'Sample play-based stories, counting, art and movement aligned with NELF.',
            'routine': 'Sample arrival, story circle, play, snack, outdoor movement and dismissal.',
            'nutrition': 'Sample menu planning with allergy checks before the first feeding session.',
            'assessment': 'Sample plan: baseline observations after admission and quarterly reviews.',
            'families': 'Sample orientation before opening and monthly parent meetings afterward.',
            'inventory': 'Sample LGU resolution, proposed staff roster and facility inspection request.',
            'pending': 'Sample final inspection clearance is still being arranged.',
        }
        for section in SECTIONS:
            requirement = records.PreOpeningRequirement.objects.create(cdc=center, section=section['key'],
                data={key: content[key] for key, label, kind in section['fields']})
            if section['key'] == 'documents':
                self.pdf(requirement, 'evidence', 'Sample supporting documents; not an authorization')
        draft = records.CDC.objects.create(name='Sample Pre-opening Draft Center', barangay=center.barangay,
            assigned_cdw=self.users['cdw_empty'], max_capacity=20, capacity_per_session=20,
            latitude=13.9320, longitude=121.6120, address='Sample proposed site, Lucena City',
            contact_person='Sample Nina Garcia', contact_number='00000000000')
        records.PreOpeningRequirement.objects.create(cdc=draft, section='basic',
            data={'address': draft.address, 'contact_person': 'Sample Nina Garcia'})

    def accreditation_scenarios(self):
        template = records.AccreditationRequest.objects.get(status='approved')
        for status, label in records.AccreditationRequest.STATUS_CHOICES:
            if records.AccreditationRequest.objects.filter(status=status).exists():
                continue
            center = records.CDC.objects.create(name=f'Sample Application Center - {label}',
                barangay=self.centers[-1].barangay, assigned_cdw=self.users['cdw_empty'],
                latitude=13.9314 + records.CDC.objects.count() * 0.0001, longitude=121.6115,
                address='Sample proposed learning site, Lucena City', max_capacity=20, capacity_per_session=20,
                accreditation_status='rejected' if status == 'rejected' else 'pending' if status in ['draft', 'not_yet_eligible'] else 'under_review')
            assessed = status in ['evaluated_by_staff', 'forwarded_to_admin', 'rejected', 'not_yet_eligible']
            passing = status in ['evaluated_by_staff', 'forwarded_to_admin']
            answers = deepcopy(template.checklist_answers) if passing else {}
            from core.serializers.accreditation_serializer import compute_checklist_scores
            allowed = {field.name for field in records.AccreditationRequest._meta.fields}
            scores = {key: value for key, value in compute_checklist_scores(answers).items() if key in allowed}
            self.clone(template, cdc=center, requested_by=self.users['cdw_empty'], status=status,
                remarks=f'Sample {label} application; no operations before authorization.', checklist_answers=answers,
                header_answers={'cdc_lc_name': center.name, 'address': center.address},
                staff_evaluator=self.staff if assessed else None, staff_evaluated_at=self.now if assessed else None,
                staff_remarks='Sample assessment: missing operating evidence.' if assessed and not passing else '',
                admin_approver=self.admin if status == 'rejected' else None,
                final_decision_at=self.now if status == 'rejected' else None,
                admin_remarks='Sample application denied: required evidence not supplied.' if status == 'rejected' else '', **scores)
        expired = records.CDC.objects.create(name='Sample Expired License Center', barangay=self.centers[-1].barangay,
            latitude=13.9330, longitude=121.6115,
            assigned_cdw=self.users['cdw_empty'], max_capacity=20, capacity_per_session=20,
            accreditation_status='expired', is_accredited=False, license_number='SAMPLE-EXPIRED-01',
            accreditation_date=self.today-timedelta(days=400), license_expiry_date=self.today-timedelta(days=35),
            accredited_by=self.admin, special_notes='Sample former center; no current enrollment while license is expired.')
        for status, label in records.PermitRecord.STATUS_CHOICES:
            if records.PermitRecord.objects.filter(status=status).exists():
                continue
            issued = status in ['temporary', 'expired']
            permit = records.PermitRecord.objects.create(cdc=expired if status == 'expired' else self.centers[-1],
                status=status, permit_type='temporary' if status == 'temporary' else 'initial',
                is_temporary=status == 'temporary', application_date=self.today-timedelta(days=45),
                issued_on=self.today-timedelta(days=40) if issued else None,
                expires_on=self.today+timedelta(days=30) if status == 'temporary' else self.today-timedelta(days=35) if issued else None,
                issued_by=self.admin if issued else None, notes=f'Sample {label} permit scenario; verify official authorization separately.')
            self.pdf(permit, 'inspection_report_file', f'Sample {label} inspection')

    def operational_scenarios(self):
        center = self.centers[0]
        health = records.ChildHealthRecord.objects.filter(cdc=center).first()
        self.clone(health, status='draft', verified_by=None, verified_on=None,
            review_remarks='', health_findings='Sample draft screening awaiting measurements.')
        for index, nutrition in enumerate(['severely_underweight', 'overweight', 'unknown']):
            screened_child = records.Child.objects.filter(cdc=center, current_status='enrolled').order_by('pk')[index+4]
            self.clone(health, child=screened_child, nutritional_status=nutrition, immunization_status=['not_started', 'unknown', 'partial'][index],
                status='submitted', verified_by=None, verified_on=None, height=None, weight=None,
                health_findings=f'Sample {nutrition} screening; measurements require confirmation.',
                needs_referral=nutrition != 'unknown', referred_to='nutrition_worker' if nutrition != 'unknown' else '',
                referral_reason='Sample nutritional follow-up required.' if nutrition != 'unknown' else '')
        child = records.Child.objects.filter(cdc=center).first()
        self.clone(child, student_id='SAMPLE-AGED-OUT-01', first_name='Sample Alumni', middle_name='',
            current_status='aged_out', date_of_birth=date(self.year.start_year-6, 1, 15),
            enrollment_date=date(self.year.start_year-2, 6, 1), health_remarks='Sample former pupil; now above daycare age.')
        report = records.Report.objects.filter(cdc=center, report_type='facility_status').first()
        for status in ['verified_by_staff', 'forwarded_to_admin']:
            self.clone(report, title=f'Sample Legacy Report - {status}', status=status,
                attachment='', pdf_attachment='',
                staff_reviewed_by=self.staff, staff_reviewed_on=self.now, admin_reviewed_by=None, admin_reviewed_on=None,
                summary='Sample retained legacy workflow state; current reports use the modern review flow.')
        plan = records.CurriculumPlan.objects.filter(cdc=center).first()
        for status in ['draft', 'submitted']:
            self.clone(plan, status=status, curriculum_title=f'Sample {status.title()} Curriculum Plan',
                reviewed_by=None, reviewed_on=None, review_remarks='',
                submitted_on=self.now if status == 'submitted' else None)
        visit = records.SupervisoryVisit.objects.filter(cdc=center).first()
        self.clone(visit, status='closed', findings='Sample follow-up closed after evidence verified.', follow_up_due=None)
        staff = records.StaffProfile.objects.filter(cdc=center).first()
        for status in ['inactive', 'on_leave']:
            self.clone(staff, employment_status=status, full_name=f'Sample {status.replace("_", " ").title()} Assistant',
                linked_user=None, is_primary_caregiver=False, role_type='assistant')
        for status in ['monitoring', 'referred', 'closed']:
            records.ChildProtectionRecord.objects.create(cdc=center, case_status=status,
                case_opened=status != 'closed', written_policy_available=True,
                notes=f'Sample anonymized {status} safeguarding scenario; no actual allegation.',
                external_referral_agency='Sample social welfare desk' if status == 'referred' else '', reviewed_by=self.staff)
        for status in ['completed', 'cancelled']:
            start_date = self.today-timedelta(days=60)
            start_date -= timedelta(days=start_date.weekday())
            program = records.FeedingProgram.objects.create(cdc=center, title=f'Sample {status.title()} Nutrition Cycle',
                created_by=self.cdw, start_date=start_date, target_feeding_days=2,
                target_beneficiaries=12, budget_allocation=600, status=status,
                notes='Sample completed two-session cycle.' if status == 'completed' else 'Sample cycle cancelled before delivery; no meals served.')
            for offset in range(2):
                records.FeedingDay.objects.create(program=program, feeding_date=program.start_date+timedelta(days=offset),
                    status=status, beneficiaries_served=12 if status == 'completed' else 0,
                    attendance_count=12 if status == 'completed' else 0, meals_served=12 if status == 'completed' else 0,
                    recorded_by=self.cdw, recorded_at=self.now, notes=f'Sample {status} session')
        for status in ['partial', 'failed']:
            records.DataIntegrationLog.objects.create(barangay=center.barangay, academic_year=self.year,
                integration_type='population_submission', status=status, affected_records_count=0,
                message=f'Sample {status} import: missing household age data; no population basis changed.')

    def population_scenarios(self):
        template = records.PopulationDataSubmission.objects.filter(status='under_planning_review').first()
        for status, label in records.PopulationDataSubmission.STATUS_CHOICES:
            if records.PopulationDataSubmission.objects.filter(status=status).exists():
                continue
            processed = status not in ['submitted', 'received']
            forwarded = status in ['sent_to_cswdo', 'received_by_cswdo', 'rejected_by_admin']
            submission = self.clone(template, data_request=None, title=f'Sample Population Submission - {label}',
                status=status, description='Sample review exercise; not the current validated denominator.',
                processed_by_planning=self.users['planning'] if processed else None,
                processed_on=self.now if processed else None,
                sent_to_cswdo_by=self.users['planning'] if forwarded else None,
                sent_to_cswdo_on=self.now if forwarded else None,
                received_by_cswdo_on=self.now if status == 'received_by_cswdo' else None,
                revised_by_cho_on=self.now if status == 'revised_by_cho' else None,
                revision_reason='incomplete_fields' if status == 'rejected_by_admin' else '',
                revision_remarks='Sample rejected file: confirm household coverage before approval.' if status == 'rejected_by_admin' else '')
            records.PopulationDataHistory.objects.create(submission=submission, action='sample_workflow', status=status,
                acted_by=self.users['planning'] if processed else self.users['cho'],
                message=f'Sample workflow checkpoint: {label}', current_location='CSWDO' if forwarded else 'City Planning')
        recommendations = list(records.SNPPlanningRecommendation.objects.order_by('pk'))
        for index, recommendation in enumerate(recommendations):
            recommendation.status = ['recommended', 'approved', 'in_progress'][index % 3]
            recommendation.reviewed_by = self.admin if index else None
            recommendation.save()

    def history_and_map_scenarios(self):
        from core.services.data_integration_service import DataIntegrationService as Integration
        for index, center in enumerate(self.centers[:3]):
            metric = records.BarangayPopulationMetrics.objects.get(barangay=center.barangay, academic_year=self.year)
            denominator = [16, 20, 40][index]
            metric.total_population = metric.children_3_5 = metric.children_3_4 = denominator
            metric.male_population = metric.female_population = denominator // 2
            metric.save()
            source = metric.source_submission
            source.total_population = source.total_records = denominator
            enrolled_rows = [{'name': child.name, 'age': child.age, 'gender': child.sex, 'barangay': center.barangay.name}
                             for child in records.Child.objects.filter(cdc=center, current_status='enrolled').order_by('pk')]
            source.data_payload = {'records': enrolled_rows + [{'name': f'Sample Household Child {index+1}-{number+1:02}',
                'age': 3+number%2, 'gender': 'male' if number%2 else 'female', 'barangay': center.barangay.name}
                for number in range(len(enrolled_rows), denominator)]}
            source.age_distribution = dict(Counter(str(row['age']) for row in source.data_payload['records']))
            source.gender_distribution = dict(Counter(row['gender'] for row in source.data_payload['records']))
            metric.male_population = source.gender_distribution.get('male', 0)
            metric.female_population = source.gender_distribution.get('female', 0)
            metric.save()
            source.barangay_breakdown = {center.barangay.name: denominator}
            source.description = f'Sample validated denominator of {denominator} eligible children, including enrolled profiles.'
            source.save()
            center.barangay.population_children_3_4 = denominator
            center.barangay.save()
            Integration._calculate_gap_analysis(center.barangay, self.year)
            for years_ago in [3, 2, 1]:
                start = self.year.start_year-years_ago
                year, created = records.AcademicYear.objects.get_or_create(name=f'{start}-{start+1}',
                    defaults={'start_year': start, 'end_year': start+1, 'start_date': date(start, 6, 1),
                              'end_date': date(start+1, 5, 31), 'is_active': False})
                historical_population = denominator - years_ago*2
                historical_source = self.clone(source, title=f'Sample Archived Population {start} - {center.barangay.name}',
                    academic_year=year, status='archived', total_population=historical_population,
                    total_records=historical_population,
                    data_payload={'records': source.data_payload['records'][:historical_population]},
                    age_distribution=dict(Counter(str(row['age']) for row in source.data_payload['records'][:historical_population])),
                    gender_distribution=dict(Counter(row['gender'] for row in source.data_payload['records'][:historical_population])),
                    barangay_breakdown={center.barangay.name: historical_population},
                    description='Sample historical validated population; not the current denominator.',
                    received_by_cswdo_on=self.now.replace(year=start))
                self.clone(metric, academic_year=year, source_submission=historical_source,
                    total_population=historical_population, children_3_5=historical_population,
                    children_3_4=historical_population, male_population=historical_source.gender_distribution.get('male', 0),
                    female_population=historical_source.gender_distribution.get('female', 0))
                historical_enrollment = max(1, center.current_enrollment-years_ago*2)
                report = records.Report.objects.create(cdc=center, academic_year=year, submitted_by=self.cdw,
                    report_type='child_profile', title=f'Sample Historical Enrollment {start} - {center.name}',
                    period_type='monthly', month=9, quarter=3, year=start, status='approved', is_complete=True,
                    staff_reviewed_by=self.staff, admin_reviewed_by=self.admin,
                    payload={'sample': True, 'daycare_age_range': [3, 4], 'formData': {'totalChildren': historical_enrollment},
                        'period': {'label': f'September {start}'},
                        'template_sections': [{'title': 'Sample historical enrollment', 'notes': 'Fictional archived snapshot.',
                            'table': [['Children ages 3-4', historical_enrollment]]}]})
                self.pdf(report, 'pdf_attachment', report.title)
            gap = Integration.get_current_gap_analysis(center.barangay, self.year)
            records.Analytics.objects.filter(cdc=center).update(coverage_rate=gap.eligible_coverage_rate_3_4,
                service_gap=gap.public_cdc_gap_children_3_4)
        for number, status in [(7, 'implemented'), (8, 'completed')]:
            barangay = records.Barangay.objects.create(name=f'Barangay {number} (Pob.)', population_children_3_4=20)
            source = records.PopulationDataSubmission.objects.create(submitted_by=self.users['cho'], academic_year=self.year,
                title=f'Sample Outreach Population - {barangay.name}', status='current_basis', total_population=20,
                total_records=20, data_sources=1, received_by_cswdo_on=self.now,
                data_payload={'records': [{'name': f'Sample Outreach Child {number}-{count+1}', 'age': 3+count%2,
                    'gender': 'male' if count%2 else 'female', 'barangay': barangay.name} for count in range(20)]},
                age_distribution={'3': 10, '4': 10}, gender_distribution={'male': 10, 'female': 10},
                barangay_breakdown={barangay.name: 20})
            records.BarangayPopulationMetrics.objects.create(barangay=barangay, academic_year=self.year,
                source_submission=source, total_population=20, children_3_5=20, children_3_4=20,
                male_population=10, female_population=10, data_quality_score=100)
            Integration._calculate_gap_analysis(barangay, self.year)
            Integration._generate_snp_recommendation(barangay, self.year)
            records.SNPPlanningRecommendation.objects.filter(barangay=barangay, academic_year=self.year).update(
                status=status, reviewed_by=self.admin)
            records.SNP.objects.create(barangay=barangay, handled_by=self.staff, total_children=20, target_children=20,
                sessions_per_week=2, hours_per_session=2, participants_identified=20, volunteers_involved=2,
                orientation_date=self.today-timedelta(days=30), certificate_issued=status == 'completed',
                is_active=status == 'implemented', notes=f'Sample {status} outreach cycle; not CDC enrollment.')

    def normalize_labels(self):
        name_fields = {'name', 'first_name', 'full_name', 'title', 'curriculum_title', 'seminar_title',
                       'guardian_name', 'father_name', 'mother_name', 'contact_person', 'examiner_name',
                       'facilitator', 'conducted_by_name', 'emergency_contact_name'}

        def normalize_payload(value, key=''):
            if isinstance(value, dict):
                return {nested_key: normalize_payload(nested_value, nested_key) for nested_key, nested_value in value.items()}
            if isinstance(value, list):
                return [normalize_payload(item) for item in value]
            if isinstance(value, str):
                value = value.replace('[SAMPLE]', 'Sample')
                if value and key in name_fields | {'child_name', 'center_name', 'cdc_lc_name', 'cdw_name', 'firstName'} and not value.startswith('Sample'):
                    value = 'Sample ' + value
            return value
        for model in apps.get_app_config('core').get_models():
            if model in [records.Barangay, records.AcademicYear]:
                continue
            for instance in model.objects.all():
                if model == records.User and instance.pk == self.admin.pk:
                    continue
                changed = []
                for field in model._meta.concrete_fields:
                    value = getattr(instance, field.name)
                    if isinstance(field, models.JSONField):
                        updated = normalize_payload(value) if field.name in {'data_payload', 'payload', 'header_answers', 'child_profile', 'data', 'schedule_payload'} else value
                        if updated != value:
                            setattr(instance, field.name, updated)
                            changed.append(field.name)
                        continue
                    if not isinstance(field, (models.CharField, models.TextField)) or field.choices or not value:
                        continue
                    updated = value.replace('[SAMPLE]', 'Sample')
                    if field.name in name_fields and not updated.startswith('Sample'):
                        updated = 'Sample ' + updated
                    if updated != value:
                        setattr(instance, field.name, updated)
                        changed.append(field.name)
                if changed:
                    instance.save(update_fields=changed)
        for report in records.Report.objects.all():
            payload = json.dumps(report.payload).replace('[SAMPLE]', 'Sample')
            report.payload = json.loads(payload)
            ReportFileService.attach_generated_report_file(report)
            report.save()

    def audit(self):
        counts = {}
        statuses = {}
        missing_statuses = {}
        missing_files = []
        for model in apps.get_app_config('core').get_models():
            counts[model.__name__] = model.objects.count()
            for field in model._meta.fields:
                if field.choices and ('status' in field.name or field.name == 'result'):
                    present = set(model.objects.values_list(field.name, flat=True))
                    key = f'{model.__name__}.{field.name}'
                    statuses[key] = sorted(str(value) for value in present)
                    absent = [value for value, label in field.flatchoices if value not in present]
                    if absent:
                        missing_statuses[key] = absent
                if isinstance(field, models.FileField):
                    for instance in model.objects.exclude(**{field.name: ''}).exclude(**{field.name: None}):
                        uploaded = getattr(instance, field.name)
                        if not uploaded.storage.exists(uploaded.name):
                            missing_files.append(f'{model.__name__}:{instance.pk}:{field.name}')
        if missing_files:
            raise CommandError(f'Missing attachment references: {missing_files}')
        return {'counts': counts, 'statuses': statuses, 'missing_statuses': missing_statuses,
                'missing_files': missing_files, 'accounts': list(records.User.objects.values('username', 'role', 'is_active')),
                'reference_date': str(self.today), 'note': 'Canonical geographic names and academic-year identifiers are preserved for map and date matching.'}
