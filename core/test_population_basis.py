from datetime import date
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from core.models import (AcademicYear, User, Barangay, CDC, Child, PopulationDataSubmission,
    PopulationMembership, CDCPopulationBasis, CDCBasisHistory, ChildHealthRecord,
    SpecialNeedsAssessment, PopulationBasisSnapshot, Notification)
from core.services.data_integration_service import DataIntegrationService
from core.services.population_basis_service import apply_basis, working_year


class PopulationBasisTests(TestCase):
    def setUp(self):
        self.year = AcademicYear.get_current()
        self.cdw = User.objects.create_user(username='basis-cdw', role='cdw')
        self.admin = User.objects.create_user(username='basis-admin', role='admin')
        self.other = User.objects.create_user(username='basis-other', role='cdw')
        self.barangay = Barangay.objects.create(name='Basis Village', population_children_3_4=0)
        self.cdc = CDC.objects.create(name='Basis CDC', barangay=self.barangay, assigned_cdw=self.cdw,
            latitude=0, longitude=0, max_capacity=30, is_accredited=True, accreditation_status='accredited',
            license_number='BASIS-001', license_expiry_date=date(2099, 1, 1))
        self.client = APIClient()
        self.client.force_authenticate(self.cdw)

    def publish(self, names, year=None):
        year = year or self.year
        submission = PopulationDataSubmission.objects.create(title='Population '+str(PopulationDataSubmission.objects.count()+1),
            submitted_by=self.admin, academic_year=year, status='received_by_cswdo',
            data_payload={'rows': [{'name': name, 'age': 3, 'barangay': self.barangay.name, 'gender': 'female'} for name in names]})
        result = DataIntegrationService.process_population_submission(submission.pk)
        self.assertTrue(result['success'], result)
        submission.refresh_from_db()
        return submission

    def test_publish_retains_children_related_records_and_cdc_basis_until_applied(self):
        first = self.publish(['Ana', 'Bea'])
        apply_basis(self.cdc.pk, first.pk, self.cdw)
        ana = Child.objects.get(name='Ana')
        bea = Child.objects.get(name='Bea')
        health = ChildHealthRecord.objects.create(cdc=self.cdc, child=bea)
        assessment = SpecialNeedsAssessment.objects.create(cdc=self.cdc, child=bea)
        ana.cdc = self.cdc
        ana.current_status = 'enrolled'
        ana.guardian_name = 'Verified guardian'
        ana.save()
        second = self.publish(['Ana', 'Cora', 'Dina'])
        ana.refresh_from_db(); health.refresh_from_db(); assessment.refresh_from_db()
        self.assertEqual(ana.guardian_name, 'Verified guardian')
        self.assertEqual(ana.current_status, 'enrolled')
        self.assertEqual(health.child_id, bea.pk)
        self.assertEqual(assessment.child_id, bea.pk)
        self.assertTrue(Child.objects.filter(pk=bea.pk).exists())
        self.assertEqual(CDCPopulationBasis.objects.get(cdc=self.cdc).submission_id, first.pk)
        self.assertEqual(PopulationBasisSnapshot.objects.get(submission=first).barangays[str(self.barangay.pk)]['population'], 2)
        before = self.client.get('/api/children/').data
        self.assertEqual({row['name'] for row in before}, {'Ana', 'Bea'})
        review = self.client.get(f'/api/cdcs/{self.cdc.pk}/population-basis/').data['updates'][0]
        self.assertEqual(review['needs_review'], 1)
        self.assertEqual(review['added'], 2)
        self.assertTrue(Notification.objects.filter(user=self.cdw, source_key=f'population_basis_{self.cdc.pk}_{second.pk}', is_active=True).exists())
        result = self.client.post(f'/api/cdcs/{self.cdc.pk}/population-basis/', {'submission': second.pk})
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual({row['name'] for row in self.client.get('/api/children/').data}, {'Ana', 'Cora', 'Dina'})
        self.assertEqual(self.client.get(f'/api/children/{bea.pk}/').status_code, 200)
        self.assertEqual(len(self.client.get('/api/children/?include_history=true').data), 1)
        self.assertTrue(PopulationMembership.objects.filter(submission=second, child=ana).exists())
        self.assertEqual(Child.objects.filter(name='Ana').count(), 1)

    def test_wrong_user_stale_update_and_repeated_apply(self):
        first = self.publish(['Ana'])
        self.client.force_authenticate(self.other)
        url = f'/api/cdcs/{self.cdc.pk}/population-basis/'
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.post(url, {'submission': first.pk}).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(url, {'submission': first.pk}).status_code, 403)
        self.client.force_authenticate(self.cdw)
        second = self.publish(['Ana', 'Bea'])
        self.assertEqual(self.client.post(url, {'submission': first.pk}).status_code, 400)
        for _ in range(2):
            self.assertEqual(self.client.post(url, {'submission': second.pk}).status_code, 200)
        self.assertEqual(CDCBasisHistory.objects.filter(cdc=self.cdc).count(), 1)

    def test_new_year_does_not_switch_cdc_or_delete_records(self):
        first = self.publish(['Ana'])
        apply_basis(self.cdc.pk, first.pk, self.cdw)
        child = Child.objects.get(name='Ana')
        next_year = AcademicYear.objects.create(name=f'{self.year.start_year+1}-{self.year.end_year+1}',
            start_year=self.year.start_year+1, end_year=self.year.end_year+1,
            start_date=date(self.year.start_year+1, 6, 1), end_date=date(self.year.end_year+1, 5, 31), is_active=True)
        second = self.publish(['Bea'], year=next_year)
        self.assertEqual(working_year(self.cdc).pk, self.year.pk)
        self.assertTrue(Child.objects.filter(pk=child.pk).exists())
        apply_basis(self.cdc.pk, second.pk, self.cdw)
        self.assertEqual(working_year(self.cdc).pk, next_year.pk)
        self.assertTrue(Child.objects.filter(pk=child.pk, academic_year=self.year).exists())
        self.assertEqual(CDCPopulationBasis.objects.filter(cdc=self.cdc).count(), 2)

    def test_processing_failure_rolls_back_publication(self):
        first = self.publish(['Ana'])
        apply_basis(self.cdc.pk, first.pk, self.cdw)
        failed = PopulationDataSubmission.objects.create(title='Bad update', submitted_by=self.admin,
            academic_year=self.year, status='received_by_cswdo', data_payload={'rows': [{'name': 'Bea', 'age': 3, 'barangay': self.barangay.name}]})
        with patch.object(DataIntegrationService, '_update_barangay_metrics', side_effect=ValueError('Test failure')):
            result = DataIntegrationService.process_population_submission(failed.pk)
        self.assertFalse(result['success'])
        first.refresh_from_db()
        self.assertEqual(first.status, 'current_basis')
        self.assertEqual(Child.objects.count(), 1)

    def test_reports_and_cdc_figures_follow_selected_version(self):
        from core.services.cdc_annual_report_service import CDCAnnualReportService
        from core.services.center_summary_service import CenterSummaryService
        first = self.publish(['Ana', 'Bea'])
        apply_basis(self.cdc.pk, first.pk, self.cdw)
        self.publish(['Ana', 'Bea', 'Cora'])
        metric = CDCAnnualReportService._latest_population_metrics(self.cdc, self.year)
        self.assertEqual(metric.children_3_4, 2)
        self.assertEqual(metric.source_submission.pk, first.pk)
        payload = CenterSummaryService.build(self.cdc, 'annual', self.year.start_year, academic_year=self.year)
        self.assertEqual(payload['auto_calculated']['population'], 2)
        self.assertIn(first.title, payload['data_basis']['population_basis'])
        from core.views.heatmap_view import _snp_candidates_payload
        self.assertEqual(_snp_candidates_payload(self.barangay, self.year)['count'], 3)

    def test_identity_connects_yearly_records_without_moving_enrollment(self):
        child = Child.objects.create(name='Yearly Child', cdc=self.cdc, barangay=self.barangay,
            date_of_birth=date(self.year.start_year - 3, 1, 1), academic_year=self.year, current_status='enrolled')
        next_year = AcademicYear.objects.create(name=f'{self.year.start_year+1}-{self.year.end_year+1}',
            start_year=self.year.start_year+1, end_year=self.year.end_year+1,
            start_date=date(self.year.start_year+1, 6, 1), end_date=date(self.year.end_year+1, 5, 31))
        next_record = Child.objects.create(name=child.name, barangay=self.barangay,
            date_of_birth=child.date_of_birth, academic_year=next_year, current_status='not_enrolled')
        self.assertEqual(child.person_id, next_record.person_id)
        child.refresh_from_db()
        self.assertEqual(child.academic_year_id, self.year.pk)
        self.assertEqual(child.current_status, 'enrolled')
        response = self.client.get(f'/api/children/{next_record.pk}/')
        # Unassigned, non-population records are not exposed to a CDW.
        self.assertEqual(response.status_code, 404)

    def test_population_can_link_existing_manually_encoded_profile(self):
        child = Child.objects.create(name='Manual Child', barangay=self.barangay, academic_year=self.year,
            age=3, current_status='not_enrolled', guardian_name='Verified guardian', contact_number='09123456789')
        source = self.publish(['Manual Child'])
        apply_basis(self.cdc.pk, source.pk, self.cdw)
        matches = self.client.get('/api/children/cho-matches/', {'q': 'Manual'}).data['results']
        self.assertEqual([row['id'] for row in matches], [child.pk])
        self.assertTrue(matches[0]['in_selected_population_basis'])
        response = self.client.post('/api/children/enroll/', {'cdc': self.cdc.pk, 'child_id': child.pk,
            'academic_year': self.year.pk, 'enrollment_date': str(self.year.start_date)})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Child.objects.filter(name='Manual Child').count(), 1)
