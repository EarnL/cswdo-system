from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('core', '0056_alter_barangaypopulationmetrics_children_3_5_and_more')]
    operations = [
        migrations.AddField(
            model_name='child',
            name='photo',
            field=models.ImageField(blank=True, null=True, upload_to='children/photos/%Y/%m/'),
        ),
    ]
