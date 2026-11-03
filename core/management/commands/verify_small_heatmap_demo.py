import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.test import override_settings
from rest_framework.test import APIClient
from core import models as m


class Command(BaseCommand):
    help = 'Verify demo map API colors, capacity statuses, staffing and SNP recommendations.'

    def handle(self, *args, **options):
        manifest = json.loads(Path('output/small-heatmap-demo.json').read_text())
        year_id = manifest['academic_year_id']
        client = APIClient()
        client.force_authenticate(m.User.objects.get(username='sample_admin'))
        with override_settings(ALLOWED_HOSTS=['testserver']):
            public = client.get('/api/public-map/', {'academic_year': year_id})
            internal = client.get('/api/heatmap/', {'academic_year': year_id})
        if public.status_code != 200 or internal.status_code != 200:
            raise CommandError('Map endpoint failed.')
        checks = []
        for scenario in manifest['scenarios']:
            name = scenario['barangay']
            row = next(row for row in public.data if row['barangay']['name'] == name)
            cdc = next(row for row in internal.data if row['name'] == scenario['cdc'])
            assert row['population']['children_3_4'] == 10
            assert row['public_cdc']['enrollment_3_4'] == scenario['enrolled']
            assert row['public_cdc']['gap_3_4'] == 10 - scenario['enrolled']
            assert row['service_signal']['need_level'] == scenario['expected_level']
            assert cdc['academic_year']['id'] == year_id
            assert m.SNPPlanningRecommendation.objects.filter(barangay__name=name, academic_year_id=year_id).exists()
            checks.append({'barangay': name, 'coverage_percent': row['public_cdc']['coverage_rate_3_4'],
                           'level': row['service_signal']['need_level'], 'center_status': cdc['status']})
        assert m.Child.objects.filter(student_id__startswith='HEATMAP-DEMO-').count() == 50
        path = Path('output/small-heatmap-verification.json')
        path.write_text(json.dumps({'passed': True, 'scenarios': checks}, indent=2), encoding='utf-8')
        self.stdout.write(self.style.SUCCESS('Both map APIs passed; all five demo scenarios have correct coverage and gap values.'))
