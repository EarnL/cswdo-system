"""
Data Integration Models
Tracks population data, enrollment data, and SNP planning across all barangays
"""
from django.db import models
from django.conf import settings
from .barangay import Barangay
from .population_data import PopulationDataSubmission
from .academic_year import AcademicYear


class BarangayPopulationMetrics(models.Model):
    """
    Real-time aggregated population metrics per barangay.
    Updated automatically when population data is received.
    """
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE, related_name='population_metrics_records')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, related_name='barangay_population_metrics', null=True, blank=True)
    
    # From latest population submission
    source_submission = models.ForeignKey(
        PopulationDataSubmission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='barangay_metrics'
    )
    
    # Total population breakdown
    total_population = models.IntegerField(default=0)
    
    # Age group breakdowns (crucial for program planning)
    children_0_2 = models.IntegerField(default=0, help_text="Legacy 0-2 population bucket; hidden from daycare coverage")
    children_3_5 = models.IntegerField(default=0, help_text="CHO demographic bucket, ages 3-5; not daycare eligibility")
    children_3_4 = models.IntegerField(null=True, blank=True, help_text="Validated daycare population ages 3-4; null until rebuilt from source records")
    children_6_12 = models.IntegerField(default=0, help_text="School age")
    adolescents_13_17 = models.IntegerField(default=0)
    adults_18_64 = models.IntegerField(default=0)
    elderly_65_plus = models.IntegerField(default=0)
    
    # Gender distribution
    male_population = models.IntegerField(default=0)
    female_population = models.IntegerField(default=0)
    
    # Special demographics
    single_parent_households = models.IntegerField(default=0)
    families_below_poverty_line = models.IntegerField(default=0)
    children_with_disabilities = models.IntegerField(default=0)
    working_children = models.IntegerField(default=0)
    
    # Nutritional data (from health submissions)
    malnourished_children = models.IntegerField(default=0)
    normal_nutrition_children = models.IntegerField(default=0)
    
    # Metadata
    last_updated = models.DateTimeField(auto_now=True)
    data_quality_score = models.FloatField(default=0.0, help_text="0-100 data quality percentage")
    
    class Meta:
        verbose_name_plural = "Barangay Population Metrics"
        constraints = [
            models.UniqueConstraint(fields=['barangay', 'academic_year'], name='unique_barangay_population_per_academic_year')
        ]
        
    def __str__(self):
        year = self.academic_year.name if self.academic_year else 'No AY'
        return f"Population Metrics - {self.barangay.name} ({year})"
    
    @property
    def total_children_0_5(self):
        """Daycare population exposed for coverage reporting."""
        return self.children_3_4 or 0
    
    @property
    def total_school_age_children(self):
        """Total children aged 6-12"""
        return self.children_6_12
    
    @property
    def vulnerable_children_count(self):
        """Children with special needs"""
        return self.children_with_disabilities + self.working_children


class EnrollmentData(models.Model):
    """
    Tracks actual enrollment by barangay and age group.
    Linked to CDCs and children records.
    """
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE, related_name='enrollment_data')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, related_name='enrollment_data', null=True, blank=True)
    
    # Enrollment by age group
    enrolled_0_2 = models.IntegerField(default=0)
    enrolled_3_4 = models.IntegerField(default=0)
    enrolled_6_12 = models.IntegerField(default=0)
    
    # Program specific enrollment
    daycare_enrollment = models.IntegerField(default=0)
    preschool_enrollment = models.IntegerField(default=0)
    school_enrollment = models.IntegerField(default=0)
    feeding_program_enrollment = models.IntegerField(default=0)
    
    # Health programs
    health_checkup_enrollment = models.IntegerField(default=0)
    nutrition_program_enrollment = models.IntegerField(default=0)
    
    # Last updated
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Enrollment Data"
        constraints = [
            models.UniqueConstraint(fields=['barangay', 'academic_year'], name='unique_barangay_enrollment_per_academic_year')
        ]
    
    def __str__(self):
        year = self.academic_year.name if self.academic_year else 'No AY'
        return f"Enrollment - {self.barangay.name} ({year})"
    
    @property
    def total_enrolled_0_5(self):
        return self.enrolled_3_4
    
    @property
    def total_enrolled(self):
        return self.enrolled_3_4 + self.enrolled_6_12


