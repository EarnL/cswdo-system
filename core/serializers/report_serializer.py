from .cdc_access import AssignedCDCSerializer
from rest_framework import serializers
from core.models import Report
from core.services.reminder_service import ReminderService

class ReportSerializer(AssignedCDCSerializer):
    cdc_name = serializers.CharField(source='cdc.name', read_only=True)
    barangay_name = serializers.CharField(source='cdc.barangay.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, allow_null=True)
    submitted_by_name = serializers.CharField(source='submitted_by.username', read_only=True)
    report_type_label = serializers.CharField(source='get_report_type_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    staff_reviewed_by_name = serializers.CharField(source='staff_reviewed_by.username', read_only=True)
    admin_reviewed_by_name = serializers.CharField(source='admin_reviewed_by.username', read_only=True)
    attachment_url = serializers.SerializerMethodField()
    attachment_name = serializers.SerializerMethodField()
    pdf_attachment_url = serializers.SerializerMethodField()
    pdf_attachment_name = serializers.SerializerMethodField()
    deadline_date = serializers.SerializerMethodField()
    days_until_deadline = serializers.SerializerMethodField()
    submission_status = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = '__all__'
        read_only_fields = (
            'submitted_by',
            'submitted_on',
            'status',
            'review_remarks',
            'staff_reviewed_by',
            'staff_reviewed_on',
            'admin_reviewed_by',
            'admin_reviewed_on',
        )

    def get_attachment_url(self, obj):
        request = self.context.get('request')
        if not obj.attachment:
            return ''
        url = obj.attachment.url
        return request.build_absolute_uri(url) if request else url

    def get_attachment_name(self, obj):
        if not obj.attachment:
            return ''
        return obj.attachment.name.split('/')[-1]

    def get_pdf_attachment_url(self, obj):
        request = self.context.get('request')
        if not obj.pdf_attachment:
            return ''
        url = obj.pdf_attachment.url
        return request.build_absolute_uri(url) if request else url

    def get_pdf_attachment_name(self, obj):
        if not obj.pdf_attachment:
            return ''
        return obj.pdf_attachment.name.split('/')[-1]

    def get_deadline_date(self, obj):
        return ReminderService.get_due_date(obj.year, obj.quarter).isoformat()

    def get_days_until_deadline(self, obj):
        due_date = ReminderService.get_due_date(obj.year, obj.quarter)
        submitted_date = obj.submitted_on.date() if obj.submitted_on else due_date
        return (due_date - submitted_date).days

    def get_submission_status(self, obj):
        if obj.status:
            return obj.get_status_display()

        due_date = ReminderService.get_due_date(obj.year, obj.quarter)
        if obj.submitted_on and obj.submitted_on.date() > due_date:
            return 'Late'
        if obj.is_complete:
            return 'Complete'
        return 'In Progress'
