import uuid
from django.db import migrations, models


def identities(apps, schema_editor):
    Child = apps.get_model('core', 'Child')
    known = {}
    for child in Child.objects.order_by('id').iterator():
        key = (child.barangay_id, child.name.strip().casefold(), child.date_of_birth) if child.date_of_birth else ('unmatched', child.pk)
        child.person_id = known.setdefault(key, uuid.uuid4())
        child.save(update_fields=['person_id'])


class Migration(migrations.Migration):
    dependencies = [('core', '0060_preserve_existing_population_basis')]
    operations = [
        migrations.AddField(model_name='child', name='person_id', field=models.UUIDField(null=True, editable=False, db_index=True)),
        migrations.RunPython(identities, migrations.RunPython.noop),
        migrations.AlterField(model_name='child', name='person_id', field=models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)),
    ]
