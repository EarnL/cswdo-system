from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import AcademicYear, BarangayPopulationMetrics, Child, PopulationDataSubmission
from core.services.data_integration_service import DataIntegrationService as Integration


class Command(BaseCommand):
    help = 'Rebuild ages 3-4 daycare metrics from original population rows, preserving child records and uploads.'

    @transaction.atomic
    def handle(self, *args, **options):
        changed = 0
        for child in Child.objects.filter(current_status='enrolled').select_related('academic_year'):
            if not child.is_daycare_eligible():
                age = child.age_for_academic_year()
                Child.objects.filter(pk=child.pk).update(
                    age=age, current_status='aged_out' if age >= 5 else 'not_enrolled'
                )
                changed += 1
        Integration._refresh_cdc_enrollment_counts(AcademicYear.get_current())
        rebuilt = 0
        for source in PopulationDataSubmission.objects.filter(status='current_basis').select_related('academic_year'):
            if not source.academic_year:
                continue
            records = Integration._parse_submission_data(source)
            grouped = Integration._aggregate_by_barangay(records, source.academic_year)
            for metric in BarangayPopulationMetrics.objects.filter(source_submission=source).select_related('barangay'):
                data = grouped.get(metric.barangay.name)
                if data is None:
                    # No guessing from the old wider cohort.
                    metric.children_3_4 = None
                    metric.save(update_fields=['children_3_4'])
                    self.stdout.write(self.style.WARNING(f'{metric.barangay.name}: no source ages; basis remains unavailable.'))
                    continue
                Integration._update_barangay_metrics(metric.barangay, data, source, source.academic_year)
                Integration._update_enrollment_from_child_records(metric.barangay, source.academic_year)
                gap = Integration._calculate_gap_analysis(metric.barangay, source.academic_year)
                if gap is None:
                    raise ValueError(f'Could not rebuild gap for {metric.barangay.name}')
                Integration._generate_snp_recommendation(metric.barangay, source.academic_year)
                rebuilt += 1
        Integration._refresh_cdc_enrollment_counts(AcademicYear.get_current())
        self.stdout.write(self.style.SUCCESS(
            f'Rebuilt {rebuilt} barangay bases; reclassified {changed} ineligible enrollments. No child records or source files deleted.'
        ))
