"""Add repeatable feature demos with one dedicated worker per sample center."""
from collections import Counter
from datetime import date, timedelta
import json
from pathlib import Path
from django.db import transaction
from django.utils import timezone
from core import models as m
from core.management.commands.seed_sample_data import Command as Base
from core.services.population_basis_service import capture_basis


class Command(Base):
    help = 'Add sample feature scenarios without resetting existing records.'

    def add_arguments(self, parser):
        parser.add_argument('--manifest', default='output/feature-sample-accounts.json')

    def account(self, username, role):
        user, created = m.User.objects.get_or_create(username=username, defaults={
            'role': role, 'first_name': 'Sample', 'last_name': username.replace('sample_', ''),
            'email': username + '@example.test', 'bio': 'Fictional local demonstration account.',
            'office_source': {'cho': 'cho', 'planning': 'city_planning'}.get(role, 'cswdo')})
        if created:
            user.set_password('SampleDemo!2026')
            user.save()
        if user.role != role:
            raise ValueError(f'Existing account has a different role: {username}')
        return user

    def put(self, model, lookup, **values):
        if model == m.Child and 'student_id' in lookup:
            lookup = {**lookup, 'student_id': 'FEATURE-' + lookup['student_id']}
        return super().put(model, lookup, **values)

    @transaction.atomic
    def handle(self, *args, **options):
        self.today, self.now = timezone.localdate(), timezone.now()
        self.year = m.AcademicYear.get_current()
        self.created, self.records = Counter(), []
        self.users = {role: self.account('sample_' + role, role)
                      for role in ('admin', 'staff', 'cho', 'planning')}
        self.admin, self.staff = self.users['admin'], self.users['staff']
        accounts = []
        # Keep the two intentionally cleared accounts unassigned.
        for center in m.CDC.objects.filter(name__istartswith='Sample').order_by('pk'):
            worker = center.assigned_cdw
            if worker is None:
                worker = self.account(f'sample_center_{center.pk}_cdw', 'cdw')
                center.assigned_cdw = worker
                center.save(update_fields=['assigned_cdw'])
                m.CDCAuditLog.objects.create(cdc=center, actor=self.admin, action='updated',
                    summary='Dedicated sample worker assigned; child records retained.')
            accounts.append({'username': worker.username, 'cdc': center.name, 'cdc_id': center.pk})
        barangay = m.Barangay.objects.get(name='Barangay 7 (Pob.)')
        from django.conf import settings
        from core.management.commands.seed_large_barangay_samples import Command as MapSeeder
        geo = json.loads((settings.BASE_DIR / 'frontend/src/data/lucenaBarangays.json').read_text(encoding='utf-8'))
        feature = next(f for f in geo['features'] if f['properties']['brgy_name'] == barangay.name)
        latitude, longitude = MapSeeder.marker(feature)
        self.guide = self.put(m.CurriculumGuide, {'title': '[FEATURE SAMPLE] Learning guide'},
            school_year=self.year.name, created_by=self.staff, description='Fictional learning guide.')
        self.pdf(self.guide, 'attachment', self.guide.title)
        centers = []
        for index, letter in enumerate(('a', 'b')):
            self.cdw = self.account(f'sample_workflow_{letter}', 'cdw')
            center = self.put(m.CDC, {'name': f'Sample Workflow Center {letter.upper()}'},
                barangay=barangay, assigned_cdw=self.cdw, latitude=latitude, longitude=longitude,
                max_capacity=30, capacity_per_session=30, is_accredited=True,
                accreditation_status='accredited', license_number=f'FEATURE-{letter.upper()}',
                license_expiry_date=self.today + timedelta(days=365), accredited_by=self.admin,
                special_notes='Fictional feature-testing center, not a real facility.')
            if not m.Child.objects.filter(cdc=center).exists():
                self.seed_center(center, index, 6)
            centers.append(center)
            accounts.append({'username': self.cdw.username, 'cdc': center.name, 'cdc_id': center.pk})
        old = self.put(m.PopulationDataSubmission, {'title': '[FEATURE SAMPLE] Applied population'},
            academic_year=self.year, submitted_by=self.users['cho'], status='archived')
        latest = self.put(m.PopulationDataSubmission, {'title': '[FEATURE SAMPLE] Approved population update'},
            academic_year=self.year, submitted_by=self.users['cho'], status='current_basis')
        self.put(m.PopulationDataHistory, {'submission': latest, 'action': 'accepted_by_cswdo'},
            status='current_basis', acted_by=self.admin, message='Fictional approved update for review/apply testing.')
        for submission in (old, latest):
            for child in m.Child.objects.filter(cdc__in=centers, academic_year=self.year):
                m.PopulationMembership.objects.get_or_create(submission=submission, child=child)
        for number, sex in enumerate(('male', 'female', 'unspecified')):
            child = self.put(m.Child, {'student_id': f'AVAILABLE-{self.year.pk}-{number}'},
                name=f'Sample Enrollment Candidate {number + 1}', age=3, sex=sex,
                barangay=barangay, academic_year=self.year, current_status='not_enrolled',
                population_source_submission=latest)
            m.PopulationMembership.objects.get_or_create(submission=latest, child=child)
            m.PopulationMembership.objects.get_or_create(submission=old, child=child)
        new_child = self.put(m.Child, {'student_id': f'UPDATE-ONLY-{self.year.pk}'},
            name='Sample Newly Added Child', age=3, sex='female', barangay=barangay,
            academic_year=self.year, current_status='not_enrolled', population_source_submission=latest)
        m.PopulationMembership.objects.get_or_create(submission=latest, child=new_child)
        for submission in (old, latest):
            count = submission.memberships.count()
            m.PopulationBasisSnapshot.objects.update_or_create(submission=submission,
                defaults={'barangays': {str(barangay.pk): {'population': count, 'total': count}}})
        past, _ = m.AcademicYear.objects.get_or_create(start_year=self.year.start_year-1,
            defaults={'end_year': self.year.start_year, 'start_date': date(self.year.start_year-1, 6, 1),
                      'end_date': date(self.year.start_year, 5, 31), 'is_active': False})
        for center in centers:
            m.CDCPopulationBasis.objects.get_or_create(cdc=center, academic_year=self.year,
                defaults={'submission': old, 'applied_by': center.assigned_cdw})
            m.CDCBasisHistory.objects.get_or_create(cdc=center, submission=old,
                defaults={'applied_by': center.assigned_cdw, 'summary': {'sample': True}})
            for number, sex in enumerate(('male', 'female', 'unspecified')):
                self.put(m.Child, {'student_id': f'HISTORY-{center.pk}-{number}'},
                    name=f'Sample Historical Child {center.pk}-{number+1}', cdc=center,
                    barangay=barangay, academic_year=past, age=4, sex=sex, current_status='graduated')
            m.Notification.objects.get_or_create(user=center.assigned_cdw,
                source_key=f'population_basis_{center.pk}_{latest.pk}', defaults={
                    'title': 'Sample population update', 'message': 'Review the new sample population data.',
                    'category': 'population', 'link': '/cdw#population-update', 'is_active': True})
        child = m.Child.objects.filter(cdc=centers[0], current_status='enrolled', academic_year=self.year).first()
        m.ChildTransfer.objects.get_or_create(child=child, from_cdc=centers[0], to_cdc=centers[1],
            defaults={'academic_year': self.year, 'requested_by': centers[1].assigned_cdw})
        # Existing archived/current demo datasets gain memberships without replacing adoption.
        for center in m.CDC.objects.filter(name__istartswith='Sample').exclude(pk__in=[c.pk for c in centers]):
            for basis in m.CDCPopulationBasis.objects.filter(cdc=center):
                for child in m.Child.objects.filter(barangay=center.barangay, academic_year=basis.academic_year):
                    m.PopulationMembership.objects.get_or_create(submission=basis.submission, child=child)
                capture_basis(basis.submission)
        result = {'accounts': list({row['cdc_id']: row for row in accounts}.values()), 'office_accounts': [u.username for u in self.users.values()],
                  'new_account_password': 'SampleDemo!2026', 'created': dict(self.created),
                  'scenarios': ['Enrollment', 'Cross-center status only', 'Pending transfer', 'Population review/apply',
                                'Academic-year history', 'Health', 'Assessments', 'Reports and drafts',
                                'Feeding', 'Parent seminars', 'Curriculum', 'Compliance'],
                  'retained_unassigned': ['sample_cdw', 'sample_cdw_empty']}
        path = Path(options['manifest']); path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, indent=2), encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'Sample features ready. Account list: {path}'))
