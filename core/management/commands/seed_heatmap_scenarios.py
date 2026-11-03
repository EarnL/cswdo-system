"""Add real sample enrollments across the existing heatmap thresholds."""
import json
import math
from datetime import date
from pathlib import Path

from django.core import serializers
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core import models as m
from core.services.map_basis_service import shared_map_rows
from core.services.data_integration_service import DataIntegrationService as Integration
from core.services.analytics_service import compute_performance_score
from core.services.cdc_annual_report_service import CDCAnnualReportService
from core.services.report_file_service import ReportFileService


class Command(BaseCommand):
    help = 'Add green and amber sample enrollment scenarios without changing population denominators.'

    def add_arguments(self, parser):
        parser.add_argument('--output-dir', default='output/heatmap-samples')

    def handle(self, *args, **options):
        year=m.AcademicYear.get_current()
        worker=m.User.objects.filter(username='sample_cdw').first()
        if not worker:
            raise CommandError('Run seed_sample_data first.')
        output=Path(options['output_dir'])
        output.mkdir(parents=True,exist_ok=True)
        configurations=[('Barangay 3 (Pob.)',0.70,'watch',13.9379,121.6125),
                        ('Barangay 4 (Pob.)',0.40,'elevated',13.9348,121.6120)]
        before={r['barangay']['name']:r for r in shared_map_rows(year)}
        for name,ratio,level,lat,lng in configurations:
            if not before.get(name,{}).get('population',{}).get('children_3_4'):
                raise CommandError(f'{name} needs a validated population basis first.')
        stamp=timezone.now().strftime('%Y%m%d_%H%M%S_%f')
        affected=[before[c[0]]['barangay']['id'] for c in configurations]
        objects=[]
        for model in [m.CDC,m.EnrollmentData,m.ChildrenGapAnalysis,m.SNPPlanningRecommendation]:
            objects.extend(model.objects.filter(barangay_id__in=affected))
        for model in [m.Analytics,m.Performance]:
            objects.extend(model.objects.filter(cdc__barangay_id__in=affected))
        (output/f'before_{stamp}.json').write_text(serializers.serialize('json',objects),encoding='utf-8')
        created_children=0
        created_centers=0
        with transaction.atomic():
            for name,ratio,level,lat,lng in configurations:
                row=before[name]
                barangay=m.Barangay.objects.get(pk=row['barangay']['id'])
                target=math.ceil(row['population']['children_3_4']*ratio)
                missing=max(0,target-row['public_cdc']['enrollment_3_4'])
                prefix=f'HEATMAP-{year.start_year}-{barangay.pk}-'
                existing=m.Child.objects.filter(student_id__startswith=prefix).count()
                for offset in range(missing):
                    number=existing+offset
                    site=number//90+1
                    center,new=m.CDC.objects.get_or_create(
                        name=f'[SAMPLE] {name} Heatmap Annex {site}',
                        defaults={'barangay':barangay,'assigned_cdw':worker,
                            'latitude':lat+(site-1)*0.0002,'longitude':lng+(site-1)*0.0002,
                            'max_capacity':90,'capacity_per_session':30,'sessions_per_day':3,
                            'address':f'Sample annex {site}, {name}, Lucena City',
                            'contact_person':'Liza Mendoza (sample)','contact_number':'00000000000',
                            'email':f'heatmap.{barangay.pk}.{site}@example.test',
                            'operating_days':'Monday to Friday','operating_hours':'07:30 AM - 04:30 PM',
                            'building_type':'barangay','total_area':75,'offers_preschool':True,
                            'has_water_supply':True,'has_sanitation':True,'has_electricity':True,
                            'special_notes':'Fictional heatmap scenario; three sessions of up to 30 children. Approximate location.'})
                    created_centers+=int(new)
                    first=['Amira','Mateo','Sofia','Lucas','Isabel','Gabriel','Maya','Noah'][number%8]
                    last=['Santos','Reyes','Cruz','Ramos','Garcia','Flores','Torres','Mendoza'][(number//8)%8]
                    child=m.Child(student_id=f'{prefix}{number+1:04}',cdc=center,barangay=barangay,
                        academic_year=year,name=f'{first} Sample {last}',first_name=first,middle_name='Sample',
                        last_name=last,sex='female' if number%2==0 else 'male',
                        date_of_birth=date(year.start_year-3-number%2,1,15),current_status='enrolled',
                        enrollment_date=timezone.localdate(),complete_address=f'Sample household {number+1}, {name}',
                        guardian_name=f'Rosa Sample {last}',guardian_relationship='Mother',
                        contact_number='00000000000',health_remarks='Fictional enrollment for heatmap testing; health screening not yet recorded.')
                    child.full_clean()
                    child.save()
                    created_children+=1
                centers=m.CDC.objects.filter(barangay=barangay,name__startswith='[SAMPLE]',name__contains='Heatmap Annex')
                for center in centers:
                    count=m.Child.objects.filter(cdc=center,academic_year=year,current_status='enrolled').count()
                    center.current_enrollment=count
                    center.save(update_fields=['current_enrollment'])
                    compute_performance_score(center)
                Integration._calculate_gap_analysis(barangay,year)
                Integration._generate_snp_recommendation(barangay,year)
                gap=Integration.get_current_gap_analysis(barangay,year)
                m.Analytics.objects.filter(cdc__barangay=barangay).update(
                    coverage_rate=gap.eligible_coverage_rate_3_4,service_gap=gap.public_cdc_gap_children_3_4)
                for center in centers:
                    title=f'[SAMPLE] Heatmap enrollment snapshot - {center.name}'
                    if not m.Report.objects.filter(cdc=center,title=title).exists():
                        report=m.Report.objects.create(cdc=center,academic_year=year,submitted_by=worker,
                            report_type='cdc_annual_report',title=title,period_type='annual',
                            quarter=4,year=year.start_year,status='under_review',is_complete=True,
                            summary='Fictional current enrollment snapshot. Prior reports remain historical snapshots.',
                            payload={**CDCAnnualReportService.build_payload(center,year.start_year,year),'sample':True})
                        ReportFileService.attach_generated_report_file(report)
                        report.save()
                    compute_performance_score(center)
            after={r['barangay']['name']:r for r in shared_map_rows(year)}
            for name,ratio,level,lat,lng in configurations:
                if after[name]['service_signal']['need_level']!=level:
                    raise CommandError(f'{name} did not reach the expected color category.')
                if after[name]['population']['children_3_4']!=before[name]['population']['children_3_4']:
                    raise CommandError('Population denominator changed unexpectedly.')
        result={'created_children':created_children,'created_centers':created_centers,
                'scenarios':[after[c[0]] for c in configurations]}
        (output/f'result_{stamp}.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        self.stdout.write(f'Added {created_children} sample enrollees and {created_centers} sample centers.')
        for name,ratio,level,lat,lng in configurations:
            row=after[name]
            self.stdout.write(f"{name}: {row['public_cdc']['enrollment_3_4']}/{row['population']['children_3_4']} = {row['public_cdc']['coverage_rate_3_4']}% coverage ({level})")
