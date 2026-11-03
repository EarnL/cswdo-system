from typing import Any, Dict, List

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q

from core.models import AccreditationRequest, CDC, CurriculumDistribution, FeedingProgram, Notification, PopulationDataSubmission, Report
from core.services.feeding_program_service import FeedingProgramService


class NotificationService:
    @classmethod
    def upsert_notification(cls, user, source_key: str, title: str, message: str, priority: str, category: str, link: str) -> Notification:
        notification, created = Notification.objects.get_or_create(
            user=user,
            source_key=source_key,
            defaults={
                'title': title,
                'message': message,
                'priority': priority,
                'category': category,
                'link': link,
                'is_active': True,
                'is_read': False,
                'read_at': None,
            },
        )
        if not created:
            notification.title = title
            notification.message = message
            notification.priority = priority
            notification.category = category
            notification.link = link
            notification.is_active = True
            notification.is_read = False
            notification.read_at = None
            notification.save(update_fields=['title', 'message', 'priority', 'category', 'link', 'is_active', 'is_read', 'read_at', 'last_seen_at'])
        return notification

    @classmethod
    def notify_accreditation_request_submitted(cls, accreditation_request: AccreditationRequest) -> None:
        User = get_user_model()
        cdc_name = accreditation_request.cdc.name
        for user in User.objects.filter(role='staff', is_active=True):
            cls.upsert_notification(
                user,
                f'accreditation_request_{accreditation_request.id}_staff_review',
                'New Accreditation Request',
                f'{cdc_name} was submitted by a CDW and needs staff review.',
                'high',
                'accreditation',
                '/staff/accreditation',
            )

    @classmethod
    def notify_accreditation_forwarded_to_admin(cls, accreditation_request: AccreditationRequest) -> None:
        User = get_user_model()
        cdc_name = accreditation_request.cdc.name
        for user in User.objects.filter(role='admin', is_active=True):
            cls.upsert_notification(
                user,
                f'accreditation_request_{accreditation_request.id}_admin_approval',
                'Accreditation Forwarded',
                f'{cdc_name} was evaluated by staff and is ready for final admin decision.',
                'high',
                'accreditation',
                '/admin/accreditation',
            )

    @classmethod
    def notify_accreditation_returned_to_cdw(cls, accreditation_request: AccreditationRequest) -> None:
        if not accreditation_request.cdc.assigned_cdw:
            return
        cls.upsert_notification(
            accreditation_request.cdc.assigned_cdw,
            f'accreditation_request_{accreditation_request.id}_cdw_action',
            'Accreditation Needs Action',
            f'{accreditation_request.cdc.name} was returned for revision or follow-up.',
            'high',
            'accreditation',
            '/cdw/accreditation',
        )

    @classmethod
    def notify_accreditation_decided(cls, accreditation_request: AccreditationRequest) -> None:
        if not accreditation_request.cdc.assigned_cdw:
            return
        title = 'Accreditation Approved' if accreditation_request.status == 'approved' else 'Accreditation Rejected'
        message = (
            f'{accreditation_request.cdc.name} has been accredited by CSWDO Admin.'
            if accreditation_request.status == 'approved'
            else f'{accreditation_request.cdc.name} accreditation was rejected by CSWDO Admin.'
        )
        cls.upsert_notification(
            accreditation_request.cdc.assigned_cdw,
            f'accreditation_request_{accreditation_request.id}_cdw_decision',
            title,
            message,
            'high' if accreditation_request.status == 'rejected' else 'medium',
            'accreditation',
            '/cdw/accreditation',
        )

    @classmethod
    def sync_user_notifications(cls, user) -> None:
        if user.role in ['cho', 'admin', 'staff', 'planning', 'city_planning']:
            from core.services.population_request_service import process_schedules, process_reminders
            process_schedules()
            process_reminders()
        generated = cls._build_generated_notifications(user)
        active_keys = set()

        for item in generated:
            source_key = item['source_key']
            active_keys.add(source_key)
            notification, created = Notification.objects.get_or_create(
                user=user,
                source_key=source_key,
                defaults={
                    'title': item['title'],
                    'message': item['message'],
                    'priority': item['priority'],
                    'category': item['category'],
                    'link': item['link'],
                    'is_active': True,
                },
            )

            changed = False
            for field in ['title', 'message', 'priority', 'category', 'link']:
                if getattr(notification, field) != item[field]:
                    setattr(notification, field, item[field])
                    changed = True
            if not notification.is_active:
                notification.is_active = True
                changed = True
            if changed:
                notification.save()

        Notification.objects.filter(user=user, is_active=True).exclude(source_key__in=active_keys).exclude(source_key__startswith='accreditation_request_').exclude(source_key__startswith='population_request_').exclude(source_key__startswith='population_basis_').update(is_active=False)

    @classmethod
    def visible_notifications(cls, user):
        queryset = Notification.objects.filter(user=user)
        if user.role != 'cdw':
            return queryset
        scope = Q(source_key__in=[item['source_key'] for item in cls._build_generated_notifications(user)])
        for cdc_id in CDC.objects.filter(assigned_cdw=user).values_list('pk', flat=True):
            scope |= Q(source_key__startswith=f'population_basis_{cdc_id}_')
        for request_id in AccreditationRequest.objects.filter(cdc__assigned_cdw=user).values_list('pk', flat=True):
            scope |= Q(source_key__startswith=f'accreditation_request_{request_id}_')
        return queryset.filter(scope)

    @classmethod
    def get_notification_summary(cls, user) -> Dict[str, Any]:
        cls.sync_user_notifications(user)
        queryset = cls.visible_notifications(user).filter(is_active=True).order_by('is_read', '-created_at')
        return {
            'total': queryset.count(),
            'unread_count': queryset.filter(is_read=False).count(),
            'notifications': list(queryset[:8].values(
                'id', 'source_key', 'title', 'message', 'priority', 'category', 'link', 'is_read', 'is_active', 'read_at', 'created_at'
            )),
        }

    @classmethod
    def get_notification_list(cls, user, status_filter: str = 'all', category: str = ''):
        cls.sync_user_notifications(user)
        queryset = cls.visible_notifications(user).order_by('is_read', '-created_at')

        if status_filter == 'unread':
            queryset = queryset.filter(is_read=False, is_active=True)
        elif status_filter == 'read':
            queryset = queryset.filter(is_read=True)
        elif status_filter == 'active':
            queryset = queryset.filter(is_active=True)

        if category:
            queryset = queryset.filter(category=category)

        return queryset

    @classmethod
    def mark_read(cls, notification: Notification) -> Notification:
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=['is_read', 'read_at'])
        return notification

    @classmethod
    def mark_unread(cls, notification: Notification) -> Notification:
        notification.is_read = False
        notification.read_at = None
        notification.save(update_fields=['is_read', 'read_at'])
        return notification

    @classmethod
    def mark_all_read(cls, user) -> int:
        return Notification.objects.filter(user=user, is_read=False).update(is_read=True, read_at=timezone.now())

    @classmethod
    def _build_notification(cls, source_key: str, title: str, message: str, priority: str, category: str, link: str) -> Dict[str, Any]:
        return {
            'source_key': source_key,
            'title': title,
            'message': message,
            'priority': priority,
            'category': category,
            'link': link,
        }

    @classmethod
    def _build_generated_notifications(cls, user) -> List[Dict[str, Any]]:
        if user.role in ['admin', 'staff']:
            return cls._get_cswdo_notifications(user)
        if user.role in ['planning', 'city_planning']:
            return cls._get_planning_notifications()
        if user.role == 'cho':
            return cls._get_cho_notifications(user)
        if user.role == 'cdw':
            return cls._get_cdw_notifications(user)
        return []

    @classmethod
    def _get_cswdo_link(cls, user, admin_link: str) -> str:
        if user.role != 'staff':
            return admin_link

        staff_links = {
            '/admin/population-data': '/staff/population-data',
            '/admin/accreditation': '/staff/accreditation',
            '/admin/regular-programs': '/staff/regular-programs',
            '/admin/reports': '/staff/reports',
        }
        return staff_links.get(admin_link, '/staff')

    @classmethod
    def _get_cswdo_notifications(cls, user) -> List[Dict[str, Any]]:
        notifications = []

        if user.role == 'staff':
            report_queue = Report.objects.filter(status__in=['submitted', 'under_review']).count()
            if report_queue:
                notifications.append(cls._build_notification(
                    'staff_report_validation_queue',
                    'Reports Under Review',
                    f'{report_queue} CDW monitoring report(s) are waiting for Staff decision.',
                    'high',
                    'reports',
                    '/staff/reports',
                ))

            accredited_without_lrps = CDC.objects.filter(
                is_accredited=True,
                accreditation_status='accredited',
                license_expiry_date__gte=timezone.localdate(),
                curriculum_distribution__isnull=True,
            ).count()
            if accredited_without_lrps:
                notifications.append(cls._build_notification(
                    'staff_curriculum_distribution_needed',
                    'Curriculum Guides Needed',
                    f'{accredited_without_lrps} accredited CDC(s) need official Learning Resource Packages.',
                    'medium',
                    'curriculum',
                    '/staff/curriculum-assessment',
                ))

        if user.role == 'admin':
            approved_reports = Report.objects.filter(status='approved').count()
            if approved_reports:
                notifications.append(cls._build_notification(
                    'admin_reports_approved_available',
                    'Approved Reports Available',
                    f'{approved_reports} approved monitoring report(s) are available for review.',
                    'low',
                    'reports',
                    '/admin/reports',
                ))

        pending_population = PopulationDataSubmission.objects.filter(status='sent_to_cswdo').count()
        if user.role == 'admin' and pending_population:
            notifications.append(cls._build_notification(
                'cswdo_population_waiting',
                'Population Files Waiting',
                f'{pending_population} population file(s) were forwarded by City Planning and are waiting for Admin review.',
                'high',
                'population',
                '/admin/population-data',
            ))

        pending_accreditation = AccreditationRequest.objects.filter(status__in=['pending_review', 'under_evaluation']).count()
        if user.role == 'staff' and pending_accreditation:
            notifications.append(cls._build_notification(
                'cswdo_accreditation_queue',
                'Accreditation Queue',
                f'{pending_accreditation} accreditation request(s) need staff review.',
                'high',
                'accreditation',
                '/staff/accreditation',
            ))

        admin_accreditation = AccreditationRequest.objects.filter(status='forwarded_to_admin').count()
        if user.role == 'admin' and admin_accreditation:
            notifications.append(cls._build_notification(
                'admin_accreditation_for_approval',
                'Accreditation for Final Approval',
                f'{admin_accreditation} evaluated accreditation request(s) are waiting for final decision.',
                'high',
                'accreditation',
                '/admin/accreditation',
            ))

        feeding_summary = FeedingProgramService().get_monitoring_summary()
        feeding_link = '/staff/regular-programs' if user.role == 'staff' else '/admin/programs/feeding'

        if feeding_summary['summary']['total_missed_days'] > 0:
            notifications.append(cls._build_notification(
                'cswdo_missed_feeding_days',
                'Missed Feeding Days',
                f"{feeding_summary['summary']['total_missed_days']} feeding day(s) were missed across active programs.",
                'high',
                'feeding',
                feeding_link,
            ))

        if feeding_summary['watchlist']:
            notifications.append(cls._build_notification(
                'cswdo_feeding_watchlist',
                'Feeding Watchlist',
                f"{len(feeding_summary['watchlist'])} feeding program(s) need attention or are nearing completion.",
                'medium',
                'feeding',
                feeding_link,
            ))

        recent_reports = Report.objects.order_by('-submitted_on')[:3]
        if recent_reports:
            notifications.append(cls._build_notification(
                'cswdo_recent_reports',
                'Recent Report Activity',
                f'{recent_reports.count()} recent report submission(s) were recorded.',
                'low',
                'reports',
                cls._get_cswdo_link(user, '/admin/reports'),
            ))

        return notifications

    @classmethod
    def _get_planning_notifications(cls) -> List[Dict[str, Any]]:
        notifications = []

        submitted = PopulationDataSubmission.objects.filter(status__in=['submitted', 'revised_by_cho']).count()
        if submitted:
            notifications.append(cls._build_notification(
                'planning_submitted_population',
                'New CHO Uploads',
                f'{submitted} new or revised population file(s) are waiting for Planning review.',
                'high',
                'population',
                '/planning',
            ))

        received = PopulationDataSubmission.objects.filter(status__in=['received', 'under_planning_review']).count()
        if received:
            notifications.append(cls._build_notification(
                'planning_ready_to_send',
                'Population Files Under Review',
                f'{received} population file(s) need an accuracy and completeness review before approval.',
                'medium',
                'population',
                '/planning',
            ))

        return notifications

    @classmethod
    def _get_cho_notifications(cls, user) -> List[Dict[str, Any]]:
        notifications = []

        own_uploads = PopulationDataSubmission.objects.filter(submitted_by=user, data_request__isnull=True).order_by('-submitted_on')
        returned = own_uploads.filter(status='returned_to_cho').count()
        if returned:
            notifications.append(cls._build_notification(
                'cho_population_needs_revision',
                'Population Data Needs Revision',
                f'{returned} population file(s) were returned by City Planning. Review the remarks and resubmit the corrected file.',
                'high',
                'population',
                '/cho/submissions/earlier',
            ))

        pending_review = own_uploads.filter(status__in=['submitted', 'revised_by_cho']).count()
        if pending_review:
            notifications.append(cls._build_notification(
                'cho_pending_review',
                'Uploads Pending Review',
                f'{pending_review} of your submitted file(s) are still waiting for Planning review.',
                'medium',
                'population',
                '/cho/submissions/earlier',
            ))

        forwarded = own_uploads.filter(status__in=['sent_to_cswdo', 'received_by_cswdo', 'current_basis', 'archived']).count()
        if forwarded:
            notifications.append(cls._build_notification(
                'cho_forwarded_uploads',
                'Uploads Forwarded',
                f'{forwarded} of your file(s) already moved forward in the workflow.',
                'low',
                'population',
                '/cho/submissions/earlier',
            ))

        return notifications

    @classmethod
    def _get_cdw_notifications(cls, user) -> List[Dict[str, Any]]:
        notifications = []

        assigned_cdcs = CDC.objects.filter(assigned_cdw=user)
        if not assigned_cdcs.exists():
            notifications.append(cls._build_notification(
                'cdw_missing_assignment',
                'No Assigned CDC',
                'Your account does not yet have an assigned CDC. Contact the administrator.',
                'high',
                'assignment',
                '/cdw/profile',
            ))
            return notifications

        assigned_ids = list(assigned_cdcs.values_list('id', flat=True))
        assigned_names = list(assigned_cdcs.values_list('name', flat=True))

        under_review = AccreditationRequest.objects.filter(cdc_id__in=assigned_ids, status__in=['pending_review', 'under_evaluation', 'forwarded_to_admin']).count()
        if under_review:
            notifications.append(cls._build_notification(
                'cdw_accreditation_followup',
                'Accreditation Follow-up',
                f'{under_review} assigned CDC record(s) need accreditation follow-up.',
                'medium',
                'accreditation',
                '/cdw/accreditation',
            ))

        needs_action = AccreditationRequest.objects.filter(cdc_id__in=assigned_ids, status__in=['needs_revision', 'not_yet_eligible', 'rejected']).count()
        if needs_action:
            notifications.append(cls._build_notification(
                'cdw_accreditation_action_needed',
                'Accreditation Needs Action',
                f'{needs_action} accreditation request(s) need revision, improvement, or follow-up.',
                'high',
                'accreditation',
                '/cdw/accreditation',
            ))

        if FeedingProgram.objects.filter(cdc_id__in=assigned_ids).exists():
            feeding_summary = FeedingProgramService().get_monitoring_summary()
            own_watchlist = [item for item in feeding_summary['watchlist'] if item['cdc_name'] in assigned_names]
            if own_watchlist:
                notifications.append(cls._build_notification(
                    'cdw_feeding_alert',
                    'Feeding Program Alert',
                    f'{len(own_watchlist)} of your feeding program(s) need attention.',
                    'high',
                    'feeding',
                    '/cdw/regular-programs',
                ))

        distributed_count = CurriculumDistribution.objects.filter(cdc_id__in=assigned_ids).count()
        if distributed_count:
            notifications.append(cls._build_notification(
                'cdw_curriculum_guides_available',
                'Curriculum Guides Available',
                f'Official Learning Resource Packages are available for {distributed_count} assigned CDC(s).',
                'medium',
                'curriculum',
                '/cdw/curriculum-assessment',
            ))

        recent_reports = Report.objects.filter(cdc__assigned_cdw=user).count()
        notifications.append(cls._build_notification(
            'cdw_report_history',
            'Report History',
            f'You have {recent_reports} submitted report file(s) in your account.',
            'low',
            'reports',
            '/cdw/reports',
        ))

        revision_queryset = Report.objects.filter(cdc__assigned_cdw=user, status='needs_revision').order_by('-staff_reviewed_on', '-submitted_on')
        revision_reports = revision_queryset.count()
        if revision_reports:
            latest_revision = revision_queryset.first()
            revision_comment = latest_revision.review_remarks if latest_revision and latest_revision.review_remarks else 'Please check the staff remarks and submit a corrected version.'
            notifications.append(cls._build_notification(
                'cdw_reports_need_revision',
                'Reports Need Revision',
                f'{revision_reports} report(s) returned. Comment: {revision_comment}',
                'high',
                'reports',
                '/cdw/reports',
            ))

        under_review_reports = Report.objects.filter(cdc__assigned_cdw=user, status='under_review').count()
        if under_review_reports:
            notifications.append(cls._build_notification(
                'cdw_reports_under_review',
                'Reports Under Review',
                f'{under_review_reports} submitted report(s) are being checked by CSWDO staff.',
                'medium',
                'reports',
                '/cdw/reports',
            ))

        approved_reports = Report.objects.filter(cdc__assigned_cdw=user, status='approved').count()
        if approved_reports:
            notifications.append(cls._build_notification(
                'cdw_reports_approved',
                'Reports Approved',
                f'{approved_reports} submitted report(s) were reviewed and approved.',
                'low',
                'reports',
                '/cdw/reports',
            ))

        rejected_queryset = Report.objects.filter(cdc__assigned_cdw=user, status='rejected').order_by('-admin_reviewed_on', '-submitted_on')
        rejected_reports = rejected_queryset.count()
        if rejected_reports:
            latest_rejected = rejected_queryset.first()
            rejected_comment = latest_rejected.review_remarks if latest_rejected and latest_rejected.review_remarks else 'Please check the final review remarks and submit a corrected version if needed.'
            notifications.append(cls._build_notification(
                'cdw_reports_rejected',
                'Reports Rejected',
                f'{rejected_reports} report(s) rejected. Comment: {rejected_comment}',
                'high',
                'reports',
                '/cdw/reports',
            ))

        return notifications
