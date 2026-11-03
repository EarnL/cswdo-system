import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count
from django.db import transaction
from core.management.commands.verify_demo_data import preserve_transaction_connection
from django.test import override_settings
from rest_framework.test import APIClient
from core import models as m


class Command(BaseCommand):
    help = 'Verify seeded feature endpoints and assignment isolation without applying updates or transfers.'

    def handle(self, *args, **options):
        results = []
        def check(label, passed):
            results.append({'check': label, 'passed': bool(passed)})
        check('One CDC per CDW', not m.CDC.objects.exclude(assigned_cdw=None).values('assigned_cdw')
              .annotate(total=Count('pk')).filter(total__gt=1).exists())
        check('Cleared accounts remain unassigned', not m.CDC.objects.filter(
            assigned_cdw__username__in=['sample_cdw', 'sample_cdw_empty']).exists())
        client = APIClient()
        with override_settings(ALLOWED_HOSTS=['testserver', 'localhost', '127.0.0.1']):
            for letter in ('a', 'b'):
                user = m.User.objects.get(username=f'sample_workflow_{letter}')
                center = m.CDC.objects.get(assigned_cdw=user)
                check(f'{user.username} password', user.check_password('SampleDemo!2026'))
                client.force_authenticate(user)
                endpoints = ['cdcs', 'children/record-context', 'children/enrollment-options',
                    'children/transfers', 'reports', 'report-drafts', 'child-health-records',
                    'special-needs-assessments', 'child-assessment-records', 'staff-profiles',
                    'staff-training-records', 'feeding-programs', 'feeding-programs/monitoring_summary',
                    'parent-seminars', 'authority-documents', 'permit-records', 'annual-evaluations',
                    'supervisory-visits', 'curriculum-plans', 'staff-schedules', 'notifications', 'dashboard',
                    f'cdcs/{center.pk}/population-basis']
                for endpoint in endpoints:
                    response = client.get(f'/api/{endpoint}/')
                    check(f'{user.username}: {endpoint}', response.status_code == 200)
                context = client.get('/api/children/record-context/').data
                check(f'{letter}: historical year visible', len(context.get('years', [])) >= 2)
                other = m.CDC.objects.get(name=f'Sample Workflow Center {"B" if letter == "a" else "A"}')
                check(f'{letter}: other CDC blocked', client.get(f'/api/cdcs/{other.pk}/').status_code == 404)
                child = m.Child.objects.filter(cdc=other, current_status='enrolled').first()
                check(f'{letter}: other private child blocked', client.get(f'/api/children/{child.pk}/').status_code == 404)
                response = client.get('/api/children/', {'record_cdc': center.pk, 'record_scope': 'population'})
                rows = response.data if isinstance(response.data, list) else response.data.get('results', [])
                row = next((row for row in rows if row['id'] == child.pk), None)
                check(f'{letter}: status-only shared child', row and row.get('can_view_profile') is False
                      and 'health_checkup_records' not in row)
            for role in ('admin', 'staff', 'cho', 'planning'):
                user = m.User.objects.get(username='sample_' + role)
                client.force_authenticate(user)
                for endpoint in ('dashboard', 'notifications', 'population-data'):
                    check(f'{role}: {endpoint}', client.get(f'/api/{endpoint}/').status_code == 200)
            # Exercise real mutations, then restore the ready-to-try scenarios.
            with preserve_transaction_connection(), transaction.atomic():
                user = m.User.objects.get(username='sample_workflow_a')
                center = m.CDC.objects.get(assigned_cdw=user)
                client.force_authenticate(user)
                update = m.PopulationDataSubmission.objects.get(title='[FEATURE SAMPLE] Approved population update')
                response = client.post(f'/api/cdcs/{center.pk}/population-basis/', {'submission': update.pk}, format='json')
                check('Apply population update', response.status_code == 200)
                candidate = m.Child.objects.get(student_id=f'FEATURE-UPDATE-ONLY-{update.academic_year_id}')
                response = client.post('/api/children/enroll/', {'child_id': candidate.pk, 'cdc': center.pk,
                    'guardian_name': 'Sample Parent', 'contact_number': '00000000000',
                    'academic_year': update.academic_year_id,
                    'enrollment_date': str(update.academic_year.start_date)}, format='json')
                check('Enroll newly added population child', response.status_code == 200)
                if response.status_code != 200:
                    self.stdout.write(str(response.data))
                transfer = m.ChildTransfer.objects.filter(from_cdc=center, status='pending').first()
                response = client.post(f'/api/children/transfers/{transfer.pk}/review/', {'decision': 'approved'}, format='json')
                check('Source CDW approves transfer', response.status_code == 200)
                transaction.set_rollback(True)
        output = {'passed': sum(row['passed'] for row in results),
                  'failed': [row for row in results if not row['passed']], 'checks': results}
        path = Path('output/feature-sample-verification.json')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(output, indent=2), encoding='utf-8')
        self.stdout.write(f"Passed {output['passed']}/{len(results)} checks; details: {path}")
        if output['failed']:
            raise CommandError(str(output['failed']))
