from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_cdcauditlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='childrengapanalysis',
            name='population_children_2_4',
            field=models.IntegerField(default=0, help_text='Reference population of children aged 2-4 in the barangay'),
        ),
        migrations.AddField(
            model_name='childrengapanalysis',
            name='public_cdc_enrollment_children_2_4',
            field=models.IntegerField(default=0, help_text='Total children currently enrolled in public CDCs in the barangay'),
        ),
        migrations.AddField(
            model_name='childrengapanalysis',
            name='public_cdc_gap_children_2_4',
            field=models.IntegerField(default=0, help_text='Population 2-4 minus public CDC enrollment; this is the public CDC service gap basis for SNP'),
        ),
    ]
