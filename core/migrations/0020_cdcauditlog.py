from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_notification'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CDCAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('created', 'Created'), ('updated', 'Updated'), ('accreditation_requested', 'Accreditation Requested'), ('accredited', 'Accredited'), ('rejected', 'Rejected')], max_length=40)),
                ('summary', models.CharField(max_length=255)),
                ('field_changes', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cdc_audit_logs', to=settings.AUTH_USER_MODEL)),
                ('cdc', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_logs', to='core.cdc')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
