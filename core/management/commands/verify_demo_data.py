"""Exercise demonstration endpoints without retaining verification mutations."""
import json
from pathlib import Path
from contextlib import contextmanager

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections, connection, transaction
from django.core.signals import request_finished, request_started
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from core import models
from core.urls import router
from core.services.map_basis_service import shared_map_rows
from core.services.prediction_service import PredictionService, annual_slope


@contextmanager
def preserve_transaction_connection():
    signals = [signal for signal in [request_started, request_finished] if signal.disconnect(close_old_connections)]
    try:
        yield
    finally:
        for signal in signals:
            signal.connect(close_old_connections)


class Command(BaseCommand):
    help = 'Verify demo API reads, role authentication and representative writes; roll verification changes back.'

    def add_arguments(self, parser):
        parser.add_argument('--output', default='output/demo-api-verification.json')

    def handle(self, *args, **options):
        results = []
        client = APIClient()
        client.raise_request_exception = False

        def check(method, url, expected=200, data=None, label=None):
            response = getattr(client, method)(url, data=data, format='json')
            results.append({'check': label or f'{method.upper()} {url}', 'status': response.status_code,
                            'expected': expected, 'passed': response.status_code == expected})
            if getattr(response, 'streaming', False):
                content = b''.join(response.streaming_content)
                results.append({'check': f'{url} returns a PDF', 'passed': content.startswith(b'%PDF')})
            return response

        with preserve_transaction_connection(), transaction.atomic():
            admin = models.User.objects.get(username='admin')
            client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(admin)))
            for prefix, view, basename in router.registry:
                suffix = 'all_barangays/' if prefix == 'integration/barangay-status' else ''
                check('get', f'/api/{prefix}/{suffix}')
                if not suffix:
                    check('get', f'/api/{prefix}/?search=Sample&status=pending&page=1')
            for endpoint in ['dashboard', 'heatmap', 'public-map', 'benchmarks', 'enhanced-benchmarks',
                             'location-analytics', 'benchmark-dashboard', 'predictive-analytics', 'notifications',
                             'notifications/all', 'activity-logs', 'reminders', 'profile']:
                check('get', f'/api/{endpoint}/')
            for center in models.CDC.objects.all():
                check('get', f'/api/cdcs/{center.pk}/complete-record/')
                check('get', f'/api/cdc/{center.pk}/detailed-analytics/')
                check('get', f'/api/cdcs/{center.pk}/pre-opening/')
            created = check('post', '/api/barangays/', 201,
                            {'name': 'Sample Verification Only', 'population_children_3_4': 10})
            if created.status_code == 201:
                identifier = created.data['id']
                check('get', f'/api/barangays/{identifier}/')
                check('patch', f'/api/barangays/{identifier}/', data={'population_children_3_4': 12})
                check('delete', f'/api/barangays/{identifier}/', 204)
                check('get', f'/api/barangays/{identifier}/', 404)
            check('post', '/api/barangays/', 400, {'name': ''}, 'Invalid create rejected')
            client.credentials()
            check('post', '/api/barangays/', 401, {'name': 'Sample Unauthorized'}, 'Anonymous write blocked')
            check('post', '/api/token/', 400, {'username': 'sample_inactive', 'password': 'SampleDemo!2026'},
                  'Inactive account login blocked')
            for user in models.User.objects.exclude(pk=admin.pk).filter(is_active=True):
                response = check('post', '/api/token/', data={'username': user.username, 'password': 'SampleDemo!2026'},
                                 label=f'{user.username} password authentication')
                if response.status_code != 200:
                    continue
                client.credentials(HTTP_AUTHORIZATION='Bearer ' + response.data['access'])
                check('get', '/api/dashboard/', label=f'{user.username} dashboard')
                check('get', '/api/notifications/', label=f'{user.username} notifications')
                client.credentials()
            worker = models.User.objects.get(username='sample_cdw_empty')
            client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(worker)))
            center = models.CDC.objects.get(name='Sample Pre-opening Draft Center')
            check('put', f'/api/cdcs/{center.pk}/pre-opening/basic/', data={'data': {'address': 'Sample revised draft address'}})
            check('put', f'/api/cdcs/{center.pk}/pre-opening/basic/', 400, {'data': {'capacity': '-1'}},
                  'Invalid pre-opening capacity rejected')
            other = models.CDC.objects.get(name='Sample Maligaya Learning Center')
            check('get', f'/api/cdcs/{other.pk}/pre-opening/', 404, label='Cross-center preparation blocked')
            complete = models.CDC.objects.get(name='Sample New Center - Empty Scenario')
            check('get', f'/api/cdcs/{complete.pk}/pre-opening/documents/', label='Private evidence download')
            connection.check_constraints()
            map_rows = shared_map_rows()
            for row in map_rows:
                if row['population']['has_current_basis']:
                    expected_gap = max(0, row['population']['children_3_4'] - row['public_cdc']['enrollment_3_4'])
                    results.append({'check': f'Map gap arithmetic {row["barangay"]["name"]}',
                                    'passed': row['public_cdc']['gap_3_4'] == expected_gap})
            for center in models.CDC.objects.all():
                actual = models.Child.objects.filter(cdc=center, academic_year=models.AcademicYear.get_current(), current_status='enrolled').count()
                results.append({'check': f'Enrollment counter {center.name}', 'passed': actual == center.current_enrollment})
                if actual:
                    forecast = PredictionService._build_cdc_forecast(center, models.AcademicYear.get_current().start_year,
                                                                   models.AcademicYear.get_current())
                    history = PredictionService._get_enrollment_history(center)
                    expected_evidence = 'trend' if annual_slope(history) is not None else 'constant scenario'
                    results.append({'check': f'Forecast matches available evidence {center.name}',
                                    'passed': forecast['evidence_level'] == expected_evidence})
            transaction.set_rollback(True)
        result = {'checks': results, 'passed': sum(item['passed'] for item in results),
                  'failed': [item for item in results if not item['passed']],
                  'map_levels': sorted({row['service_signal']['need_level'] for row in map_rows}),
                  'scope': 'API list/filter-query smoke checks, role logins, representative CRUD and validation; not exhaustive browser or every mutation coverage.'}
        output = Path(options['output'])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2), encoding='utf-8')
        self.stdout.write(f'{result["passed"]}/{len(results)} checks passed. Results: {output}')
        if result['failed']:
            raise CommandError(json.dumps(result['failed']))
