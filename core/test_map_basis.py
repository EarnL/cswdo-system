from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from core.models import (AcademicYear, Barangay, BarangayPopulationMetrics, CDC, Child,
                         ChildrenGapAnalysis, PopulationDataSubmission, User)
from core.services.data_integration_service import DataIntegrationService


class MapBasisTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='basis_admin', role='admin')
        self.cho = User.objects.create_user(username='basis_cho', role='cho')
        self.year = AcademicYear.get_current()
        self.barangay = Barangay.objects.create(name='Cotta', population_children_3_4=0)
        self.cdc = CDC.objects.create(name='Cotta CDC', barangay=self.barangay,
                                      max_capacity=30, latitude=13.93, longitude=121.61)
        self.source = PopulationDataSubmission.objects.create(
            submitted_by=self.cho, academic_year=self.year, title='Published basis', status='current_basis')
        self.metrics = BarangayPopulationMetrics.objects.create(
            barangay=self.barangay, academic_year=self.year, source_submission=self.source,
            total_population=100, children_3_5=30, children_3_4=25)
        ChildrenGapAnalysis.objects.create(barangay=self.barangay, academic_year=self.year,
                                           population_metrics=self.metrics, population_children_3_4=25)

    def test_public_and_private_share_indicators_and_public_is_safe(self):
        public = self.client.get('/api/public-map/').data[0]
        self.client.force_authenticate(self.admin)
        internal = self.client.get('/api/heatmap/').data[0]
        self.assertEqual(public['service_signal'], internal['shared_basis']['service_signal'])
        self.assertEqual(public['population'], internal['shared_basis']['population'])
        self.assertEqual(public['public_cdc']['locations'][0]['name'], 'Cotta CDC')
        for private in ['guardian_name', 'contact_number', 'named_snp_candidates']:
            self.assertNotIn(private, str(public))

    def test_unpublished_data_is_missing_not_zero(self):
        self.source.status = 'sent_to_cswdo'
        self.source.save()
        row = self.client.get('/api/public-map/').data[0]
        self.assertIsNone(row['population']['children_3_4'])
        self.assertIsNone(row['public_cdc']['gap_3_4'])
        self.assertEqual(row['service_signal']['need_level'], 'no_data')
        self.assertEqual(row['public_cdc']['centers'], 1)

    def test_confirmed_zero_does_not_use_age_group_fallback(self):
        BarangayPopulationMetrics.objects.filter(pk=self.metrics.pk).update(children_3_4=0)
        row = self.client.get('/api/public-map/').data[0]
        self.assertTrue(row['population']['has_current_basis'])
        self.assertEqual(row['population']['children_3_4'], 0)

    def test_other_roles_cannot_read_private_map(self):
        self.client.force_authenticate(self.cho)
        self.assertEqual(self.client.get('/api/heatmap/').status_code, 403)

    def test_enrollment_updates_without_republishing_population(self):
        child = Child.objects.create(name='Test Child', age=3, barangay=self.barangay,
                                     cdc=self.cdc, academic_year=self.year, current_status='enrolled')
        row = self.client.get('/api/public-map/').data[0]
        self.assertEqual(row['public_cdc']['enrollment_3_4'], 1)
        self.assertEqual(row['public_cdc']['gap_3_4'], 24)
        self.assertEqual(row['service_signal']['need_score'], 96)
        child.current_status = 'not_enrolled'
        child.save()
        self.assertEqual(self.client.get('/api/public-map/').data[0]['public_cdc']['enrollment_3_4'], 0)

    def test_failed_publication_preserves_previous_basis(self):
        candidate = PopulationDataSubmission.objects.create(
            submitted_by=self.cho, academic_year=self.year, title='Invalid replacement', status='received_by_cswdo')
        with patch.object(DataIntegrationService, '_parse_submission_data', return_value=[{'age': 3, 'barangay': 'Cotta'}]), \
             patch.object(DataIntegrationService, '_aggregate_by_barangay', side_effect=ValueError('Invalid rows')):
            result = DataIntegrationService.process_population_submission(candidate.id)
        self.assertFalse(result['success'])
        self.source.refresh_from_db()
        candidate.refresh_from_db()
        self.assertEqual(self.source.status, 'current_basis')
        self.assertEqual(candidate.status, 'received_by_cswdo')
        self.assertTrue(BarangayPopulationMetrics.objects.filter(pk=self.metrics.pk).exists())
