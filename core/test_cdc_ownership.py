from tempfile import TemporaryDirectory
from django.test import TestCase, override_settings
from django.core.files.base import ContentFile
from rest_framework_simplejwt.tokens import RefreshToken
from core import test_child_enrollment as fixtures
from core.models import CDC, Child, Report, ReportDraft, SafetyIncident, User


class CDCOwnershipTests(TestCase):
    def setUp(self):
        fixtures.ChildEnrollmentTests.setUp(self)
        self.foreign = CDC.objects.create(name='Other center', barangay=self.barangay,
            assigned_cdw=self.other, latitude=0, longitude=0, max_capacity=30,
            is_accredited=True, accreditation_status='accredited',
            license_expiry_date=self.cdc.license_expiry_date)
        self.child.cdc = self.cdc
        self.child.current_status = 'enrolled'
        self.child.save()

    def test_cdc_api_always_scopes_assignments(self):
        response = self.client.get('/api/cdcs/')
        rows = response.data if isinstance(response.data, list) else response.data['results']
        self.assertEqual([row['id'] for row in rows], [self.cdc.pk])
        self.assertEqual(self.client.get(f'/api/cdcs/{self.foreign.pk}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/cdcs/{self.foreign.pk}/complete-record/').status_code, 403)
        CDC.objects.filter(pk=self.cdc.pk).update(assigned_cdw=None)
        self.foreign.assigned_cdw = self.user
        self.foreign.save()
        self.assertEqual(self.client.get(f'/api/cdcs/{self.foreign.pk}/').status_code, 200)

    def test_private_record_reads_and_writes_reject_other_cdw(self):
        row = SafetyIncident.objects.create(cdc=self.foreign, description='Private')
        url = f'/api/safety-incidents/{row.pk}/'
        for method, data in [('get', {}), ('patch', {'description': 'Changed'}), ('delete', {})]:
            self.assertEqual(getattr(self.client, method)(url, data, format='json').status_code, 404)
        row.refresh_from_db()
        self.assertEqual(row.description, 'Private')

    def test_destination_and_related_child_cannot_be_forged(self):
        row = SafetyIncident.objects.create(cdc=self.cdc, description='Owned')
        foreign_child = Child.objects.create(name='Other child', cdc=self.foreign,
            barangay=self.barangay, academic_year=self.year, age=3)
        for payload in ({'cdc': self.foreign.pk}, {'child': foreign_child.pk}):
            response = self.client.patch(f'/api/safety-incidents/{row.pk}/', payload, format='json')
            self.assertEqual(response.status_code, 403, response.data)
        row.refresh_from_db()
        self.assertEqual(row.cdc_id, self.cdc.pk)
        self.assertIsNone(row.child_id)

    def test_draft_creation_rejects_unassigned_center(self):
        response = self.client.post('/api/report-drafts/', {'cdc': self.foreign.pk,
            'report_type': 'form6', 'quarter': 1, 'year': 2026}, format='json')
        self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(ReportDraft.objects.exists())

    def test_reassignment_changes_report_and_draft_access(self):
        report = Report.objects.create(cdc=self.cdc, submitted_by=self.user,
            academic_year=self.year, quarter=1, year=2026, status='needs_revision')
        draft = ReportDraft.objects.create(cdc=self.cdc, user=self.user, academic_year=self.year)
        urls = [f'/api/reports/{report.pk}/', f'/api/report-drafts/{draft.pk}/']
        CDC.objects.filter(pk=self.foreign.pk).update(assigned_cdw=None)
        self.cdc.assigned_cdw = self.other
        self.cdc.save()
        for url in urls:
            self.assertEqual(self.client.get(url).status_code, 404)
            self.assertEqual(self.client.patch(url, {'title': 'Forbidden'}, format='json').status_code, 404)
        self.client.force_authenticate(self.other)
        for url in urls:
            self.assertEqual(self.client.get(url).status_code, 200)
            response = self.client.patch(url, {'title': 'New assigned worker'}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
        report.refresh_from_db()
        self.assertEqual(report.submitted_by_id, self.user.pk)

    def test_media_requires_current_assignment_even_with_old_cookie(self):
        with TemporaryDirectory() as root, override_settings(MEDIA_ROOT=root):
            report = Report.objects.create(cdc=self.cdc, submitted_by=self.user,
                academic_year=self.year, quarter=1, year=2026)
            report.attachment.save('ownership.txt', ContentFile(b'private test file'))
            url = report.attachment.url
            self.client.force_authenticate(user=None)
            self.assertEqual(self.client.get(url).status_code, 404)
            token = str(RefreshToken.for_user(self.user).access_token)
            self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
            response = self.client.get('/api/children/record-context/')
            self.assertIn('media_access', response.cookies)
            self.client.credentials()
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b''.join(response.streaming_content), b'private test file')
            CDC.objects.filter(pk=self.foreign.pk).update(assigned_cdw=None)
            self.cdc.assigned_cdw = self.other
            self.cdc.save()
            self.assertEqual(self.client.get(url).status_code, 404)
            self.client.force_authenticate(self.other)
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b''.join(response.streaming_content), b'private test file')

    def test_admin_access_is_preserved(self):
        admin = User.objects.create_user(username='ownership_admin', role='admin')
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.get(f'/api/cdcs/{self.foreign.pk}/').status_code, 200)

    def test_reassignment_hides_previous_activity_and_notifications(self):
        from core.models import Notification
        from core.services.activity_log_service import ActivityLogService
        from core.services.notification_service import NotificationService
        report = Report.objects.create(cdc=self.cdc, submitted_by=self.user,
            academic_year=self.year, quarter=1, year=2026)
        ActivityLogService.log(self.user, 'report_submitted', 'Private report', 'report', report.pk)
        notice = Notification.objects.create(user=self.user, source_key=f'population_basis_{self.cdc.pk}_1',
            title='Private center update', message='Details', category='population')
        self.assertTrue(ActivityLogService.get_queryset_for_user(self.user).exists())
        self.assertTrue(NotificationService.visible_notifications(self.user).filter(pk=notice.pk).exists())
        CDC.objects.filter(pk=self.foreign.pk).update(assigned_cdw=None)
        self.cdc.assigned_cdw = self.other
        self.cdc.save()
        self.assertFalse(ActivityLogService.get_queryset_for_user(self.user).exists())
        self.assertTrue(ActivityLogService.get_queryset_for_user(self.other).exists())
        self.assertFalse(NotificationService.visible_notifications(self.user).filter(pk=notice.pk).exists())

    def test_logout_clears_media_cookie(self):
        self.client.cookies['media_access'] = 'old-token'
        response = self.client.post('/api/media-session/logout/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies['media_access']['max-age'], 0)
