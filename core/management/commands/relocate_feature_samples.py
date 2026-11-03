import json
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from core import models as m
from core.management.commands.seed_large_barangay_samples import Command as MapSeeder
from core.services.report_file_service import ReportFileService


class Command(BaseCommand):
    help = 'Move the fictional workflow barangay records to existing Barangay 7 (Pob.).'

    @transaction.atomic
    def handle(self, *args, **options):
        target = m.Barangay.objects.get(name='Barangay 7 (Pob.)')
        old = m.Barangay.objects.filter(name='Sample Workflow Barangay').first()
        if not old:
            self.stdout.write('Fictional barangay is already removed.')
            return
        geo = json.loads((settings.BASE_DIR / 'frontend/src/data/lucenaBarangays.json').read_text(encoding='utf-8'))
        feature = next(f for f in geo['features'] if f['properties']['brgy_name'] == target.name)
        latitude, longitude = MapSeeder.marker(feature)
        centers = list(m.CDC.objects.filter(barangay=old))
        counts = {}
        for relation in m.Barangay._meta.related_objects:
            model, field = relation.related_model, relation.field.name
            rows = model.objects.filter(**{field: old})
            counts[model.__name__] = rows.count()
            rows.update(**{field: target})
        def rename(value):
            if isinstance(value, str):
                return value.replace(old.name, target.name)
            if isinstance(value, list):
                return [rename(item) for item in value]
            if isinstance(value, dict):
                return {key.replace(old.name, target.name): rename(item) for key, item in value.items()}
            return value
        for snapshot in m.PopulationBasisSnapshot.objects.all():
            if str(old.pk) in snapshot.barangays:
                values = snapshot.barangays.copy()
                if str(target.pk) in values:
                    raise ValueError('Snapshot already contains the destination; manual merge required.')
                values[str(target.pk)] = values.pop(str(old.pk))
                snapshot.barangays = values
                snapshot.save(update_fields=['barangays'])
        for source in m.PopulationDataSubmission.objects.filter(title__startswith='[FEATURE SAMPLE]'):
            source.data_payload = rename(source.data_payload)
            source.barangay_breakdown = rename(source.barangay_breakdown)
            source.save(update_fields=['data_payload', 'barangay_breakdown'])
        for center in centers:
            center.barangay = target
            center.latitude, center.longitude = latitude, longitude
            center.save(update_fields=['barangay', 'latitude', 'longitude'])
            m.CDCAuditLog.objects.create(cdc=center, action='updated',
                summary='Fictional sample barangay replaced with existing Barangay 7 (Pob.).',
                field_changes={'barangay': {'from': old.name, 'to': target.name}})
            for report in m.Report.objects.filter(cdc=center):
                report.payload = rename(report.payload)
                ReportFileService.attach_generated_report_file(report)
                report.save()
        # Refuse deletion if anything is still linked, so no cascade can remove records.
        for relation in m.Barangay._meta.related_objects:
            if relation.related_model.objects.filter(**{relation.field.name: old}).exists():
                raise ValueError('Unmoved barangay relationship found.')
        old.delete()
        self.stdout.write(self.style.SUCCESS(f'Moved to {target.name}; preserved related records: {counts}'))
