from datetime import date
from unittest.mock import patch
from django.test import TestCase, SimpleTestCase
from django.utils import timezone
from core.models import AcademicYear, Barangay, BarangayPopulationMetrics, CDC, Child, Report, User, PopulationDataSubmission
from core.services.prediction_service import PredictionService, annual_slope, validate_history, numeric


class ForecastMathTests(SimpleTestCase):
    def test_decline_zero_and_short_history(self):
        self.assertIsNone(annual_slope([{'date': date(2024, 1, 1), 'value': 30}]))
        self.assertIsNone(annual_slope([{'date': date(2024, 1, 1), 'value': 30}, {'date': date(2024, 4, 1), 'value': 40}]))
        points = [{'date': date(y, 3, 31), 'value': value} for y, value in [(2022, 30), (2023, 20), (2024, 10)]]
        self.assertLess(annual_slope(points), 0)
        self.assertEqual(validate_history(points)['held_out_periods'], 1)
        self.assertLess(validate_history(points)['mean_absolute_error_children'], 0.1)
        self.assertEqual(numeric(0), 0)
        for invalid in [None, '', 'NaN', 'inf', -1, True]:
            self.assertIsNone(numeric(invalid))


class PredictionForecastTests(TestCase):
    def setUp(self):
        self.year = AcademicYear.get_current()
        self.user = User.objects.create_user(username='forecast_admin', role='admin')
        self.barangay = Barangay.objects.create(name='Forecast Barangay', population_children_3_4=0)
        self.cdc = CDC.objects.create(name='First Center', barangay=self.barangay, max_capacity=30, capacity_per_session=30, sessions_per_day=1, latitude=13.9, longitude=121.6)
        self.source = PopulationDataSubmission.objects.create(title='Approved source', academic_year=self.year, submitted_by=self.user, status='current_basis', received_by_cswdo_on=timezone.now())
        BarangayPopulationMetrics.objects.create(barangay=self.barangay, academic_year=self.year, source_submission=self.source, children_3_4=100)

    def report(self, year, count, quarter=1, status='approved', report_type='form7'):
        return Report.objects.create(cdc=self.cdc, submitted_by=self.user, academic_year=self.year, report_type=report_type, status=status, quarter=quarter, year=year, payload={'daycare_age_range': [3, 4], 'formData': {'totalChildren': count}})

    def test_history_deduplicates_and_uses_comparable_approved_periods(self):
        self.report(2022, 30)
        latest = self.report(2022, 25)
        self.report(2023, 20)
        self.report(2024, 15)
        self.report(2024, 999, status='draft')
        self.report(2024, 888, quarter=2)
        self.report(2024, 777, report_type='child_profile')
        points = PredictionService._get_enrollment_history(self.cdc)
        self.assertEqual([p['value'] for p in points], [25, 20, 15])
        self.assertEqual(points[0]['report_id'], latest.id)
        self.assertEqual(validate_history(points)['held_out_periods'], 1)

    def test_two_centers_do_not_duplicate_barangay_population_or_gap(self):
        CDC.objects.create(name='Second Center', barangay=self.barangay, max_capacity=30, capacity_per_session=30, sessions_per_day=1, latitude=13.9, longitude=121.6)
        result = PredictionService.generate_predictive_dashboard()
        self.assertEqual(len(result['barangay_forecasts']), 1)
        self.assertEqual(result['chart_series']['eligible_children'], [100] * 5)
        self.assertEqual(result['chart_series']['predicted_unenrolled'], [100] * 5)
        self.assertEqual(result['barangay_forecasts'][0]['forecast_points'][-1]['capacity'], 60)
        self.assertEqual(result['barangay_forecasts'][0]['evidence_level'], 'constant scenario')

    def test_missing_population_is_not_zero_and_centerless_barangay_is_included(self):
        other = Barangay.objects.create(name='No Center', population_children_3_4=0)
        result = PredictionService.generate_predictive_dashboard()
        self.assertIsNone(result['summary']['predicted_not_enrolled_total'])
        row = next(r for r in result['barangay_forecasts'] if r['barangay_id'] == other.id)
        self.assertIsNone(row['forecast_points'][0]['eligible_children'])
        self.assertEqual(row['forecast_points'][0]['capacity'], 0)
        BarangayPopulationMetrics.objects.create(barangay=other, academic_year=self.year, source_submission=self.source, children_3_4=0)
        result = PredictionService.generate_predictive_dashboard()
        self.assertEqual(result['summary']['predicted_not_enrolled_total'], 100)

    def test_population_trend_uses_approved_academic_year_sources(self):
        previous = AcademicYear.objects.create(start_year=self.year.start_year - 1, end_year=self.year.start_year,
            start_date=date(self.year.start_year - 1, 6, 1), end_date=date(self.year.start_year, 5, 31))
        source = PopulationDataSubmission.objects.create(title='Historical approved source', academic_year=previous, submitted_by=self.user, status='archived', received_by_cswdo_on=timezone.now())
        BarangayPopulationMetrics.objects.create(barangay=self.barangay, academic_year=previous, source_submission=source, children_3_4=90)
        result = PredictionService.generate_predictive_dashboard()
        row = result['barangay_forecasts'][0]
        self.assertEqual(row['evidence_level'], 'trend')
        self.assertAlmostEqual(row['forecast_points'][-1]['eligible_children'], 140, delta=0.2)
        self.assertEqual(row['history'][0]['source_submission_id'], source.id)

    def test_declining_enrollment_and_utilization_above_100(self):
        self.report(2022, 60); self.report(2023, 55); self.report(2024, 50)
        with patch.object(PredictionService, '_get_current_enrollment', return_value=40):
            row = PredictionService._build_cdc_forecast(self.cdc, 2026, self.year)
        self.assertLess(row['projected_growth_rate'], 0)
        self.assertLess(row['projected_enrollment_final_year'], row['current_enrollment'])
        self.assertGreater(row['current_utilization'], 100)
        self.assertEqual(row['validation']['held_out_periods'], 1)
        self.assertIsNone(row['predicted_not_enrolled'])

    def test_zero_capacity_remains_zero(self):
        self.cdc.capacity_per_session = 0
        with patch.object(PredictionService, '_get_current_enrollment', return_value=10):
            row = PredictionService._build_cdc_forecast(self.cdc, 2026, self.year)
        self.assertEqual(row['effective_capacity'], 0)
        self.assertEqual(row['additional_slots_needed'], 10)
        self.assertIsNone(row['current_utilization'])
        self.assertEqual(row['evidence_level'], 'constant scenario')
