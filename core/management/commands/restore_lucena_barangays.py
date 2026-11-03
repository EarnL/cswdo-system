"""Restore the city barangay directory without replacing operational records."""
import json
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.models import Barangay
from core.management.commands.reset_demo_data import Command as BackupCommand


def restore_directory():
    geography = json.loads((settings.BASE_DIR / 'frontend/src/data/lucenaBarangays.json').read_text(encoding='utf-8'))
    names = [feature['properties']['brgy_name'] for feature in geography['features']]
    if len(names) != 33 or len(set(names)) != 33:
        raise CommandError('Expected exactly 33 distinct barangays in the project map.')

    def normalized(name):
        return name.casefold().replace('(pob.)', '').strip()

    with transaction.atomic():
        existing = {normalized(row.name): row for row in Barangay.objects.select_for_update().all()}
        created = []
        for name in names:
            if normalized(name) not in existing:
                row = Barangay.objects.create(name=name, population_children_3_4=0)
                existing[normalized(name)] = row
                created.append(name)
        return created


class Command(BaseCommand):
    help = 'Back up and add missing Lucena barangays; preserve existing IDs, values and related records.'

    def add_arguments(self, parser):
        parser.add_argument('--execute', action='store_true')
        parser.add_argument('--pg-bin', default=r'C:\Program Files\PostgreSQL\18\bin')

    def handle(self, *args, **options):
        if not options['execute']:
            self.stdout.write('No changes made. Use --execute to back up and restore missing barangays.')
            return
        backup = settings.BASE_DIR / 'backups' / ('restore_barangays_' + timezone.now().strftime('%Y%m%d_%H%M%S_%f'))
        backup.mkdir(parents=True)
        BackupCommand().backup(backup, Path(options['pg_bin']))
        with transaction.atomic():
            before = {model: list(model.objects.order_by('pk').values())
                      for model in apps.get_app_config('core').get_models()}
            created = restore_directory()
            for model, rows in before.items():
                current = list(model.objects.filter(pk__in=[row['id'] for row in rows]).order_by('pk').values())
                if current != rows:
                    raise CommandError(f'Existing {model.__name__} records changed; rolling back.')
            result = {'added': created, 'total_barangays': Barangay.objects.count(),
                      'existing_records_unchanged': True,
                      'note': 'Missing population sources remain unvalidated; zero is only the required directory-field placeholder.'}
            (backup / 'verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'Added {len(created)} barangays. Total: {result["total_barangays"]}. All existing records unchanged.'))
        self.stdout.write(f'Backup and verification: {backup}')
