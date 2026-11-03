from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0043_alter_cdc_current_enrollment'),
    ]

    operations = [
        migrations.AddField(
            model_name='curriculumplan',
            name='evidence_attachment',
            field=models.FileField(blank=True, null=True, upload_to='curriculum_implementation/%Y/%m/'),
        ),
    ]
