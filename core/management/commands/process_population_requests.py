from django.core.management.base import BaseCommand
from core.services.population_request_service import process_schedules, process_reminders


class Command(BaseCommand):
    help = 'Create due recurring population requests and send deduplicated deadline reminders.'

    def handle(self, *args, **options):
        count = process_schedules()
        process_reminders()
        self.stdout.write(self.style.SUCCESS(f'Created {count} requests; reminders updated.'))
