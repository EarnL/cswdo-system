from core.test_child_enrollment import ChildEnrollmentTests
from core.models import CDC, Child, ChildTransfer, CDCPopulationBasis, User, ChildHealthRecord, SpecialNeedsAssessment, PopulationMembership
from datetime import date
from django.test import TestCase


class SharedEnrollmentTests(TestCase):
    def setUp(self):
        ChildEnrollmentTests.setUp(self)
        self.second = CDC.objects.create(name='Second CDC', barangay=self.barangay, assigned_cdw=self.other,
            latitude=13.9, longitude=121.6, max_capacity=30, is_accredited=True,
            accreditation_status='accredited', license_number='ENROLL-002', license_expiry_date=self.cdc.license_expiry_date)
        CDCPopulationBasis.objects.create(cdc=self.second, academic_year=self.year, submission=self.source, applied_by=self.other)

    def enroll_first(self):
        response = self.client.post('/api/children/enroll/', self.payload, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.child.refresh_from_db()
        self.client.force_authenticate(self.other)

    def test_shared_status_does_not_expose_private_records(self):
        self.enroll_first()
        data = self.client.get('/api/children/cho-matches/', {'q': 'Existing'}).data['results'][0]
        self.assertEqual(data['cdc_name'], self.cdc.name)
        self.assertFalse(data['can_view_profile'])
        for key in ('guardian_name', 'contact_number', 'date_of_birth', 'complete_address', 'health_checkup_records', 'assessment_history', 'photo'):
            self.assertNotIn(key, data)
        listing = self.client.get('/api/children/').data
        rows = listing if isinstance(listing, list) else listing['results']
        self.assertFalse(next(row for row in rows if row['id'] == self.child.pk)['can_view_profile'])
        self.assertEqual(self.client.get(f'/api/children/{self.child.pk}/').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/children/{self.child.pk}/', {'guardian_name': 'Changed'}, format='json').status_code, 404)

    def test_cross_center_duplicate_blocked_for_selected_manual_and_legacy(self):
        self.enroll_first()
        response = self.client.post('/api/children/enroll/', {**self.payload, 'cdc': self.second.pk}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['cdc_name'], self.cdc.name)
        self.child.population_memberships.all().delete()
        manual = {**self.payload, 'cdc': self.second.pk, 'name': self.child.name, 'age': 3, 'guardian_name': 'Guardian', 'contact_number': '09123456789'}
        del manual['child_id']
        for endpoint in ('/api/children/enroll/', '/api/children/'):
            self.assertEqual(self.client.post(endpoint, manual, format='json').status_code, 409)
        self.assertEqual(Child.objects.count(), 1)

    def test_transfer_requires_source_approval_and_preserves_record(self):
        self.enroll_first()
        original_person = self.child.person_id
        self.child.health_remarks = 'Retain history'
        self.child.save()
        health = ChildHealthRecord.objects.create(child=self.child, cdc=self.cdc, health_findings='Original findings')
        assessment = SpecialNeedsAssessment.objects.create(child=self.child, cdc=self.cdc, remarks='Original assessment')
        response = self.client.post('/api/children/transfers/', {'child_id': self.child.pk, 'cdc': self.second.pk}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        transfer_id = response.data['id']
        url = f'/api/children/transfers/{transfer_id}/review/'
        self.assertEqual(self.client.post(url, {'decision': 'approved'}, format='json').status_code, 403)
        self.child.refresh_from_db()
        self.assertEqual(self.child.cdc_id, self.cdc.pk)
        self.client.force_authenticate(self.user)
        self.assertTrue(self.client.get('/api/children/transfers/').data[0]['can_review'])
        self.assertEqual(self.client.post(url, {'decision': 'approved'}, format='json').status_code, 200)
        self.child.refresh_from_db()
        self.assertEqual(self.child.cdc_id, self.second.pk)
        self.assertEqual(self.child.person_id, original_person)
        self.assertEqual(self.child.health_remarks, 'Retain history')
        self.assertTrue(self.child.population_memberships.exists())
        health.refresh_from_db()
        assessment.refresh_from_db()
        self.assertEqual(health.child_id, self.child.pk)
        self.assertEqual(health.cdc_id, self.cdc.pk)
        self.assertEqual(health.health_findings, 'Original findings')
        self.assertEqual(assessment.child_id, self.child.pk)
        self.assertEqual(assessment.remarks, 'Original assessment')
        self.assertEqual(Child.objects.count(), 1)
        self.assertEqual(self.client.get(f'/api/children/{self.child.pk}/').status_code, 404)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/children/{self.child.pk}/').status_code, 200)
        audit = ChildTransfer.objects.get(pk=transfer_id)
        self.assertEqual(audit.from_cdc_id, self.cdc.pk)
        self.assertEqual(audit.reviewed_by_id, self.user.pk)
        self.cdc.refresh_from_db()
        self.second.refresh_from_db()
        self.assertEqual(self.cdc.current_enrollment, 0)
        self.assertEqual(self.second.current_enrollment, 1)

    def test_transfer_retries_decline_and_unauthorized_users(self):
        self.enroll_first()
        payload = {'child_id': self.child.pk, 'cdc': self.second.pk}
        first = self.client.post('/api/children/transfers/', payload, format='json')
        again = self.client.post('/api/children/transfers/', payload, format='json')
        self.assertEqual(first.data['id'], again.data['id'])
        self.assertEqual(ChildTransfer.objects.count(), 1)
        outsider = User.objects.create_user(username='transfer_outsider', role='cdw')
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.get('/api/children/transfers/').data, [])
        self.assertEqual(self.client.post('/api/children/transfers/', payload, format='json').status_code, 403)
        self.client.force_authenticate(self.user)
        url = f"/api/children/transfers/{first.data['id']}/review/"
        self.assertEqual(self.client.post(url, {'decision': 'declined'}, format='json').status_code, 200)
        self.assertEqual(self.client.post(url, {'decision': 'approved'}, format='json').status_code, 409)
        self.child.refresh_from_db()
        self.assertEqual(self.child.cdc_id, self.cdc.pk)

    def test_profile_cannot_bypass_transfer(self):
        self.enroll_first()
        self.client.force_authenticate(self.user)
        response = self.client.patch(f'/api/children/{self.child.pk}/', {'cdc': self.second.pk}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_profile_edit_cannot_bypass_duplicate_enrollment(self):
        self.enroll_first()
        duplicate = Child.objects.create(name='Unmatched name', age=3, academic_year=self.year,
            barangay=self.barangay, current_status='not_enrolled')
        PopulationMembership.objects.create(child=duplicate, submission=self.source)
        response = self.client.patch(f'/api/children/{duplicate.pk}/', {
            'name': self.child.name, 'cdc': self.second.pk, 'current_status': 'enrolled'}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        duplicate.refresh_from_db()
        self.assertIsNone(duplicate.cdc_id)

    def test_selecting_duplicate_population_identity_cannot_enroll_twice(self):
        self.child.date_of_birth = date(self.year.start_date.year - 3, self.year.start_date.month, self.year.start_date.day)
        self.child.save()
        self.enroll_first()
        duplicate = Child.objects.create(name=self.child.name, date_of_birth=self.child.date_of_birth,
            academic_year=self.year, barangay=self.barangay, current_status='not_enrolled')
        PopulationMembership.objects.create(child=duplicate, submission=self.source)
        response = self.client.post('/api/children/enroll/', {**self.payload, 'cdc': self.second.pk, 'child_id': duplicate.pk}, format='json')
        self.assertEqual(response.status_code, 409)

    def test_cswdoadmin_can_review_and_invalid_target_cannot_receive(self):
        self.enroll_first()
        response = self.client.post('/api/children/transfers/', {'child_id': self.child.pk, 'cdc': self.second.pk}, format='json')
        admin = User.objects.create_user(username='transfer_admin', role='admin')
        self.client.force_authenticate(admin)
        self.second.is_accredited = False
        self.second.save()
        url = f"/api/children/transfers/{response.data['id']}/review/"
        self.assertEqual(self.client.post(url, {'decision': 'approved'}, format='json').status_code, 400)
        self.second.is_accredited = True
        self.second.save()
        self.assertEqual(self.client.post(url, {'decision': 'approved'}, format='json').status_code, 200)
