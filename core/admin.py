from django.contrib import admin
from .models import *

admin.site.register(Barangay)
admin.site.register(CDC)
admin.site.register(Child)
admin.site.register(Report)
admin.site.register(HealthNutrition)
admin.site.register(Sanitation)
admin.site.register(Performance)
admin.site.register(Analytics)
admin.site.register(SNP)
admin.site.register(Budget)
admin.site.register(AcademicYear)
admin.site.register(PopulationDataSubmission)

# Integration system models
admin.site.register(BarangayPopulationMetrics)
admin.site.register(EnrollmentData)
admin.site.register(ChildrenGapAnalysis)
admin.site.register(SNPPlanningRecommendation)
admin.site.register(DataIntegrationLog)
