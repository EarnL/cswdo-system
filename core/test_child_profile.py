import io
import tempfile
from unittest.mock import patch

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Child, User


class ChildProfileTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        settings = override_settings(MEDIA_ROOT=self.media.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.admin = User.objects.create_user(username='profile_admin', role='admin')
        self.planner = User.objects.create_user(username='profile_planner', role='planning')
        self.child = Child.objects.create(name='Existing child', age=3, current_status='not_enrolled', guardian_name='Original guardian')
        self.client = APIClient()
        self.url = f'/api/children/{self.child.pk}/'

    def photo(self):
        data = io.BytesIO()
        Image.new('RGB', (12, 12), 'white').save(data, format='PNG')
        return SimpleUploadedFile('portrait.png', data.getvalue(), content_type='image/png')

    def test_photo_upload_and_replacement_preserve_existing_record(self):
        self.client.force_authenticate(self.admin)
        for _ in range(2):
            response = self.client.patch(self.url, {'photo': self.photo()}, format='multipart')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertTrue(response.data['can_edit'])
            self.assertTrue(response.data['photo'])
        self.child.refresh_from_db()
        self.assertEqual(self.child.guardian_name, 'Original guardian')
        self.assertEqual(self.child.name, 'Existing child')
        self.assertEqual(self.child.age, 3)
        self.assertEqual(self.child.current_status, 'not_enrolled')

    def test_read_only_role_cannot_edit_or_upload(self):
        self.client.force_authenticate(self.planner)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['can_edit'])
        self.assertEqual(self.client.patch(self.url, {'guardian_name': 'Changed'}).status_code, 403)
        self.assertEqual(self.client.patch(self.url, {'photo': self.photo()}, format='multipart').status_code, 403)
        self.child.refresh_from_db()
        self.assertEqual(self.child.guardian_name, 'Original guardian')
        self.assertFalse(self.child.photo)

    def test_invalid_and_oversized_photos_are_rejected(self):
        self.client.force_authenticate(self.admin)
        invalid = SimpleUploadedFile('fake.png', b'not an image', content_type='image/png')
        self.assertEqual(self.client.patch(self.url, {'photo': invalid}, format='multipart').status_code, 400)
        from core.serializers.child_serializer import ChildSerializer
        photo = self.photo()
        photo.size = 6 * 1024 * 1024
        serializer = ChildSerializer(self.child, data={'photo': photo}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('photo', serializer.errors)

    def test_cdw_capability_respects_assignment_and_grant(self):
        from types import SimpleNamespace
        from core.views.child_view import ChildViewSet
        view = ChildViewSet()
        view.request = SimpleNamespace(user=SimpleNamespace(id=42, role='cdw'))
        child = SimpleNamespace(cdc=SimpleNamespace(assigned_cdw_id=42))
        with patch('core.views.child_view.GrantToOperateService.has_valid_grant', return_value=False):
            self.assertFalse(view.can_edit_record(child))
        with patch('core.views.child_view.GrantToOperateService.has_valid_grant', return_value=True):
            self.assertTrue(view.can_edit_record(child))
            child.cdc.assigned_cdw_id = 43
            self.assertFalse(view.can_edit_record(child))

    def test_source_metadata_uses_submission_period_and_is_read_only(self):
        from core.models import AcademicYear, PopulationDataSubmission
        from core.serializers.child_serializer import ChildSerializer
        period = AcademicYear.objects.create(name='2024-2025', start_year=2024, end_year=2025, start_date='2024-06-01', end_date='2025-05-31')
        source = PopulationDataSubmission.objects.create(title='CHO source', submitted_by=self.admin, academic_year=period, status='current_basis')
        self.child.population_source_submission = source
        self.child.save()
        serializer = ChildSerializer(self.child, data={'population_source_status': 'archived', 'population_reporting_period': '2099-2100'}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn('population_source_status', serializer.validated_data)
        self.assertNotIn('population_reporting_period', serializer.validated_data)
        self.assertEqual(serializer.data['population_source_status'], 'current_basis')
        self.assertEqual(serializer.data['population_reporting_period'], '2024-2025')
