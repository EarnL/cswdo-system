from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from core.models import CDC
from core.services.analytics_service import compute_performance_score
from core.permissions import IsCSWDOManager

@api_view(['POST'])
@permission_classes([IsCSWDOManager])
def compute_all_performance(request):
    cdcs = CDC.objects.all()
    results = []

    for cdc in cdcs:
        perf = compute_performance_score(cdc)
        results.append({
            "cdc": cdc.name,
            "score": perf.overall_score,
            "rating": perf.rating,
            "reward": perf.reward,
            "on_time_score": perf.submission_score,
            "completeness_score": perf.completeness_score,
            "enrollment_score": perf.performance_score,
        })

    return Response(results)
