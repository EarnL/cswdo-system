# Generated migration for session-based capacity management

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_barangaypopulationmetrics_dataintegrationlog_and_more'),
    ]

    operations = [
        # Add session-based capacity fields to CDC model
        migrations.AddField(
            model_name='cdc',
            name='capacity_per_session',
            field=models.IntegerField(
                default=30,
                help_text='Maximum children per session (e.g., 30 for morning session)'
            ),
        ),
        migrations.AddField(
            model_name='cdc',
            name='sessions_per_day',
            field=models.IntegerField(
                default=1,
                help_text='Number of sessions per day (e.g., 1=morning, 2=morning+midday, 3=morning+midday+afternoon)'
            ),
        ),
        
        # Add session capacity tracking fields to ChildrenGapAnalysis model
        migrations.AddField(
            model_name='childrengapanalysis',
            name='enrolled_children_total',
            field=models.IntegerField(
                default=0,
                help_text='Total enrolled children across all programs'
            ),
        ),
        migrations.AddField(
            model_name='childrengapanalysis',
            name='cdc_capacity_per_session',
            field=models.IntegerField(
                default=30,
                help_text='CDC capacity per single session'
            ),
        ),
        migrations.AddField(
            model_name='childrengapanalysis',
            name='sessions_needed_for_enrolled',
            field=models.IntegerField(
                default=0,
                help_text='Number of sessions needed to accommodate enrolled children (NOT a gap if sessions are available)'
            ),
        ),
        migrations.AddField(
            model_name='childrengapanalysis',
            name='cdc_has_service_gap',
            field=models.BooleanField(
                default=False,
                help_text='True only if enrolled children exceed what available CDC sessions can handle'
            ),
        ),
    ]
