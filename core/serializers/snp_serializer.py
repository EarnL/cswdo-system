from rest_framework import serializers
from core.models import AcademicYear, Child, SNP
from core.services.data_integration_service import DataIntegrationService

class SNPSerializer(serializers.ModelSerializer):
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    barangay_population = serializers.SerializerMethodField()
    current_enrollment = serializers.SerializerMethodField()
    remaining_children = serializers.SerializerMethodField()
    public_cdc_gap_basis = serializers.SerializerMethodField()
    planning_note = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    deleted_at = serializers.DateTimeField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = SNP
        fields = '__all__'

    def get_current_enrollment(self, obj):
        academic_year = AcademicYear.get_current()
        gap = DataIntegrationService.get_current_gap_analysis(obj.barangay, academic_year)
        if gap:
            return gap.public_cdc_enrollment_children_3_4
        return Child.objects.filter(
            barangay=obj.barangay,
            academic_year=academic_year,
            cdc__isnull=False,
            current_status='enrolled',
        ).count()

    def get_barangay_population(self, obj):
        gap = DataIntegrationService.get_current_gap_analysis(obj.barangay, AcademicYear.get_current())
        return gap.population_children_3_4 if gap else 0

    def get_status(self, obj):
        return 'Active' if obj.is_active else 'Archived'

    def get_remaining_children(self, obj):
        population = self.get_barangay_population(obj)
        enrolled = self.get_current_enrollment(obj)
        if obj.estimated_unenrolled_children is not None:
            return obj.estimated_unenrolled_children
        return max(population - enrolled, 0)

    def get_public_cdc_gap_basis(self, obj):
        gap = DataIntegrationService.get_current_gap_analysis(obj.barangay, AcademicYear.get_current())
        return gap.public_cdc_gap_children_3_4 if gap else self.get_remaining_children(obj)

    def get_planning_note(self, obj):
        return (
            'This gap compares barangay population ages 3-4 with public CDC enrollment only. '
            'Some children in the gap may already be enrolled in private institutions.'
        )
