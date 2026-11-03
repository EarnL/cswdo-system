from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0030_activitylog_reportdraft'),
    ]

    operations = [
        migrations.AddField(
            model_name='report',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'),
                    ('submitted', 'Submitted'),
                    ('under_review', 'Under Review'),
                    ('needs_revision', 'Needs Revision'),
                    ('verified_by_staff', 'Verified by Staff'),
                    ('forwarded_to_admin', 'Forwarded to Admin'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                ],
                default='submitted',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='report',
            name='review_remarks',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='report',
            name='staff_reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='staff_reviewed_reports',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='report',
            name='staff_reviewed_on',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='report',
            name='admin_reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='admin_reviewed_reports',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='report',
            name='admin_reviewed_on',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
