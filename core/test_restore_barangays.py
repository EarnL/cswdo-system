from django.test import TestCase

from core.management.commands.restore_lucena_barangays import restore_directory
from core.models import Barangay, CDC


class RestoreBarangaysTests(TestCase):
    def test_directory_restoration_preserves_existing_links_and_is_repeat_safe(self):
        barangay = Barangay.objects.create(name='Barangay 3', population_children_3_4=123)
        center = CDC.objects.create(name='Existing center', barangay=barangay,
                                    latitude=13.94, longitude=121.61, max_capacity=20)
        self.assertEqual(len(restore_directory()), 32)
        self.assertEqual(Barangay.objects.count(), 33)
        barangay.refresh_from_db()
        center.refresh_from_db()
        self.assertEqual(barangay.population_children_3_4, 123)
        self.assertEqual(center.barangay_id, barangay.pk)
        self.assertEqual(restore_directory(), [])
        self.assertEqual(Barangay.objects.count(), 33)
