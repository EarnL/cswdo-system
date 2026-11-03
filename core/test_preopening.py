import tempfile
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Barangay, CDC, Child, PreOpeningRequirement, User
from core.services.grant_to_operate_service import GrantToOperateService
from core.services.preopening_service import SECTIONS


class PreOpeningTests(TestCase):
    def setUp(self):
        self.worker = User.objects.create(username='preparing', role='cdw')
        self.other = User.objects.create(username='other', role='cdw')
        self.staff = User.objects.create(username='reviewer', role='staff')
        self.center = CDC.objects.create(name='Unopened center', barangay=Barangay.objects.create(
            name='Test barangay', population_children_3_4=0), assigned_cdw=self.worker,
            latitude=0, longitude=0, max_capacity=30, current_enrollment=0)
        self.url = f'/api/cdcs/{self.center.pk}/pre-opening/'
        self.client = APIClient()
        self.client.force_authenticate(self.worker)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        storage = patch.object(PreOpeningRequirement._meta.get_field('evidence'), 'storage', FileSystemStorage(location=self.temp.name))
        storage.start()
        self.addCleanup(storage.stop)

    def test_unaccredited_worker_can_prepare_all_sections_without_child_records(self):
        for section in SECTIONS:
            data = {key: '30' if key == 'capacity' else 'Proposed arrangement' for key, label, kind in section['fields']}
            response = self.client.put(self.url + section['key'] + '/', {'data': data}, format='json')
            self.assertEqual(response.status_code, 200)
        import json
        response = self.client.put(self.url + 'documents/', {
            'data': json.dumps({'inventory': 'LGU document', 'pending': 'None'}),
            'evidence': SimpleUploadedFile('evidence.pdf', b'%PDF-1.4 test', content_type='application/pdf'),
        }, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['complete'])
        self.assertFalse(Child.objects.exists())
        self.assertFalse(GrantToOperateService.has_valid_grant(self.center))
        self.assertTrue(GrantToOperateService.get_status(self.center)['requirements_complete'])
        response = self.client.get(self.url + 'documents/')
        self.assertEqual(response.status_code, 200)
        response.close()

    def test_drafts_and_replacements_do_not_duplicate_sections(self):
        self.assertEqual(self.client.put(self.url + 'staff/', {'data': {'staff_names': 'Worker'}}, format='json').status_code, 200)
        self.client.put(self.url + 'staff/', {'data': {'staff_names': 'Updated worker'}}, format='json')
        self.assertEqual(PreOpeningRequirement.objects.count(), 1)
        response = self.client.get(self.url)
        self.assertEqual(response.data['completedCount'], 0)
        self.assertEqual(response.data['sections'][1]['data']['staff_names'], 'Updated worker')

    def test_scope_and_read_only_review(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.client.put(self.url + 'basic/', {'data': {}}, format='json').status_code, 404)
        self.assertEqual(self.client.get(self.url + 'documents/').status_code, 404)
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertEqual(self.client.put(self.url + 'basic/', {'data': {}}, format='json').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_rejects_workflow_fields_and_invalid_uploads(self):
        for data in [{'is_accredited': True}, [], {'capacity': '-1'}, {'address': {'unexpected': 'value'}}]:
            self.assertEqual(self.client.put(self.url + 'basic/', {'data': data}, format='json').status_code, 400)
        self.assertEqual(self.client.put(self.url + 'documents/', {
            'data': '{}', 'evidence': SimpleUploadedFile('unsafe.html', b'<script></script>'),
        }, format='multipart').status_code, 400)
        self.center.refresh_from_db()
        self.assertFalse(self.center.is_accredited)
