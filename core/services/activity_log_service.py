from django.db.models import Q
from core.models import ActivityLog, CDC, Report, ReportDraft, SpecialNeedsAssessment, AccreditationRequest


class ActivityLogService:
    @classmethod
    def log(cls, actor, action, summary, target_type='', target_id=None, metadata=None):
        ActivityLog.objects.create(
            actor=actor if getattr(actor, 'is_authenticated', False) else None,
            actor_role=getattr(actor, 'role', '') or '',
            action=action,
            summary=summary,
            target_type=target_type,
            target_id=target_id,
            metadata=metadata or {},
        )

    @classmethod
    def get_queryset_for_user(cls, user):
        queryset = ActivityLog.objects.select_related('actor')
        if getattr(user, 'role', '') in ['admin', 'staff']:
            return queryset
        if getattr(user, 'role', '') == 'cdw':
            scope = Q(target_type='user', target_id=user.pk)
            for label, model, relation in (
                ('cdc', CDC, 'assigned_cdw'),
                ('report', Report, 'cdc__assigned_cdw'),
                ('report_draft', ReportDraft, 'cdc__assigned_cdw'),
                ('special_needs_assessment', SpecialNeedsAssessment, 'cdc__assigned_cdw'),
                ('accreditation_request', AccreditationRequest, 'cdc__assigned_cdw'),
            ):
                scope |= Q(target_type=label, target_id__in=model.objects.filter(**{relation: user}).values('pk'))
            return queryset.filter(scope)
        return queryset.filter(actor=user)
