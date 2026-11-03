from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.serializers.auth_serializer import UserManagementSerializer
from core.services.activity_log_service import ActivityLogService


User = get_user_model()


class UserManagementViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('created_by').prefetch_related('assigned_cdcs__barangay').order_by('username')
    serializer_class = UserManagementSerializer
    permission_classes = [IsAuthenticated]

    def _ensure_admin(self, request):
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only CSWDO administrators can manage users and roles.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def list(self, request, *args, **kwargs):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        response = super().create(request, *args, **kwargs)
        if response.status_code == status.HTTP_201_CREATED:
            ActivityLogService.log(
                request.user,
                'account_created',
                f"Created user account {response.data.get('username')}",
                target_type='user',
                target_id=response.data.get('id'),
                metadata={
                    'role': response.data.get('role'),
                    'office_source': response.data.get('office_source'),
                    'assigned_cdc': response.data.get('assigned_cdc'),
                },
            )
        return response

    def update(self, request, *args, **kwargs):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        instance = self.get_object()
        before = {
            'role': instance.role,
            'is_active': instance.is_active,
            'office_source': instance.office_source,
            'assigned_cdc_id': instance.assigned_cdcs.first().id if instance.assigned_cdcs.exists() else None,
        }
        response = super().update(request, *args, **kwargs)
        self._log_account_update(request.user, response, before)
        return response

    def partial_update(self, request, *args, **kwargs):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        instance = self.get_object()
        before = {
            'role': instance.role,
            'is_active': instance.is_active,
            'office_source': instance.office_source,
            'assigned_cdc_id': instance.assigned_cdcs.first().id if instance.assigned_cdcs.exists() else None,
        }
        response = super().partial_update(request, *args, **kwargs)
        self._log_account_update(request.user, response, before)
        return response

    def destroy(self, request, *args, **kwargs):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        user = self.get_object()
        if user == request.user:
            return Response(
                {'error': 'Administrators cannot deactivate their own account from this page.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = False
        user.deactivated_at = timezone.now()
        user.save(update_fields=['is_active', 'deactivated_at', 'updated_at'])
        ActivityLogService.log(
            request.user,
            'account_deactivated',
            f"Deactivated user account {user.username}",
            target_type='user',
            target_id=user.id,
            metadata={'role': user.role},
        )
        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _log_account_update(self, actor, response, before):
        if response.status_code not in [status.HTTP_200_OK, status.HTTP_201_CREATED]:
            return

        after = {
            'role': response.data.get('role'),
            'is_active': response.data.get('is_active'),
            'office_source': response.data.get('office_source'),
            'assigned_cdc_id': (response.data.get('assigned_cdc') or {}).get('id'),
        }
        changed = {key: {'from': before.get(key), 'to': after.get(key)} for key in after if before.get(key) != after.get(key)}
        if not changed:
            return

        action = 'account_updated'
        if 'role' in changed:
            action = 'role_changed'
        if changed.get('is_active', {}).get('to') is False:
            action = 'account_deactivated'

        ActivityLogService.log(
            actor,
            action,
            f"Updated user account {response.data.get('username')}",
            target_type='user',
            target_id=response.data.get('id'),
            metadata={'changes': changed},
        )
