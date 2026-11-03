"""
Data Integration Service
Orchestrates the connection between population data, enrollment data, and SNP planning.
Ensures that all departments work with synchronized, up-to-date data.
"""

import logging
import csv
from datetime import datetime
import math
import re
from core.daycare_policy import is_daycare_age
from django.db import transaction
from django.utils import timezone

from core.models import (
    AcademicYear,
    PopulationDataSubmission,
    Barangay,
    BarangayPopulationMetrics,
    EnrollmentData,
    ChildrenGapAnalysis,
    SNPPlanningRecommendation,
    DataIntegrationLog,
    CDC,
    Child,
    HealthNutrition,
    Report,
    PopulationMembership,
    PopulationDataHistory,
)

logger = logging.getLogger(__name__)


class DataIntegrationService:
    """
    Orchestrates data integration across the entire system.
    Ensures population data flows to all dependent systems automatically.
    """
    
    SESSIONS_PER_YEAR = 52 * 2  # 2 sessions per week, 52 weeks per year
    BARANGAY_ALIASES = {
        # Some CHO files use older/local area names. Normalize them to the
        # barangay names used by the system map and planning records.
        'wakas': 'domoit',
    }

    @staticmethod
    def get_current_population_metrics(barangay: Barangay, academic_year: AcademicYear = None):
        """Return the active population metrics for the approved current basis only."""
        academic_year = academic_year or AcademicYear.get_current()
        return (
            BarangayPopulationMetrics.objects.select_related('source_submission', 'academic_year', 'barangay')
            .filter(
                barangay=barangay,
                academic_year=academic_year,
                source_submission__status='current_basis',
                children_3_4__isnull=False,
            )
            .order_by('-last_updated', '-id')
            .first()
        )

    @staticmethod
    def get_current_gap_analysis(barangay: Barangay, academic_year: AcademicYear = None):
        """Return gap analysis tied to the approved current population basis only."""
        academic_year = academic_year or AcademicYear.get_current()
        return (
            ChildrenGapAnalysis.objects.select_related('population_metrics', 'population_metrics__source_submission', 'academic_year')
            .filter(
                barangay=barangay,
                academic_year=academic_year,
                population_metrics__source_submission__status='current_basis',
                population_metrics__children_3_4__isnull=False,
            )
            .order_by('-last_calculated', '-id')
            .first()
        )
    
    @staticmethod
    @transaction.atomic
    def process_population_submission(submission_id: int) -> dict:
        """
        Main entry point: Process a population submission and cascade updates
        through the entire system.
        
        This ensures that when CHO data reaches CSWDO, all connected systems
        are automatically updated with the latest information.
        """
        try:
            submission = PopulationDataSubmission.objects.get(id=submission_id)
            if submission.status not in ['received_by_cswdo', 'current_basis', 'archived']:
                return {'success': False, 'error': 'CSWDO must accept the validated submission before it can be applied.'}
            academic_year = submission.academic_year or AcademicYear.get_current()
            # Serialize publication within the year to prevent two concurrent bases.
            AcademicYear.objects.select_for_update().get(pk=academic_year.pk)
            if not submission.academic_year_id:
                submission.academic_year = academic_year
                submission.save(update_fields=['academic_year'])
            results = {
                'success': True,
                'processed_barangays': 0,
                'updated_metrics': 0,
                'children_synced': 0,
                'generated_recommendations': 0,
                'errors': []
            }
            
            # Step 1: Parse population data
            parsed_data = DataIntegrationService._parse_submission_data(submission)
            if not parsed_data:
                logger.error(f"Failed to parse submission {submission_id}")
                return {'success': False, 'error': 'Could not parse submission data'}

            # Step 2: Promote this approved submission before rebuilding derived records.
            from core.services.population_basis_service import capture_basis, notify_available
            for previous in PopulationDataSubmission.objects.filter(academic_year=academic_year, status='current_basis').exclude(pk=submission.pk):
                capture_basis(previous)
                approval = submission.history.filter(action='accepted_by_cswdo').first()
                PopulationDataHistory.objects.create(submission=previous, action='marked_outdated', status='archived',
                    message='Replaced as the city basis. CDCs retain their selected version until they apply an update.',
                    acted_by_id=approval.acted_by_id if approval else None, current_location='History')
            # All active consumers intentionally read only metrics whose source is current_basis.
            PopulationDataSubmission.objects.filter(
                academic_year=academic_year,
                status='current_basis',
            ).exclude(id=submission.id).update(status='archived')
            if submission.status != 'current_basis':
                submission.status = 'current_basis'
                submission.save(update_fields=['status', 'status_updated_on'])
            
            # Step 3: Aggregate data by barangay
            barangay_data = DataIntegrationService._aggregate_by_barangay(parsed_data, academic_year)
            if not barangay_data:
                raise ValueError('The submission contains no usable barangay population records.')

            # Step 4: Replace the planning basis for this academic year.
            # Old uploads remain as historical submissions, but derived planning data
            # must reflect the latest accepted CHO file only.
            DataIntegrationService._reset_academic_year_population_basis(academic_year)

            # Step 5: Sync child-level names for assessment workflows.
            results['children_synced'] = DataIntegrationService._sync_children_from_population_records(
                parsed_data,
                academic_year,
                submission,
            )
            
            # Step 6: Update metrics for each barangay
            for barangay_name, data in barangay_data.items():
                try:
                    barangay = DataIntegrationService._find_barangay_by_name(barangay_name)
                    if not barangay:
                        raise Barangay.DoesNotExist
                    DataIntegrationService._update_barangay_metrics(barangay, data, submission, academic_year)
                    results['processed_barangays'] += 1
                    results['updated_metrics'] += 1
                except Barangay.DoesNotExist:
                    logger.warning(f"Barangay '{barangay_name}' not found in database")
                    results['errors'].append(f"Barangay '{barangay_name}' not found")
                except Exception as e:
                    logger.error(f"Error updating metrics for {barangay_name}: {str(e)}")
                    results['errors'].append(f"Error updating {barangay_name}: {str(e)}")
            
            # Step 7: Calculate enrollment gaps and generate SNP recommendations
            for barangay in Barangay.objects.all():
                try:
                    DataIntegrationService._update_enrollment_from_child_records(barangay, academic_year)
                    DataIntegrationService._calculate_gap_analysis(barangay, academic_year)
                    DataIntegrationService._generate_snp_recommendation(barangay, academic_year)
                    results['generated_recommendations'] += 1
                except Exception as e:
                    logger.error(f"Error generating SNP recommendation for {barangay.name}: {str(e)}")
                    results['errors'].append(f"SNP recommendation failed for {barangay.name}")
            
            if results['errors']:
                raise ValueError('; '.join(results['errors']))

            # Step 8: Log the integration
            capture_basis(submission)
            notify_available(submission)
            DataIntegrationService._log_integration(
                submission=submission,
                barangays_processed=results['processed_barangays'],
                status='success' if not results['errors'] else 'partial'
            )
            
            return results
            
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"Error in process_population_submission: {str(e)}")
            return {'success': False, 'error': str(e)}

    @staticmethod
    def _reset_academic_year_population_basis(academic_year: AcademicYear):
        """
        Clear population-derived planning records for an academic year before
        rebuilding them from the latest accepted CHO submission.
        """
        # Only rebuild cached planning summaries. Child identities and all their
        # related records survive every publication and academic-year transition.
        SNPPlanningRecommendation.objects.filter(academic_year=academic_year).delete()
        ChildrenGapAnalysis.objects.filter(academic_year=academic_year).delete()
        EnrollmentData.objects.filter(academic_year=academic_year).delete()
        BarangayPopulationMetrics.objects.filter(academic_year=academic_year).delete()

        if academic_year.pk == AcademicYear.get_current().pk:
            Barangay.objects.update(population_children_3_4=0)
        DataIntegrationService._refresh_cdc_enrollment_counts(academic_year)
        logger.info(f"Reset population planning basis for {academic_year.name}")

    @staticmethod
    def _eligible_age(age) -> bool:
        return is_daycare_age(age)

    @staticmethod
    def _refresh_cdc_enrollment_counts(academic_year: AcademicYear):
        """Align each CDC enrollment counter with enrolled child records for one academic year."""
        for cdc in CDC.objects.all():
            from core.services.population_basis_service import working_year
            if working_year(cdc).pk != academic_year.pk:
                continue
            active_count = sum(child.is_daycare_eligible(academic_year) for child in Child.objects.filter(
                cdc=cdc,
                academic_year=academic_year,
                current_status='enrolled',
            ))
            if cdc.current_enrollment != active_count:
                cdc.current_enrollment = active_count
                cdc.save(update_fields=['current_enrollment'])
    
    @staticmethod
    def _parse_submission_data(submission: PopulationDataSubmission) -> list:
        """
        Parse population data from submission (CSV file or JSON payload).
        Returns list of records with standardized fields.
        """
        try:
            records = []
            
            # Try to load from data_payload first (JSON)
            if submission.data_payload:
                payload = submission.data_payload
                if isinstance(payload, dict):
                    # Could be {'rows': [...]} or {'data': [...]} format
                    for key in ['rows', 'records', 'data', 'items']:
                        if key in payload and isinstance(payload[key], list):
                            records = payload[key]
                            break
                elif isinstance(payload, list):
                    records = payload
            
            # If still no records and file exists, try to parse CSV
            if not records and submission.data_file:
                try:
                    import pandas as pd
                    df = pd.read_csv(submission.data_file.path)
                    records = df.to_dict('records')
                except Exception as e:
                    logger.warning(f"Could not parse population file with pandas: {e}")
                    records = DataIntegrationService._parse_csv_without_pandas(submission)
            
            return records
            
        except Exception as e:
            logger.error(f"Error parsing submission data: {e}")
            return []

    @staticmethod
    def _parse_csv_without_pandas(submission: PopulationDataSubmission) -> list:
        """Parse CSV population files without requiring pandas."""
        if not submission.data_file:
            return []

        file_name = str(getattr(submission.data_file, 'name', '')).lower()
        if not file_name.endswith('.csv'):
            logger.warning('Population file is not CSV and pandas is unavailable for Excel parsing.')
            return []

        try:
            with submission.data_file.open('rb') as file_obj:
                raw = file_obj.read()
            text = raw.decode('utf-8-sig')
            return list(csv.DictReader(text.splitlines()))
        except Exception as exc:
            logger.error(f"Could not parse CSV population file without pandas: {exc}")
            return []
    
    @staticmethod
    def _normalize_name(value: str) -> str:
        text = str(value or '').strip().lower()
        text = re.sub(r'[^a-z0-9]+', ' ', text)
        text = re.sub(r'\b(brgy|barangay|pob|poblacion)\b', '', text)
        return re.sub(r'\s+', ' ', text).strip()

    @staticmethod
    def _find_barangay_by_name(name: str):
        normalized_target = DataIntegrationService._normalize_name(name)
        if not normalized_target:
            return None
        normalized_target = DataIntegrationService.BARANGAY_ALIASES.get(normalized_target, normalized_target)

        for barangay in Barangay.objects.all():
            if DataIntegrationService._normalize_name(barangay.name) == normalized_target:
                return barangay
        return None

    @staticmethod
    def _aggregate_by_barangay(records: list, academic_year=None) -> dict:
        """
        Group population records by barangay and calculate statistics.
        Returns dict: {barangay_name: {age_groups, demographics, ...}}
        """
        barangay_data = {}
        
        for record in records:
            # Extract key fields (handle various naming conventions)
            raw_barangay = DataIntegrationService._extract_field(record, 'barangay')
            age = DataIntegrationService._extract_field(record, 'age')
            dob = DataIntegrationService._parse_date(DataIntegrationService._extract_field(record, 'date_of_birth'))
            if dob and academic_year:
                age = Child(date_of_birth=dob).age_for_academic_year(academic_year)
            gender = DataIntegrationService._extract_field(record, 'gender')
            enrolled = DataIntegrationService._extract_field(record, 'enrolled')
            single_parent = DataIntegrationService._extract_field(record, 'single_parent')
            disability = DataIntegrationService._extract_field(record, 'disability')
            working = DataIntegrationService._extract_field(record, 'working')
            
            barangay_obj = DataIntegrationService._find_barangay_by_name(raw_barangay)
            barangay = barangay_obj.name if barangay_obj else str(raw_barangay or '').strip()

            if not barangay or age in [None, '']:
                continue
            try:
                age_int = int(float(age))
            except (TypeError, ValueError, OverflowError):
                continue
            if age_int < 0:
                continue
            
            if barangay not in barangay_data:
                barangay_data[barangay] = {
                    'total': 0,
                    'children_3_4': 0,
                    'age_groups': {
                        '0-2': 0, '3-5': 0, '6-12': 0, '13-17': 0, '18-64': 0, '65+': 0
                    },
                    'gender': {'male': 0, 'female': 0},
                    'single_parent_households': 0,
                    'children_with_disabilities': 0,
                    'working_children': 0,
                    'enrolled': 0,
                    'not_enrolled': 0,
                }
            
            # Count total
            barangay_data[barangay]['total'] += 1
            
            # Count by age group
            try:
                if age_int <= 2:
                    barangay_data[barangay]['age_groups']['0-2'] += 1
                elif age_int <= 5:
                    barangay_data[barangay]['age_groups']['3-5'] += 1
                elif age_int <= 12:
                    barangay_data[barangay]['age_groups']['6-12'] += 1
                elif age_int <= 17:
                    barangay_data[barangay]['age_groups']['13-17'] += 1
                elif age_int <= 64:
                    barangay_data[barangay]['age_groups']['18-64'] += 1
                else:
                    barangay_data[barangay]['age_groups']['65+'] += 1

                if is_daycare_age(age_int):
                    barangay_data[barangay]['children_3_4'] += 1
            except (ValueError, TypeError):
                pass
            
            # Count gender
            if gender and gender.lower() in ['m', 'male', 'boy']:
                barangay_data[barangay]['gender']['male'] += 1
            elif gender and gender.lower() in ['f', 'female', 'girl']:
                barangay_data[barangay]['gender']['female'] += 1
            
            # Count special demographics
            if single_parent and DataIntegrationService._to_bool(single_parent):
                barangay_data[barangay]['single_parent_households'] += 1
            
            if disability and DataIntegrationService._to_bool(disability):
                barangay_data[barangay]['children_with_disabilities'] += 1
            
            if working and DataIntegrationService._to_bool(working):
                barangay_data[barangay]['working_children'] += 1
            
            # Count enrollment
            if enrolled and DataIntegrationService._to_bool(enrolled):
                barangay_data[barangay]['enrolled'] += 1
            else:
                barangay_data[barangay]['not_enrolled'] += 1
        
        return barangay_data
    
    @staticmethod
    def _extract_field(record: dict, field_name: str):
        """Extract a field value from record, handling various naming conventions."""
        # Define common aliases for each field
        aliases = {
            'barangay': ['barangay', 'brgy', 'barangay_name', 'village', 'sitio'],
            'name': ['name', 'full_name', 'child_full_name', 'child_name', 'resident_name', 'student_name'],
            'first_name': ['first_name', 'given_name'],
            'middle_name': ['middle_name'],
            'last_name': ['last_name', 'surname', 'family_name'],
            'date_of_birth': ['date_of_birth', 'birth_date', 'birthday', 'dob'],
            'address': ['address', 'complete_address', 'home_address'],
            'guardian_name': ['guardian_name', 'parent_guardian', 'guardian', 'parent_name'],
            'contact_number': ['contact_number', 'contact_no', 'phone', 'mobile_number'],
            'mother_name': ['mother_name', 'mother', 'mothers_name'],
            'father_name': ['father_name', 'father', 'fathers_name'],
            'age': ['age', 'edad', 'years_old', 'age_years'],
            'gender': ['gender', 'sex', 'genero'],
            'enrolled': ['enrolled', 'in_school', 'school_enrolled', 'is_enrolled'],
            'single_parent': ['single_parent', 'solo_parent', 'single_parent_household'],
            'disability': ['disability', 'pwd', 'has_disability', 'special_needs'],
            'working': ['working', 'employed_child', 'child_labor', 'is_working'],
        }
        
        possible_keys = aliases.get(field_name, [field_name])
        
        for key in possible_keys:
            # Try exact match
            if key in record:
                return record[key]
            # Try case-insensitive match
            for record_key in record.keys():
                if record_key.lower() == key.lower():
                    return record[record_key]
        
        return None
    
    @staticmethod
    def _to_bool(value):
        """Convert various boolean representations to bool."""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ['true', '1', 'yes', 'y', 'on', 'active']
        if isinstance(value, int):
            return value != 0
        return bool(value)

    @staticmethod
    def _parse_date(value):
        if not value:
            return None
        if hasattr(value, 'date'):
            return value.date()
        text = str(value).strip()
        for pattern in ('%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%m-%d-%Y', '%d-%m-%Y'):
            try:
                return datetime.strptime(text, pattern).date()
            except ValueError:
                continue
        return None

    @staticmethod
    def _split_name(full_name: str):
        parts = str(full_name or '').strip().split()
        if not parts:
            return '', '', ''
        if len(parts) == 1:
            return parts[0], '', ''
        if len(parts) == 2:
            return parts[0], '', parts[1]
        return parts[0], ' '.join(parts[1:-1]), parts[-1]

    @staticmethod
    def _sync_children_from_population_records(records: list, academic_year: AcademicYear, submission: PopulationDataSubmission) -> int:
        prepared = []
        barangay_ids = set()
        for record in records:
            raw_name = DataIntegrationService._extract_field(record, 'name')
            first_name = DataIntegrationService._extract_field(record, 'first_name') or ''
            middle_name = DataIntegrationService._extract_field(record, 'middle_name') or ''
            last_name = DataIntegrationService._extract_field(record, 'last_name') or ''
            full_name = str(raw_name or ' '.join(part for part in [first_name, middle_name, last_name] if part)).strip()
            if not full_name:
                continue

            raw_age = DataIntegrationService._extract_field(record, 'age')
            date_of_birth = DataIntegrationService._parse_date(DataIntegrationService._extract_field(record, 'date_of_birth'))
            try:
                age = int(float(raw_age)) if raw_age not in [None, ''] else None
            except (TypeError, ValueError):
                age = None
            if date_of_birth:
                reference_date = academic_year.start_date
                age = reference_date.year - date_of_birth.year
                if (reference_date.month, reference_date.day) < (date_of_birth.month, date_of_birth.day):
                    age -= 1
            if age is None or age < 0 or age > 17:
                continue

            raw_barangay = DataIntegrationService._extract_field(record, 'barangay')
            barangay = DataIntegrationService._find_barangay_by_name(raw_barangay)
            if not barangay:
                continue

            if not (first_name or middle_name or last_name):
                first_name, middle_name, last_name = DataIntegrationService._split_name(full_name)

            raw_gender = str(DataIntegrationService._extract_field(record, 'gender') or '').strip().lower()
            sex = 'male' if raw_gender in ['m', 'male', 'boy'] else 'female' if raw_gender in ['f', 'female', 'girl'] else 'unspecified'

            prepared.append({
                'barangay': barangay,
                'full_name': full_name,
                'first_name': str(first_name or '').strip(),
                'middle_name': str(middle_name or '').strip(),
                'last_name': str(last_name or '').strip(),
                'sex': sex,
                'age': age,
                'date_of_birth': date_of_birth,
                'complete_address': DataIntegrationService._extract_field(record, 'address') or '',
                'guardian_name': DataIntegrationService._extract_field(record, 'guardian_name') or '',
                'contact_number': DataIntegrationService._extract_field(record, 'contact_number') or '',
                'mother_name': DataIntegrationService._extract_field(record, 'mother_name') or '',
                'father_name': DataIntegrationService._extract_field(record, 'father_name') or '',
            })
            barangay_ids.add(barangay.id)

        existing_by_key = {}
        previous_people = {}
        if barangay_ids:
            for child in Child.objects.filter(academic_year=academic_year, barangay_id__in=barangay_ids).order_by('id'):
                key = (child.barangay_id, DataIntegrationService._normalize_name(child.name), child.date_of_birth)
                existing_by_key.setdefault(key, child)
            for bid, name, dob, person_id in Child.objects.filter(barangay_id__in=barangay_ids,
                    date_of_birth__isnull=False).exclude(academic_year=academic_year).order_by('id').values_list(
                    'barangay_id', 'name', 'date_of_birth', 'person_id'):
                previous_people.setdefault((bid, DataIntegrationService._normalize_name(name), dob), person_id)

        now = timezone.now()
        to_create = []
        members = []
        synced = 0
        for item in prepared:
            barangay = item['barangay']
            full_name = item['full_name']
            key = (barangay.id, DataIntegrationService._normalize_name(full_name), item['date_of_birth'])
            child = existing_by_key.get(key)
            if not child:
                child = Child(academic_year=academic_year, barangay=barangay, name=full_name)
                if key in previous_people:
                    child.person_id = previous_people[key]
                to_create.append(child)
                existing_by_key[key] = child
            elif child.pk:
                # Existing profiles are CDW-owned. Link the new version without
                # overwriting identity, contact details, enrollment or care data.
                members.append(child)
                synced += 1
                continue

            members.append(child)

            child.first_name = item['first_name']
            child.middle_name = item['middle_name']
            child.last_name = item['last_name']
            child.name = full_name
            child.sex = item['sex']
            child.age = item['age']
            child.date_of_birth = item['date_of_birth']
            child.complete_address = item['complete_address'] or child.complete_address
            child.guardian_name = item['guardian_name'] or child.guardian_name
            child.contact_number = item['contact_number'] or child.contact_number
            child.mother_name = item['mother_name'] or child.mother_name
            child.father_name = item['father_name'] or child.father_name
            if not child.cdc_id:
                child.current_status = 'aged_out' if child.age >= 5 else 'not_enrolled'
            child.population_source_submission = submission
            child.updated_at = now
            synced += 1

        if to_create:
            Child.objects.bulk_create(to_create, batch_size=1000)
            student_id_updates = []
            year = academic_year.start_year if academic_year else timezone.localdate().year
            for child in to_create:
                if child.pk and not child.student_id:
                    child.student_id = f"CSWDO-{year}-{child.pk:06d}"
                    student_id_updates.append(child)
            if student_id_updates:
                Child.objects.bulk_update(student_id_updates, ['student_id'], batch_size=1000)

        PopulationMembership.objects.bulk_create(
            [PopulationMembership(submission=submission, child_id=child.pk) for child in members],
            ignore_conflicts=True, batch_size=1000,
        )

        logger.info(f"Synced {synced} child records for {academic_year.name}")
        return synced
    
    @staticmethod
    def _update_barangay_metrics(barangay: Barangay, data: dict, submission: PopulationDataSubmission, academic_year: AcademicYear):
        """
        Update population metrics for a barangay.
        Creates or updates BarangayPopulationMetrics record.
        """
        metrics, created = BarangayPopulationMetrics.objects.update_or_create(
            barangay=barangay,
            academic_year=academic_year,
            defaults={
                'source_submission': submission,
                'total_population': data['total'],
                'children_0_2': data['age_groups']['0-2'],
                'children_3_5': data['age_groups']['3-5'],
                'children_3_4': data['children_3_4'],
                'children_6_12': data['age_groups']['6-12'],
                'adolescents_13_17': data['age_groups']['13-17'],
                'adults_18_64': data['age_groups']['18-64'],
                'elderly_65_plus': data['age_groups']['65+'],
                'male_population': data['gender']['male'],
                'female_population': data['gender']['female'],
                'single_parent_households': data['single_parent_households'],
                'children_with_disabilities': data['children_with_disabilities'],
                'working_children': data['working_children'],
                'data_quality_score': 85.0,  # TODO: Calculate based on completeness
            }
        )

        # Keep the barangay-level daycare reference population aligned for SNP planning.
        if academic_year.pk == AcademicYear.get_current().pk:
            barangay.population_children_3_4 = data.get('children_3_4', 0)
            barangay.save(update_fields=['population_children_3_4'])
        
        logger.info(f"{'Created' if created else 'Updated'} population metrics for {barangay.name}")
        return metrics

    @staticmethod
    def _update_enrollment_from_child_records(barangay: Barangay, academic_year: AcademicYear = None):
        """
        Keep barangay enrollment metrics aligned with CDW student profiles.
        CHO population rows are not counted as enrolled until matched to a CDC.
        """
        academic_year = academic_year or AcademicYear.get_current()
        enrolled_children = Child.objects.filter(
            barangay=barangay,
            academic_year=academic_year,
            cdc__isnull=False,
            current_status='enrolled',
        )

        buckets = {
            'enrolled_0_2': 0,
            'enrolled_3_4': 0,
            'enrolled_6_12': 0,
        }

        for child in enrolled_children:
            age = child.age_for_academic_year(academic_year)
            if is_daycare_age(age):
                buckets['enrolled_3_4'] += 1
            elif 6 <= age <= 12:
                buckets['enrolled_6_12'] += 1

        early_childhood_total = buckets['enrolled_3_4']
        enrollment, _ = EnrollmentData.objects.update_or_create(
            barangay=barangay,
            academic_year=academic_year,
            defaults={
                **buckets,
                'daycare_enrollment': buckets['enrolled_3_4'],
                'preschool_enrollment': buckets['enrolled_3_4'],
                'school_enrollment': buckets['enrolled_6_12'],
                'feeding_program_enrollment': early_childhood_total,
                'health_checkup_enrollment': early_childhood_total,
                'nutrition_program_enrollment': early_childhood_total,
            },
        )
        return enrollment
    
    @staticmethod
    def _calculate_gap_analysis(barangay: Barangay, academic_year: AcademicYear = None):
        """
        Calculate enrollment gaps by comparing population data with enrollment data.
        This identifies how many children are not enrolled in each age group/program.
        
        KEY: Enrollment exceeding CDC capacity is NOT a gap if managed via multiple sessions.
        Only flagged as a service gap if sessions needed exceed available sessions per day.
        """
        try:
            academic_year = academic_year or AcademicYear.get_current()
            enrollment = DataIntegrationService._update_enrollment_from_child_records(barangay, academic_year)
            
            population = DataIntegrationService.get_current_population_metrics(barangay, academic_year)
            if not population:
                logger.warning(f"No current-basis population metrics for {barangay.name} ({academic_year.name})")
                return None
            
            # Calculate gaps (unenrolled children = population - enrolled)
            gap_0_2 = 0
            gap_6_12 = max(0, population.children_6_12 - enrollment.enrolled_6_12)

            population_children_3_4 = max(population.children_3_4, 0)
            public_cdc_enrollment = sum(
                1
                for child in Child.objects.filter(
                    barangay=barangay,
                    academic_year=academic_year,
                    cdc__isnull=False,
                    current_status='enrolled',
                )
                if DataIntegrationService._eligible_age(child.age_for_academic_year(academic_year))
            )
            public_cdc_gap_children_3_4 = max(0, population_children_3_4 - public_cdc_enrollment)
            gap_3_4 = public_cdc_gap_children_3_4
            
            # Count vulnerable unenrolled children
            vulnerable_unenrolled = min(
                population.children_with_disabilities,
                gap_3_4
            )
            
            working_unenrolled = min(
                population.working_children,
                gap_3_4 + gap_6_12
            )
            
            # Calculate session-based capacity management
            total_enrolled = public_cdc_enrollment
            
            # Check actual center allocations, not all barangay children against
            # the first CDC. Spare places at another CDC do not remove a local overload.
            centers = list(CDC.objects.filter(barangay=barangay))
            enrolled_by_center = {}
            for child in Child.objects.filter(
                barangay=barangay, academic_year=academic_year,
                current_status='enrolled', cdc__isnull=False,
            ):
                if DataIntegrationService._eligible_age(child.age_for_academic_year(academic_year)):
                    enrolled_by_center[child.cdc_id] = enrolled_by_center.get(child.cdc_id, 0) + 1
            cdc_sessions_per_day = sum(c.sessions_per_day for c in centers)
            total_capacity = sum(c.effective_capacity for c in centers)
            # Legacy scalar field represents the weighted mean when there are multiple centers.
            cdc_capacity_per_session = round(total_capacity / cdc_sessions_per_day) if cdc_sessions_per_day else 30
            sessions_needed = sum(
                math.ceil(enrolled_by_center.get(c.pk, 0) / max(c.capacity_per_session, 1))
                for c in centers
            )
            cdc_has_service_gap = any(
                enrolled_by_center.get(c.pk, 0) > c.effective_capacity for c in centers
            )
            
            # Create or update gap analysis
            gap_analysis, created = ChildrenGapAnalysis.objects.update_or_create(
                barangay=barangay,
                academic_year=academic_year,
                defaults={
                    'population_metrics': population,
                    'enrollment_data': enrollment,
                    'gap_0_2': gap_0_2,
                    'gap_3_4': gap_3_4,
                    'gap_6_12': gap_6_12,
                    'vulnerable_children_unenrolled': vulnerable_unenrolled,
                    'working_children_unenrolled': working_unenrolled,
                    'population_children_3_4': population_children_3_4,
                    'public_cdc_enrollment_children_3_4': public_cdc_enrollment,
                    'public_cdc_gap_children_3_4': public_cdc_gap_children_3_4,
                    'enrolled_children_total': total_enrolled,
                    'cdc_capacity_per_session': cdc_capacity_per_session,
                    'sessions_needed_for_enrolled': sessions_needed,
                    'cdc_has_service_gap': cdc_has_service_gap,
                    'calculation_method': 'automated',
                }
            )
            
            gap_msg = (
                f"{gap_analysis.total_gap_all_ages} unenrolled children; "
                f"public CDC 3-4 gap basis: {gap_analysis.public_cdc_gap_children_3_4}"
            )
            if cdc_has_service_gap:
                gap_msg += f" (CDC SERVICE GAP: {sessions_needed} sessions needed)"
            logger.info(f"Gap analysis calculated for {barangay.name}: {gap_msg}")
            return gap_analysis
            
        except Exception as e:
            logger.error(f"Error calculating gap analysis for {barangay.name}: {e}")
            raise
    
    @staticmethod
    def _generate_snp_recommendation(barangay: Barangay, academic_year: AcademicYear = None):
        """
        Generate SNP (Supervised Neighborhood Play) recommendations based on:
        1. Enrollment gaps (unenrolled children in population)
        2. Vulnerable children (disabilities, malnutrition, working children)
        3. Single parent households
        4. Low enrollment rates
        
        NOTE: If enrolled children exceed single-session capacity, they are
        distributed across multiple sessions (morning, midday, afternoon).
        This is NOT considered a service gap—it's normal CDC operation.
        Only flagged as a service gap if sessions needed exceed available sessions.
        """
        try:
            academic_year = academic_year or AcademicYear.get_current()
            # Get gap analysis
            gap_analysis = DataIntegrationService.get_current_gap_analysis(barangay, academic_year)
            if not gap_analysis:
                logger.warning(f"No gap analysis for {barangay.name} ({academic_year.name})")
                return None
            
            population = gap_analysis.population_metrics
            if not population:
                return None
            
            # Priority breakdown
            # High priority: vulnerable children (disability, malnutrition, working)
            high_priority = gap_analysis.vulnerable_children_unenrolled + gap_analysis.working_children_unenrolled
            
            # Medium priority: children from single parent households
            single_parent_ratio = (population.single_parent_households / population.total_population) if population.total_population > 0 else 0
            medium_priority = int((gap_analysis.total_gap_0_5 * single_parent_ratio))
            
            # General enrollment: remaining unenrolled
            general_priority = gap_analysis.total_gap_0_5 - high_priority - medium_priority
            general_priority = max(0, general_priority)
            
            # Recommended SNP slots are a planning guide, not official enrollment.
            # Main basis: eligible 3-4 population minus available CDC capacity/accommodated children.
            total_cdc_capacity = sum(
                max(cdc.effective_capacity or 0, cdc.current_enrollment or 0)
                for cdc in CDC.objects.filter(barangay=barangay)
            )
            capacity_or_accommodated = max(total_cdc_capacity, gap_analysis.public_cdc_enrollment_children_3_4)
            snp_gap_basis = max(0, gap_analysis.population_children_3_4 - capacity_or_accommodated)

            if snp_gap_basis <= 0:
                recommended_enrollment = 0
            elif snp_gap_basis < 10:
                recommended_enrollment = snp_gap_basis
            else:
                recommended_enrollment = min(15, snp_gap_basis)
            
            volunteers_needed = 0 if recommended_enrollment == 0 else max(2, min(5, (recommended_enrollment + 4) // 5))
            
            # Build rationale (includes session-based capacity info)
            rationale = DataIntegrationService._build_snp_rationale(barangay, gap_analysis, recommended_enrollment)
            
            # Create or update recommendation
            recommendation, created = SNPPlanningRecommendation.objects.update_or_create(
                barangay=barangay,
                academic_year=academic_year,
                defaults={
                    'gap_analysis': gap_analysis,
                    'recommended_snp_enrollment': recommended_enrollment,
                    'high_priority_children': high_priority,
                    'medium_priority_children': medium_priority,
                    'general_enrollment_children': general_priority,
                    'recommended_volunteers': volunteers_needed,
                    'recommended_snack_budget': 0,
                    'recommended_activity_materials_budget': 0,
                    'estimated_budget_needed': 0,
                    'recommendation_rationale': rationale,
                    'status': 'recommended',
                }
            )
            
            logger.info(f"SNP recommendation generated for {barangay.name}: {recommended_enrollment} children")
            return recommendation
            
        except Exception as e:
            logger.error(f"Error generating SNP recommendation for {barangay.name}: {e}")
            raise
    
    @staticmethod
    def _build_snp_rationale(barangay: Barangay, gap_analysis: ChildrenGapAnalysis, recommended_enrollment: int) -> str:
        """Build human-readable explanation of SNP recommendation, including session-based capacity info."""
        population = gap_analysis.population_metrics
        
        # Session capacity info
        session_info = ""
        if gap_analysis.enrolled_children_total > 0:
            sessions_needed = gap_analysis.sessions_needed_for_enrolled
            capacity_per_session = gap_analysis.cdc_capacity_per_session
            has_gap = gap_analysis.cdc_has_service_gap
            
            if has_gap:
                session_info = f"""
Enrollment Capacity Status (SERVICE GAP):
- Total enrolled: {gap_analysis.enrolled_children_total} children
- Capacity per session: {capacity_per_session} children
- Sessions needed: {sessions_needed}
- ⚠️ SERVICE GAP DETECTED: Sessions needed exceed available CDC sessions
- RECOMMENDATION: Establish additional session times or CDC branches

"""
            else:
                session_info = f"""
Enrollment Capacity Status (MANAGED VIA SESSIONS):
- Total enrolled: {gap_analysis.enrolled_children_total} children
- Capacity per session: {capacity_per_session} children
- Sessions needed to accommodate: {sessions_needed}
- Current sessions available: Can be provided (e.g., morning, midday, afternoon sessions)
- ✓ All enrolled children can be served via multiple sessions per day

"""
        
        rationale = f"""
SNP Planning Recommendation for {barangay.name}

Population Analysis:
- Total daycare population (3-4 years): {gap_analysis.population_children_3_4} children
- Enrolled in public CDCs: {gap_analysis.public_cdc_enrollment_children_3_4} children
- Unenrolled (Gap): {gap_analysis.total_gap_0_5} children
- Enrollment Rate: {gap_analysis.enrollment_rate_0_5}%

SNP Gap Basis for Ages 3-4:
- Population aged 3-4 in barangay: {gap_analysis.population_children_3_4} children
- Enrolled in public CDCs: {gap_analysis.public_cdc_enrollment_children_3_4} children
- Public CDC coverage gap: {gap_analysis.public_cdc_gap_children_3_4} children
- NOTE: This gap is the basis for SNP planning, but it is not automatically the same as the out-of-school count because some children may be enrolled in private institutions.

{session_info}
Priority Identification:
- High Priority (Vulnerable): {gap_analysis.vulnerable_children_unenrolled} children
  * Children with disabilities: {population.children_with_disabilities}
  * Working children: {gap_analysis.working_children_unenrolled}
  * Malnourished: {population.malnourished_children}
- Medium Priority (Single Parent Households): {population.single_parent_households} households

Recommendation:
- Prepare a weekly validation list for up to {recommended_enrollment} possible children based on the 3-4 service gap
- Treat this as a planning basis only; it does not create official SNP enrollment
- Focus on validating vulnerable and at-risk children before inviting them
- Coordinate with health programs for nutritional support
- Suggested activity pattern: 2 sessions per week, 2 hours per session
- Expected outcomes: Improved school readiness, nutrition, and development monitoring

CAPACITY MANAGEMENT NOTE:
If enrolled children exceed single-session capacity, they are NOT considered a service gap.
Instead, the CDC manages enrollment through multiple daily sessions (morning, midday, afternoon).
Example: 70 enrolled children ÷ 30 per session = 3 sessions per day.
Only flag as service gap if total enrollment cannot be accommodated even with maximum sessions.

This recommendation is based on automated data integration from population submissions.
""".strip()
        
        return rationale
    
    @staticmethod
    def _log_integration(submission: PopulationDataSubmission, barangays_processed: int, status: str):
        """Log the integration event for audit purposes."""
        processed_metrics = BarangayPopulationMetrics.objects.filter(source_submission=submission)
        for metrics in processed_metrics:
            DataIntegrationLog.objects.create(
                integration_type='population_submission',
                barangay=metrics.barangay,
                academic_year=metrics.academic_year,
                source_submission=submission,
                affected_records_count=metrics.total_population,
                status=status,
                message=f"Processed population submission for {metrics.barangay.name}",
                processing_time_ms=0,
            )
    
    @staticmethod
    def recalculate_all_recommendations(academic_year=None):
        """
        Recalculate all SNP recommendations based on current data.
        Can be called when data quality improves or for manual recalculation.
        """
        count = 0
        academic_year = academic_year or AcademicYear.get_current()
        DataIntegrationService._refresh_cdc_enrollment_counts(academic_year)
        for barangay in Barangay.objects.all():
            try:
                DataIntegrationService._update_enrollment_from_child_records(barangay, academic_year)
                DataIntegrationService._calculate_gap_analysis(barangay, academic_year)
                DataIntegrationService._generate_snp_recommendation(barangay, academic_year)
                count += 1
            except Exception as e:
                logger.error(f"Error recalculating for {barangay.name}: {e}")
        
        return count
    
    @staticmethod
    def get_barangay_integration_status(barangay: Barangay, academic_year=None) -> dict:
        """
        Get complete integration status for a single barangay.
        Used for dashboards and reporting.
        """
        try:
            academic_year = academic_year or AcademicYear.get_current()
            population = DataIntegrationService.get_current_population_metrics(barangay, academic_year)
            if not population:
                return None
            enrollment = EnrollmentData.objects.get(barangay=barangay, academic_year=academic_year)
            gap = DataIntegrationService.get_current_gap_analysis(barangay, academic_year)
            if not gap:
                return None
            snp = SNPPlanningRecommendation.objects.get(
                barangay=barangay,
                academic_year=academic_year,
                gap_analysis__population_metrics__source_submission__status='current_basis',
            )
            
            return {
                'barangay': barangay.name,
                'academic_year': academic_year.name,
                'population_metrics': {
                    'total_0_5': population.total_children_0_5,
                    'eligible_3_4': gap.population_children_3_4,
                    'total_6_12': population.children_6_12,
                    'vulnerable': population.vulnerable_children_count,
                },
                'enrollment': {
                    'enrolled_0_5': enrollment.total_enrolled_0_5,
                    'enrolled_3_4': gap.public_cdc_enrollment_children_3_4,
                    'enrolled_6_12': enrollment.enrolled_6_12,
                },
                'gaps': {
                    'gap_0_5': gap.total_gap_0_5,
                    'unreached_3_4': gap.public_cdc_gap_children_3_4,
                    'gap_6_12': gap.gap_6_12,
                    'enrollment_rate_0_5': gap.enrollment_rate_0_5,
                    'eligible_coverage_rate_3_4': gap.eligible_coverage_rate_3_4,
                },
                'snp_plan': {
                    'recommended_enrollment': snp.recommended_snp_enrollment,
                    'high_priority': snp.high_priority_children,
                    'status': snp.status,
                }
            }
        except Exception as e:
            logger.error(f"Error getting integration status for {barangay.name}: {e}")
            return None
