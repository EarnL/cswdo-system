# Generated manually for PopulationDataSubmission model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0013_user_address_user_bio_user_date_of_birth_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='PopulationDataSubmission',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('submitted_on', models.DateTimeField(auto_now_add=True)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('data_file', models.FileField(blank=True, null=True, upload_to='population_data/%Y/%m/')),
                ('data_payload', models.JSONField(blank=True, default=dict)),
                ('status', models.CharField(choices=[('submitted', 'Submitted by CHO'), ('received', 'Received by City Planning'), ('sent_to_cswdo', 'Sent to CSWDO'), ('received_by_cswdo', 'Received by CSWDO')], default='submitted', max_length=20)),
                ('status_updated_on', models.DateTimeField(auto_now=True)),
                ('processed_on', models.DateTimeField(blank=True, null=True)),
                ('sent_to_cswdo_on', models.DateTimeField(blank=True, null=True)),
                ('received_by_cswdo_on', models.DateTimeField(blank=True, null=True)),
                ('total_records', models.IntegerField(default=0)),
                ('data_sources', models.IntegerField(default=0)),
                ('processed_by_planning', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='processed_population_data', to=settings.AUTH_USER_MODEL)),
                ('sent_to_cswdo_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sent_population_data', to=settings.AUTH_USER_MODEL)),
                ('submitted_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='population_submissions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-submitted_on'],
            },
        ),
    ]