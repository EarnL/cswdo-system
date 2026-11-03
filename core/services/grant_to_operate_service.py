from django.utils import timezone
from core.services.preopening_service import preparation_summary


class GrantToOperateService:
    @staticmethod
    def get_status(cdc):
        today = timezone.localdate()
        latest_request = cdc.accreditation_requests.first()
        latest_authority = cdc.authority_documents.filter(document_type='authority_to_operate').first()
        latest_permit = cdc.permit_records.first()

        has_approved_request = bool(latest_request and latest_request.status == 'approved')
        has_valid_license = bool(cdc.license_number and cdc.license_expiry_date and cdc.license_expiry_date >= today)
        has_valid_authority = bool(
            latest_authority
            and (not latest_authority.expires_on or latest_authority.expires_on >= today)
        )
        has_active_permit = bool(latest_permit and latest_permit.is_active)
        has_valid_grant = bool(
            cdc.is_accredited
            and cdc.accreditation_status == 'accredited'
            and has_valid_license
        )

        requirement_steps = preparation_summary(cdc)['groups']
        missing = [item['label'] for item in requirement_steps if not item['done']]
        completed_count = sum(1 for item in requirement_steps if item['done'])
        requirements_complete = completed_count == len(requirement_steps)
        readiness_percent = round((completed_count / len(requirement_steps)) * 100, 1)

        if has_valid_grant:
            stage = 'operating'
            label = 'Grant to Operate active'
            next_step = 'Operate normally and keep records updated.'
            current_actions = ['Use operating features', 'Keep records current', 'Monitor Grant expiry']
        elif latest_request:
            stage = latest_request.status
            label = latest_request.get_status_display()
            if latest_request.status in ['pending_review', 'under_evaluation', 'evaluated_by_staff', 'forwarded_to_admin']:
                next_step = 'Wait for CSWDO review.'
                current_actions = ['Check notices', 'Keep documents updated']
            elif latest_request.status == 'needs_revision':
                next_step = 'Update returned requirements.'
                current_actions = ['Read CSWDO remarks', 'Fix missing items', 'Resubmit request']
            elif latest_request.status == 'rejected':
                next_step = 'Address rejection remarks.'
                current_actions = ['Review decision', 'Update requirements', 'Submit a new request']
            elif latest_request.status == 'not_yet_eligible':
                next_step = 'Complete remaining requirements.'
                current_actions = ['Finish missing items', 'Request evaluation again']
            else:
                next_step = 'Complete requirements and submit for review.'
                current_actions = ['Finish missing items', 'Submit request']
        elif requirements_complete:
            stage = 'ready_to_request'
            label = 'Ready to request Grant'
            next_step = 'Submit the accreditation request.'
            current_actions = ['Open Accreditation', 'Submit request']
        else:
            stage = 'pre_grant'
            label = 'Grant to Operate not yet issued'
            next_step = 'Complete missing requirements first.'
            current_actions = ['Update CDC profile', 'Upload requirements', 'Finish missing records']

        allowed_features = [
            'Dashboard',
            'CDC Information',
            'CDC Papers',
            'Accreditation',
            'Notifications',
            'Profile',
        ]
        restricted_features = [
            'Student Profiles',
            'Enrollment',
            'Monitoring Reports',
            'CDC Reports',
            'Regular Programs',
            'Curriculum Implementation',
            'Special Needs Assessments',
        ]
        if has_valid_grant:
            allowed_features += restricted_features
            restricted_features = []

        return {
            'has_valid_grant': has_valid_grant,
            'stage': stage,
            'label': label,
            'next_step': next_step,
            'current_actions': current_actions,
            'requirement_steps': requirement_steps,
            'requirements_complete': requirements_complete,
            'readiness_percent': readiness_percent,
            'missing_requirements': missing if not has_valid_grant else [],
            'allowed_features': allowed_features,
            'restricted_features': restricted_features,
            'license_number': cdc.license_number or '',
            'grant_issued_on': cdc.accreditation_date.isoformat() if cdc.accreditation_date else '',
            'grant_expires_on': cdc.license_expiry_date.isoformat() if cdc.license_expiry_date else '',
            'latest_request_id': latest_request.id if latest_request else None,
            'latest_request_status': latest_request.status if latest_request else '',
        }

    @staticmethod
    def has_valid_grant(cdc):
        return GrantToOperateService.get_status(cdc)['has_valid_grant']

    @staticmethod
    def cdw_operating_error(cdc):
        status = GrantToOperateService.get_status(cdc)
        if status['has_valid_grant']:
            return ''
        return (
            'This CDC does not have an active Grant to Operate yet. '
            'Complete the accreditation requirements before using operating features.'
        )
