try:
    import pandas as pd
    import numpy as np
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

import csv
import io
import re
from datetime import datetime

from core.models import PopulationDataSubmission


class PopulationAnalyticsService:
    """Population analytics tailored for CSWDO planning and barangay-level decisions."""

    PROGRAM_CATEGORIES = {
        'early_childhood': {'min_age': 0, 'max_age': 5, 'programs': ['Daycare', 'Nutrition', 'Health Screening']},
        'school_age': {'min_age': 6, 'max_age': 12, 'programs': ['School Feeding', 'Educational Support', 'After-School Care']},
        'adolescent': {'min_age': 13, 'max_age': 17, 'programs': ['Youth Development', 'Counseling', 'Skills Training']},
        'young_mothers': {'min_age': 18, 'max_age': 24, 'programs': ['Maternal Care', 'Family Planning', 'Livelihood Support']},
        'special_needs': {'disability': True, 'programs': ['Special Education', 'Therapy', 'Assistive Devices']},
        'elderly_caregivers': {'min_age': 60, 'max_age': float('inf'), 'programs': ['Senior Care', 'Caregiver Support', 'Community Health']},
    }

    COLUMN_ALIASES = {
        'name': ['name', 'full_name', 'child_full_name', 'child_name', 'resident_name'],
        'age': ['age', 'edad', 'years_old'],
        'date_of_birth': ['date_of_birth', 'birth_date', 'birthday', 'dob'],
        'gender': ['gender', 'sex'],
        'barangay': ['barangay', 'brgy', 'barangay_name', 'village'],
        'guardian_name': ['guardian_name', 'parent_guardian', 'guardian', 'parent_name'],
        'complete_address': ['complete_address', 'address', 'home_address'],
        'contact_number': ['contact_number', 'contact_no', 'phone', 'mobile_number'],
        'mother_name': ['mother_name', 'mother', 'mothers_name'],
        'father_name': ['father_name', 'father', 'fathers_name'],
        'household_size': ['household_size', 'family_size', 'members_in_household'],
        'single_parent': ['single_parent', 'solo_parent', 'single_parent_household'],
        'income_level': ['income_level', 'income_status', 'economic_status'],
        'working': ['working', 'employed_child', 'child_labor'],
        'enrolled': ['enrolled', 'in_school', 'school_enrolled'],
        'disability': ['disability', 'pwd', 'has_disability', 'special_needs'],
        'bmi': ['bmi'],
    }

    BOOLEAN_COLUMNS = ['single_parent', 'working', 'enrolled', 'disability']

    @staticmethod
    def preview_upload_file(uploaded_file) -> dict:
        if not uploaded_file:
            return {
                'valid': False,
                'error': 'No file was provided for preview.',
            }

        try:
            if not PANDAS_AVAILABLE:
                return PopulationAnalyticsService._preview_csv_without_pandas(uploaded_file)

            dataframe = PopulationAnalyticsService._load_uploaded_file_dataframe(uploaded_file)
            if dataframe is None or dataframe.empty:
                return {
                    'valid': False,
                    'error': 'The selected file has no readable rows.',
                }

            original_columns = [str(column) for column in dataframe.columns]
            normalized_columns = [PopulationAnalyticsService._normalize_column_name(column) for column in dataframe.columns]
            alias_mapping = PopulationAnalyticsService._build_alias_mapping(normalized_columns)
            canonical_columns = [alias_mapping.get(column, column) for column in normalized_columns]
            missing_required = [
                column for column in ['name', 'date_of_birth', 'gender', 'barangay', 'guardian_name']
                if column not in canonical_columns
            ]
            sample_rows = (
                dataframe.fillna('')
                .head(5)
                .astype(str)
                .to_dict(orient='records')
            )

            return {
                'valid': True,
                'row_count': int(len(dataframe)),
                'column_count': int(len(original_columns)),
                'detected_columns': original_columns,
                'normalized_columns': canonical_columns,
                'missing_required_columns': missing_required,
                'preview_rows': sample_rows,
            }
        except Exception as exc:
            return {
                'valid': False,
                'error': f'Preview failed: {exc}',
            }

    @staticmethod
    def _preview_csv_without_pandas(uploaded_file) -> dict:
        file_name = getattr(uploaded_file, 'name', '').lower()
        if not file_name.endswith('.csv'):
            return {
                'valid': False,
                'error': 'Preview for Excel files requires pandas to be installed on the server.',
            }

        if hasattr(uploaded_file, 'seek'):
            uploaded_file.seek(0)

        content = uploaded_file.read()
        if isinstance(content, bytes):
            text = content.decode('utf-8-sig')
        else:
            text = str(content)

        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        original_columns = reader.fieldnames or []
        normalized_columns = [PopulationAnalyticsService._normalize_column_name(column) for column in original_columns]
        alias_mapping = PopulationAnalyticsService._build_alias_mapping(normalized_columns)
        canonical_columns = [alias_mapping.get(column, column) for column in normalized_columns]
        missing_required = [
            column for column in ['name', 'date_of_birth', 'gender', 'barangay', 'guardian_name']
            if column not in canonical_columns
        ]

        return {
            'valid': True,
            'row_count': len(rows),
            'column_count': len(original_columns),
            'detected_columns': original_columns,
            'normalized_columns': canonical_columns,
            'missing_required_columns': missing_required,
            'preview_rows': rows[:5],
        }

    @staticmethod
    def analyze_population_data(submission: PopulationDataSubmission) -> dict:
        if not PANDAS_AVAILABLE:
            return PopulationAnalyticsService._get_fallback_analysis('Advanced analytics is unavailable because pandas is not installed.')

        try:
            df = PopulationAnalyticsService._load_submission_dataframe(submission)
            if df is None or df.empty:
                return PopulationAnalyticsService._get_fallback_analysis('No analyzable population rows were found in the submission.')

            df = PopulationAnalyticsService._prepare_dataframe(df)
            total_population = len(df)

            analysis_results = {}
            analysis_results.update(PopulationAnalyticsService._analyze_demographics(df))
            analysis_results.update(PopulationAnalyticsService._analyze_program_needs(df))
            analysis_results.update(PopulationAnalyticsService._analyze_risks(df))
            analysis_results.update(PopulationAnalyticsService._analyze_resource_needs(df))
            analysis_results.update(PopulationAnalyticsService._analyze_geographic_distribution(df))
            analysis_results.update(PopulationAnalyticsService._generate_policy_recommendations(df))
            analysis_results['executive_summary'] = PopulationAnalyticsService._build_executive_summary(df)
            analysis_results['planning_highlights'] = PopulationAnalyticsService._build_planning_highlights(df)
            analysis_results.update({
                'data_quality_score': PopulationAnalyticsService._calculate_comprehensive_data_quality(df),
                'analysis_timestamp': datetime.now().isoformat(),
                'data_source': submission.title,
                'analyzed_records': total_population,
                'analysis_version': '3.0',
            })
            return analysis_results
        except Exception as exc:
            return PopulationAnalyticsService._get_fallback_analysis(f'Analysis failed: {exc}')

    @staticmethod
    def _load_submission_dataframe(submission: PopulationDataSubmission):
        if not PANDAS_AVAILABLE:
            return None

        if submission.data_file:
            return PopulationAnalyticsService._load_uploaded_file_dataframe(submission.data_file)

        payload = submission.data_payload or {}
        if isinstance(payload, dict):
            for key in ['rows', 'records', 'data', 'items']:
                value = payload.get(key)
                if isinstance(value, list) and value:
                    return pd.DataFrame(value)
        if isinstance(payload, list) and payload:
            return pd.DataFrame(payload)
        return None

    @staticmethod
    def _load_uploaded_file_dataframe(uploaded_file):
        if not PANDAS_AVAILABLE or not uploaded_file:
            return None

        file_name = getattr(uploaded_file, 'name', '')
        lower_name = str(file_name).lower()
        file_path = getattr(uploaded_file, 'path', None)
        source = file_path if file_path else uploaded_file

        if hasattr(uploaded_file, 'seek'):
            uploaded_file.seek(0)

        if lower_name.endswith('.csv'):
            return pd.read_csv(source)
        if lower_name.endswith('.xlsx') or lower_name.endswith('.xls'):
            return pd.read_excel(source)

        raise ValueError('Unsupported file format. Only CSV and Excel files can be previewed.')

    @staticmethod
    def _prepare_dataframe(df: 'pd.DataFrame') -> 'pd.DataFrame':
        prepared = df.copy()
        prepared.columns = [PopulationAnalyticsService._normalize_column_name(column) for column in prepared.columns]
        prepared = prepared.rename(columns=PopulationAnalyticsService._build_alias_mapping(prepared.columns))

        if 'barangay' in prepared.columns:
            prepared['barangay'] = (
                prepared['barangay']
                .fillna('Unspecified Barangay')
                .astype(str)
                .str.strip()
                .replace('', 'Unspecified Barangay')
                .str.title()
            )

        if 'gender' in prepared.columns:
            prepared['gender'] = prepared['gender'].fillna('Unspecified').map(PopulationAnalyticsService._normalize_gender)

        if 'income_level' in prepared.columns:
            prepared['income_level'] = (
                prepared['income_level']
                .fillna('unknown')
                .astype(str)
                .str.strip()
                .str.lower()
            )

        if 'age' not in prepared.columns and 'date_of_birth' in prepared.columns:
            birth_dates = pd.to_datetime(prepared['date_of_birth'], errors='coerce')
            today = pd.Timestamp.today()
            prepared['age'] = (
                today.year
                - birth_dates.dt.year
                - ((today.month < birth_dates.dt.month) | ((today.month == birth_dates.dt.month) & (today.day < birth_dates.dt.day))).astype(int)
            )

        if 'age' in prepared.columns:
            prepared['age'] = pd.to_numeric(prepared['age'], errors='coerce')
            prepared = prepared[prepared['age'].notna()].copy()
            prepared['age'] = prepared['age'].clip(lower=0, upper=120).astype(int)

        for column in PopulationAnalyticsService.BOOLEAN_COLUMNS:
            if column in prepared.columns:
                prepared[column] = prepared[column].map(PopulationAnalyticsService._normalize_bool).fillna(False)

        if 'name' not in prepared.columns:
            prepared['name'] = [f'Record {index + 1}' for index in range(len(prepared))]

        return prepared.reset_index(drop=True)

    @staticmethod
    def _normalize_column_name(value) -> str:
        text = str(value).strip().lower()
        text = re.sub(r'[^a-z0-9]+', '_', text)
        return text.strip('_')

    @staticmethod
    def _build_alias_mapping(columns) -> dict:
        mapping = {}
        for canonical, aliases in PopulationAnalyticsService.COLUMN_ALIASES.items():
            for alias in aliases:
                normalized_alias = PopulationAnalyticsService._normalize_column_name(alias)
                if normalized_alias in columns:
                    mapping[normalized_alias] = canonical
                    break
        return mapping

    @staticmethod
    def _normalize_bool(value):
        if isinstance(value, bool):
            return value
        if value is None:
            return None
        text = str(value).strip().lower()
        if text in {'true', '1', 'yes', 'y', 'oo'}:
            return True
        if text in {'false', '0', 'no', 'n', 'hindi'}:
            return False
        return None

    @staticmethod
    def _normalize_gender(value) -> str:
        text = str(value).strip().lower()
        if text in {'m', 'male', 'lalaki'}:
            return 'Male'
        if text in {'f', 'female', 'babae'}:
            return 'Female'
        return 'Unspecified'

    @staticmethod
    def _analyze_demographics(df: 'pd.DataFrame') -> dict:
        return {
            'total_population': int(len(df)),
            'age_distribution': PopulationAnalyticsService._analyze_age_distribution(df),
            'gender_distribution': PopulationAnalyticsService._analyze_gender_distribution(df),
            'family_structure': PopulationAnalyticsService._analyze_family_structure(df),
            'population_density': PopulationAnalyticsService._calculate_population_density(df),
            'dependency_ratio': PopulationAnalyticsService._calculate_dependency_ratio(df),
        }

    @staticmethod
    def _analyze_age_distribution(df: 'pd.DataFrame') -> dict:
        if 'age' not in df.columns:
            return {}

        age_groups = {
            'early_childhood_0_2': (0, 2),
            'daycare_3_4': (3, 4),
            'kindergarten_5': (5, 5),
            'early_school_6_9': (6, 9),
            'pre_teen_10_12': (10, 12),
            'adolescents_13_17': (13, 17),
            'young_adults_18_24': (18, 24),
            'adults_25_59': (25, 59),
            'seniors_60_plus': (60, float('inf')),
        }

        total = len(df)
        output = {}
        for group_name, (minimum, maximum) in age_groups.items():
            mask = df['age'] >= minimum
            if maximum != float('inf'):
                mask &= df['age'] <= maximum
            count = int(mask.sum())
            output[group_name] = {
                'count': count,
                'percentage': round((count / total) * 100, 2) if total else 0,
                'program_relevance': PopulationAnalyticsService._get_program_relevance(group_name),
            }
        return output

    @staticmethod
    def _analyze_gender_distribution(df: 'pd.DataFrame') -> dict:
        if 'gender' not in df.columns:
            return {}

        counts = df['gender'].value_counts()
        total = len(df)
        output = {}
        for gender, count in counts.items():
            output[str(gender).lower()] = {
                'count': int(count),
                'percentage': round((int(count) / total) * 100, 2) if total else 0,
                'program_implications': PopulationAnalyticsService._get_gender_program_implications(str(gender).lower()),
            }
        return output

    @staticmethod
    def _analyze_family_structure(df: 'pd.DataFrame') -> dict:
        summary = {}
        if 'household_size' in df.columns:
            household_sizes = pd.to_numeric(df['household_size'], errors='coerce').dropna()
            summary['average_household_size'] = round(float(household_sizes.mean()), 2) if not household_sizes.empty else 0
        if 'single_parent' in df.columns:
            summary['single_parent_households'] = round(float(df['single_parent'].mean()) * 100, 2)
        if 'income_level' in df.columns:
            income_distribution = (df['income_level'].value_counts(normalize=True) * 100).round(2).to_dict()
            summary['income_distribution'] = income_distribution
        return summary

    @staticmethod
    def _calculate_dependency_ratio(df: 'pd.DataFrame') -> float:
        if 'age' not in df.columns:
            return 0
        dependents = int(((df['age'] < 15) | (df['age'] > 64)).sum())
        working_age = int(((df['age'] >= 15) & (df['age'] <= 64)).sum())
        return round((dependents / working_age) * 100, 2) if working_age else 0

    @staticmethod
    def _calculate_population_density(df: 'pd.DataFrame') -> dict:
        if 'barangay' not in df.columns:
            return {}
        barangay_pop = df['barangay'].value_counts()
        return {
            'average_population_per_barangay': round(float(barangay_pop.mean()), 2),
            'most_populated_barangay': str(barangay_pop.index[0]),
            'least_populated_barangay': str(barangay_pop.index[-1]),
            'population_range': {
                'max': int(barangay_pop.max()),
                'min': int(barangay_pop.min()),
                'range': int(barangay_pop.max() - barangay_pop.min()),
            },
        }

    @staticmethod
    def _analyze_program_needs(df: 'pd.DataFrame') -> dict:
        program_needs = {}
        total_population = len(df)

        for category, config in PopulationAnalyticsService.PROGRAM_CATEGORIES.items():
            if 'disability' in config:
                eligible_count = int(df['disability'].sum()) if 'disability' in df.columns else 0
            elif 'age' in df.columns:
                eligible_count = int(((df['age'] >= config['min_age']) & (df['age'] <= config['max_age'])).sum())
            else:
                eligible_count = 0

            percentage = (eligible_count / total_population) * 100 if total_population else 0
            program_needs[category] = {
                'eligible_population': eligible_count,
                'percentage': round(percentage, 2),
                'programs': config['programs'],
                'priority_level': PopulationAnalyticsService._calculate_program_priority(percentage),
                'staff_requirements': PopulationAnalyticsService._calculate_staff_needs(category, eligible_count),
            }

        return {'program_needs': program_needs}

    @staticmethod
    def _calculate_program_priority(percentage: float) -> str:
        if percentage >= 20:
            return 'high'
        if percentage >= 10:
            return 'medium'
        return 'low'

    @staticmethod
    def _calculate_staff_needs(category: str, eligible_count: int) -> dict:
        staff_ratios = {
            'early_childhood': 15,
            'school_age': 25,
            'adolescent': 20,
            'young_mothers': 30,
            'special_needs': 8,
            'elderly_caregivers': 12,
        }
        ratio = staff_ratios.get(category, 20)
        required_staff = eligible_count / ratio if ratio else 0
        return {
            'required_staff': round(required_staff, 1),
            'staff_ratio': ratio,
            'staff_types': PopulationAnalyticsService._get_staff_types(category),
        }

    @staticmethod
    def _analyze_risks(df: 'pd.DataFrame') -> dict:
        total_population = len(df)
        if total_population == 0:
            return {'risk_assessment': {'high_risk_areas': [], 'moderate_risk_areas': [], 'overall_risk_score': 0, 'intervention_priorities': []}}

        high_risk_areas = []
        moderate_risk_areas = []

        if 'age' in df.columns:
            child_share = ((df['age'] <= 17).sum() / total_population) * 100
            if child_share >= 45:
                high_risk_areas.append(PopulationAnalyticsService._risk_entry('high_child_dependency', child_share, total_population))

        if 'disability' in df.columns:
            disability_share = (df['disability'].sum() / total_population) * 100
            if disability_share > 0:
                moderate_risk_areas.append(PopulationAnalyticsService._risk_entry('persons_with_disability', disability_share, total_population))

        if 'single_parent' in df.columns:
            single_parent_share = (df['single_parent'].sum() / total_population) * 100
            if single_parent_share > 0:
                moderate_risk_areas.append(PopulationAnalyticsService._risk_entry('single_parent_households', single_parent_share, total_population))

        if 'income_level' in df.columns:
            low_income_share = ((df['income_level'] == 'low').sum() / total_population) * 100
            if low_income_share > 0:
                high_risk_areas.append(PopulationAnalyticsService._risk_entry('low_income_families', low_income_share, total_population))

        if 'enrolled' in df.columns and 'age' in df.columns:
            school_age_mask = (df['age'] >= 6) & (df['age'] <= 17)
            school_age_total = int(school_age_mask.sum())
            if school_age_total:
                not_enrolled_share = ((~df.loc[school_age_mask, 'enrolled']).sum() / school_age_total) * 100
                if not_enrolled_share > 0:
                    high_risk_areas.append(PopulationAnalyticsService._risk_entry('school_dropout_risk', not_enrolled_share, school_age_total))

        risk_assessment = {
            'high_risk_areas': sorted(high_risk_areas, key=lambda item: item['percentage'], reverse=True),
            'moderate_risk_areas': sorted(moderate_risk_areas, key=lambda item: item['percentage'], reverse=True),
        }
        risk_assessment['overall_risk_score'] = round(sum(item['percentage'] for item in risk_assessment['high_risk_areas'] + risk_assessment['moderate_risk_areas']), 2)
        risk_assessment['intervention_priorities'] = PopulationAnalyticsService._prioritize_interventions(risk_assessment)
        return {'risk_assessment': risk_assessment}

    @staticmethod
    def _risk_entry(factor: str, percentage: float, population_base: int) -> dict:
        severity = 'high' if percentage >= 20 else 'moderate' if percentage >= 10 else 'low'
        return {
            'factor': factor,
            'percentage': round(percentage, 2),
            'severity': severity,
            'affected_population': int(round((percentage / 100) * population_base)),
        }

    @staticmethod
    def _analyze_resource_needs(df: 'pd.DataFrame') -> dict:
        staffing = PopulationAnalyticsService._calculate_overall_staff_needs(df)
        return {
            'resource_allocation': {
                'staffing_requirements': staffing,
                'facility_needs': PopulationAnalyticsService._assess_facility_needs(df),
                'supply_requirements': PopulationAnalyticsService._calculate_supply_needs(df),
                'training_needs': PopulationAnalyticsService._assess_training_needs(df),
            }
        }

    @staticmethod
    def _calculate_overall_staff_needs(df: 'pd.DataFrame') -> dict:
        total_population = len(df)
        staff_breakdown = {
            'social_workers': max(1, round(total_population / 500)) if total_population else 0,
            'health_workers': max(1, round(total_population / 1000)) if total_population else 0,
            'educators': max(1, round(max(int((df['age'] <= 17).sum()) if 'age' in df.columns else 0, 1) / 300)) if total_population else 0,
            'administrative_staff': max(1, round(total_population / 2000)) if total_population else 0,
            'support_staff': max(2, round(total_population / 800)) if total_population else 0,
        }
        total_staff = sum(staff_breakdown.values())
        return {
            'staff_breakdown': staff_breakdown,
            'total_staff_required': total_staff,
            'staff_to_population_ratio': round((total_staff / total_population) * 1000, 2) if total_population else 0,
        }

    @staticmethod
    def _assess_facility_needs(df: 'pd.DataFrame') -> dict:
        total_population = len(df)
        child_population = int((df['age'] <= 17).sum()) if 'age' in df.columns else 0
        return {
            'daycare_centers': max(1, round(max(child_population, 1) / 80)) if total_population else 0,
            'health_centers': max(1, round(total_population / 1000)) if total_population else 0,
            'community_centers': max(1, round(total_population / 1500)) if total_population else 0,
            'emergency_shelters': max(1, round(total_population / 3000)) if total_population else 0,
        }

    @staticmethod
    def _calculate_supply_needs(df: 'pd.DataFrame') -> dict:
        total_population = len(df)
        monthly = {
            'nutritional_supplements': int(total_population * 2),
            'medical_supplies': int(round(total_population * 0.5)),
            'educational_materials': int(total_population),
            'hygiene_kits': int(round(total_population * 0.8)),
            'clothing_assistance': int(round(total_population * 0.3)),
        }
        return {
            'monthly_requirements': monthly,
            'annual_projections': {key: value * 12 for key, value in monthly.items()},
        }

    @staticmethod
    def _assess_training_needs(df: 'pd.DataFrame') -> dict:
        return {
            'child_protection_training': {'frequency': 'annual', 'staff_percentage': 100},
            'first_aid_cpr': {'frequency': 'biannual', 'staff_percentage': 80},
            'case_management': {'frequency': 'quarterly', 'staff_percentage': 60},
            'nutrition_education': {'frequency': 'quarterly', 'staff_percentage': 70},
            'gender_and_development': {'frequency': 'annual', 'staff_percentage': 90},
        }

    @staticmethod
    def _analyze_geographic_distribution(df: 'pd.DataFrame') -> dict:
        if 'barangay' not in df.columns:
            return {'geographic_analysis': {}}

        barangay_stats = PopulationAnalyticsService._analyze_barangay_breakdown(df)
        return {
            'geographic_analysis': {
                'barangay_breakdown': barangay_stats,
                'population_disparities': PopulationAnalyticsService._calculate_disparities(barangay_stats),
                'service_coverage_gaps': PopulationAnalyticsService._identify_service_gaps(barangay_stats),
                'regional_recommendations': PopulationAnalyticsService._generate_regional_recommendations(barangay_stats),
            }
        }

    @staticmethod
    def _analyze_barangay_breakdown(df: 'pd.DataFrame') -> dict:
        breakdown = {}
        total_population = len(df)

        for barangay, group in df.groupby('barangay'):
            total = int(len(group))
            children_total = int((group['age'] <= 17).sum()) if 'age' in group.columns else 0
            under_five_total = int((group['age'] <= 5).sum()) if 'age' in group.columns else 0
            school_age_total = int(((group['age'] >= 6) & (group['age'] <= 12)).sum()) if 'age' in group.columns else 0
            adolescent_total = int(((group['age'] >= 13) & (group['age'] <= 17)).sum()) if 'age' in group.columns else 0
            senior_total = int((group['age'] >= 60).sum()) if 'age' in group.columns else 0
            pwd_total = int(group['disability'].sum()) if 'disability' in group.columns else 0
            single_parent_total = int(group['single_parent'].sum()) if 'single_parent' in group.columns else 0
            low_income_total = int((group['income_level'] == 'low').sum()) if 'income_level' in group.columns else 0

            breakdown[str(barangay)] = {
                'count': total,
                'share_of_total_population': round((total / total_population) * 100, 2) if total_population else 0,
                'children_total': children_total,
                'under_five_total': under_five_total,
                'school_age_total': school_age_total,
                'adolescent_total': adolescent_total,
                'senior_total': senior_total,
                'persons_with_disability': pwd_total,
                'single_parent_households': single_parent_total,
                'low_income_families': low_income_total,
                'male_total': int((group['gender'] == 'Male').sum()) if 'gender' in group.columns else 0,
                'female_total': int((group['gender'] == 'Female').sum()) if 'gender' in group.columns else 0,
                'planning_priority': PopulationAnalyticsService._barangay_priority(total, children_total, under_five_total, low_income_total, pwd_total),
            }

        return dict(sorted(breakdown.items(), key=lambda item: item[1]['children_total'], reverse=True))

    @staticmethod
    def _barangay_priority(total: int, children_total: int, under_five_total: int, low_income_total: int, pwd_total: int) -> str:
        score = children_total + under_five_total + low_income_total + pwd_total
        if total and score / total >= 1.0:
            return 'high'
        if total and score / total >= 0.5:
            return 'medium'
        return 'standard'

    @staticmethod
    def _calculate_disparities(barangay_stats: dict) -> dict:
        if not barangay_stats:
            return {}
        populations = [item['count'] for item in barangay_stats.values()]
        max_pop = max(populations)
        min_pop = min(populations)
        average = sum(populations) / len(populations)
        return {
            'disparity_ratio': round(max_pop / min_pop, 2) if min_pop else 0,
            'coefficient_of_variation': round(float(np.std(populations)) / average, 2) if average else 0,
            'most_unequal_barangays': PopulationAnalyticsService._identify_unequal_areas(barangay_stats),
        }

    @staticmethod
    def _identify_service_gaps(barangay_stats: dict) -> list:
        gaps = []
        if not barangay_stats:
            return gaps

        average_children = sum(item['children_total'] for item in barangay_stats.values()) / len(barangay_stats)
        for barangay, stats in barangay_stats.items():
            if stats['children_total'] >= average_children and stats['planning_priority'] == 'high':
                gaps.append(f'{barangay} has high child-service demand and should be prioritized for CSWDO program coverage.')
            if stats['under_five_total'] >= max(10, average_children * 0.35):
                gaps.append(f'{barangay} needs stronger early childhood and daycare support based on its under-five count.')
        return gaps[:6]

    @staticmethod
    def _generate_regional_recommendations(barangay_stats: dict) -> list:
        if not barangay_stats:
            return []

        ordered = sorted(barangay_stats.items(), key=lambda item: item[1]['children_total'], reverse=True)
        recommendations = []
        for barangay, stats in ordered[:3]:
            recommendations.append(f'Prioritize {barangay} for child-focused services because it has {stats["children_total"]} children in the current dataset.')
        for barangay, stats in sorted(barangay_stats.items(), key=lambda item: item[1]['low_income_families'], reverse=True)[:2]:
            if stats['low_income_families'] > 0:
                recommendations.append(f'Expand family assistance in {barangay} due to {stats["low_income_families"]} low-income records.')
        return recommendations

    @staticmethod
    def _generate_policy_recommendations(df: 'pd.DataFrame') -> dict:
        summary = PopulationAnalyticsService._build_executive_summary(df)
        highest_barangay = summary.get('highest_child_population_barangay')
        recommendations = {
            'immediate_actions': [],
            'short_term_programs': [],
            'long_term_policies': [],
            'monitoring_indicators': [
                'Children under five by barangay',
                'School-age population by barangay',
                'Adolescent population by barangay',
                'Single-parent and low-income households',
                'Persons with disability and senior population',
            ],
        }

        if highest_barangay:
            recommendations['immediate_actions'].append(f'Validate service capacity in {highest_barangay["barangay"]} because it has the highest child population in the latest submission.')
        recommendations['immediate_actions'].append('Use barangay child totals to set quarterly outreach, feeding, and case management targets.')
        recommendations['short_term_programs'].append('Align daycare, nutrition, and parenting sessions with barangays showing high under-five totals.')
        recommendations['short_term_programs'].append('Prepare youth and school support activities where school-age and adolescent counts are highest.')
        recommendations['long_term_policies'].append('Institutionalize barangay-based population analytics as an input to annual CSWDO enrollment, staffing, and CDC planning.')
        recommendations['long_term_policies'].append('Create service coverage standards for high-priority barangays based on child population and vulnerability counts.')
        return {'policy_recommendations': recommendations}

    @staticmethod
    def _prioritize_interventions(risk_assessment: dict) -> list:
        priorities = []
        combined = sorted(
            risk_assessment.get('high_risk_areas', []) + risk_assessment.get('moderate_risk_areas', []),
            key=lambda item: item['percentage'],
            reverse=True,
        )
        for risk in combined[:5]:
            priorities.append({
                'intervention': PopulationAnalyticsService._get_intervention_for_risk(risk['factor']),
                'target_population': risk['affected_population'],
                'urgency': 'high' if risk['severity'] == 'high' else 'medium',
            })
        return priorities

    @staticmethod
    def _get_intervention_for_risk(risk_factor: str) -> str:
        interventions = {
            'high_child_dependency': 'Expand daycare, feeding, and barangay child development sessions',
            'school_dropout_risk': 'Conduct school retention monitoring and family case management',
            'low_income_families': 'Strengthen livelihood referral and emergency family assistance',
            'single_parent_households': 'Increase parenting support and childcare assistance',
            'persons_with_disability': 'Plan inclusive services and assistive support for PWD clients',
        }
        return interventions.get(risk_factor, 'Provide targeted social welfare support')

    @staticmethod
    def _calculate_comprehensive_data_quality(df: 'pd.DataFrame') -> float:
        if df.empty:
            return 0

        score = 100.0
        required_cols = ['name', 'date_of_birth', 'gender', 'barangay', 'guardian_name']
        missing_cols = [column for column in required_cols if column not in df.columns]
        score -= len(missing_cols) * 15

        missing_pct = float(df.isnull().sum().sum()) / float(max(len(df) * len(df.columns), 1)) * 100
        score -= missing_pct * 0.5

        if 'age' in df.columns:
            invalid_ages = int(((df['age'] < 0) | (df['age'] > 120)).sum())
            score -= (invalid_ages / len(df)) * 100

        if 'gender' in df.columns:
            valid_genders = {'Male', 'Female', 'Unspecified'}
            invalid_genders = int((~df['gender'].isin(valid_genders)).sum())
            score -= (invalid_genders / len(df)) * 25

        return round(max(0, min(100, score)), 2)

    @staticmethod
    def _build_executive_summary(df: 'pd.DataFrame') -> dict:
        total_population = len(df)
        child_population = int((df['age'] <= 17).sum()) if 'age' in df.columns else 0
        under_five = int((df['age'] <= 5).sum()) if 'age' in df.columns else 0
        school_age = int(((df['age'] >= 6) & (df['age'] <= 12)).sum()) if 'age' in df.columns else 0
        adolescent = int(((df['age'] >= 13) & (df['age'] <= 17)).sum()) if 'age' in df.columns else 0
        barangay_breakdown = PopulationAnalyticsService._analyze_barangay_breakdown(df) if 'barangay' in df.columns else {}
        top_barangay = next(iter(barangay_breakdown.items()), None)

        return {
            'total_population': total_population,
            'child_population': child_population,
            'child_population_percentage': round((child_population / total_population) * 100, 2) if total_population else 0,
            'under_five_population': under_five,
            'school_age_population': school_age,
            'adolescent_population': adolescent,
            'barangay_count': df['barangay'].nunique() if 'barangay' in df.columns else 0,
            'highest_child_population_barangay': {
                'barangay': top_barangay[0],
                'children_total': top_barangay[1]['children_total'],
                'planning_priority': top_barangay[1]['planning_priority'],
            } if top_barangay else None,
        }

    @staticmethod
    def _build_planning_highlights(df: 'pd.DataFrame') -> list:
        summary = PopulationAnalyticsService._build_executive_summary(df)
        highlights = [
            f'{summary["child_population"]} children were identified across {summary["barangay_count"]} barangays.',
            f'{summary["under_five_population"]} children are under five and likely need daycare, nutrition, and early childhood support.',
            f'{summary["school_age_population"]} are school-age children and {summary["adolescent_population"]} are adolescents for youth-focused planning.',
        ]
        top_barangay = summary.get('highest_child_population_barangay')
        if top_barangay:
            highlights.append(
                f'{top_barangay["barangay"]} currently has the highest recorded child population with {top_barangay["children_total"]} children.'
            )
        return highlights

    @staticmethod
    def _get_program_relevance(age_group: str) -> str:
        relevance_map = {
            'early_childhood_0_2': 'Early childhood care and parent guidance',
            'daycare_3_4': 'Daycare eligibility, Pre-K1 and Pre-K2',
            'kindergarten_5': 'Kindergarten transition and school readiness',
            'early_school_6_9': 'Important for school support and nutrition monitoring',
            'pre_teen_10_12': 'Important for educational support and child protection',
            'adolescents_13_17': 'Important for youth development and counseling',
            'young_adults_18_24': 'Relevant for parenting, livelihood, and transition support',
            'adults_25_59': 'Relevant for family and workforce stability',
            'seniors_60_plus': 'Relevant for elderly support and family caregiving',
        }
        return relevance_map.get(age_group, 'General population services')

    @staticmethod
    def _get_gender_program_implications(gender: str) -> str:
        implications = {
            'male': 'Monitor participation, behavior support, and youth engagement needs',
            'female': 'Monitor education continuity, safety, and maternal health needs',
            'unspecified': 'Improve data completion for more accurate gender-responsive planning',
        }
        return implications.get(gender, 'Use inclusive gender-sensitive planning')

    @staticmethod
    def _get_staff_types(category: str) -> list:
        staff_types_map = {
            'early_childhood': ['Child Development Workers', 'Nutritionists', 'Nurses'],
            'school_age': ['Teachers', 'Counselors', 'Program Aides'],
            'adolescent': ['Youth Workers', 'Counselors', 'Skills Trainers'],
            'young_mothers': ['Social Workers', 'Health Educators', 'Livelihood Officers'],
            'special_needs': ['Special Education Teachers', 'Therapists', 'Specialized Nurses'],
            'elderly_caregivers': ['Social Workers', 'Caregivers', 'Community Health Aides'],
        }
        return staff_types_map.get(category, ['General Staff'])

    @staticmethod
    def _identify_unequal_areas(barangay_stats: dict) -> list:
        ordered = sorted(barangay_stats.items(), key=lambda item: item[1]['count'])
        return [barangay for barangay, _ in ordered[:3]]

    @staticmethod
    def _get_fallback_analysis(message='Advanced analytics not available') -> dict:
        return {
            'error': message,
            'fallback_analysis': True,
            'total_population': 0,
            'age_distribution': {},
            'gender_distribution': {},
            'barangay_breakdown': {},
            'program_needs': {},
            'risk_assessment': {'overall_risk_score': 0, 'high_risk_areas': [], 'moderate_risk_areas': [], 'intervention_priorities': []},
            'resource_allocation': {},
            'geographic_analysis': {},
            'policy_recommendations': {},
            'executive_summary': {},
            'planning_highlights': [],
            'data_quality_score': 0,
        }

    @staticmethod
    def perform_analysis(submission_id: int) -> bool:
        try:
            submission = PopulationDataSubmission.objects.get(id=submission_id)
            analysis_results = PopulationAnalyticsService.analyze_population_data(submission)

            submission.analysis_results = analysis_results
            submission.total_population = analysis_results.get('total_population', 0)
            submission.total_records = analysis_results.get('analyzed_records', 0)
            submission.data_sources = max(1, len(analysis_results.get('geographic_analysis', {}).get('barangay_breakdown', {}))) if analysis_results.get('analyzed_records') else 0
            submission.age_distribution = analysis_results.get('age_distribution', {})
            submission.gender_distribution = analysis_results.get('gender_distribution', {})
            submission.barangay_breakdown = analysis_results.get('geographic_analysis', {}).get('barangay_breakdown', {})
            submission.save()
            return True
        except Exception as exc:
            print(f'Population analysis failed for submission {submission_id}: {exc}')
            return False
