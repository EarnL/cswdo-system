import json
from django.core.serializers.json import DjangoJSONEncoder
from django.db import migrations
from django.utils import timezone


def preserve(apps, schema_editor):
    Child = apps.get_model('core', 'Child')
    Member = apps.get_model('core', 'PopulationMembership')
    Submission = apps.get_model('core', 'PopulationDataSubmission')
    Snapshot = apps.get_model('core', 'PopulationBasisSnapshot')
    Basis = apps.get_model('core', 'CDCPopulationBasis')
    History = apps.get_model('core', 'CDCBasisHistory')
    CDC = apps.get_model('core', 'CDC')
    Metrics = apps.get_model('core', 'BarangayPopulationMetrics')
    Year = apps.get_model('core', 'AcademicYear')
    today = timezone.localdate()
    current_year = Year.objects.filter(start_date__lte=today, end_date__gte=today).first() or Year.objects.filter(is_active=True).first()
    Member.objects.bulk_create([Member(child_id=c.pk, submission_id=c.population_source_submission_id)
        for c in Child.objects.exclude(population_source_submission=None).iterator()], ignore_conflicts=True, batch_size=1000)
    for submission in Submission.objects.filter(status='current_basis').exclude(academic_year=None):
        rows = {}
        for metric in Metrics.objects.filter(source_submission=submission):
            entry = {'population': metric.children_3_4 or 0, 'total': metric.total_population}
            for key, name in [('metrics', 'BarangayPopulationMetrics'), ('enrollment', 'EnrollmentData'),
                              ('gap', 'ChildrenGapAnalysis'), ('recommendation', 'SNPPlanningRecommendation')]:
                entry[key] = list(apps.get_model('core', name).objects.filter(barangay_id=metric.barangay_id, academic_year_id=submission.academic_year_id).values())
            rows[str(metric.barangay_id)] = entry
        Snapshot.objects.get_or_create(submission=submission, defaults={'barangays': json.loads(json.dumps(rows, cls=DjangoJSONEncoder))})
        for cdc in CDC.objects.all():
            if current_year and submission.academic_year.start_year > current_year.start_year:
                continue
            Basis.objects.get_or_create(cdc=cdc, academic_year_id=submission.academic_year_id, defaults={'submission': submission})
            History.objects.create(cdc=cdc, submission=submission, summary={'migration': True, 'message': 'Existing working basis retained.'})


class Migration(migrations.Migration):
    dependencies = [('core', '0059_population_basis_adoption')]
    operations = [migrations.RunPython(preserve, migrations.RunPython.noop)]
