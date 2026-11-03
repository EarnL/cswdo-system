import json
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile

from core.accreditation_checklist import get_accreditation_checklist
from core.models import (
    AcademicYear,
    AnnualEvaluation,
    AccreditationRequest,
    AuthorityDocument,
    Barangay,
    BarangayPopulationMetrics,
    CDC,
    CDCAuditLog,
    Child,
    ChildHealthRecord,
    ChildProtectionRecord,
    ChildrenGapAnalysis,
    EmergencyReadiness,
    EnrollmentData,
    FeedingProgram,
    InteractionObservation,
    Notification,
    PhysicalEnvironmentAssessment,
    PopulationDataSubmission,
    PermitRecord,
    Report,
    SafetyIncident,
    StaffProfile,
    StaffTrainingRecord,
    SupervisoryVisit,
    User,
)
from core.services.data_integration_service import DataIntegrationService
from core.services.prediction_service import PredictionService


class BaseAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(username='admin_user', password='testpass123', role='admin')
        self.staff = User.objects.create_user(username='staff_user', password='testpass123', role='staff')
        self.cdw = User.objects.create_user(username='cdw_user', password='testpass123', role='cdw')
        self.cho = User.objects.create_user(username='cho_user', password='testpass123', role='cho')
        self.planning = User.objects.create_user(username='planning_user', password='testpass123', role='planning')

        self.barangay = Barangay.objects.create(name='Barangay 1', population_children_3_4=120)
        self.cdc = CDC.objects.create(
            name='CDC One',
            barangay=self.barangay,
            latitude=13.95,
            longitude=121.61,
            max_capacity=100,
            current_enrollment=42,
            assigned_cdw=self.cdw,
        )

    def current_population_source(self):
        return PopulationDataSubmission.objects.create(
            submitted_by=self.cho, academic_year=AcademicYear.get_current(),
            title='Validated ages 3-4 basis', status='current_basis',
        )

    def create_enrollees(self, count):
        Child.objects.bulk_create([
            Child(name=f'Eligible child {index}', age=3 + index % 2,
                  cdc=self.cdc, barangay=self.barangay,
                  academic_year=AcademicYear.get_current(), current_status='enrolled')
            for index in range(count)
        ])

    def grant_to_operate(self, cdc=None):
        cdc = cdc or self.cdc
        cdc.accreditation_status = 'accredited'
        cdc.is_accredited = True
        cdc.license_number = f'GTO-TEST-{cdc.id:04d}'
        cdc.accreditation_date = timezone.localdate()
        cdc.license_expiry_date = timezone.localdate().replace(year=timezone.localdate().year + 1)
        cdc.save(update_fields=[
            'accreditation_status',
            'is_accredited',
            'license_number',
            'accreditation_date',
            'license_expiry_date',
            'updated_at',
        ])
        return cdc


