from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import AcademicYear, Barangay, CDC, Child, PopulationDataSubmission, User, PopulationMembership, CDCPopulationBasis


class ChildEnrollmentTests(TestCase):
    def setUp(self):
        self.year = AcademicYear.get_current()
        self.user = User.objects.create_user(username='enrollment_cdw', role='cdw')
        self.other = User.objects.create_user(username='another_cdw', role='cdw')
        self.barangay = Barangay.objects.create(name='Enrollment barangay', population_children_3_4=0)
        self.cdc = CDC.objects.create(name='Assigned CDC', barangay=self.barangay, assigned_cdw=self.user,
            latitude=13.9, longitude=121.6, max_capacity=30, is_accredited=True,
            accreditation_status='accredited', license_number='ENROLL-001',
            license_expiry_date=timezone.localdate() + timedelta(days=90))
        self.source = PopulationDataSubmission.objects.create(title='Validated CHO data', submitted_by=self.user,
            academic_year=self.year, status='current_basis', data_payload={'records': [{'name': 'Existing Child', 'age': 3}]})
        self.child = Child.objects.create(name='Existing Child', sex='female', age=3,
            guardian_name='Existing guardian', contact_number='09123456789', barangay=self.barangay,
            academic_year=self.year, population_source_submission=self.source, current_status='not_enrolled')
        PopulationMembership.objects.create(submission=self.source, child=self.child)
        CDCPopulationBasis.objects.create(cdc=self.cdc, academic_year=self.year, submission=self.source, applied_by=self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        refresh = patch('core.views.child_view.ChildViewSet._refresh_population_planning')
        refresh.start()
        self.addCleanup(refresh.stop)
        self.payload = {'child_id': self.child.pk, 'cdc': self.cdc.pk, 'academic_year': self.year.pk,
                        'enrollment_date': str(self.year.start_date)}

    def test_select_enroll_reuses_id_and_preserves_source_and_identity(self):
        result = self.client.post('/api/children/enroll/', {**self.payload, 'name': 'Tampered name', 'guardian_name': 'Replacement'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['id'], self.child.pk)
        self.assertEqual(Child.objects.count(), 1)
        self.child.refresh_from_db()
        self.source.refresh_from_db()
        self.assertEqual(self.child.name, 'Existing Child')
        self.assertEqual(self.child.guardian_name, 'Existing guardian')
        self.assertEqual(self.child.cdc_id, self.cdc.pk)
        self.assertEqual(self.child.population_source_submission_id, self.source.pk)
        self.assertEqual(self.source.data_payload, {'records': [{'name': 'Existing Child', 'age': 3}]})
        again = self.client.post('/api/children/enroll/', self.payload, format='json')
        self.assertEqual(again.status_code, 409)
        self.assertEqual(Child.objects.count(), 1)

    def test_search_shows_validated_matches_and_existing_enrollment_only_in_scope(self):
        Child.objects.create(name='Existing pending', age=3, barangay=self.barangay, academic_year=self.year,
                             current_status='not_enrolled')
        archived = PopulationDataSubmission.objects.create(title='Old CHO data', submitted_by=self.user,
                                                           academic_year=self.year, status='archived')
        Child.objects.create(name='Existing archived', age=3, barangay=self.barangay, academic_year=self.year,
                             population_source_submission=archived, current_status='not_enrolled')
        self.client.post('/api/children/enroll/', self.payload, format='json')
        response = self.client.get('/api/children/cho-matches/', {'q': 'Existing'})
        self.assertEqual([row['id'] for row in response.data['results']], [self.child.pk])
        self.assertEqual(response.data['results'][0]['cdc_name'], 'Assigned CDC')
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/children/cho-matches/', {'q': 'Existing'}).data['results'], [])
        self.assertEqual(self.client.post('/api/children/enroll/', self.payload, format='json').status_code, 403)

    def test_manual_entry_checks_duplicates_and_creates_only_new_children(self):
        payload = {**self.payload, 'name': 'Existing Child', 'age': 3, 'guardian_name': 'Guardian', 'contact_number': '09123456789'}
        del payload['child_id']
        self.assertEqual(self.client.post('/api/children/enroll/', payload, format='json').status_code, 409)
        payload['name'] = 'New manually encoded child'
        result = self.client.post('/api/children/enroll/', payload, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        self.assertIsNone(result.data['population_source_submission'])
        self.assertEqual(self.client.post('/api/children/enroll/', payload, format='json').status_code, 409)
        self.assertEqual(Child.objects.count(), 2)

    def test_rechecks_validation_grant_period_and_age_at_save(self):
        self.assertEqual(self.client.post('/api/children/enroll/', {**self.payload, 'academic_year': self.year.pk + 100}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/children/enroll/', {**self.payload, 'enrollment_date': str(self.year.start_date - timedelta(days=1))}, format='json').status_code, 400)
        self.child.age = 2
        self.child.save()
        self.assertEqual(self.client.post('/api/children/enroll/', self.payload, format='json').status_code, 400)
        self.child.age = 3
        self.child.save()
        self.source.status = 'archived'
        self.source.save()
        # A replacement at city level does not invalidate this CDC's chosen basis.
        self.assertEqual(self.client.post('/api/children/enroll/', self.payload, format='json').status_code, 200)
        self.cdc.license_expiry_date = timezone.localdate() - timedelta(days=1)
        self.cdc.save()
        self.assertEqual(self.client.post('/api/children/enroll/', self.payload, format='json').status_code, 403)

    def test_same_name_different_children_require_explicit_selection(self):
        another = Child.objects.create(name=self.child.name, age=4, sex='male', barangay=self.barangay,
            academic_year=self.year, population_source_submission=self.source, current_status='not_enrolled',
            guardian_name='Another guardian', contact_number='09999999999')
        PopulationMembership.objects.create(submission=self.source, child=another)
        results = self.client.get('/api/children/cho-matches/', {'q': 'Existing Child'}).data['results']
        self.assertEqual(len(results), 2)
        response = self.client.post('/api/children/enroll/', {**self.payload, 'child_id': another.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.child.refresh_from_db()
        self.assertIsNone(self.child.cdc)

    def test_read_only_role_cannot_search_or_enroll(self):
        planner = User.objects.create_user(username='enrollment_planner', role='planning')
        self.client.force_authenticate(planner)
        self.assertEqual(self.client.get('/api/children/enrollment-options/').status_code, 403)
        self.assertEqual(self.client.get('/api/children/cho-matches/', {'q': 'Existing'}).status_code, 403)
        self.assertEqual(self.client.post('/api/children/enroll/', self.payload, format='json').status_code, 403)

    def test_legacy_create_cannot_duplicate_an_enrollment(self):
        self.client.post('/api/children/enroll/', self.payload, format='json')
        response = self.client.post('/api/children/', {
            'name': self.child.name, 'age': 3, 'cdc': self.cdc.pk, 'academic_year': self.year.pk,
            'guardian_name': 'Guardian', 'contact_number': '09123456789',
        }, format='json')
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(Child.objects.count(), 1)
