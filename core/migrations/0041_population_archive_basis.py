from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0040_report_period_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='populationdatasubmission',
            name='status',
            field=models.CharField(
                choices=[
                    ('submitted', 'Submitted by CHO'),
                    ('received', 'Received by City Planning'),
                    ('sent_to_cswdo', 'Sent to CSWDO'),
                    ('received_by_cswdo', 'Received by CSWDO'),
                    ('current_basis', 'Current Population Basis'),
                    ('archived', 'Archived / Outdated'),
                ],
                default='submitted',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='child',
            name='population_source_submission',
            field=models.ForeignKey(
                blank=True,
                help_text='CHO population submission that created or refreshed this child record.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='synced_children',
                to='core.populationdatasubmission',
            ),
        ),
    ]
