from django.test import TestCase
from rest_framework.test import APIClient
from core.models import Barangay, CDC, CDCAuditLog, Child, User


class CDCRecordExportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='record_admin', role='admin')
        barangay = Barangay.objects.create(name='Record Barangay', population_children_3_4=0)
        self.cdc = CDC.objects.create(name='Official Center', barangay=barangay, max_capacity=30, latitude=13.9, longitude=121.6)
        self.other = CDC.objects.create(name='Other Center', barangay=barangay, max_capacity=30, latitude=13.9, longitude=121.6)

    def test_complete_download_is_center_scoped_and_includes_full_history(self):
        for index in range(12):
            CDCAuditLog.objects.create(cdc=self.cdc, actor=self.admin, action='update', summary=f'Change {index}')
        Child.objects.create(cdc=self.cdc, name='Included child', age=3)
        Child.objects.create(cdc=self.other, name='Excluded child', age=3)
        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/cdcs/{self.cdc.pk}/complete-record/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['cdc']['audit_logs']), 12)
        self.assertEqual([child['name'] for child in response.data['records']['children']], ['Included child'])
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_other_roles_cannot_download_admin_record(self):
        for role in ['cdw', 'staff', 'cho', 'planning']:
            user = User.objects.create_user(username=f'record_{role}', role=role)
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(f'/api/cdcs/{self.cdc.pk}/complete-record/').status_code, 403)