class ChildrenGapAnalysis(models.Model):
    """
    Automatically calculated gaps between population and enrollment.
    Identifies unenrolled children by age group and programs.
    """
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE, related_name='gap_analysis_records')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, related_name='children_gap_analyses', null=True, blank=True)
    
    # Based on latest population and enrollment data
    population_metrics = models.ForeignKey(
        BarangayPopulationMetrics,
        on_delete=models.SET_NULL,
        null=True,
        related_name='gap_analyses'
    )
    enrollment_data = models.ForeignKey(
        EnrollmentData,
        on_delete=models.SET_NULL,
        null=True,
        related_name='gap_analyses'
    )
    
    # Calculated gaps by age group
    gap_0_2 = models.IntegerField(default=0, help_text="Legacy 0-2 gap bucket; hidden from daycare coverage")
    gap_3_4 = models.IntegerField(default=0, help_text="Unenrolled children 3-4")
    gap_6_12 = models.IntegerField(default=0, help_text="Unenrolled children 6-12")
    
    # Program participation gaps
    gap_daycare = models.IntegerField(default=0)
    gap_preschool = models.IntegerField(default=0)
    gap_school = models.IntegerField(default=0)
    gap_health_services = models.IntegerField(default=0)
    gap_feeding_program = models.IntegerField(default=0)
    
    # Vulnerable children gaps
    vulnerable_children_unenrolled = models.IntegerField(default=0)
    working_children_unenrolled = models.IntegerField(default=0)

    # SNP planning basis for early childhood public-service coverage
    population_children_3_4 = models.IntegerField(
        default=0,
        help_text="Reference population of children aged 3-4 in the barangay"
    )
    public_cdc_enrollment_children_3_4 = models.IntegerField(
        default=0,
        help_text="Total children currently enrolled in public CDCs in the barangay"
    )
    public_cdc_gap_children_3_4 = models.IntegerField(
        default=0,
        help_text="Population 3-4 minus public CDC enrollment; this is the public CDC service gap basis for SNP"
    )
    
    # Session-based capacity management (NOT a service gap if managed via multiple sessions)
    enrolled_children_total = models.IntegerField(
        default=0,
        help_text="Total enrolled children across all programs"
    )
    cdc_capacity_per_session = models.IntegerField(
        default=30,
        help_text="CDC capacity per single session"
    )
    sessions_needed_for_enrolled = models.IntegerField(
        default=0,
        help_text="Number of sessions needed to accommodate enrolled children (NOT a gap if sessions are available)"
    )
    cdc_has_service_gap = models.BooleanField(
        default=False,
        help_text="True only if enrolled children exceed what available CDC sessions can handle"
    )
    
    # Analysis metadata
    last_calculated = models.DateTimeField(auto_now=True)
    calculation_method = models.CharField(
        max_length=50,
        default='automated',
        choices=[
            ('automated', 'Automated from data'),
            ('manual', 'Manually adjusted'),
        ]
    )
    
    class Meta:
        verbose_name_plural = "Children Gap Analyses"
        constraints = [
            models.UniqueConstraint(fields=['barangay', 'academic_year'], name='unique_barangay_gap_per_academic_year')
        ]
    
    def __str__(self):
        year = self.academic_year.name if self.academic_year else 'No AY'
        return f"Gap Analysis - {self.barangay.name} ({year})"
    
    @property
    def total_gap_0_5(self):
        """Daycare service gap for children aged 3-4."""
        return self.gap_3_4
    
    @property
    def total_gap_all_ages(self):
        """Total unenrolled children all ages"""
        return self.gap_3_4 + self.gap_6_12

    @property
    def snp_service_gap_basis(self):
        """
        Gap basis for SNP planning.
        This reflects the public CDC coverage gap for children aged 3-4.
        It should not be interpreted as a pure out-of-school count because
        some children may be enrolled in private institutions.
        """
        return self.public_cdc_gap_children_3_4
    
    @property
    def enrollment_rate_0_5(self):
        """Enrollment rate for the daycare planning group."""
        if not self.population_metrics:
            return 0
        total_0_5 = self.population_metrics.total_children_0_5
        if total_0_5 == 0:
            return 0
        enrolled = total_0_5 - self.total_gap_0_5
        return round((enrolled / total_0_5) * 100, 2)

    @property
    def eligible_coverage_rate_3_4(self):
        """CDC coverage rate for the official eligible 3-4 age group."""
        if not self.population_children_3_4:
            return 0
        return round((self.public_cdc_enrollment_children_3_4 / self.population_children_3_4) * 100, 2)
    
    @property
    def enrollment_rate_6_12(self):
        """Enrollment rate for 6-12 age group"""
        if not self.population_metrics:
            return 0
        total_6_12 = self.population_metrics.children_6_12
        if total_6_12 == 0:
            return 0
        enrolled = total_6_12 - self.gap_6_12
        return round((enrolled / total_6_12) * 100, 2)


