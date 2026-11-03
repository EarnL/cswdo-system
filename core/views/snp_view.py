from rest_framework import viewsets
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from core.models import SNP
from core.serializers import SNPSerializer
from rest_framework.decorators import action
from rest_framework.response import Response

class SNPViewSet(viewsets.ModelViewSet):
    queryset = SNP.objects.all()
    serializer_class = SNPSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SNP.objects.filter(is_active=True)

    def _ensure_admin(self, request):
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only administrators can manage SNP records.'},
                status=403
            )
        return None

    def _planning_only_response(self):
        return Response(
            {
                'error': (
                    'SNP is now a planning and recommendation feature only. '
                    'Use /integration/snp-recommendations/ for possible children and weekly planning.'
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def create(self, request, *args, **kwargs):
        return self._planning_only_response()

    def update(self, request, *args, **kwargs):
        return self._planning_only_response()

    def partial_update(self, request, *args, **kwargs):
        return self._planning_only_response()

    def destroy(self, request, *args, **kwargs):
        return self._planning_only_response()

    @action(detail=False, methods=['get'])
    def history(self, request):
        queryset = SNP.objects.filter(is_active=False)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
