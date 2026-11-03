from django.db import migrations, models
import django.db.models.deletion
import core.models.preopening


class Migration(migrations.Migration):
    dependencies = [('core', '0057_child_photo')]

    operations = [
        migrations.CreateModel(
            name='PreOpeningRequirement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('section', models.CharField(max_length=30)),
                ('data', models.JSONField(default=dict)),
                ('evidence', models.FileField(blank=True, storage=core.models.preopening.preopening_storage, upload_to='preopening/%Y/%m/')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cdc', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='preopening_requirements', to='core.cdc')),
            ],
            options={'constraints': [models.UniqueConstraint(fields=('cdc', 'section'), name='unique_preopening_section')]},
        ),
    ]
