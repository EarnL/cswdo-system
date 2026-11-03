from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0044_curriculumplan_evidence_attachment'),
    ]

    operations = [
        migrations.AlterField(
            model_name='childhealthrecord',
            name='child',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='health_records', to='core.child'),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='advice_given',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='checkup_type',
            field=models.CharField(choices=[('general', 'General health check-up'), ('dental', 'Dental check-up'), ('vision', 'Eye / Vision check-up'), ('hearing', 'Hearing check-up'), ('nutrition', 'Nutrition check-up'), ('other', 'Other')], default='general', max_length=20),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='conducted_by',
            field=models.CharField(choices=[('barangay_health_worker', 'Barangay Health Worker'), ('nurse', 'Nurse'), ('midwife', 'Midwife'), ('doctor', 'Doctor'), ('dentist', 'Dentist'), ('nutrition_worker', 'Nutrition Worker'), ('cho_rhu_personnel', 'CHO / RHU Personnel'), ('other', 'Other')], default='barangay_health_worker', max_length=40),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='conducted_by_name',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='follow_up_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='follow_up_instruction',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='follow_up_needed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='health_findings',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='medicine_given',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='needs_referral',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='referral_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='referred_to',
            field=models.CharField(blank=True, choices=[('', 'Not referred'), ('barangay_health_center', 'Barangay Health Center'), ('rural_health_unit', 'Rural Health Unit'), ('cho', 'CHO'), ('doctor', 'Doctor'), ('dentist', 'Dentist'), ('nutrition_worker', 'Nutrition Worker'), ('specialist', 'Specialist'), ('other', 'Other')], max_length=40),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='review_remarks',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='status',
            field=models.CharField(choices=[('draft', 'Draft'), ('submitted', 'Submitted'), ('under_review', 'Under Review'), ('verified', 'Verified'), ('returned', 'Returned for Revision')], default='submitted', max_length=20),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='symptoms_observed',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='verified_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verified_child_health_records', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='childhealthrecord',
            name='verified_on',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