class ReportPermissionTests(BaseAPITestCase):
    def test_staff_cannot_create_report(self):
        self.client.force_authenticate(user=self.staff)

        payload = {
            'cdc': self.cdc.id,
            'report_type': 'form6',
            'title': 'Staff should not create this',
            'summary': 'Permission test',
            'quarter': 1,
            'year': 2026,
            'is_complete': True,
            'is_on_time': True,
            'payload': {'formData': {'totalChildren': '40'}},
        }

        response = self.client.post('/api/reports/', payload, format='json')
        self.assertEqual(response.status_code, 403)

    def test_cdw_can_create_report_for_assigned_cdc(self):
        self.grant_to_operate()
        self.client.force_authenticate(user=self.cdw)

        payload = {
            'cdc': self.cdc.id,
            'report_type': 'form6',
            'title': 'Assigned CDC report',
            'summary': 'Permission test',
            'quarter': 1,
            'year': 2026,
            'is_complete': True,
            'is_on_time': True,
            'payload': {'formData': {'totalChildren': '40'}},
        }

        response = self.client.post('/api/reports/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Report.objects.count(), 1)

    def test_cdw_cannot_create_operating_report_without_grant_to_operate(self):
        self.client.force_authenticate(user=self.cdw)

        payload = {
            'cdc': self.cdc.id,
            'report_type': 'form6',
            'title': 'Pre-grant report',
            'summary': 'Should be blocked',
            'quarter': 1,
            'year': 2026,
            'is_complete': True,
            'is_on_time': True,
            'payload': {'formData': {'totalChildren': '40'}},
        }

        response = self.client.post('/api/reports/', payload, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertIn('Grant to Operate', str(response.data))

    def test_cdw_cannot_register_child_without_grant_to_operate(self):
        self.client.force_authenticate(user=self.cdw)

        response = self.client.post(
            '/api/children/',
            {
                'cdc': self.cdc.id,
                'name': 'Pre Grant Child',
                'age': 4,
                'current_status': 'enrolled',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn('Grant to Operate', str(response.data))

    def test_cdw_quarterly_report_generates_attachment_file_for_cswdo(self):
        self.grant_to_operate()
        self.client.force_authenticate(user=self.cdw)

        payload = {
            'cdc': self.cdc.id,
            'report_type': 'health_nutrition',
            'title': 'Health and Nutrition Report - CDC One',
            'summary': 'Quarterly nutrition summary for the assigned center.',
            'quarter': 2,
            'year': 2026,
            'is_complete': True,
            'is_on_time': True,
            'payload': {
                'report_meta': {
                    'center_name': self.cdc.name,
                    'barangay_name': self.barangay.name,
                    'cdw_name': self.cdw.username,
                    'reporting_period': 'Q2 2026',
                },
                'fields': {
                    'children_weighed': 38,
                    'children_measured': 38,
                    'nutrition_normal': 30,
                    'nutrition_underweight': 6,
                    'nutrition_severely_underweight': 2,
                    'feeding_program': 'Daily snack feeding continued.',
                    'vitamin_supplementation': 'Completed with barangay health workers.',
                    'deworming': 'Done in April.',
                    'immunization': 'Tracking updated.',
                },
            },
        }

        response = self.client.post('/api/reports/', payload, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['attachment_url'])
        self.assertTrue(response.data['attachment_name'].endswith('.html'))
        self.assertTrue(response.data['pdf_attachment_url'])
        self.assertTrue(response.data['pdf_attachment_name'].endswith('.pdf'))

        report = Report.objects.get(id=response.data['id'])
        self.assertTrue(report.attachment.name.endswith('.html'))
        self.assertTrue(report.pdf_attachment.name.endswith('.pdf'))
        report.attachment.open('rb')
        content = report.attachment.read().decode('utf-8')
        report.attachment.close()
        self.assertIn('Health and Nutrition Report', content)
        self.assertIn('Quarterly nutrition summary', content)
        self.assertIn('CDC One', content)
        report.pdf_attachment.open('rb')
        pdf_content = report.pdf_attachment.read()
        report.pdf_attachment.close()
        self.assertTrue(pdf_content.startswith(b'%PDF-1.4'))

    def test_staff_can_view_generated_quarterly_report_file_details(self):
        report = Report.objects.create(
            cdc=self.cdc,
            submitted_by=self.cdw,
            report_type='facility_status',
            title='Facility and Center Status Report',
            summary='Generated facility report.',
            quarter=1,
            year=2026,
            is_complete=True,
            is_on_time=True,
            payload={
                'report_meta': {
                    'center_name': self.cdc.name,
                    'barangay_name': self.barangay.name,
                    'cdw_name': self.cdw.username,
                    'reporting_period': 'Q1 2026',
                },
                'fields': {
                    'building_status': 'Good condition',
                    'cleanliness': 'Clean and maintained',
                },
            },
        )
        from core.services.report_file_service import ReportFileService
        ReportFileService.attach_generated_report_file(report)
        report.save(update_fields=['attachment', 'pdf_attachment'])

        self.client.force_authenticate(user=self.staff)
        response = self.client.get('/api/reports/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['report_type'], 'facility_status')
        self.assertTrue(response.data[0]['attachment_url'])
        self.assertTrue(response.data[0]['pdf_attachment_url'])

    def test_assigned_cdw_can_generate_cdc_annual_report_from_current_records(self):
        self.grant_to_operate()
        academic_year = AcademicYear.get_current()
        Child.objects.create(
            cdc=self.cdc,
            barangay=self.barangay,
            academic_year=academic_year,
            name='Ana Child',
            sex='female',
            age=4,
            current_status='enrolled',
        )
        BarangayPopulationMetrics.objects.create(
            barangay=self.barangay,
            academic_year=academic_year,
            total_population=1000,
            children_0_2=40,
            children_3_5=80,
            data_quality_score=95,
        )
        EnrollmentData.objects.create(
            barangay=self.barangay,
            academic_year=academic_year,
            enrolled_3_4=1,
            daycare_enrollment=1,
        )
        ChildrenGapAnalysis.objects.create(
            barangay=self.barangay,
            academic_year=academic_year,
            population_children_3_4=90,
            public_cdc_enrollment_children_3_4=1,
            public_cdc_gap_children_3_4=89,
        )
        FeedingProgram.objects.create(
            cdc=self.cdc,
            created_by=self.staff,
            start_date=timezone.localdate(),
            target_beneficiaries=1,
            status='active',
        )

        self.client.force_authenticate(user=self.staff)
        staff_response = self.client.post(
            '/api/reports/generate-cdc-annual/',
            {'cdc': self.cdc.id, 'year': 2026},
            format='json',
        )
        self.assertEqual(staff_response.status_code, 403)

        self.client.force_authenticate(user=self.cdw)
        response = self.client.post(
            '/api/reports/generate-cdc-annual/',
            {'cdc': self.cdc.id, 'year': 2026},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['report_type'], 'cdc_annual_report')
        self.assertEqual(response.data['period_type'], 'annual')
        self.assertEqual(response.data['submitted_by'], self.cdw.id)
        self.assertTrue(response.data['is_complete'])
        self.assertTrue(response.data['payload']['generated_summary_report'])
        self.assertTrue(response.data['attachment_url'])
        self.assertTrue(response.data['pdf_attachment_url'])

        report = Report.objects.get(id=response.data['id'])
        report.attachment.open('rb')
        html_content = report.attachment.read().decode('utf-8')
        report.attachment.close()
        self.assertIn('CDC Annual Report', html_content)
        self.assertIn('Enrollment and Capacity', html_content)
        self.assertIn('Total Center Capacity', html_content)

        self.client.force_authenticate(user=self.staff)
        blocked = self.client.post(f'/api/reports/{report.id}/start-review/', {}, format='json')
        self.assertEqual(blocked.status_code, 400)
        self.assertIn('do not use approve', blocked.data['error'])


class PopulationUploadPermissionTests(BaseAPITestCase):
    def _csv_file(self, name='population.csv'):
        return SimpleUploadedFile(
            name,
            b'name,date_of_birth,gender,barangay,guardian_name\nAna,2022-01-01,Female,Barangay 1,Maria\nBen,2021-01-01,Male,Barangay 1,Jose\n',
            content_type='text/csv',
        )

    def test_staff_cannot_preview_population_upload(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post(
            '/api/population-data/preview_upload/',
            {'data_file': self._csv_file()},
            format='multipart',
        )

        self.assertEqual(response.status_code, 403)

    def test_cho_can_preview_population_upload(self):
        self.client.force_authenticate(user=self.cho)

        response = self.client.post(
            '/api/population-data/preview_upload/',
            {'data_file': self._csv_file()},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])
        self.assertEqual(response.data['row_count'], 2)
        self.assertIn('name', [value.lower() for value in response.data['detected_columns']])

    def test_cho_can_submit_population_upload(self):
        from core.models import PopulationDataRequest
        from core.models.population_request import request_today
        from datetime import timedelta
        item = PopulationDataRequest.objects.create(title='CHO Upload', purpose='Coverage planning', assigned_to=self.cho, created_by=self.admin, academic_year=AcademicYear.get_current(), period_start=request_today(), period_end=request_today(), due_date=request_today() + timedelta(days=14))
        self.client.force_authenticate(user=self.cho)

        response = self.client.post(
            '/api/population-data/',
            {
                'title': 'CHO Upload',
                'data_request': item.pk,
                'description': 'Population submission test',
                'data_file': self._csv_file('submission.csv'),
                'data_payload': json.dumps({
                    'age_range': '0-4',
                    'file_name': 'submission.csv',
                    'expected_columns': ['name', 'age', 'gender', 'barangay'],
                }),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)

    def test_staff_cannot_submit_population_upload(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post(
            '/api/population-data/',
            {
                'title': 'Blocked Upload',
                'description': 'Should fail',
                'data_file': self._csv_file('blocked.csv'),
                'data_payload': json.dumps({'age_range': '0-4'}),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 403)


class AccreditationWorkflowNotificationTests(BaseAPITestCase):
    def test_accreditation_submission_and_forwarding_create_role_notifications(self):
        self.client.force_authenticate(user=self.cdw)
        submit_response = self.client.post(
            '/api/accreditation-requests/',
            {'cdc': self.cdc.id, 'remarks': 'Ready for staff review.'},
            format='json',
        )

        self.assertEqual(submit_response.status_code, 201)
        request_id = submit_response.data['id']
        self.assertTrue(Notification.objects.filter(
            user=self.staff,
            source_key=f'accreditation_request_{request_id}_staff_review',
            is_active=True,
            is_read=False,
            link='/staff/accreditation',
        ).exists())

        accreditation_request = AccreditationRequest.objects.get(id=request_id)
        accreditation_request.checklist_answers = {'facility_safe': {'compliance': 'no'}}
        accreditation_request.percentage = 0
        accreditation_request.passing_percentage = 75
        accreditation_request.save(update_fields=['checklist_answers', 'percentage', 'passing_percentage', 'updated_at'])

        self.client.force_authenticate(user=self.staff)
        incomplete_response = self.client.post(
            f'/api/accreditation-requests/{request_id}/forward-to-admin/',
            {'staff_remarks': 'This should not forward yet.'},
            format='json',
        )
        self.assertEqual(incomplete_response.status_code, 400)

        checklist = get_accreditation_checklist()
        accreditation_request.checklist_answers = {
            item['id']: {'compliance': 'yes'}
            for section in checklist['sections']
            for item in section['items']
        }
        accreditation_request.percentage = 100
        accreditation_request.save(update_fields=['checklist_answers', 'percentage', 'updated_at'])

        forward_response = self.client.post(
            f'/api/accreditation-requests/{request_id}/forward-to-admin/',
            {'staff_remarks': 'Forwarding for admin decision.'},
            format='json',
        )

        self.assertEqual(forward_response.status_code, 200)
        self.assertEqual(forward_response.data['status'], 'forwarded_to_admin')
        self.assertTrue(Notification.objects.filter(
            user=self.admin,
            source_key=f'accreditation_request_{request_id}_admin_approval',
            is_active=True,
            is_read=False,
            link='/admin/accreditation',
        ).exists())

        self.client.force_authenticate(user=self.admin)
        list_response = self.client.get('/api/accreditation-requests/')
        self.assertEqual(list_response.status_code, 200)
        self.assertTrue(any(
            item['id'] == request_id and item['status'] == 'forwarded_to_admin'
            for item in list_response.data
        ))


class PatternMonitoringTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        Report.objects.create(
            cdc=self.cdc,
            submitted_by=self.cdw,
            report_type='form7',
            title='Q1 Report',
            summary='Initial quarter',
            payload={'formData': {'totalChildren': '80'}},
            quarter=1,
            year=2025,
            is_complete=True,
            is_on_time=True,
        )
        Report.objects.create(
            cdc=self.cdc,
            submitted_by=self.cdw,
            report_type='form7',
            title='Q2 Report',
            summary='Second quarter',
            payload={'formData': {'totalChildren': '62'}},
            quarter=2,
            year=2025,
            is_complete=False,
            is_on_time=True,
        )
        Report.objects.create(
            cdc=self.cdc,
            submitted_by=self.cdw,
            report_type='form7',
            title='Q3 Report',
            summary='Third quarter',
            payload={'formData': {'totalChildren': '40'}},
            quarter=3,
            year=2025,
            is_complete=False,
            is_on_time=False,
        )



class EnhancedBenchmarkTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.second_cdc = CDC.objects.create(
            name='CDC Two',
            barangay=self.barangay,
            latitude=13.96,
            longitude=121.62,
            max_capacity=60,
            current_enrollment=25,
            capacity_per_session=20,
            sessions_per_day=2,
        )
        BarangayPopulationMetrics.objects.create(
            academic_year=AcademicYear.get_current(),
            source_submission=self.current_population_source(),
            children_3_4=100,
            barangay=self.barangay,
            total_population=220,
            children_0_2=30,
            children_3_5=100,
            children_6_12=40,
        )
        EnrollmentData.objects.create(
            academic_year=AcademicYear.get_current(),
            barangay=self.barangay,
            enrolled_0_2=20,
            enrolled_3_4=35,
            enrolled_6_12=10,
        )

    def test_enhanced_benchmark_uses_barangay_totals_once(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.get('/api/enhanced-benchmarks/')
        self.assertEqual(response.status_code, 200)

        barangay_entry = next(
            item for item in response.data['data']['barangay_rankings']
            if item['barangay_info']['name'] == self.barangay.name
        )

        self.assertEqual(barangay_entry['summary_metrics']['total_population_0_5'], 100)
        self.assertEqual(barangay_entry['summary_metrics']['total_enrolled'], 67)
        self.assertEqual(barangay_entry['summary_metrics']['total_capacity'], 70)
        self.assertEqual(barangay_entry['summary_metrics']['total_unserved'], 33)
        self.assertEqual(barangay_entry['summary_metrics']['total_cdcs'], 2)

    def test_enhanced_benchmark_exposes_location_aware_cdc_fields(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.get('/api/enhanced-benchmarks/')
        self.assertEqual(response.status_code, 200)

        barangay_entry = next(
            item for item in response.data['data']['barangay_rankings']
            if item['barangay_info']['name'] == self.barangay.name
        )
        cdc_entry = next(
            item for item in barangay_entry['cdc_analytics']
            if item['cdc_info']['name'] == self.cdc.name
        )

        self.assertEqual(cdc_entry['cdc_info']['barangay'], self.barangay.name)
        self.assertIn(self.barangay.name, cdc_entry['cdc_info']['location_label'])
        self.assertIn('served_children', cdc_entry['service_coverage'])
        self.assertIn('potential_overlap', cdc_entry['gaps_and_opportunities'])


class CDCAuditLogTests(BaseAPITestCase):
    def test_admin_create_cdc_generates_audit_log(self):
        self.client.force_authenticate(user=self.admin)

        payload = {
            'name': 'CDC Three',
            'barangay': self.barangay.id,
            'address': 'Barangay Hall',
            'contact_person': 'Maria Cruz',
            'contact_number': '09171234567',
            'latitude': 13.97,
            'longitude': 121.63,
            'max_capacity': 55,
            'current_enrollment': 10,
        }

        response = self.client.post('/api/cdcs/', payload, format='json')

        self.assertEqual(response.status_code, 201)
        cdc = CDC.objects.get(name='CDC Three')
        audit_log = CDCAuditLog.objects.filter(cdc=cdc).first()
        self.assertIsNotNone(audit_log)
        self.assertEqual(audit_log.action, 'created')
        self.assertEqual(audit_log.actor, self.admin)
        self.assertIn('name', audit_log.field_changes)

    def test_staff_create_cdc_defaults_current_enrollment_to_zero(self):
        self.client.force_authenticate(user=self.staff)

        payload = {
            'name': 'CDC Without Enrollment',
            'barangay': self.barangay.id,
            'address': 'Barangay Hall',
            'contact_person': 'Maria Cruz',
            'contact_number': '09171234567',
            'latitude': 13.97,
            'longitude': 121.63,
            'capacity_per_session': 25,
            'sessions_per_day': 2,
            'max_capacity': 50,
        }

        response = self.client.post('/api/cdcs/', payload, format='json')

        self.assertEqual(response.status_code, 201)
        cdc = CDC.objects.get(name='CDC Without Enrollment')
        self.assertEqual(cdc.current_enrollment, 0)

    def test_admin_update_cdc_generates_field_change_log(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.put(
            f'/api/cdcs/{self.cdc.id}/',
            {
                'name': self.cdc.name,
                'barangay': self.barangay.id,
                'address': 'Updated Address',
                'contact_person': 'Updated Contact',
                'contact_number': '09999999999',
                'email': 'updated@example.com',
                'latitude': self.cdc.latitude,
                'longitude': self.cdc.longitude,
                'max_capacity': 120,
                'current_enrollment': 42,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        audit_log = CDCAuditLog.objects.filter(cdc=self.cdc, action='updated').first()
        self.assertIsNotNone(audit_log)
        self.assertIn('address', audit_log.field_changes)
        self.assertEqual(audit_log.field_changes['address']['to'], 'Updated Address')

    def test_cdc_detail_exposes_recent_audit_logs(self):
        CDCAuditLog.objects.create(
            cdc=self.cdc,
            actor=self.admin,
            action='updated',
            summary='CDC record updated.',
            field_changes={'max_capacity': {'from': 100, 'to': 110}},
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(f'/api/cdcs/{self.cdc.id}/')

        self.assertEqual(response.status_code, 200)
        self.assertIn('audit_logs', response.data)
        self.assertEqual(response.data['audit_logs'][0]['action'], 'updated')


class PublicCDCGapTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.barangay.population_children_3_4 = 600
        self.barangay.save(update_fields=['population_children_3_4'])
        BarangayPopulationMetrics.objects.create(
            academic_year=AcademicYear.get_current(),
            source_submission=self.current_population_source(),
            children_3_4=600,
            barangay=self.barangay,
            total_population=900,
            children_0_2=220,
            children_3_5=600,
            children_6_12=150,
        )
        EnrollmentData.objects.create(
            barangay=self.barangay,
            enrolled_0_2=90,
            enrolled_3_4=170,
            enrolled_6_12=50,
        )
        self.create_enrollees(300)
        self.cdc.current_enrollment = 300
        self.cdc.save(update_fields=['current_enrollment'])

    def test_gap_analysis_uses_barangay_population_3_4_against_public_cdc_enrollment(self):
        gap = DataIntegrationService._calculate_gap_analysis(self.barangay)

        self.assertEqual(gap.population_children_3_4, 600)
        self.assertEqual(gap.public_cdc_enrollment_children_3_4, 300)
        self.assertEqual(gap.public_cdc_gap_children_3_4, 300)
        self.assertEqual(gap.snp_service_gap_basis, 300)

    def test_snp_recommendation_is_capped_by_public_cdc_gap_basis(self):
        DataIntegrationService._calculate_gap_analysis(self.barangay)
        recommendation = DataIntegrationService._generate_snp_recommendation(self.barangay)

        self.assertLessEqual(recommendation.recommended_snp_enrollment, 300)
        self.assertIn('Public CDC coverage gap', recommendation.recommendation_rationale)
        self.assertIn('private institutions', recommendation.recommendation_rationale)

    def test_cdc_detail_and_gap_api_expose_public_cdc_gap_fields(self):
        DataIntegrationService._calculate_gap_analysis(self.barangay)
        self.client.force_authenticate(user=self.admin)

        cdc_response = self.client.get(f'/api/cdcs/{self.cdc.id}/')
        gap_response = self.client.get('/api/integration/gap-analysis/')

        self.assertEqual(cdc_response.status_code, 200)
        self.assertEqual(gap_response.status_code, 200)
        self.assertEqual(gap_response.data[0]['public_cdc_gap_children_3_4'], 300)


class PublicMapEndpointTests(BaseAPITestCase):
    def test_public_map_uses_current_basis_and_excludes_private_fields(self):
        academic_year = AcademicYear.get_current()
        source = PopulationDataSubmission.objects.create(
            submitted_by=self.cho,
            academic_year=academic_year,
            title='Current CHO Population Basis',
            status='current_basis',
        )
        metrics = BarangayPopulationMetrics.objects.create(
            barangay=self.barangay,
            academic_year=academic_year,
            source_submission=source,
            total_population=900,
            children_0_2=120,
            children_3_5=220, children_3_4=220,
        )
        ChildrenGapAnalysis.objects.create(
            barangay=self.barangay,
            academic_year=academic_year,
            population_metrics=metrics,
            gap_0_2=30,
            gap_3_4=40,
            population_children_3_4=220,
            public_cdc_enrollment_children_3_4=150,
            public_cdc_gap_children_3_4=70,
        )

        response = self.client.get('/api/public-map/')

        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data if item['barangay']['id'] == self.barangay.id)
        self.assertEqual(row['population']['children_0_5'], 340)
        # Current child records, rather than a stale stored rollup, drive enrollment.
        self.assertEqual(row['public_cdc']['gap_3_4'], 220)
        serialized = json.dumps(response.data)
        self.assertNotIn('contact_number', serialized)
        self.assertNotIn('named_snp_candidates', serialized)
        self.assertNotIn('guardian_name', serialized)


class PredictiveAnalyticsTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.barangay.population_children_3_4 = 180
        self.barangay.save(update_fields=['population_children_3_4'])
        BarangayPopulationMetrics.objects.create(
            academic_year=AcademicYear.get_current(),
            source_submission=self.current_population_source(),
            children_3_4=180,
            barangay=self.barangay,
            total_population=320,
            children_0_2=60,
            children_3_5=180,
            children_6_12=70,
            children_with_disabilities=12,
            working_children=5,
        )
        EnrollmentData.objects.create(
            barangay=self.barangay,
            enrolled_0_2=25,
            enrolled_3_4=40,
            enrolled_6_12=35,
        )
        self.create_enrollees(68)
        DataIntegrationService._calculate_gap_analysis(self.barangay)
        DataIntegrationService._generate_snp_recommendation(self.barangay)

        report_payloads = [40, 52, 61]
        for index, total_children in enumerate(report_payloads, start=1):
            Report.objects.create(
                cdc=self.cdc,
                submitted_by=self.cdw,
                report_type='form7',
                title=f'Forecast Q{index}',
                summary='Predictive analytics history',
                payload={'formData': {'totalChildren': str(total_children)}},
                quarter=index,
                year=2025,
                is_complete=True,
                is_on_time=True,
            )

        self.cdc.current_enrollment = 68
        self.cdc.capacity_per_session = 25
        self.cdc.sessions_per_day = 2
        self.cdc.save(update_fields=['current_enrollment', 'capacity_per_session', 'sessions_per_day'])

    @patch('core.services.prediction_service.datetime')
    def test_prediction_service_returns_structured_forecast_data(self, mocked_datetime):
        mocked_datetime.now.return_value = __import__('datetime').datetime(2026, 4, 21, 8, 0, 0)

        data = PredictionService.generate_predictive_dashboard()

        self.assertIn('summary', data)
        self.assertIn('chart_series', data)
        self.assertIn('cdc_forecasts', data)
        self.assertGreaterEqual(len(data['cdc_forecasts']), 1)

        forecast = data['cdc_forecasts'][0]
        self.assertEqual(forecast['cdc_name'], self.cdc.name)
        self.assertIn('projected_growth_rate', forecast)
        self.assertIn('forecast_points', forecast)
        self.assertIn('barangay_need', forecast)
        self.assertGreaterEqual(len(forecast['forecast_points']), 5)
        self.assertEqual(forecast['evidence_level'], 'constant scenario')
        self.assertEqual(forecast['confidence_score'], 0)
        self.assertEqual(data['model_version'], 2)

    @patch('core.services.prediction_service.datetime')
    def test_staff_can_access_predictive_analytics_api(self, mocked_datetime):
        mocked_datetime.now.return_value = __import__('datetime').datetime(2026, 4, 21, 8, 0, 0)
        self.client.force_authenticate(user=self.staff)

        response = self.client.get('/api/predictive-analytics/')

        self.assertEqual(response.status_code, 200)
        self.assertIn('summary', response.data)
        self.assertIn('top_risks', response.data)
        self.assertIn('cdc_forecasts', response.data)
        self.assertGreaterEqual(response.data['summary']['total_cdcs_forecasted'], 1)
        self.assertEqual(response.data['cdc_forecasts'][0]['cdc_name'], self.cdc.name)


class NationalBenchmarkComplianceTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.cdc.has_water_supply = True
        self.cdc.has_sanitation = True
        self.cdc.has_electricity = True
        self.cdc.has_health_services = True
        self.cdc.has_feeding_program = True
        self.cdc.total_area = 45
        self.cdc.total_staff = 2
        self.cdc.qualified_caregivers = 1
        self.cdc.contact_person = 'Maria Cruz'
        self.cdc.contact_number = '09171234567'
        self.cdc.offers_preschool = True
        self.cdc.volunteers = 1
        self.cdc.establishment_date = '2024-01-01'
        self.cdc.license_number = 'LIC-001'
        self.cdc.accreditation_status = 'accredited'
        self.cdc.is_accredited = True
        self.cdc.license_expiry_date = '2027-01-01'
        self.cdc.save()

        Report.objects.create(
            cdc=self.cdc,
            submitted_by=self.cdw,
            report_type='form7',
            title='National Benchmark Report',
            summary='Benchmark compliance evidence',
            payload={'formData': {'totalChildren': '42'}},
            quarter=1,
            year=2026,
            is_complete=True,
            is_on_time=True,
        )

    def test_benchmark_api_returns_pdf_based_areas_and_cdc_barangay_linkage(self):
        response = self.client.get('/api/benchmarks/')

        self.assertEqual(response.status_code, 200)
        self.assertIn('national_standard_reference', response.data)
        self.assertIn('barangay_comparison', response.data)
        self.assertIn('cdc_comparison', response.data)
        self.assertEqual(
            response.data['national_standard_reference']['issuing_body'],
            'ECCD Council',
        )
        self.assertGreaterEqual(len(response.data['national_standard_reference']['areas']), 8)
        self.assertEqual(response.data['cdc_comparison'][0]['barangay_name'], self.barangay.name)
        self.assertGreaterEqual(response.data['barangay_comparison'][0]['total_cdcs'], 1)


class ComplianceWorkflowTests(BaseAPITestCase):
    def test_admin_can_create_core_compliance_records_and_detail_exposes_them(self):
        self.client.force_authenticate(user=self.admin)

        authority_response = self.client.post(
            '/api/authority-documents/',
            {
                'cdc': self.cdc.id,
                'document_type': 'authority_to_operate',
                'title': 'Authority to Operate',
                'document_number': 'AUTH-001',
                'issued_on': '2026-04-21',
                'expires_on': '2027-04-21',
            },
            format='json',
        )
        permit_response = self.client.post(
            '/api/permit-records/',
            {
                'cdc': self.cdc.id,
                'application_date': '2026-04-21',
                'permit_type': 'initial',
                'status': 'issued',
                'issued_on': '2026-04-21',
                'expires_on': '2027-04-21',
                'notes': 'Initial permit issued.',
            },
            format='json',
        )
        evaluation_response = self.client.post(
            '/api/annual-evaluations/',
            {
                'cdc': self.cdc.id,
                'school_year': '2026-2027',
                'evaluation_date': '2026-04-21',
                'readiness_status': 'ready',
                'strengths': 'Strong parent engagement',
                'areas_for_improvement': 'Needs more facility documentation',
            },
            format='json',
        )
        visit_response = self.client.post(
            '/api/supervisory-visits/',
            {
                'cdc': self.cdc.id,
                'visit_date': '2026-04-21',
                'status': 'completed',
                'findings': 'Operations aligned with current requirements.',
                'recommendations': 'Maintain annual permit evidence.',
            },
            format='json',
        )

        self.assertEqual(authority_response.status_code, 201)
        self.assertEqual(permit_response.status_code, 201)
        self.assertEqual(evaluation_response.status_code, 201)
        self.assertEqual(visit_response.status_code, 201)

        detail_response = self.client.get(f'/api/cdcs/{self.cdc.id}/')
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data['latest_authority_document']['document_number'], 'AUTH-001')
        self.assertEqual(detail_response.data['latest_permit_record']['status'], 'issued')
        self.assertEqual(detail_response.data['latest_annual_evaluation']['school_year'], '2026-2027')
        self.assertEqual(detail_response.data['latest_supervisory_visit']['status'], 'completed')

    def test_cdw_cannot_create_compliance_records(self):
        self.client.force_authenticate(user=self.cdw)

        response = self.client.post(
            '/api/annual-evaluations/',
            {
                'cdc': self.cdc.id,
                'school_year': '2026-2027',
                'evaluation_date': '2026-04-21',
                'readiness_status': 'progressing',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 403)

    def test_accredit_action_creates_permit_and_authority_records(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            f'/api/cdcs/{self.cdc.id}/accredit/',
            {
                'status': 'accredited',
                'license_number': 'LIC-NEW-001',
                'license_expiry_date': '2027-04-21',
                'notes': 'Issued after compliance review.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(PermitRecord.objects.filter(cdc=self.cdc, status='issued').exists())
        self.assertTrue(
            AuthorityDocument.objects.filter(
                cdc=self.cdc,
                document_type='authority_to_operate',
                document_number='LIC-NEW-001',
            ).exists()
        )

    def test_benchmark_uses_core_compliance_records_for_area_vii_and_viii(self):
        self.client.force_authenticate(user=self.admin)

        AuthorityDocument.objects.create(
            cdc=self.cdc,
            document_type='authority_to_operate',
            title='Authority to Operate',
            document_number='AUTH-002',
            issued_on='2026-04-21',
            expires_on='2027-04-21',
            verified_by=self.admin,
        )
        PermitRecord.objects.create(
            cdc=self.cdc,
            application_date='2026-04-21',
            permit_type='initial',
            status='issued',
            issued_on='2026-04-21',
            expires_on='2027-04-21',
            issued_by=self.admin,
        )
        AnnualEvaluation.objects.create(
            cdc=self.cdc,
            school_year='2026-2027',
            evaluation_date='2026-04-21',
            readiness_status='ready',
            evaluated_by=self.admin,
        )
        SupervisoryVisit.objects.create(
            cdc=self.cdc,
            visit_date='2026-04-21',
            status='completed',
            supervisor=self.admin,
        )

        response = self.client.get('/api/benchmarks/')

        self.assertEqual(response.status_code, 200)
        cdc_entry = next((item for item in response.data['cdc_comparison'] if item['cdc_id'] == self.cdc.id), None)
        self.assertIsNotNone(cdc_entry)
        area_vii = next((item for item in cdc_entry['area_results'] if item['key'] == 'leadership_management_support'), None)
        area_viii = next((item for item in cdc_entry['area_results'] if item['key'] == 'registration_evaluation_recognition'), None)
        self.assertEqual(area_vii['score'], 100.0)
        self.assertEqual(area_viii['score'], 100.0)


class HealthSafetyWorkflowTests(BaseAPITestCase):
    def test_admin_can_create_child_and_area_i_records(self):
        self.client.force_authenticate(user=self.admin)

        child_response = self.client.post(
            '/api/children/',
            {
                'cdc': self.cdc.id,
                'name': 'Ana Dela Cruz',
                'age': 4,
                'is_special_needs': False,
            },
            format='json',
        )
        self.assertEqual(child_response.status_code, 201)
        child_id = child_response.data['id']

        health_response = self.client.post(
            '/api/child-health-records/',
            {
                'cdc': self.cdc.id,
                'child': child_id,
                'screening_date': '2026-04-21',
                'immunization_status': 'complete',
                'nutritional_status': 'normal',
                'vision_screening_result': 'Passed',
                'hearing_screening_result': 'Passed',
            },
            format='json',
        )
        readiness_response = self.client.post(
            '/api/emergency-readiness/',
            {
                'cdc': self.cdc.id,
                'assessment_date': '2026-04-21',
                'has_first_aid_kit': True,
                'fire_safety_equipment_available': True,
                'drills_this_year': 2,
                'emergency_contact_name': 'Maria Cruz',
                'emergency_contact_number': '09171234567',
            },
            format='json',
        )
        incident_response = self.client.post(
            '/api/safety-incidents/',
            {
                'cdc': self.cdc.id,
                'child': child_id,
                'incident_type': 'injury',
                'incident_date': '2026-04-21',
                'description': 'Minor scrape during play.',
                'status': 'closed',
            },
            format='json',
        )
        protection_response = self.client.post(
            '/api/child-protection-records/',
            {
                'cdc': self.cdc.id,
                'review_date': '2026-04-21',
                'written_policy_available': True,
                'case_opened': False,
                'case_status': 'none',
            },
            format='json',
        )

        self.assertEqual(health_response.status_code, 201)
        self.assertEqual(readiness_response.status_code, 201)
        self.assertEqual(incident_response.status_code, 201)
        self.assertEqual(protection_response.status_code, 201)

        detail_response = self.client.get(f'/api/cdcs/{self.cdc.id}/')
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data['latest_child_health_record']['child_name'], 'Ana Dela Cruz')
        self.assertTrue(detail_response.data['latest_emergency_readiness']['has_first_aid_kit'])
        self.assertEqual(detail_response.data['latest_safety_incident']['incident_type'], 'injury')
        self.assertTrue(detail_response.data['latest_child_protection_record']['written_policy_available'])

    def test_cdw_can_create_area_i_records_for_assigned_cdc(self):
        child = Child.objects.create(cdc=self.cdc, name='Ben', age=3)
        self.client.force_authenticate(user=self.cdw)

        response = self.client.post(
            '/api/child-health-records/',
            {
                'cdc': self.cdc.id,
                'child': child.id,
                'screening_date': '2026-04-21',
                'immunization_status': 'partial',
                'nutritional_status': 'normal',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)

    def test_area_i_benchmark_uses_health_and_safety_records(self):
        child = Child.objects.create(cdc=self.cdc, name='Cara', age=4)
        ChildHealthRecord.objects.create(
            cdc=self.cdc,
            child=child,
            screening_date='2026-04-21',
            immunization_status='complete',
            nutritional_status='normal',
            recorded_by=self.admin,
        )
        EmergencyReadiness.objects.create(
            cdc=self.cdc,
            assessment_date='2026-04-21',
            has_first_aid_kit=True,
            fire_safety_equipment_available=True,
            drills_this_year=2,
            assessed_by=self.admin,
        )
        ChildProtectionRecord.objects.create(
            cdc=self.cdc,
            review_date='2026-04-21',
            written_policy_available=True,
            case_status='none',
            reviewed_by=self.admin,
        )
        self.cdc.has_health_services = True
        self.cdc.has_feeding_program = True
        self.cdc.has_water_supply = True
        self.cdc.save()

        response = self.client.get('/api/benchmarks/')

        self.assertEqual(response.status_code, 200)
        cdc_entry = next((item for item in response.data['cdc_comparison'] if item['cdc_id'] == self.cdc.id), None)
        self.assertIsNotNone(cdc_entry)
        area_i = next((item for item in cdc_entry['area_results'] if item['key'] == 'health_nutrition_safety'), None)
        self.assertEqual(area_i['score'], 100.0)


class PhysicalEnvironmentWorkflowTests(BaseAPITestCase):
    def test_admin_can_create_area_ii_assessment_and_detail_exposes_it(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            '/api/physical-environment-assessments/',
            {
                'cdc': self.cdc.id,
                'assessment_date': '2026-04-22',
                'has_safe_water_supply': True,
                'has_functional_sanitation': True,
                'has_stable_electricity': True,
                'classroom_area': 48.5,
                'building_type_observed': 'owned',
                'building_condition': 'safe',
                'handwashing_station_available': True,
                'outdoor_play_area_available': True,
                'outdoor_area_fenced': True,
                'proper_drainage': True,
                'fire_safety_equipment_available': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)

        detail_response = self.client.get(f'/api/cdcs/{self.cdc.id}/')
        self.assertEqual(detail_response.status_code, 200)
        self.assertTrue(detail_response.data['latest_physical_environment_assessment']['has_safe_water_supply'])
        self.assertEqual(detail_response.data['latest_physical_environment_assessment']['building_type_observed'], 'owned')
        self.assertTrue(detail_response.data['physical_environment_snapshot']['has_assessment'])

    def test_cdw_can_create_area_ii_assessment_for_assigned_cdc(self):
        self.client.force_authenticate(user=self.cdw)

        response = self.client.post(
            '/api/physical-environment-assessments/',
            {
                'cdc': self.cdc.id,
                'assessment_date': '2026-04-22',
                'has_safe_water_supply': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)

    def test_area_ii_benchmark_uses_physical_environment_assessment(self):
        PhysicalEnvironmentAssessment.objects.create(
            cdc=self.cdc,
            assessment_date='2026-04-22',
            has_safe_water_supply=True,
            has_functional_sanitation=True,
            has_stable_electricity=True,
            classroom_area=50,
            building_type_observed='school',
            building_condition='safe',
            assessed_by=self.admin,
        )

        response = self.client.get('/api/benchmarks/')

        self.assertEqual(response.status_code, 200)
        cdc_entry = next((item for item in response.data['cdc_comparison'] if item['cdc_id'] == self.cdc.id), None)
        self.assertIsNotNone(cdc_entry)
        area_ii = next((item for item in cdc_entry['area_results'] if item['key'] == 'physical_environment_safety'), None)
        self.assertEqual(area_ii['score'], 100.0)


class InteractionWorkflowTests(BaseAPITestCase):
    def test_admin_can_create_area_iii_observation_and_detail_exposes_it(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            '/api/interaction-observations/',
            {
                'cdc': self.cdc.id,
                'observation_date': '2026-04-22',
                'staff_child_interaction_rating': 'supportive',
                'child_child_interaction_rating': 'supportive',
                'fairness_and_inclusion_observed': True,
                'independence_support_observed': True,
                'positive_behavior_guidance_observed': True,
                'routines_and_transitions_supportive': True,
                'strengths': 'Warm tone and responsive coaching observed.',
                'follow_up_actions': 'Continue peer support routines.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)

        detail_response = self.client.get(f'/api/cdcs/{self.cdc.id}/')
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data['latest_interaction_observation']['staff_child_interaction_rating'], 'supportive')
        self.assertTrue(detail_response.data['interaction_snapshot']['has_observation'])
        self.assertTrue(detail_response.data['interaction_snapshot']['positive_behavior_guidance_observed'])

    def test_cdw_can_create_area_iii_observation_for_assigned_cdc(self):
        self.client.force_authenticate(user=self.cdw)

        response = self.client.post(
            '/api/interaction-observations/',
            {
                'cdc': self.cdc.id,
                'observation_date': '2026-04-22',
                'staff_child_interaction_rating': 'developing',
                'child_child_interaction_rating': 'supportive',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)

    def test_area_iii_benchmark_uses_interaction_observations(self):
        InteractionObservation.objects.create(
            cdc=self.cdc,
            observation_date='2026-04-22',
            staff_child_interaction_rating='supportive',
            child_child_interaction_rating='supportive',
            fairness_and_inclusion_observed=True,
            independence_support_observed=True,
            positive_behavior_guidance_observed=True,
            routines_and_transitions_supportive=True,
            observed_by=self.admin,
        )

        response = self.client.get('/api/benchmarks/')

        self.assertEqual(response.status_code, 200)
        cdc_entry = next((item for item in response.data['cdc_comparison'] if item['cdc_id'] == self.cdc.id), None)
        self.assertIsNotNone(cdc_entry)
        area_iii = next((item for item in cdc_entry['area_results'] if item['key'] == 'interactions_relationships'), None)
        self.assertEqual(area_iii['score'], 100.0)


class StaffingWorkflowTests(BaseAPITestCase):
    def test_admin_can_create_staffing_records_and_detail_exposes_them(self):
        self.client.force_authenticate(user=self.admin)

        profile_response = self.client.post(
            '/api/staff-profiles/',
            {
                'cdc': self.cdc.id,
                'full_name': 'Lina Santos',
                'role_type': 'teacher',
                'employment_status': 'active',
                'hire_date': '2026-04-01',
                'highest_education': 'bachelors',
                'has_eccd_training': True,
                'is_qualified': True,
                'is_primary_caregiver': True,
                'first_aid_certified': True,
                'notes': 'Lead classroom teacher.',
            },
            format='json',
        )
        self.assertEqual(profile_response.status_code, 201)

        training_response = self.client.post(
            '/api/staff-training-records/',
            {
                'cdc': self.cdc.id,
                'staff_profile': profile_response.data['id'],
                'title': 'ECCD Refresher Training',
                'training_type': 'eccd',
                'provider': 'CSWDO Training Unit',
                'completed_on': '2026-04-21',
                'valid_until': '2027-04-21',
                'hours': 8,
            },
            format='json',
        )
        self.assertEqual(training_response.status_code, 201)

        detail_response = self.client.get(f'/api/cdcs/{self.cdc.id}/')
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data['latest_staff_profile']['full_name'], 'Lina Santos')
        self.assertEqual(detail_response.data['latest_staff_training_record']['title'], 'ECCD Refresher Training')
        self.assertTrue(detail_response.data['staffing_snapshot']['has_active_staff_profile'])
        self.assertTrue(detail_response.data['staffing_snapshot']['has_recent_training'])

    def test_cdw_can_create_staffing_records_for_assigned_cdc(self):
        self.client.force_authenticate(user=self.cdw)

        response = self.client.post(
            '/api/staff-profiles/',
            {
                'cdc': self.cdc.id,
                'full_name': 'Nora Reyes',
                'role_type': 'assistant',
                'employment_status': 'active',
                'highest_education': 'college_level',
                'is_primary_caregiver': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)

    def test_area_iv_benchmark_uses_staffing_records(self):
        primary_staff = StaffProfile.objects.create(
            cdc=self.cdc,
            full_name='Lina Santos',
            role_type='teacher',
            employment_status='active',
            highest_education='bachelors',
            has_eccd_training=True,
            is_qualified=True,
            is_primary_caregiver=True,
            recorded_by=self.admin,
        )
        StaffProfile.objects.create(
            cdc=self.cdc,
            full_name='Mila Cruz',
            role_type='assistant',
            employment_status='active',
            highest_education='college_level',
            is_primary_caregiver=True,
            recorded_by=self.admin,
        )
        StaffTrainingRecord.objects.create(
            cdc=self.cdc,
            staff_profile=primary_staff,
            title='Child Protection and ECCD Update',
            training_type='child_protection',
            provider='CSWDO',
            completed_on='2026-04-21',
            recorded_by=self.admin,
        )

        response = self.client.get('/api/benchmarks/')

        self.assertEqual(response.status_code, 200)
        cdc_entry = next((item for item in response.data['cdc_comparison'] if item['cdc_id'] == self.cdc.id), None)
        self.assertIsNotNone(cdc_entry)
        area_iv = next((item for item in cdc_entry['area_results'] if item['key'] == 'staff_qualifications_development'), None)
        self.assertEqual(area_iv['score'], 100.0)
