"""Reporting over saved checklists, without changing historical scores."""
import hashlib
import json
from pathlib import Path

from core.models import SpecialNeedsAssessment

DOMAINS = json.loads(Path(__file__).with_name('special_needs_domains.json').read_text())


def completion(checklist):
    checklist = checklist if isinstance(checklist, dict) else {}
    answered = 0
    total = sum(len(domain['items']) for domain in DOMAINS)
    for domain in DOMAINS:
        items = checklist.get(domain['key'], [])
        items = items if isinstance(items, list) else []
        by_id = {item.get('id'): item for item in items if isinstance(item, dict)}
        for index in range(len(domain['items'])):
            item = by_id.get(f"{domain['key']}_{index + 1}", {})
            answered += item.get('present') in ('present', 'unable')
    return {'answered': answered, 'total': total, 'complete': answered == total}


def build_summary(cdc, quarter, year):
    start_month = (quarter - 1) * 3 + 1
    records = list(SpecialNeedsAssessment.objects.select_related('child').filter(
        cdc=cdc, assessment_date__year=year,
        assessment_date__month__gte=start_month, assessment_date__month__lte=start_month + 2,
    ).order_by('-assessment_date', '-updated_at', '-pk'))
    included, excluded, selected, seen = [], [], [], set()
    counts = dict.fromkeys(dict(SpecialNeedsAssessment.RESULT_CHOICES), 0)
    for item in records:
        progress = completion(item.checklist)
        row = {
            'assessment_id': item.pk, 'id': item.child_id, 'name': item.child.name,
            'age': item.child.age, 'assessment_date': item.assessment_date.isoformat(),
            'assessment_type': item.get_assessment_type_display(),
            'status': item.status, 'result': item.get_result_display(),
            'remarks': item.remarks, **progress,
        }
        if not progress['complete']:
            row['reason'] = 'Incomplete checklist'
        elif item.status != 'submitted':
            row['reason'] = 'Draft - not submitted'
        elif item.child_id in seen:
            row['reason'] = 'Earlier assessment - child already counted'
        else:
            seen.add(item.child_id)
            included.append(row)
            selected.append(item)
            counts[item.result] += 1
            continue
        excluded.append(row)
    fingerprint = hashlib.sha256(json.dumps([
        (item.pk, item.updated_at.isoformat()) for item in records
    ]).encode()).hexdigest()
    return {
        'summary_type': 'special_needs_assessment', 'cdc': cdc.pk, 'cdc_name': cdc.name,
        'quarter': quarter, 'year': year,
        'selection_rule': 'Latest complete, submitted assessment per child in this quarter. Date, then last update, determines the latest record.',
        'counts': counts, 'assessment_ids': [item.pk for item in selected],
        'children': included, 'excluded': excluded,
        'incomplete_count': sum(not row['complete'] for row in excluded),
        'fingerprint': fingerprint,
    }, selected
