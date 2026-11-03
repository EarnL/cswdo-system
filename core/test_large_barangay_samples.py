import io
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from core import models
from core.services.map_basis_service import shared_map_rows


class LargeBarangaySampleTests(TestCase):
    def test_adds_connected_map_scenarios_without_replacing_existing_records(self):
        with tempfile.TemporaryDirectory() as temporary, override_settings(MEDIA_ROOT=temporary):
            models.User.objects.create_user(username='admin', role='admin')
            call_command('seed_sample_data', admin_username='admin', as_of=str(timezone.localdate()),
                         manifest=str(Path(temporary) / 'initial.json'), stdout=io.StringIO())
            original = list(models.Child.objects.values_list('pk', 'student_id', 'cdc_id'))
            with patch('core.management.commands.seed_large_barangay_samples.BackupCommand.backup'), \
                 patch('core.management.commands.seed_large_barangay_samples.settings.BASE_DIR', Path(temporary)):
                geo = Path(temporary) / 'frontend/src/data'
                geo.mkdir(parents=True)
                source = Path(__file__).resolve().parent.parent / 'frontend/src/data/lucenaBarangays.json'
                (geo / source.name).write_bytes(source.read_bytes())
                call_command('seed_large_barangay_samples', execute=True, stdout=io.StringIO())
                counts = (models.CDC.objects.count(), models.Child.objects.count(), models.Report.objects.count())
                call_command('seed_large_barangay_samples', execute=True, stdout=io.StringIO())
                self.assertEqual(counts, (models.CDC.objects.count(), models.Child.objects.count(), models.Report.objects.count()))
            self.assertEqual(original, list(models.Child.objects.filter(pk__in=[row[0] for row in original]).values_list('pk', 'student_id', 'cdc_id')))
            rows = {row['barangay']['name']: row for row in shared_map_rows()}
            for name, count, level in [('Mayao Castillo', 24, 'watch'), ('Ibabang Iyam', 16, 'elevated'), ('Isabang', 8, 'critical')]:
                self.assertEqual(rows[name]['service_signal']['need_level'], level)
                center = models.CDC.objects.get(name=f'Sample {name} Learning Center')
                self.assertEqual(center.current_enrollment, count)
                self.assertEqual(models.Child.objects.filter(cdc=center, current_status='enrolled').count(), count)
                self.assertTrue(models.ChildHealthRecord.objects.filter(cdc=center).exists())
                self.assertTrue(models.Report.objects.filter(cdc=center).exists())
                self.assertTrue(models.FeedingProgram.objects.filter(cdc=center).exists())
                self.assertTrue(models.StaffProfile.objects.filter(cdc=center).exists())
