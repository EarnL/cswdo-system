from core.models import CDC, Performance, Report

def _bounded_percent(value):
    return max(0, min(100, value or 0))

def compute_performance_score(cdc: CDC) -> Performance:
    reports = Report.objects.filter(cdc=cdc)
    total_reports = reports.count()

    if total_reports > 0:
        on_time_count = reports.filter(is_on_time=True).count()
        complete_count = reports.filter(is_complete=True).count()
        on_time_score = (on_time_count / total_reports) * 100
        completeness_score = (complete_count / total_reports) * 100
    else:
        on_time_score = 0
        completeness_score = 0

    enrollment_rate = _bounded_percent((cdc.current_enrollment / cdc.max_capacity) * 100 if cdc.max_capacity else 0)
    overall_score = (enrollment_rate * 0.4) + (on_time_score * 0.3) + (completeness_score * 0.3)

    if overall_score >= 90:
        rating = "Outstanding"
        reward = "Gold Support Award"
    elif overall_score >= 80:
        rating = "Very Good"
        reward = "Silver Recognition"
    elif overall_score >= 70:
        rating = "Good"
        reward = "Bronze Commendation"
    elif overall_score >= 60:
        rating = "Needs Improvement"
        reward = "Encouragement Support"
    else:
        rating = "Under Review"
        reward = "No reward"

    perf, created = Performance.objects.update_or_create(
        cdc=cdc,
        defaults={
            "submission_score": on_time_score,
            "completeness_score": completeness_score,
            "performance_score": enrollment_rate,
            "overall_score": overall_score,
            "rating": rating,
            "reward": reward
        }
    )
    return perf
