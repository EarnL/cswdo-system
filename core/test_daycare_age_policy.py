from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from core.models import AcademicYear, Barangay, BarangayPopulationMetrics, CDC, Child, User, PopulationDataSubmission
from core.serializers.child_serializer import ChildSerializer
from core.services.data_integration_service import DataIntegrationService as Integration
from core.services.map_basis_service import shared_map_rows
from core.daycare_policy import is_daycare_age


class DaycareAgePolicyTests(TestCase):
    def setUp(self):
        self.year = AcademicYear.get_current()
        self.barangay = Barangay.objects.create(name='Cotta', population_children_3_4=0)
        self.cdc = CDC.objects.create(name='Age Policy CDC', barangay=self.barangay, max_capacity=30,
                                      latitude=13.93, longitude=121.61)
        self.user = User.objects.create_user(username='age_policy', role='admin')
        self.source = PopulationDataSubmission.objects.create(
            title='Age-specific source', submitted_by=self.user, academic_year=self.year,
            status='current_basis',
        )

    def test_only_three_and_four_are_eligible(self):
        for age in [0, 1, 2, 5, 6, None, 'invalid']:
            self.assertFalse(is_daycare_age(age))
        for age in [3, 4, '3', '4']:
            self.assertTrue(is_daycare_age(age))

    def test_birthdays_use_academic_year_start(self):
        self.year.start_date = date(2026, 6, 1)
        for dob, expected in [(date(2023, 6, 1), True), (date(2023, 6, 2), False),
                              (date(2021, 6, 2), True), (date(2021, 6, 1), False)]:
            self.assertEqual(Child(date_of_birth=dob).is_daycare_eligible(self.year), expected)

    def test_import_separates_daycare_and_general_demographics(self):
        records = [{'barangay': 'Cotta', 'age': age} for age in [2, 3, 4, 5]]
        data = Integration._aggregate_by_barangay(records, self.year)['Cotta']
        self.assertEqual(data['children_3_4'], 2)
        self.assertEqual(data['age_groups']['3-5'], 3)
        Integration._update_barangay_metrics(self.barangay, data, self.source, self.year)
        Child.objects.create(name='Enrolled age 3', age=3, cdc=self.cdc, academic_year=self.year)
        Integration._calculate_gap_analysis(self.barangay, self.year)
        row = shared_map_rows(self.year)[0]
        self.assertEqual(row['population']['children_3_4'], 2)
        self.assertEqual(row['public_cdc']['enrollment_3_4'], 1)
        self.assertEqual(row['public_cdc']['gap_3_4'], 1)
        self.assertEqual(row['service_signal']['need_score'], 50)

    def test_import_uses_birth_date_over_stale_age(self):
        self.year.start_date = date(2026, 6, 1)
        data = Integration._aggregate_by_barangay([
            {'barangay': 'Cotta', 'age': 4, 'date_of_birth': '2021-01-01'},
            {'barangay': 'Cotta', 'date_of_birth': '2023-01-01'},
        ], self.year)['Cotta']
        self.assertEqual(data['children_3_4'], 1)

    def test_wider_legacy_total_is_not_relabelled(self):
        BarangayPopulationMetrics.objects.create(
            barangay=self.barangay, academic_year=self.year,
            source_submission=self.source, children_3_5=100,
        )
        row = shared_map_rows(self.year)[0]
        self.assertFalse(row['population']['has_current_basis'])
        self.assertIsNone(row['population']['children_3_4'])

    def test_enrollment_api_rejects_ineligible_age(self):
        for age in [2, 5]:
            serializer = ChildSerializer(data={
                'name': 'Outside cohort', 'age': age, 'cdc': self.cdc.pk,
                'academic_year': self.year.pk, 'current_status': 'enrolled',
            })
            self.assertFalse(serializer.is_valid())
            self.assertIn('age', serializer.errors)

    def test_legacy_enrollments_do_not_inflate_center_load(self):
        for age in [2, 3, 4, 5]:
            child = Child.objects.create(name=f'Age {age}', age=age, cdc=self.cdc, academic_year=self.year)
            # Simulate legacy data bypassing model save.
            Child.objects.filter(pk=child.pk).update(current_status='enrolled')
        client = APIClient()
        client.force_authenticate(self.user)
        self.assertEqual(client.get('/api/heatmap/').data[0]['enrollment'], 2)
        Integration._refresh_cdc_enrollment_counts(self.year)
        self.cdc.refresh_from_db()
        self.assertEqual(self.cdc.current_enrollment, 2)

    def test_underage_records_remain_available_without_enrollment(self):
        child = Child.objects.create(name='Population child', age=2, barangay=self.barangay,
                                     academic_year=self.year, current_status='not_enrolled')
        self.assertEqual(child.current_status, 'not_enrolled')
        self.assertFalse(child.is_daycare_eligible())