class SNPPlanningRecommendation(models.Model):
    """
    Automatic SNP (Supervised Neighborhood Play) planning recommendations
    based on population gaps and vulnerable children.
    """
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE, related_name='snp_recommendation_records')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, related_name='snp_recommendations', null=True, blank=True)
    
    # References to analysis data
    gap_analysis = models.ForeignKey(
        ChildrenGapAnalysis,
        on_delete=models.SET_NULL,
        null=True,
        related_name='snp_recommendations'
    )
    
    # Recommended targets
    recommended_snp_enrollment = models.IntegerField(
        default=0,
        help_text="Recommended number of children for SNP program"
    )
    
    # Priority breakdown
    high_priority_children = models.IntegerField(
        default=0,
        help_text="Vulnerable children (disability, malnutrition, working children)"
    )
    medium_priority_children = models.IntegerField(
        default=0,
        help_text="Unenrolled children from low-income families"
    )
    general_enrollment_children = models.IntegerField(
        default=0,
        help_text="General unenrolled children"
    )
    
    # Program recommendations
    recommended_sessions_per_week = models.IntegerField(default=2)
    recommended_hours_per_session = models.IntegerField(default=2)
    estimated_budget_needed = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Resource requirements
    recommended_volunteers = models.IntegerField(default=5)
    recommended_snack_budget = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    recommended_activity_materials_budget = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Rationale
    recommendation_rationale = models.TextField(
        blank=True,
        help_text="Explanation of how this recommendation was calculated"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('recommended', 'Recommended'),
            ('approved', 'Approved by CSWDO'),
            ('implemented', 'Implemented'),
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
        ],
        default='recommended'
    )
    
    # Tracking
    generated_on = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_snp_recommendations'
    )
    
    class Meta:
        verbose_name_plural = "SNP Planning Recommendations"
        constraints = [
            models.UniqueConstraint(fields=['barangay', 'academic_year'], name='unique_barangay_snp_per_academic_year')
        ]
    
    def __str__(self):
        year = self.academic_year.name if self.academic_year else 'No AY'
        return f"SNP Plan - {self.barangay.name} ({year}, {self.recommended_snp_enrollment} children)"
    
    @property
    def total_budget_needed(self):
        """Total estimated budget for SNP program"""
        return self.estimated_budget_needed + self.recommended_snack_budget + self.recommended_activity_materials_budget


class DataIntegrationLog(models.Model):
    """
    Logs all data integration events for audit and debugging.
    Tracks when population data is processed and how it cascades through the system.
    """
    INTEGRATION_TYPES = [
        ('population_submission', 'Population Data Submission'),
        ('enrollment_update', 'Enrollment Data Update'),
        ('health_data_update', 'Health Data Update'),
        ('gap_calculation', 'Gap Analysis Calculation'),
        ('snp_recommendation', 'SNP Recommendation Generation'),
    ]
    
    timestamp = models.DateTimeField(auto_now_add=True)
    integration_type = models.CharField(max_length=50, choices=INTEGRATION_TYPES)
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE, related_name='integration_logs')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, related_name='integration_logs', null=True, blank=True)
    
    # What triggered this integration
    source_submission = models.ForeignKey(
        PopulationDataSubmission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Details of what was processed
    affected_records_count = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=[('success', 'Success'), ('partial', 'Partial'), ('failed', 'Failed')],
        default='success'
    )
    
    # Log message
    message = models.TextField(blank=True)
    
    # Metrics
    processing_time_ms = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.get_integration_type_display()} - {self.barangay.name} ({self.timestamp.date()})"
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name_plural = "Data Integration Logs"
