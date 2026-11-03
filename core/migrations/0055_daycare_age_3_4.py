from django.db import migrations, models


def invalidate_old_cohort(apps, schema_editor):
    # A 2-5 aggregate cannot be converted to 3-4 without the original ages.
    # Keep source submissions and child records; rebuild derived metrics separately.
    apps.get_model('core', 'Barangay').objects.update(population_children_3_4=0)
    apps.get_model('core', 'ChildrenGapAnalysis').objects.update(
        population_children_3_4=0, public_cdc_enrollment_children_3_4=0,
        public_cdc_gap_children_3_4=0, gap_3_4=0,
    )
    apps.get_model('core', 'EnrollmentData').objects.update(enrolled_3_4=0)


class Migration(migrations.Migration):
    dependencies = [('core', '0054_alter_populationdatarequest_assigned_to_and_more')]
    operations = [
        migrations.RenameField('barangay', 'population_children_2_4', 'population_children_3_4'),
        migrations.RenameField('enrollmentdata', 'enrolled_3_5', 'enrolled_3_4'),
        migrations.RenameField('childrengapanalysis', 'gap_3_5', 'gap_3_4'),
        migrations.RenameField('childrengapanalysis', 'population_children_2_4', 'population_children_3_4'),
        migrations.RenameField('childrengapanalysis', 'public_cdc_enrollment_children_2_4', 'public_cdc_enrollment_children_3_4'),
        migrations.RenameField('childrengapanalysis', 'public_cdc_gap_children_2_4', 'public_cdc_gap_children_3_4'),
        migrations.AddField(
            'barangaypopulationmetrics', 'children_3_4',
            models.IntegerField(null=True, blank=True, help_text='Validated daycare population ages 3-4; null until rebuilt from source records'),
        ),
        migrations.RunPython(invalidate_old_cohort, migrations.RunPython.noop),
    ]
