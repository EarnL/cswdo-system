from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers

from core.models import ChildAssessmentRecord, CurriculumDistribution, CurriculumGuide, CurriculumPlan, StaffSchedule


class CurriculumGuideSerializer(AssignedCDCSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    attachment_url = serializers.SerializerMethodField()
    attachment_name = serializers.SerializerMethodField()

    class Meta:
        model = CurriculumGuide
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at')

    def get_attachment_url(self, obj):
        request = self.context.get('request')
        if not obj.attachment:
            return ''
        return request.build_absolute_uri(obj.attachment.url) if request else obj.attachment.url

    def get_attachment_name(self, obj):
        if not obj.attachment:
            return ''
        return obj.attachment.name.split('/')[-1]

    def validate(self, attrs):
        attachment = attrs.get('attachment') or getattr(self.instance, 'attachment', None)
        if not attachment:
            raise serializers.ValidationError({
                'attachment': 'Attach the official Curriculum Guide document before sending it to CDCs.',
            })
        return attrs


class CurriculumDistributionSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    barangay_name = serializers.CharField(source='cdc.barangay.name', read_only=True)
    assigned_cdw_name = serializers.CharField(source='cdc.assigned_cdw.username', read_only=True)
    sent_by_name = serializers.CharField(source='sent_by.username', read_only=True)
    grant_issued_on = serializers.DateField(source='cdc.accreditation_date', read_only=True)
    grant_expires_on = serializers.DateField(source='cdc.license_expiry_date', read_only=True)

    class Meta:
        model = CurriculumDistribution
        fields = '__all__'
        read_only_fields = ('sent_by', 'sent_at')


class CurriculumPlanSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    barangay_name = serializers.CharField(source='cdc.barangay.name', read_only=True)
    guide_title = serializers.CharField(source='guide.title', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    evidence_attachment_url = serializers.SerializerMethodField()
    evidence_attachment_name = serializers.SerializerMethodField()

    class Meta:
        model = CurriculumPlan
        fields = '__all__'
        read_only_fields = (
            'recorded_by',
            'status',
            'review_remarks',
            'submitted_on',
            'reviewed_by',
            'reviewed_on',
            'created_at',
            'updated_at',
        )

    def get_evidence_attachment_url(self, obj):
        request = self.context.get('request')
        if not obj.evidence_attachment:
            return ''
        return request.build_absolute_uri(obj.evidence_attachment.url) if request else obj.evidence_attachment.url

    def get_evidence_attachment_name(self, obj):
        if not obj.evidence_attachment:
            return ''
        return obj.evidence_attachment.name.split('/')[-1]


class ChildAssessmentRecordSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    child_name = serializers.CharField(source='child.name', read_only=True)
    assessed_by_name = serializers.CharField(source='assessed_by.username', read_only=True)

    class Meta:
        model = ChildAssessmentRecord
        fields = '__all__'
        read_only_fields = ('assessed_by', 'created_at', 'updated_at')

    def validate(self, attrs):
        child = attrs.get('child') or getattr(self.instance, 'child', None)
        cdc = attrs.get('cdc') or getattr(self.instance, 'cdc', None)

        if child and cdc and child.cdc_id != cdc.id:
            raise serializers.ValidationError({
                'child': 'Selected child does not belong to this CDC.',
            })

        return attrs


class StaffScheduleSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    ratio_summary = serializers.SerializerMethodField()

    class Meta:
        model = StaffSchedule
        fields = '__all__'
        read_only_fields = ('recorded_by', 'created_at', 'updated_at', 'ratio_summary')

    def get_ratio_summary(self, obj):
        children_per_teacher = None
        if obj.teacher_count > 0:
            children_per_teacher = round(obj.cdc.current_enrollment / obj.teacher_count, 1)

        ratio_compliant = False
        if obj.cdc.current_enrollment == 0:
            ratio_compliant = True
        elif obj.teacher_count > 0 and obj.cdc.current_enrollment <= obj.teacher_count * 10:
            ratio_compliant = True
        elif obj.teacher_count > 0 and obj.assistant_count > 0 and obj.cdc.current_enrollment <= obj.teacher_count * 25:
            ratio_compliant = True

        return {
            'children_per_teacher': children_per_teacher,
            'ratio_compliant': ratio_compliant,
        }
