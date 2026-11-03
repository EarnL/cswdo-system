import json
import tempfile
from datetime import date, timedelta
from pathlib import Path

from django.conf import settings
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import AcademicYear, Barangay, CDC, Child, Report, SpecialNeedsAssessment, User
from core.services.special_needs_summary import DOMAINS, completion


def full_checklist():
    return {domain['key']: [
        {'id': f"{domain['key']}_{index + 1}", 'label': label, 'present': 'present', 'comments': ''}
        for index, label in enumerate(domain['items'])
    ] for domain in DOMAINS}


class AssessmentSummaryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='assessment_cdw', role='cdw')
        self.other = User.objects.create_user(username='other_assessment_cdw', role='cdw')
        barangay = Barangay.objects.create(name='Assessment barangay', population_children_3_4=0)
        self.cdc = CDC.objects.create(name='Assessment CDC', barangay=barangay, assigned_cdw=self.user,
            latitude=13.9, longitude=121.6, max_capacity=30, is_accredited=True,
            accreditation_status='accredited', license_number='ASSESS-001',
            license_expiry_date=timezone.localdate() + timedelta(days=90))
        self.child = Child.objects.create(name='Assessment Child', age=4, sex='male',
            barangay=barangay, cdc=self.cdc, academic_year=AcademicYear.get_current(), current_status='enrolled')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.params = {'cdc': self.cdc.pk, 'quarter': 4, 'year': 2026}
        self.url = '/api/special-needs-assessments/'
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        media = override_settings(MEDIA_ROOT=directory.name)
        media.enable()
        self.addCleanup(media.disable)

    def record(self, **kwargs):
        values = dict(child=self.child, cdc=self.cdc, assessed_by=self.user,
                      assessment_date=date(2026, 10, 1), status='submitted', checklist=full_checklist(), result='no_concern')
        values.update(kwargs)
        return SpecialNeedsAssessment.objects.create(**values)

    def preview(self):
        response = self.client.get(self.url + 'summary-preview/', self.params)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_latest_complete_per_child_and_exclusions(self):
        older = self.record()
        latest = self.record(assessment_type='second', assessment_date=date(2026, 10, 2), result='needs_monitoring')
        draft = self.record(assessment_type='third', status='draft', assessment_date=date(2026, 10, 3))
        incomplete = self.record(checklist={}, assessment_date=date(2026, 10, 4))
        self.record(assessment_date=date(2026, 9, 30))
        data = self.preview()
        self.assertEqual(data['assessment_ids'], [latest.pk])
        self.assertEqual(sum(data['counts'].values()), 1)
        self.assertEqual(data['counts']['needs_monitoring'], 1)
        self.assertEqual({row['assessment_id'] for row in data['excluded']}, {older.pk, draft.pk, incomplete.pk})
        self.assertEqual(data['incomplete_count'], 1)

    def test_preview_submit_snapshot_and_duplicate(self):
        self.record()
        preview = self.preview()
        payload = {**self.params, 'fingerprint': preview['fingerprint'], 'remarks': 'Reviewed'}
        response = self.client.post(self.url + 'submit-summary/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        report = Report.objects.get(pk=response.data['report'])
        self.assertEqual(report.status, 'under_review')
        self.assertEqual(report.payload['children'], preview['children'])
        self.assertTrue(report.attachment)
        self.assertEqual(self.client.post(self.url + 'submit-summary/', payload, format='json').status_code, 409)
        self.assertEqual(Report.objects.count(), 1)

    def test_stale_preview_and_empty_period(self):
        item = self.record()
        preview = self.preview()
        item.remarks = 'Changed after preview'
        item.save()
        response = self.client.post(self.url + 'submit-summary/', {**self.params, 'fingerprint': preview['fingerprint']}, format='json')
        self.assertEqual(response.status_code, 409)
        self.params['quarter'] = 1
        preview = self.preview()
        response = self.client.post(self.url + 'submit-summary/', {**self.params, 'fingerprint': preview['fingerprint']}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_returned_report_is_resubmitted_without_new_record(self):
        self.record()
        preview = self.preview()
        response = self.client.post(self.url + 'submit-summary/', {**self.params, 'fingerprint': preview['fingerprint']}, format='json')
        report = Report.objects.get(pk=response.data['report'])
        report.status = 'needs_revision'
        report.review_remarks = 'Please clarify the remarks.'
        report.save()
        preview = self.preview()
        self.assertEqual(preview['revision_report'], report.pk)
        response = self.client.post(self.url + 'submit-summary/', {**self.params,
            'fingerprint': preview['fingerprint'], 'revision_report': report.pk, 'remarks': 'Clarified'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        report.refresh_from_db()
        self.assertEqual(report.status, 'under_review')
        self.assertEqual(report.payload['remarks'], 'Clarified')
        self.assertEqual(Report.objects.count(), 1)

    def test_permissions_and_period_validation(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url + 'summary-preview/', self.params).status_code, 400)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(self.url + 'summary-preview/', {**self.params, 'quarter': 'bad'}).status_code, 400)
        self.cdc.license_expiry_date = timezone.localdate() - timedelta(days=1)
        self.cdc.save()
        self.assertEqual(self.client.get(self.url + 'summary-preview/', self.params).status_code, 403)

    def test_incomplete_submission_and_duplicate_stage_rejected(self):
        incomplete = self.record(status='draft', checklist={})
        self.assertEqual(self.client.post(f'{self.url}{incomplete.pk}/submit/').status_code, 400)
        incomplete.refresh_from_db()
        self.assertEqual(incomplete.status, 'draft')
        submitted = self.record()
        incomplete.checklist = full_checklist()
        incomplete.save()
        self.assertEqual(self.client.post(f'{self.url}{incomplete.pk}/submit/').status_code, 400)
        submitted.delete()
        self.assertEqual(self.client.post(f'{self.url}{incomplete.pk}/submit/').status_code, 200)

    def test_all_required_items_and_frontend_schema_match(self):
        checklist = full_checklist()
        self.assertTrue(completion(checklist)['complete'])
        checklist['gross_motor'][0]['present'] = 'invalid'
        checklist['gross_motor'].append(checklist['gross_motor'][1])
        self.assertFalse(completion(checklist)['complete'])
        frontend = Path(settings.BASE_DIR) / 'frontend/src/data/specialNeedsDomains.json'
        self.assertEqual(json.loads(frontend.read_text()), DOMAINS)
