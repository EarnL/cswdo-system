"""
Django management command: recalculate_snp_recommendations

Usage:
    python manage.py recalculate_snp_recommendations

This command recalculates all SNP recommendations based on current data.
Useful after data cleanup or when adjusting calculation algorithms.
"""

from django.core.management.base import BaseCommand

from core.services.data_integration_service import DataIntegrationService


class Command(BaseCommand):
    help = 'Recalculate all SNP recommendations based on current data'

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('Recalculating SNP recommendations for all barangays...')
        )

        try:
            count = DataIntegrationService.recalculate_all_recommendations()
            self.stdout.write(self.style.SUCCESS('Recalculation complete.'))
            self.stdout.write(f'  Updated {count} barangays')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Recalculation failed: {str(e)}'))
