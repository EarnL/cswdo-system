from core.permissions import OfficeAnalyticsPermission
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.services.prediction_service import PredictionService


@api_view(['GET'])
@permission_classes([OfficeAnalyticsPermission])
def predictive_analytics_dashboard(request):
    data = PredictionService.generate_predictive_dashboard()
    return Response(data)
