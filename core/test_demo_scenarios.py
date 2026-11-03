import io
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from core import models
from core.services.grant_to_operate_service import GrantToOperateService
from core.services.map_basis_service import shared_map_rows


class DemoScenarioTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = models.User.objects.create_superuser(username='admin', password='OriginalAdminPassword', role='admin')
        cls.password_hash = cls.admin.password
        cls.temporary = tempfile.TemporaryDirectory(prefix='cswdo-demo-tests-')
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.settings_override = override_settings(MEDIA_ROOT=cls.temporary.name)
        cls.settings_override.enable()
        cls.addClassCleanup(cls.settings_override.disable)
        cls.storage_patch = patch.object(models.PreOpeningRequirement._meta.get_field('evidence'), 'storage',
                                        FileSystemStorage(location=cls.temporary.name))
        cls.storage_patch.start()
        cls.addClassCleanup(cls.storage_patch.stop)
        cls.manifest = Path(cls.temporary.name) / 'manifest.json'
        call_command('seed_demo_scenarios', as_of=str(timezone.localdate()), admin_username='admin',
                     manifest=str(cls.manifest), stdout=io.StringIO())

    def test_preserves_admin_and_covers_every_status_and_model(self):
        self.admin.refresh_from_db()
        self.assertEqual(self.password_hash, self.admin.password)
        self.assertTrue(self.admin.is_active and self.admin.is_superuser)
        self.assertFalse(models.User.objects.filter(username='sample_admin').exists())
        manifest = json.loads(self.manifest.read_text())
        self.assertEqual(manifest['missing_statuses'], {})
        self.assertEqual(manifest['missing_files'], [])
        self.assertTrue(all(count > 0 for count in manifest['counts'].values()))

    def test_operating_and_preopening_scenarios_are_separate(self):
        for center in models.CDC.objects.all():
            enrolled = models.Child.objects.filter(cdc=center, current_status='enrolled').count()
            self.assertEqual(center.current_enrollment, enrolled)
            if enrolled:
                self.assertTrue(GrantToOperateService.has_valid_grant(center))
        worker = models.User.objects.get(username='sample_cdw_empty')
        self.assertFalse(models.Child.objects.filter(cdc__assigned_cdw=worker).exists())
        center = models.CDC.objects.get(name='Sample New Center - Empty Scenario')
        self.assertTrue(GrantToOperateService.get_status(center)['requirements_complete'])
        self.assertFalse(GrantToOperateService.has_valid_grant(center))
        self.assertEqual({row['service_signal']['need_level'] for row in shared_map_rows()},
                         {'watch', 'elevated', 'critical', 'no_data'})

    def test_sample_api_verification(self):
        call_command('verify_demo_data', output=str(Path(self.temporary.name) / 'api.json'), stdout=io.StringIO())
