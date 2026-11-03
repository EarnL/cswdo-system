import io
import tempfile
from pathlib import Path

from django.apps import apps
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core import models as m
from core.services.map_basis_service import shared_map_rows


class SampleDataTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.tmp = tempfile.TemporaryDirectory(prefix='cswdo-samples-')
        cls.override = override_settings(MEDIA_ROOT=cls.tmp.name)
        cls.override.enable()
        call_command('seed_sample_data', manifest=str(Path(cls.tmp.name)/'manifest.json'), stdout=io.StringIO())

    @classmethod
    def tearDownClass(cls):
        cls.override.disable()
        cls.tmp.cleanup()
        super().tearDownClass()

    def test_rerun_preserves_counts_edits_and_population_basis(self):
        center=m.CDC.objects.get(name='[SAMPLE] Maligaya Learning Center')
        center.contact_person='User edited contact'
        center.save()
        before={model.__name__:model.objects.count() for model in apps.get_app_config('core').get_models()}
        basis=list(m.BarangayPopulationMetrics.objects.values('pk','source_submission_id','total_population'))
        call_command('seed_sample_data',manifest=str(Path(self.tmp.name)/'rerun.json'),stdout=io.StringIO())
        after={model.__name__:model.objects.count() for model in apps.get_app_config('core').get_models()}
        self.assertEqual(before,after)
        self.assertEqual(basis,list(m.BarangayPopulationMetrics.objects.values('pk','source_submission_id','total_population')))
        center.refresh_from_db()
        self.assertEqual(center.contact_person,'User edited contact')

    def test_related_totals_files_and_empty_scenario(self):
        self.assertEqual(m.Child.objects.filter(current_status='enrolled').count(),27)
        for center in m.CDC.objects.all():
            self.assertEqual(center.current_enrollment,m.Child.objects.filter(cdc=center,current_status='enrolled').count())
        for row in shared_map_rows():
            if row['population']['has_current_basis']:
                self.assertEqual(row['public_cdc']['gap_3_4'],row['population']['children_3_4']-row['public_cdc']['enrollment_3_4'])
        empty=m.CDC.objects.get(name='[SAMPLE] New Center - Empty Scenario')
        self.assertFalse(m.Child.objects.filter(cdc=empty).exists())
        self.assertFalse(m.Report.objects.filter(cdc=empty).exists())
        self.assertFalse(empty.feeding_programs.exists())
        for report in m.Report.objects.all():
            self.assertTrue(report.pdf_attachment.storage.exists(report.pdf_attachment.name))
            with report.pdf_attachment.open('rb') as file:
                self.assertTrue(file.read(4)==b'%PDF')
        approved=m.AccreditationRequest.objects.get(status='approved')
        self.assertGreaterEqual(approved.percentage,75)
        self.assertFalse(approved.sections_needing_improvement)

    def test_heatmap_colors_and_multiple_center_capacity(self):
        from core.services.data_integration_service import DataIntegrationService as Integration
        options={'output_dir':str(Path(self.tmp.name)/'heatmap'),'stdout':io.StringIO()}
        call_command('seed_heatmap_scenarios',**options)
        counts=(m.Child.objects.count(),m.CDC.objects.count(),m.Report.objects.count())
        call_command('seed_heatmap_scenarios',**options)
        self.assertEqual(counts,(m.Child.objects.count(),m.CDC.objects.count(),m.Report.objects.count()))
        rows={r['barangay']['name']:r for r in shared_map_rows()}
        self.assertEqual(rows['Barangay 3 (Pob.)']['service_signal']['need_level'],'watch')
        self.assertEqual(rows['Barangay 4 (Pob.)']['service_signal']['need_level'],'elevated')
        self.assertEqual(rows['Barangay 5 (Pob.)']['service_signal']['need_level'],'critical')
        green=m.Barangay.objects.get(name='Barangay 3 (Pob.)')
        amber=m.Barangay.objects.get(name='Barangay 4 (Pob.)')
        self.assertFalse(Integration.get_current_gap_analysis(green).cdc_has_service_gap)
        # The original 9/8 overloaded center must still be flagged, even with spare annex capacity.
        self.assertTrue(Integration.get_current_gap_analysis(amber).cdc_has_service_gap)
        for center in m.CDC.objects.filter(name__contains='Heatmap Annex'):
            self.assertEqual(center.current_enrollment,m.Child.objects.filter(cdc=center,current_status='enrolled').count())

    def test_all_data_endpoints_and_role_dashboards(self):
        client=APIClient()
        client.force_authenticate(m.User.objects.get(username='sample_admin'))
        from core.urls import router
        results={}
        for prefix, view, basename in router.registry:
            suffix='all_barangays/' if prefix=='integration/barangay-status' else ''
            response=client.get(f'/api/{prefix}/{suffix}')
            results[prefix]=response.status_code
        for endpoint in ['dashboard','heatmap','public-map','benchmarks','enhanced-benchmarks',
                         'location-analytics','benchmark-dashboard','predictive-analytics','notifications',
                         'notifications/all','activity-logs','reminders','profile']:
            results[endpoint]=client.get(f'/api/{endpoint}/').status_code
        self.assertEqual({key:value for key,value in results.items() if value!=200},{})
        for center in m.CDC.objects.all():
            self.assertEqual(client.get(f'/api/cdcs/{center.pk}/complete-record/').status_code,200)
            self.assertEqual(client.get(f'/api/cdc/{center.pk}/detailed-analytics/').status_code,200)
        for username in ['sample_cdw','sample_cdw_empty','sample_cho','sample_planning','sample_staff']:
            client.force_authenticate(m.User.objects.get(username=username))
            self.assertEqual(client.get('/api/dashboard/').status_code,200,username)
            self.assertEqual(client.get('/api/notifications/').status_code,200,username)
        client.force_authenticate(m.User.objects.get(username='sample_cdw_empty'))
        response=client.get('/api/children/')
        body=response.json()
        self.assertEqual(body.get('count',len(body.get('results',[]))) if isinstance(body,dict) else len(body),0)
