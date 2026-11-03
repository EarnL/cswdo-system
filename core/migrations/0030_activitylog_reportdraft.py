from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0029_childassessmentrecord_curriculumplan_staffschedule'),
    ]

    operations = [
        migrations.CreateModel(
            name='ActivityLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('actor_role', models.CharField(blank=True, max_length=20)),
                ('action', models.CharField(max_length=50)),
                ('summary', models.CharField(max_length=255)),
                ('target_type', models.CharField(blank=True, max_length=50)),
                ('target_id', models.PositiveIntegerField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='activity_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ReportDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('report_type', models.CharField(choices=[('form6', 'CDW Profile Report'), ('form7', 'CDC Profile Form'), ('eccd_checklist', 'ECCD Checklist Summary Report'), ('child_profile', 'Child Profile and Enrollment Report'), ('health_nutrition', 'Health and Nutrition Report'), ('activities', 'Activities and Accomplishment Report'), ('parent_community', 'Parent and Community Involvement Report'), ('cdw_accomplishment', 'CDW Accomplishment Report'), ('facility_status', 'Facility and Center Status Report')], default='form6', max_length=20)),
                ('title', models.CharField(blank=True, max_length=255)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('quarter', models.IntegerField(default=1)),
                ('year', models.IntegerField(default=2026)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cdc', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_drafts', to='core.cdc')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_drafts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='reportdraft',
            constraint=models.UniqueConstraint(fields=('user', 'cdc', 'report_type', 'quarter', 'year'), name='unique_report_draft_per_period'),
        ),
    ]
