import tempfile
from datetime import timedelta
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from core.models import User, AcademicYear, PopulationDataRequest, PopulationDataSubmission, PopulationRequestSchedule, Notification
from core.models.population_request import request_today
from core.services.population_request_service import process_schedules, process_reminders
from core.services.notification_service import NotificationService


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PopulationRequestWorkflowTests(TestCase):
    def setUp(self):
        self.storage = tempfile.TemporaryDirectory()
        self.addCleanup(self.storage.cleanup)
        override = override_settings(MEDIA_ROOT=self.storage.name)
        override.enable()
        self.addCleanup(override.disable)
        self.client = APIClient()
        self.users = {role: User.objects.create_user(username=role, role=role, password='test') for role in ['admin', 'staff', 'cho', 'planning', 'cdw']}
        self.other_cho = User.objects.create_user(username='other_cho', role='cho')
        self.year = AcademicYear.get_current()
        self.today = request_today()

    def login(self, role):
        self.client.force_authenticate(self.users[role])

    def payload(self):
        return {'title': 'Quarterly child population', 'purpose': 'Update coverage planning.', 'academic_year': self.year.pk, 'period_start': str(self.today.replace(day=1)), 'period_end': str(self.today), 'due_date': str(self.today + timedelta(days=14))}

    def create_request(self):
        self.login('admin')
        response = self.client.post('/api/population-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['id']

    def csv(self, name='population.csv'):
        return SimpleUploadedFile(name, b'child_full_name,date_of_birth,sex,barangay,guardian_name\nAna,2023-01-01,Female,Barangay 1,Maria\n', content_type='text/csv')

    def submit(self, pk):
        self.login('cho')
        response = self.client.post(f'/api/population-requests/{pk}/submit/', {'data_file': self.csv()}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data['id']

    def test_complete_revision_workflow_preserves_files_and_separates_current_basis(self):
        pk = self.create_request()
        self.assertTrue(Notification.objects.filter(user=self.users['cho'], link=f'/cho/data-requests/{pk}', is_active=True).exists())
        sid = self.submit(pk)
        original = PopulationDataSubmission.objects.get(pk=sid).data_file.name
        self.login('planning')
        response = self.client.post(f'/api/population-data/{sid}/return_to_cho/', {'revision_reason': 'Incomplete', 'remarks': 'Add missing barangay rows.', 'revision_due_date': str(self.today + timedelta(days=7))}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        item = PopulationDataRequest.objects.get(pk=pk)
        self.assertEqual(item.status, 'needs_revision')
        self.assertEqual(item.deadline_status, 'due_soon')
        self.client.force_authenticate(self.other_cho)
        response = self.client.post(f'/api/population-data/{sid}/resubmit_revision/', {'data_file': self.csv()}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(PopulationDataSubmission.objects.get(pk=sid).history.filter(action='revised_by_cho', acted_by=self.other_cho).exists())
        submission = PopulationDataSubmission.objects.get(pk=sid)
        self.assertNotEqual(submission.data_file.name, original)
        self.assertTrue(submission.history.filter(file_snapshot=original).exists())
        self.login('planning')
        self.assertEqual(self.client.post(f'/api/population-data/{sid}/mark_received/').status_code, 200)
        response = self.client.post(f'/api/population-data/{sid}/send_to_cswdo/')
        self.assertEqual(response.status_code, 200, response.data)
        item.refresh_from_db(); submission.refresh_from_db()
        self.assertEqual(item.status, 'completed')
        self.assertIsNotNone(item.completed_at)
        self.assertEqual(submission.status, 'sent_to_cswdo')
        self.assertIsNone(submission.received_by_cswdo_on)
        self.login('cho')
        self.assertEqual(self.client.post(f'/api/population-requests/{pk}/submit/', {'data_file': self.csv()}, format='multipart').status_code, 400)

    def test_permissions_and_duplicate_response(self):
        self.login('cho')
        self.assertEqual(self.client.post('/api/population-requests/', self.payload(), format='json').status_code, 403)
        pk = self.create_request()
        self.client.force_authenticate(self.other_cho)
        self.assertEqual(self.client.get(f'/api/population-requests/{pk}/').status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.other_cho, link=f'/cho/data-requests/{pk}', is_active=True).exists())
        self.login('planning')
        self.assertEqual(self.client.post(f'/api/population-requests/{pk}/submit/', {'data_file': self.csv()}, format='multipart').status_code, 403)
        sid = self.submit(pk)
        self.assertEqual(self.client.post(f'/api/population-requests/{pk}/submit/', {'data_file': self.csv()}, format='multipart').status_code, 400)
        self.assertEqual(self.client.post(f'/api/population-data/{sid}/send_to_cswdo/').status_code, 403)
        self.login('admin')
        self.assertEqual(self.client.delete(f'/api/population-data/{sid}/').status_code, 400)
        self.login('cdw')
        self.assertEqual(self.client.get('/api/population-requests/').status_code, 403)

    def test_invalid_file_and_request_dates_are_rejected(self):
        self.login('admin')
        payload = self.payload(); payload['period_end'] = str(self.today.replace(day=1) - timedelta(days=1))
        self.assertEqual(self.client.post('/api/population-requests/', payload, format='json').status_code, 400)
        pk = self.create_request(); self.login('cho')
        self.assertEqual(self.client.post('/api/population-data/', {'data_request': 'invalid', 'data_file': self.csv()}, format='multipart').status_code, 400)
        response = self.client.post(f'/api/population-requests/{pk}/submit/', {'data_file': SimpleUploadedFile('bad.csv', b'name\nAna\n')}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(PopulationDataSubmission.objects.filter(data_request_id=pk).exists())
        self.assertEqual(self.client.post('/api/population-data/', {'title': 'Unrequested', 'data_file': self.csv()}, format='multipart').status_code, 400)

    def test_deadlines_do_not_follow_cho_into_review_and_reminders_do_not_reset_reads(self):
        pk = self.create_request()
        item = PopulationDataRequest.objects.get(pk=pk)
        item.due_date = self.today - timedelta(days=1); item.save()
        self.assertEqual(item.deadline_status, 'overdue')
        process_reminders()
        reminder = Notification.objects.get(user=self.users['cho'], source_key__contains=f'population_request_{pk}_reminder_')
        NotificationService.mark_read(reminder)
        process_reminders(); reminder.refresh_from_db()
        self.assertTrue(reminder.is_read)
        self.submit(pk); item.refresh_from_db()
        self.assertIsNone(item.deadline_status)
        process_reminders(); reminder.refresh_from_db()
        self.assertFalse(reminder.is_active)
        NotificationService.sync_user_notifications(self.users['planning'])
        self.assertTrue(Notification.objects.filter(user=self.users['planning'], source_key__startswith=f'population_request_{pk}_under_review_', is_active=True).exists())

    def test_cancellation_closes_request_and_blocks_upload(self):
        pk = self.create_request()
        response = self.client.post(f'/api/population-requests/{pk}/cancel/', {'reason': 'Data no longer needed.'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.login('cho')
        self.assertEqual(self.client.post(f'/api/population-requests/{pk}/submit/', {'data_file': self.csv()}, format='multipart').status_code, 400)

    def test_schedules_are_idempotent_and_can_be_paused(self):
        self.login('admin')
        payload = {key: value for key, value in self.payload().items() if key in ['title', 'purpose', 'assigned_to']}
        payload.update(frequency='monthly', next_period_start=str(self.today.replace(day=1)), due_days=14)
        response = self.client.post('/api/population-request-schedules/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        sid = response.data['id']
        process_schedules(); process_schedules()
        self.assertEqual(PopulationDataRequest.objects.filter(schedule_id=sid).count(), 1)
        self.assertEqual(self.client.post(f'/api/population-request-schedules/{sid}/toggle/').status_code, 200)
        schedule = PopulationRequestSchedule.objects.get(pk=sid)
        self.assertFalse(schedule.is_active)
        process_schedules()
        self.assertEqual(PopulationDataRequest.objects.filter(schedule_id=sid).count(), 1)


    def test_duplicate_period_blocked_and_correction_linked(self):
        pk = self.create_request()
        response = self.client.post('/api/population-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('existing_request_id', response.data)
        PopulationDataRequest.objects.filter(pk=pk).update(status='completed')
        payload = {**self.payload(), 'correction_of': pk, 'overlap_reason': 'Correct child totals', 'coverage': 'All Lucena City barangays; children aged 0-5'}
        response = self.client.post('/api/population-requests/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['correction_of'], pk)
        response = self.client.post('/api/population-requests/', payload, format='json')
        self.assertEqual(response.status_code, 400)

    def test_overlap_requires_reason(self):
        self.create_request()
        payload = self.payload()
        payload['period_end'] = str(self.today + timedelta(days=1))
        response = self.client.post('/api/population-requests/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        payload['overlap_reason'] = 'Separate update for newly verified records'
        response = self.client.post('/api/population-requests/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
