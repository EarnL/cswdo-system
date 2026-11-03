from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsCSWDOManager(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ['admin', 'staff']
        )


class AuthenticatedReadManagerWrite(IsCSWDOManager):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return super().has_permission(request, view)


class PlanningReadOnlyAuthenticated(BasePermission):
    """Authenticated access, with City Planning restricted to monitoring reads."""

    message = 'City Planning has view-only access to this information.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role in ['planning', 'city_planning']:
            return request.method in SAFE_METHODS
        return True


class OfficeAnalyticsPermission(PlanningReadOnlyAuthenticated):
    """City-wide internal analysis is not part of the assigned-center portal."""
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role != 'cdw'
