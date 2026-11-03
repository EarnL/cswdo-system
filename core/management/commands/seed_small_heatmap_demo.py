import json
from datetime import date
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from core import models as m
from core.management.commands.seed_large_barangay_samples import Command as MapSeeder
from core.management.commands.seed_feature_samples import Command as Accounts
from core.services.data_integration_service import DataIntegrationService as Integration
from core.services.population_basis_service import capture_basis
from core.services.map_basis_service import shared_map_rows


class Command(BaseCommand):
    help = 'Add 50 fictional children in a separate 2022-2023 heatmap demonstration year.'

    @transaction.atomic
    def handle(self, *args, **options):
        configs = [('Ibabang Dupay', 8, 8, 'watch'), ('Mayao Silangan', 5, 4, 'elevated'),
                   ('Mayao Castillo', 8, 30, 'watch'), ('Ilayang Talim', 1, 3, 'critical'),
                   ('Domoit', 4, 6, 'elevated')]
        current = m.AcademicYear.get_current()
        baseline = {r['barangay']['name']: (r['population']['children_3_4'], r['population']['source']['id'],
                    r['public_cdc']['enrollment_3_4']) for r in shared_map_rows(current)}
        year, _ = m.AcademicYear.objects.get_or_create(name='2022-2023', defaults={
            'start_year': 2022, 'end_year': 2023, 'start_date': date(2022, 6, 1),
            'end_date': date(2023, 5, 31), 'is_active': False})
        accounts = Accounts()
        cho = m.User.objects.get(username='sample_cho')
        admin = m.User.objects.get(username='sample_admin')
        title = '[HEATMAP DEMO] 2022-2023 - fictional ages 3-4 population'
        source, _ = m.PopulationDataSubmission.objects.get_or_create(title=title, defaults={
            'academic_year': year, 'submitted_by': cho, 'status': 'current_basis',
            'description': 'Fictional demonstration only. Does not replace current academic-year data.',
            'total_records': 50, 'total_population': 50})
        geo = json.loads((settings.BASE_DIR / 'frontend/src/data/lucenaBarangays.json').read_text(encoding='utf-8'))
        manifest, payload = [], []
        for name, enrolled, capacity, expected in configs:
            barangay = m.Barangay.objects.get(name=name)
            existing = m.BarangayPopulationMetrics.objects.filter(barangay=barangay, academic_year=year).first()
            if existing and existing.source_submission_id != source.pk:
                raise CommandError(f'{name} already has another population source for this year; nothing overwritten.')
            feature = next(f for f in geo['features'] if f['properties']['brgy_name'] == name)
            latitude, longitude = MapSeeder.marker(feature)
            if name == 'Mayao Castillo':
                center = m.CDC.objects.get(name='Sample Mayao Castillo Learning Center')
            else:
                worker = accounts.account(f'sample_heatmap_{barangay.pk}', 'cdw')
                center, _ = m.CDC.objects.get_or_create(name=f'Sample Heatmap CDC - {name}', defaults={
                    'barangay': barangay, 'assigned_cdw': worker, 'latitude': latitude, 'longitude': longitude,
                    'max_capacity': capacity, 'capacity_per_session': capacity, 'sessions_per_day': 1,
                    'current_enrollment': 0, 'address': f'Fictional demo site, {name}, Lucena City',
                    'operating_days': 'Monday to Friday', 'operating_hours': '08:00 AM - 11:00 AM',
                    'is_accredited': True, 'accreditation_status': 'accredited',
                    'license_number': f'DEMO-MAP-{barangay.pk}', 'license_expiry_date': date(2028, 5, 31),
                    'special_notes': 'Fictional map marker inside the actual barangay polygon; not a real facility.'})
                m.StaffProfile.objects.get_or_create(cdc=center, linked_user=worker, defaults={
                    'full_name': f'Sample Worker {name}', 'role_type': 'cdw', 'is_primary_caregiver': True,
                    'is_qualified': True, 'has_eccd_training': True, 'recorded_by': admin})
                m.CDCPopulationBasis.objects.get_or_create(cdc=center, academic_year=year,
                    defaults={'submission': source, 'applied_by': worker})
            for number in range(10):
                child, _ = m.Child.objects.get_or_create(student_id=f'HEATMAP-DEMO-{barangay.pk}-{number}', defaults={
                    'name': f'Sample Map Child {barangay.pk}-{number+1}', 'barangay': barangay,
                    'cdc': center if number < enrolled else None, 'academic_year': year,
                    'age': 3 + number % 2, 'sex': 'female' if number % 2 else 'male',
                    'date_of_birth': date(2019-number % 2, 1, 15),
                    'current_status': 'enrolled' if number < enrolled else 'not_enrolled',
                    'enrollment_date': year.start_date if number < enrolled else None,
                    'guardian_name': 'Sample Guardian', 'contact_number': '00000000000',
                    'population_source_submission': source, 'is_special_needs': number == 9,
                    'nutritional_status': 'underweight' if number == 9 else 'normal'})
                m.PopulationMembership.objects.get_or_create(submission=source, child=child)
                payload.append({'name': child.name, 'age': child.age, 'gender': child.sex, 'barangay': name})
                if number == 0:
                    m.ChildHealthRecord.objects.get_or_create(child=child, screening_date=date(2022, 7, 1),
                        defaults={'cdc': center, 'recorded_by': center.assigned_cdw, 'nutritional_status': 'normal',
                                  'medical_notes': 'Fictional heatmap demo screening.', 'status': 'verified'})
            m.BarangayPopulationMetrics.objects.get_or_create(barangay=barangay, academic_year=year,
                defaults={'source_submission': source, 'total_population': 10, 'children_3_4': 10,
                          'children_3_5': 10, 'male_population': 5, 'female_population': 5,
                          'children_with_disabilities': 1, 'malnourished_children': 1,
                          'single_parent_households': 2, 'data_quality_score': 100})
            Integration._calculate_gap_analysis(barangay, year)
            Integration._generate_snp_recommendation(barangay, year)
            m.Report.objects.get_or_create(cdc=center, title=f'[HEATMAP DEMO] 2022-2023 - {name}', defaults={
                'submitted_by': center.assigned_cdw, 'academic_year': year, 'report_type': 'child_profile',
                'quarter': 1, 'year': 2022, 'status': 'approved', 'is_complete': True, 'is_on_time': True,
                'summary': 'Fictional historical enrollment snapshot for map demonstration.',
                'payload': {'sample': True, 'formData': {'totalChildren': enrolled}}})
            manifest.append({'barangay': name, 'cdc': center.name, 'username': center.assigned_cdw.username,
                             'population': 10, 'enrolled': enrolled, 'expected_level': expected})
        source.data_payload = {'records': payload}
        source.barangay_breakdown = {name: 10 for name, *_ in configs}
        source.save(update_fields=['data_payload', 'barangay_breakdown'])
        m.PopulationDataHistory.objects.get_or_create(submission=source, action='accepted_by_cswdo',
            defaults={'status': 'current_basis', 'acted_by': admin,
                      'message': 'Fictional historical heatmap demonstration; current-year data unchanged.'})
        capture_basis(source)
        for row in shared_map_rows(year):
            scenario = next((s for s in manifest if s['barangay'] == row['barangay']['name']), None)
            if scenario and row['service_signal']['need_level'] != scenario['expected_level']:
                raise CommandError(f'Unexpected coverage signal for {scenario["barangay"]}')
        for row in shared_map_rows(current):
            values = (row['population']['children_3_4'], row['population']['source']['id'], row['public_cdc']['enrollment_3_4'])
            if values != baseline[row['barangay']['name']]:
                raise CommandError('Current-year population/enrollment changed; rolling back.')
        path = Path('output/small-heatmap-demo.json'); path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({'academic_year_id': year.pk, 'academic_year': year.name,
                                   'scenarios': manifest, 'current_year_preserved': True}, indent=2), encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'50 demo children across 5 barangays in {year.name}. Current approved data preserved.'))
