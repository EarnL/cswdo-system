"""Add connected demonstration records to three large map polygons."""
from collections import Counter
from datetime import timedelta
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from core import models as records
from core.management.commands import seed_sample_data as base
from core.management.commands.reset_demo_data import Command as BackupCommand
from core.services.map_basis_service import shared_map_rows


class Command(base.Command):
    help = 'Add linked Sample centers to Mayao Castillo, Ibabang Iyam and Isabang, without resetting existing data.'

    def add_arguments(self, parser):
        parser.add_argument('--execute', action='store_true')
        parser.add_argument('--pg-bin', default=r'C:\Program Files\PostgreSQL\18\bin')

    @staticmethod
    def marker(feature):
        polygons = feature['geometry']['coordinates']
        if feature['geometry']['type'] == 'Polygon':
            polygons = [polygons]

        def area(ring):
            return abs(sum(first[0]*second[1]-second[0]*first[1] for first, second in zip(ring, ring[1:])))

        polygon = max(polygons, key=lambda item: area(item[0]))
        ring = polygon[0]
        west, east = min(point[0] for point in ring), max(point[0] for point in ring)
        south, north = min(point[1] for point in ring), max(point[1] for point in ring)

        def inside(longitude, latitude, boundary):
            crossings = False
            for first, second in zip(boundary, boundary[1:]):
                if (first[1] > latitude) != (second[1] > latitude):
                    crossing = first[0] + (latitude-first[1])*(second[0]-first[0])/(second[1]-first[1])
                    if longitude < crossing:
                        crossings = not crossings
            return crossings

        candidates = [(west+(east-west)*column/20, south+(north-south)*row/20)
                      for column in range(1, 20) for row in range(1, 20)]
        candidates = [point for point in candidates if inside(*point, ring)
                      and not any(inside(*point, hole) for hole in polygon[1:])]
        if not candidates:
            raise CommandError('Could not locate a marker inside the map polygon.')
        longitude, latitude = min(candidates, key=lambda point: (point[0]-(west+east)/2)**2 + (point[1]-(south+north)/2)**2)
        return latitude, longitude

    def put(self, model, lookup, **values):
        lookup = dict(lookup)
        if model == records.Child:
            lookup['student_id'] = f'SAMPLE-LARGE-{self.current_center.pk}-{lookup["student_id"].split("-")[-1]}'
        for container in [lookup, values]:
            for field in ['name', 'first_name', 'full_name', 'guardian_name', 'father_name', 'mother_name',
                          'contact_person', 'facilitator', 'examiner_name', 'conducted_by_name']:
                if container.get(field) and not container[field].startswith('Sample'):
                    container[field] = 'Sample ' + container[field]
        return super().put(model, lookup, **values)

    def handle(self, *args, **options):
        scenarios = [('Mayao Castillo', 24, 30, 30), ('Ibabang Iyam', 16, 40, 20), ('Isabang', 8, 80, 20)]
        missing = [scenario for scenario in scenarios if not records.CDC.objects.filter(name=f'Sample {scenario[0]} Learning Center').exists()]
        if not missing or not options['execute']:
            self.stdout.write(f'{len(missing)} large-barangay scenarios to add. Use --execute to back up and create them.' if missing else 'All three scenarios already exist; nothing changed.')
            return
        self.today = timezone.localdate()
        self.now = timezone.now()
        self.year = records.AcademicYear.get_current()
        self.users = {role: records.User.objects.get(username='admin' if role == 'admin' else f'sample_{role}')
                      for role in ['admin', 'staff', 'cdw', 'cho', 'planning']}
        self.admin, self.staff, self.cdw = (self.users[role] for role in ['admin', 'staff', 'cdw'])
        self.guide = records.CurriculumGuide.objects.filter(status='active').first()
        if not self.guide:
            raise CommandError('An active sample curriculum guide is required.')
        geo = json.loads((settings.BASE_DIR / 'frontend/src/data/lucenaBarangays.json').read_text(encoding='utf-8'))
        features = {feature['properties']['brgy_name']: feature for feature in geo['features']}
        backup = settings.BASE_DIR / 'backups' / ('large_barangay_samples_' + self.now.strftime('%Y%m%d_%H%M%S'))
        backup.mkdir(parents=True)
        BackupCommand().backup(backup, Path(options['pg_bin']))
        self.created, self.records, self.centers = Counter(), [], []
        previous_tag = base.TAG
        base.TAG = 'Sample'
        try:
            with transaction.atomic():
                for name, enrollment, population, capacity in missing:
                    index = [scenario[0] for scenario in scenarios].index(name)
                    barangay, created = records.Barangay.objects.get_or_create(name=name, defaults={'population_children_3_4': population})
                    if records.BarangayPopulationMetrics.objects.filter(barangay=barangay, academic_year=self.year).exists():
                        raise CommandError(f'{name} already has population metrics; refusing to overwrite its basis.')
                    latitude, longitude = self.marker(features[name])
                    center = records.CDC.objects.create(name=f'Sample {name} Learning Center', barangay=barangay,
                        assigned_cdw=self.cdw, latitude=latitude, longitude=longitude, max_capacity=capacity,
                        capacity_per_session=capacity, sessions_per_day=1, address=f'Sample demonstration site, {name}, Lucena City',
                        contact_person=self.cdw.get_full_name(), contact_number='00000000000',
                        email=f'sample.large{index+1}@example.test', operating_days='Monday to Friday',
                        operating_hours='08:00 AM - 11:00 AM', building_type='barangay', total_area=75,
                        has_water_supply=True, has_sanitation=True, has_electricity=True, offers_preschool=True,
                        has_feeding_program=True, has_health_services=True, total_staff=2, qualified_caregivers=1, volunteers=1,
                        is_accredited=True, accreditation_status='accredited', license_number=f'SAMPLE-LARGE-GTO-{index+1}',
                        accreditation_date=self.today-timedelta(days=60), license_expiry_date=self.today+timedelta(days=365),
                        accredited_by=self.admin, special_notes='Fictional sample center. Marker is inside the barangay polygon, not an actual facility address.')
                    self.current_center = center
                    self.centers.append(center)
                    self.seed_center(center, index, enrollment)
                    records.AccreditationRequest.objects.filter(cdc=center).exclude(status='approved').update(
                        remarks='Sample renewal application; the existing operating grant remains valid.')
                    children = list(records.Child.objects.filter(cdc=center, current_status='enrolled').order_by('pk'))
                    rows = [{'name': child.name, 'age': child.age, 'gender': child.sex, 'barangay': name} for child in children]
                    rows += [{'name': f'Sample Unenrolled Child {name} {number+1:02}', 'age': 3+number%2,
                              'gender': 'female' if number%2 == 0 else 'male', 'barangay': name}
                             for number in range(population-enrollment)]
                    source = records.PopulationDataSubmission.objects.create(submitted_by=self.users['cho'], academic_year=self.year,
                        title=f'Sample Validated Population - {name}', description='Fictional ages 3-4 population, including linked enrolled children.',
                        status='current_basis', data_payload={'records': rows}, total_population=population, total_records=population,
                        data_sources=1, age_distribution=dict(Counter(str(row['age']) for row in rows)),
                        gender_distribution=dict(Counter(row['gender'] for row in rows)), barangay_breakdown={name: population},
                        processed_by_planning=self.users['planning'], processed_on=self.now,
                        sent_to_cswdo_by=self.users['planning'], sent_to_cswdo_on=self.now, received_by_cswdo_on=self.now)
                    records.BarangayPopulationMetrics.objects.create(barangay=barangay, academic_year=self.year,
                        source_submission=source, total_population=population, children_3_5=population, children_3_4=population,
                        male_population=source.gender_distribution['male'], female_population=source.gender_distribution['female'],
                        children_with_disabilities=1, data_quality_score=100)
                    records.PopulationDataHistory.objects.create(submission=source, action='sample_workflow', status='current_basis',
                        message='Sample population accepted as the current map basis.', acted_by=self.admin, current_location='CSWDO')
                self.refresh_derived_data()
                self.seed_notifications()
                self.verify()
                rows = [row for row in shared_map_rows(self.year) if row['barangay']['name'] in {scenario[0] for scenario in scenarios}]
                expected = {'Mayao Castillo': 'watch', 'Ibabang Iyam': 'elevated', 'Isabang': 'critical'}
                for row in rows:
                    if row['service_signal']['need_level'] != expected[row['barangay']['name']]:
                        raise CommandError('Unexpected map coverage signal; rolling back.')
                (backup / 'map-scenarios.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
        finally:
            base.TAG = previous_tag
        self.stdout.write(self.style.SUCCESS(f'Added {len(self.centers)} connected large-barangay scenarios. Backup and map verification: {backup}'))
