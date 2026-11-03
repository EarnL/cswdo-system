from django.db import migrations, models


REPORT_TYPE_CHOICES = [
    ('form6', 'CDW Profile Report'),
    ('form7', 'CDC Profile Form'),
    ('cdc_monthly_report', 'CDC Monthly Report'),
    ('cdc_quarterly_report', 'CDC Quarterly Report'),
    ('cdc_annual_report', 'CDC Annual Report'),
    ('eccd_checklist', 'ECCD Checklist Summary Report'),
    ('child_profile', 'Child Profile and Enrollment Report'),
    ('health_nutrition', 'Health and Nutrition Report'),
    ('activities', 'Activities and Accomplishment Report'),
    ('parent_community', 'Parent and Community Involvement Report'),
    ('cdw_accomplishment', 'CDW Accomplishment Report'),
    ('facility_status', 'Facility and Center Status Report'),
    ('special_needs', 'Special Needs Assessment Summary'),
]


PERIOD_TYPE_CHOICES = [
    ('monthly', 'Monthly'),
    ('quarterly', 'Quarterly'),
    ('annual', 'Annual'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0039_academicyear_child_allergies_and_more'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='reportdraft',
            name='unique_report_draft_per_period',
        ),
        migrations.AddField(
            model_name='report',
            name='month',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='report',
            name='period_type',
            field=models.CharField(choices=PERIOD_TYPE_CHOICES, default='quarterly', max_length=20),
        ),
        migrations.AddField(
            model_name='reportdraft',
            name='month',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='reportdraft',
            name='period_type',
            field=models.CharField(choices=PERIOD_TYPE_CHOICES, default='quarterly', max_length=20),
        ),
        migrations.AlterField(
            model_name='report',
            name='report_type',
            field=models.CharField(choices=REPORT_TYPE_CHOICES, default='form6', max_length=20),
        ),
        migrations.AlterField(
            model_name='reportdraft',
            name='report_type',
            field=models.CharField(choices=REPORT_TYPE_CHOICES, default='form6', max_length=20),
        ),
        migrations.AddConstraint(
            model_name='reportdraft',
            constraint=models.UniqueConstraint(
                fields=('user', 'cdc', 'report_type', 'period_type', 'month', 'quarter', 'year'),
                name='unique_report_draft_per_period',
            ),
        ),
    ]
