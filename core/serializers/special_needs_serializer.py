from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import SpecialNeedsAssessment
from core.services.special_needs_summary import completion


class SpecialNeedsAssessmentSerializer(AssignedCDCSerializer):
    child_name = serializers.CharField(source='child.name', read_only=True)
    child_age = serializers.IntegerField(source='child.age', read_only=True)
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    barangay_name = serializers.CharField(source='cdc.barangay.name', read_only=True)
    assessed_by_name = serializers.CharField(source='assessed_by.username', read_only=True)
    result_label = serializers.CharField(source='get_result_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = SpecialNeedsAssessment
        fields = '__all__'
        read_only_fields = ('assessed_by', 'submitted_on', 'created_at', 'updated_at')

    def validate(self, attrs):
        child = attrs.get('child') or getattr(self.instance, 'child', None)
        cdc = attrs.get('cdc') or getattr(self.instance, 'cdc', None)
        assessment_type = attrs.get('assessment_type') or getattr(self.instance, 'assessment_type', None)
        request = self.context.get('request')
        if request and request.user.role == 'cdw' and cdc and cdc.assigned_cdw_id != request.user.id:
            raise serializers.ValidationError({'cdc': 'You can only assess children from your assigned CDC.'})
        target_status = attrs.get('status', getattr(self.instance, 'status', 'draft'))
        if target_status == 'submitted' and not completion(attrs.get('checklist', getattr(self.instance, 'checklist', {})))['complete']:
            raise serializers.ValidationError({'checklist': 'Answer every checklist item before submitting.'})
        if child and cdc and child.cdc_id != cdc.id:
            raise serializers.ValidationError({'child': 'Selected child does not belong to this CDC.'})
        if child and child.current_status != 'enrolled':
            raise serializers.ValidationError({'child': 'Selected child is not officially enrolled in this CDC.'})
        if child and assessment_type:
            submitted_assessment = SpecialNeedsAssessment.objects.filter(
                child=child,
                assessment_type=assessment_type,
                status='submitted',
            )
            if self.instance:
                submitted_assessment = submitted_assessment.exclude(pk=self.instance.pk)
            if submitted_assessment.exists():
                raise serializers.ValidationError({
                    'child': 'This child already has a submitted record for the selected assessment.',
                })
        return attrs
