from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import AcademicYear
from core.serializers.academic_year_serializer import AcademicYearSerializer
from core.permissions import PlanningReadOnlyAuthenticated


class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [PlanningReadOnlyAuthenticated]

    @action(detail=False, methods=['get'])
    def current(self, request):
        from core.models import CDC
        from core.services.population_basis_service import working_year
        cdc = CDC.objects.filter(assigned_cdw=request.user).first() if request.user.role == 'cdw' else None
        serializer = self.get_serializer(working_year(cdc) if cdc else AcademicYear.get_current())
        return Response(serializer.data)
