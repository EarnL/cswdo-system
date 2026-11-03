"""
Django management command: process_population_submission

Usage:
    python manage.py process_population_submission <submission_id>
    
Example:
    python manage.py process_population_submission 1
    
This command manually triggers the data integration process for a specific
population submission. Useful for testing and re-processing failed submissions.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from core.models import PopulationDataSubmission
from core.services.data_integration_service import DataIntegrationService


class Command(BaseCommand):
    help = 'Process a population submission and trigger data integration'

    def add_arguments(self, parser):
        parser.add_argument(
            'submission_id',
            type=int,
            help='The ID of the population submission to process'
        )

    def handle(self, *args, **options):
        submission_id = options['submission_id']

        try:
            submission = PopulationDataSubmission.objects.get(id=submission_id)
        except PopulationDataSubmission.DoesNotExist:
            raise CommandError(f'Population submission with ID {submission_id} does not exist')

        self.stdout.write(
            self.style.SUCCESS(f'Processing submission: {submission.title}')
        )

        try:
            with transaction.atomic():
                result = DataIntegrationService.process_population_submission(submission_id)

            if result['success']:
                self.stdout.write(
                    self.style.SUCCESS('Integration successful.')
                )
                self.stdout.write(f"  Processed barangays: {result['processed_barangays']}")
                self.stdout.write(f"  Updated metrics: {result['updated_metrics']}")
                self.stdout.write(f"  Generated recommendations: {result['generated_recommendations']}")

                if result['errors']:
                    self.stdout.write(self.style.WARNING(f"  Warnings: {len(result['errors'])}"))
                    for error in result['errors']:
                        self.stdout.write(f"    - {error}")
            else:
                self.stdout.write(
                    self.style.ERROR(f'Integration failed: {result.get("error")}')
                )

        except Exception as e:
            raise CommandError(f'Error processing submission: {str(e)}')

