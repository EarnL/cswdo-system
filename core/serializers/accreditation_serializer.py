from rest_framework import serializers

from core.accreditation_checklist import get_accreditation_checklist
from core.models import AccreditationRequest


def compute_checklist_scores(answers, checklist=None, passing_percentage=75):
    checklist = checklist or get_accreditation_checklist()
    answers = answers or {}
    total_score = 0
    max_score = float(checklist.get('total_max_score') or 0)
    sections_needing_improvement = []
    area_results = []

    for section in checklist['sections']:
        section_score = 0
        computed_section_max = sum(float(item.get('points') or 0) for item in section.get('items', []))
        section_max = float(section.get('max_score') or computed_section_max or 0)
        minimum_score = float(section.get('minimum_score') or (section_max * passing_percentage / 100))
        for item in section['items']:
            points = float(item.get('points') or 0)
            value = (answers.get(item['id']) or {}).get('compliance', '')
            if value in ['yes', 'na']:
                total_score += points
                section_score += points
        section_percentage = (section_score / section_max * 100) if section_max else 0
        area_status = 'Complied With Requirements' if section_score >= minimum_score else 'Not Complied With Requirements'
        area_results.append({
            'id': section['id'],
            'title': section['title'],
            'score': round(section_score, 2),
            'max_score': round(section_max, 2),
            'minimum_score': round(minimum_score, 2),
            'percentage': round(section_percentage, 1),
            'rating': area_status,
        })
        if area_status != 'Complied With Requirements':
            sections_needing_improvement.append({
                'id': section['id'],
                'title': section['title'],
                'percentage': round(section_percentage, 1),
            })

    if not max_score:
        max_score = sum(
            float(section.get('max_score') or sum(float(item.get('points') or 0) for item in section.get('items', [])) or 0)
            for section in checklist['sections']
        )
    percentage = (total_score / max_score * 100) if max_score else 0
    eligible = percentage >= passing_percentage and not sections_needing_improvement
    if not eligible:
        recognition = 'Not Yet Eligible'
    elif total_score >= 201:
        recognition = 'Level 3 Recognition - Outstanding Rating'
    elif total_score >= 180:
        recognition = 'Level 2 Recognition - Very Satisfactory Rating'
    else:
        recognition = 'Level 1 Recognition - Satisfactory Rating'
    return {
        'total_score': round(total_score, 2),
        'max_score': round(max_score, 2),
        'percentage': round(percentage, 2),
        'eligibility_result': recognition,
        'sections_needing_improvement': sections_needing_improvement,
        'area_results': area_results,
    }


class AccreditationRequestSerializer(serializers.ModelSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    cdc_address = serializers.CharField(source='cdc.address', read_only=True)
    barangay_name = serializers.CharField(source='cdc.barangay.name', read_only=True)
    certificate_number = serializers.CharField(source='cdc.license_number', read_only=True)
    grant_issued_on = serializers.DateField(source='cdc.accreditation_date', read_only=True)
    grant_expires_on = serializers.DateField(source='cdc.license_expiry_date', read_only=True)
    cdw_name = serializers.CharField(source='requested_by.username', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.username', read_only=True)
    staff_evaluator_name = serializers.CharField(source='staff_evaluator.username', read_only=True)
    admin_approver_name = serializers.CharField(source='admin_approver.username', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AccreditationRequest
        fields = '__all__'
        read_only_fields = (
            'requested_by',
            'staff_evaluator',
            'admin_approver',
            'total_score',
            'max_score',
            'percentage',
            'eligibility_result',
            'sections_needing_improvement',
            'requested_at',
            'created_at',
            'updated_at',
            'staff_evaluated_at',
            'final_decision_at',
        )
