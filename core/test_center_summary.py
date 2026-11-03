import tempfile
from datetime import date, timedelta
from types import SimpleNamespace

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import AcademicYear, Barangay, CDC, User, Report, ChildHealthRecord, FeedingProgram, FeedingDay
from core.services.center_summary_service import CenterSummaryService, reporting_period
from core.services.center_report_renderer import render_html, render_pdf
from core.services.report_file_service import ReportFileService


class CenterSummaryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='center_report_cdw', role='cdw')
        self.other = User.objects.create_user(username='other_center_cdw', role='cdw')
        self.staff = User.objects.create_user(username='center_staff', role='staff')
        barangay = Barangay.objects.create(name='Center report barangay', population_children_3_4=0)
        self.cdc = CDC.objects.create(name='Report Center', barangay=barangay, assigned_cdw=self.user,
            latitude=13.9, longitude=121.6, max_capacity=30, is_accredited=True,
            accreditation_status='accredited', license_number='REPORT-001',
            license_expiry_date=timezone.localdate() + timedelta(days=90))
        self.academic_year = AcademicYear.get_current()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        media = override_settings(MEDIA_ROOT=directory.name)
        media.enable()
        self.addCleanup(media.disable)

    def build(self, **kwargs):
        return CenterSummaryService.build(self.cdc, kwargs.pop('mode', 'monthly'), kwargs.pop('year', 2024), **{'month': 2, **kwargs})

    def test_calendar_boundaries(self):
        self.assertEqual(reporting_period('monthly', 2024, 2)['end'], '2024-02-29')
        self.assertEqual(reporting_period('quarterly', 2026, quarter=4)['start'], '2026-10-01')
        self.assertEqual(reporting_period('quarterly', 2026, quarter=4)['end'], '2026-12-31')
        self.assertEqual(reporting_period('annual', 2026)['end'], '2026-12-31')

    def test_dated_counts_and_missing_information(self):
        for day in [date(2024, 1, 31), date(2024, 2, 1), date(2024, 2, 29), date(2024, 3, 1)]:
            ChildHealthRecord.objects.create(cdc=self.cdc, screening_date=day)
        payload = self.build()
        self.assertEqual(payload['period_metrics']['healthRecords'], 2)
        self.assertEqual(payload['auto_calculated']['healthRecords'], 4)
        self.assertIsNone(payload['auto_calculated']['population'])
        self.assertIsNone(payload['auto_calculated']['servedVsPopulation'])
        self.assertEqual(payload['period_metrics']['parentSeminars'], 0)
        self.assertIn('academic year', payload['metric_sources']['current_context'])
        self.assertEqual(len(payload['comparisons']), 1)
        self.assertEqual(self.build(mode='quarterly', quarter=1)['period_metrics']['healthRecords'], 4)
        self.assertEqual(self.build(mode='annual')['period_metrics']['healthRecords'], 4)

    def test_scheduled_feeding_not_counted_and_repeated_servings_explained(self):
        program = FeedingProgram.objects.create(cdc=self.cdc, created_by=self.user, start_date=date(2024, 2, 1), target_beneficiaries=5)
        FeedingDay.objects.filter(program=program).delete()
        for day, state, served in [(1, 'completed', 5), (2, 'completed', 5), (3, 'scheduled', 0)]:
            FeedingDay.objects.create(program=program, feeding_date=date(2024, 2, day), status=state, beneficiaries_served=served)
        data = self.build()
        self.assertEqual(data['period_metrics']['feedingDays'], 2)
        self.assertEqual(data['period_metrics']['feedingBeneficiariesServed'], 10)
        self.assertIn('same child', str(data['auto_tables']['period_activities']))

    def test_empty_period_not_presented_as_confirmed_no_service(self):
        data = self.build()
        self.assertEqual(data['comparisons'], [])
        self.assertIsNone(data['auto_calculated']['healthScore'])
        self.assertIn('does not confirm', str(data['template_sections']))
        self.assertIn('No records found for this period', str(data['auto_tables']['period_activities']))

    def test_existing_monthly_ratios_and_readiness_rules_are_preserved(self):
        from core.serializers.cdc_serializer import CDCSerializer
        self.cdc.current_enrollment = 40
        self.cdc.capacity_per_session = 30
        self.cdc.sessions_per_day = 1
        self.cdc.qualified_caregivers = 2
        self.cdc.save()
        ChildHealthRecord.objects.create(cdc=self.cdc, screening_date=date(2024, 2, 1))
        payload = self.build()
        metrics = payload['auto_calculated']
        self.assertEqual(metrics['enrollment'], 40)
        self.assertAlmostEqual(metrics['utilization'], 40 / 30 * 100)
        self.assertEqual(metrics['childrenPerTeacher'], 20)
        self.assertEqual(metrics['healthScore'], CDCSerializer().get_health_safety_snapshot(self.cdc)['readiness_score'])
        self.assertIn('exceeds', str(payload['template_sections']))

    def test_preview_permission_validation_and_no_report_written(self):
        url = '/api/reports/center-summary-preview/'
        params = {'cdc': self.cdc.pk, 'period_type': 'monthly', 'year': 2024, 'month': 2}
        response = self.client.get(url, params)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Report.objects.count(), 0)
        self.assertEqual(self.client.get(url, {**params, 'month': 13}).status_code, 400)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(url, params).status_code, 403)
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get(url, params).status_code, 403)

    def test_server_overrides_client_figures_and_keeps_observations(self):
        response = self.client.post('/api/reports/', {'cdc': self.cdc.pk, 'report_type': 'cdc_monthly_report',
            'period_type': 'monthly', 'year': 2024, 'month': 2, 'quarter': 1,
            'payload': {'auto_calculated': {'enrollment': 99999}, 'narratives': {'learning_programs': 'Actual CDW note'}, 'evidence': {'activity_photo_1': '/media/saved-evidence.jpg'}}}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        report = Report.objects.get(pk=response.data['id'])
        self.assertNotEqual(report.payload['auto_calculated']['enrollment'], 99999)
        self.assertEqual(report.payload['narratives']['learning_programs'], 'Actual CDW note')
        self.assertEqual(report.status, 'under_review')
        self.assertTrue(report.pdf_attachment)
        report.status = 'needs_revision'
        report.save()
        revised = self.client.patch(f'/api/reports/{report.pk}/', {'payload': {'narratives': {'learning_programs': 'Revised note'}}}, format='json')
        self.assertEqual(revised.status_code, 200, revised.data)
        self.assertEqual(revised.data['payload']['narratives']['learning_programs'], 'Revised note')
        self.assertEqual(revised.data['payload']['evidence']['activity_photo_1'], '/media/saved-evidence.jpg')

    def test_annual_generation_preserves_previous_snapshot_and_view_only_workflow(self):
        old = Report.objects.create(cdc=self.cdc, submitted_by=self.user, report_type='cdc_annual_report', year=2024, quarter=4, payload={'legacy': True})
        response = self.client.post('/api/reports/generate-cdc-annual/', {'cdc': self.cdc.pk, 'year': 2024}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        old.refresh_from_db()
        self.assertEqual(old.payload['legacy'], True)
        self.assertNotEqual(response.data['id'], old.pk)
        self.assertTrue(response.data['payload']['generated_summary_report'])
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.post(f"/api/reports/{response.data['id']}/start-review/").status_code, 400)

    def test_html_pdf_and_legacy_rendering(self):
        payload = self.build(supplied={'narratives': {'challenges': 'A note with <markup> & details.'}})
        report = SimpleNamespace(payload=payload, title='Monthly Center Report', cdc=self.cdc)
        html = render_html(report)
        self.assertIn('Not recorded', html)
        self.assertIn('A note with &lt;markup&gt; &amp; details.', html)
        self.assertIn('Feeding servings recorded', html)
        pdf = render_pdf(report)
        self.assertTrue(pdf.startswith(b'%PDF'))
        self.assertGreater(len(pdf), 10000)
        legacy = SimpleNamespace(payload={'template_sections': [{'title': 'Original heading', 'notes': 'Original note'}]}, title='Old report', cdc=self.cdc, summary='Saved summary', period_type='monthly', month=2, year=2024, quarter=1, submitted_by=self.user)
        original = ReportFileService._render_periodic_report_html(legacy, {'label': 'Monthly Report', 'description': 'Saved monthly report'})
        self.assertIn('Original note', original)
        self.assertIn('Saved summary', original)
