"""Back up PostgreSQL and rebuild explicitly requested demonstration data."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import zipfile
from uuid import uuid4
from zoneinfo import ZoneInfo
from contextlib import ExitStack
from unittest.mock import patch

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command
from django.core.files.storage import FileSystemStorage
from django.core.files.base import ContentFile
from django.db import connection, models as django_models, transaction
from django.test import override_settings
from django.utils import timezone

from core import models as models
from core.management.commands.seed_demo_scenarios import Command as DemoSeeder


class Command(BaseCommand):
    help = 'Backup-first destructive demo reset. No changes without --execute or --rehearse.'

    def add_arguments(self, parser):
        parser.add_argument('--admin-username', default='admin')
        parser.add_argument('--execute', action='store_true')
        parser.add_argument('--rehearse', action='store_true')
        parser.add_argument('--pg-bin', default=r'C:\Program Files\PostgreSQL\18\bin')
        parser.add_argument('--as-of', default=str(timezone.localtime(timezone.now(), ZoneInfo('Asia/Manila')).date()))

    def backup(self, directory, pg_bin):
        database = connection.settings_dict
        environment = os.environ.copy()
        environment['PGPASSWORD'] = database.get('PASSWORD') or ''
        arguments = ['--host', database.get('HOST') or 'localhost', '--port', str(database.get('PORT') or 5432),
                     '--username', database['USER'], '--no-password']
        dump = directory / 'database.dump'
        subprocess.run([str(pg_bin / 'pg_dump.exe'), *arguments, '--format=custom', '--file', str(dump), database['NAME']],
                       env=environment, check=True, capture_output=True)
        listing = subprocess.run([str(pg_bin / 'pg_restore.exe'), '--list', str(dump)],
                                 check=True, capture_output=True, text=True)
        (directory / 'restore-list.txt').write_text(listing.stdout, encoding='utf-8')
        if 'TABLE DATA' not in listing.stdout or dump.stat().st_size < 1000:
            raise CommandError('Backup verification failed; no records were changed.')
        restore_database = 'cswdo_restore_check_' + uuid4().hex[:12]
        subprocess.run([str(pg_bin / 'createdb.exe'), *arguments, restore_database],
                       env=environment, check=True, capture_output=True)
        try:
            subprocess.run([str(pg_bin / 'pg_restore.exe'), *arguments, '--exit-on-error', '--no-owner',
                            '--dbname', restore_database, str(dump)], env=environment, check=True, capture_output=True)
            proof = subprocess.run([str(pg_bin / 'psql.exe'), *arguments, '--dbname', restore_database,
                '--tuples-only', '--no-align', '--command',
                'SELECT count(*) FROM core_user; SELECT count(*) FROM django_migrations;'],
                env=environment, check=True, capture_output=True, text=True)
            (directory / 'restore-verification.txt').write_text('Restored successfully into an isolated database.\nUser and migration counts:\n' + proof.stdout,
                                                              encoding='utf-8')
        finally:
            subprocess.run([str(pg_bin / 'dropdb.exe'), *arguments, restore_database],
                           env=environment, check=True, capture_output=True)
        with zipfile.ZipFile(directory / 'uploads.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
            for label, root in [('media', Path(settings.MEDIA_ROOT)), ('private_media', settings.BASE_DIR / 'private_media')]:
                if root.exists():
                    for source in root.rglob('*'):
                        if source.is_file():
                            archive.write(source, str(Path(label) / source.relative_to(root)))
        with zipfile.ZipFile(directory / 'uploads.zip') as archive:
            if archive.testzip():
                raise CommandError('Upload backup verification failed.')
        manifest = {source.name: hashlib.sha256(source.read_bytes()).hexdigest()
                    for source in [dump, directory / 'uploads.zip']}
        (directory / 'checksums.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        (directory / 'RESTORE.txt').write_text(
            'Stop application writers before restoring. These backups contain sensitive original data.\n'
            'Restore database.dump into an EMPTY PostgreSQL database using pg_restore --exit-on-error --no-owner '
            '--dbname=<database> database.dump, then point application settings to that database.\n'
            'Extract uploads.zip into the project root to restore media/ and private_media/.\n'
            'Preserve original database role permissions and configuration. checksums.json contains SHA-256 hashes.\n',
            encoding='utf-8')

    def handle(self, *args, **options):
        if options['execute'] and options['rehearse']:
            raise CommandError('Choose --execute OR --rehearse.')
        admin = models.User.objects.get(username=options['admin_username'], role='admin', is_active=True)
        if connection.vendor != 'postgresql':
            raise CommandError('This backup/reset command supports PostgreSQL only.')
        if not (options['execute'] or options['rehearse']):
            self.stdout.write(f'No changes made. Admin to preserve: {admin.username} (id {admin.pk}). Use --rehearse first.')
            return
        directory = settings.BASE_DIR / 'backups' / ('demo_reset_' + timezone.now().strftime('%Y%m%d_%H%M%S_%f'))
        directory.mkdir(parents=True)
        self.backup(directory, Path(options['pg_bin']))
        self.stdout.write(f'Backup verified: {directory}', ending='\n')
        before = models.User.objects.filter(pk=admin.pk).values().get()
        groups = list(admin.groups.values_list('pk', flat=True))
        permissions = list(admin.user_permissions.values_list('pk', flat=True))
        old_uploads = []
        for root in [Path(settings.MEDIA_ROOT), settings.BASE_DIR / 'private_media']:
            if root.exists():
                old_uploads.extend(str(source.resolve()) for source in root.rglob('*') if source.is_file())
        (directory / 'original-upload-paths.json').write_text(json.dumps(old_uploads, indent=2), encoding='utf-8')
        tables = [model._meta.db_table for model in apps.get_app_config('core').get_models()
                  if model != models.User]
        tables += ['django_admin_log', 'django_session']
        quoted = ', '.join(connection.ops.quote_name(table) for table in tables)
        admin_picture = None
        if options['rehearse'] and admin.profile_picture:
            with admin.profile_picture.open('rb') as uploaded:
                admin_picture = uploaded.read()
        with ExitStack() as resources, transaction.atomic():
            if options['rehearse']:
                temporary = resources.enter_context(tempfile.TemporaryDirectory(prefix='cswdo-demo-rehearsal-'))
                resources.enter_context(override_settings(MEDIA_ROOT=temporary))
                for model in apps.get_app_config('core').get_models():
                    for field in model._meta.fields:
                        if isinstance(field, django_models.FileField):
                            resources.enter_context(patch.object(field, 'storage', FileSystemStorage(location=temporary)))
                if admin_picture is not None:
                    FileSystemStorage(location=temporary).save(admin.profile_picture.name, ContentFile(admin_picture))
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL lock_timeout = '15s'")
                cursor.execute(f'TRUNCATE TABLE {quoted} RESTART IDENTITY')
            models.User.objects.exclude(pk=admin.pk).delete()
            seeder = DemoSeeder(stdout=self.stdout, stderr=self.stderr)
            seeder.handle(as_of=options['as_of'], admin_username=admin.username,
                          manifest=str(directory / 'seed-manifest.json'))
            after = models.User.objects.filter(pk=admin.pk).values().get()
            protected = ['username', 'password', 'is_active', 'is_staff', 'is_superuser', 'role', 'email']
            if any(before[field] != after[field] for field in protected):
                raise CommandError('Admin identity or credentials changed; rolling back.')
            if groups != list(admin.groups.values_list('pk', flat=True)) or permissions != list(admin.user_permissions.values_list('pk', flat=True)):
                raise CommandError('Admin permissions changed; rolling back.')
            connection.check_constraints()
            result = seeder.audit()
            call_command('verify_demo_data', output=str(directory / 'api-verification.json'), stdout=self.stdout)
            result.update(admin_preserved=True, backup=str(directory), rehearsed=options['rehearse'])
            (directory / 'verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
            if options['rehearse']:
                transaction.set_rollback(True)
        self.stdout.write(self.style.SUCCESS('Rehearsal rolled back.' if options['rehearse'] else 'Demo reset committed.'))
        if options['execute']:
            referenced = set()
            for model in apps.get_app_config('core').get_models():
                for field in model._meta.fields:
                    if isinstance(field, django_models.FileField):
                        for instance in model.objects.all():
                            uploaded = getattr(instance, field.name)
                            if uploaded:
                                referenced.add(str(Path(uploaded.path).resolve()))
            roots = [Path(settings.MEDIA_ROOT).resolve(), (settings.BASE_DIR / 'private_media').resolve()]
            removed = []
            for filename in old_uploads:
                source = Path(filename).resolve()
                if any(source.is_relative_to(root) for root in roots) and str(source) not in referenced and source.is_file():
                    source.unlink()
                    removed.append(str(source))
            (directory / 'removed-original-uploads.json').write_text(json.dumps(removed, indent=2), encoding='utf-8')
        self.stdout.write(f'Verification: {directory / "verification.json"}')
