from datetime import date
from django.test import TestCase
from core import test_child_enrollment as fixtures
from core.models import AcademicYear, Barangay, CDC, Child, PopulationDataSubmission, PopulationMembership, CDCPopulationBasis


class RecordContextTests(TestCase):
    def setUp(self):
        fixtures.ChildEnrollmentTests.setUp(self)
        self.child.cdc = self.cdc
        self.child.save()
        self.outside = Barangay.objects.create(name='Outside barangay', population_children_3_4=0)
        self.foreign_cdc = CDC.objects.create(name='Outside CDC', barangay=self.outside, assigned_cdw=self.other,
            latitude=0, longitude=0, max_capacity=30, is_accredited=True, accreditation_status='accredited',
            license_number='OUTSIDE-1', license_expiry_date=date(2099, 1, 1))
        self.foreign_child = Child.objects.create(name='Private outside child', cdc=self.foreign_cdc,
            barangay=self.outside, academic_year=self.year, age=3)

    def rows(self, response):
        self.assertEqual(response.status_code, 200, response.data)
        return response.data if isinstance(response.data, list) else response.data['results']

    def test_context_uses_applied_basis_even_after_another_dataset_is_approved(self):
        self.source.status = 'archived'
        self.source.save()
        PopulationDataSubmission.objects.create(title='New not yet applied', submitted_by=self.user,
            academic_year=self.year, status='current_basis')
        result = self.client.get('/api/children/record-context/').data
        self.assertEqual(result['assignments'][0]['basis']['id'], self.source.pk)
        self.assertEqual(result['assignments'][0]['barangay'], self.barangay.pk)
        self.assertEqual(len(result['assignments']), 1)
        self.assertEqual(result['years'][0]['total'], 1)

    def test_current_and_history_queries_never_expose_unassigned_barangay(self):
        for extra in ({}, {'include_history': 'true'}, {'include_history': 'true', 'academic_year': self.year.pk}):
            rows = self.rows(self.client.get('/api/children/', {'record_cdc': self.cdc.pk, **extra}))
            self.assertEqual([row['id'] for row in rows], [self.child.pk])
            forged = self.rows(self.client.get('/api/children/', {'record_cdc': self.cdc.pk, 'barangay': self.outside.pk, **extra}))
            self.assertEqual(forged, [])
        for endpoint in ('/api/children/', '/api/children/record-context/'):
            self.assertEqual(self.client.get(endpoint, {'record_cdc': self.foreign_cdc.pk}).status_code, 403)

    def test_history_has_year_counts_and_grouped_sex_counts(self):
        past = AcademicYear.objects.create(start_year=self.year.start_year - 1, end_year=self.year.start_year,
            start_date=date(self.year.start_year - 1, 6, 1), end_date=date(self.year.start_year, 5, 31))
        Child.objects.create(name='Past male', cdc=self.cdc, barangay=self.barangay, academic_year=past, age=3, sex='male')
        Child.objects.create(name='Past unknown', cdc=self.cdc, barangay=self.barangay, academic_year=past, age=3)
        result = self.client.get('/api/children/record-context/', {'record_cdc': self.cdc.pk}).data
        previous = next(row for row in result['years'] if row['academic_year'] == past.pk)
        self.assertEqual((previous['total'], previous['male'], previous['female']), (2, 1, 0))
        rows = self.rows(self.client.get('/api/children/', {'record_cdc': self.cdc.pk, 'include_history': 'true', 'academic_year': past.pk}))
        self.assertEqual({row['name'] for row in rows}, {'Past male', 'Past unknown'})

    def test_database_rejects_multiple_assignments(self):
        from django.db import IntegrityError, transaction
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.foreign_cdc.assigned_cdw = self.user
            self.foreign_cdc.save()

    def test_same_barangay_other_center_keeps_status_only_visibility(self):
        self.foreign_cdc.barangay = self.barangay
        self.foreign_cdc.save()
        self.child.cdc = self.foreign_cdc
        self.child.current_status = 'enrolled'
        self.child.save()
        for extra in ({}, {'record_scope': 'population'}):
            row = self.rows(self.client.get('/api/children/', {'record_cdc': self.cdc.pk, **extra}))[0]
            self.assertEqual(row['cdc_name'], self.foreign_cdc.name)
            self.assertFalse(row['can_view_profile'])
            self.assertNotIn('health_checkup_records', row)
            self.assertNotIn('guardian_name', row)
        self.assertEqual(self.rows(self.client.get('/api/children/', {'record_scope': 'cdc'})), [])
        self.assertEqual(self.rows(self.client.get('/api/children/', {'include_history': 'true'})), [])
        self.assertEqual(self.client.get(f'/api/children/{self.child.pk}/').status_code, 404)

    def test_empty_roster_still_returns_applied_period(self):
        self.child.population_memberships.all().delete()
        self.child.delete()
        result = self.client.get('/api/children/record-context/').data
        self.assertEqual(result['years'], [])
        self.assertEqual(result['assignments'][0]['basis']['year'], self.year.name)

    def test_future_unopened_year_is_not_available_in_history(self):
        future = AcademicYear.objects.create(start_year=self.year.end_year, end_year=self.year.end_year + 1,
            start_date=date(self.year.end_year, 6, 1), end_date=date(self.year.end_year + 1, 5, 31))
        Child.objects.create(name='Future record', cdc=self.cdc, barangay=self.barangay, academic_year=future, age=3)
        result = self.client.get('/api/children/record-context/', {'record_cdc': self.cdc.pk}).data
        self.assertNotIn(future.pk, [row['academic_year'] for row in result['years']])
        rows = self.rows(self.client.get('/api/children/', {'record_cdc': self.cdc.pk, 'include_history': 'true', 'academic_year': future.pk}))
        self.assertEqual(rows, [])
