"""Serve uploads through current ownership checks, including browser image links."""
from django.apps import apps
from django.conf import settings
from django.db.models import FileField
from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed


class MediaAuthenticationCookieMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # Reuse the existing short-lived access credential for ordinary <img>/<a>
        # requests, which cannot add the SPA's Authorization header.
        header = request.META.get('HTTP_AUTHORIZATION', '')
        if 'media_access' not in response.cookies and header.startswith('Bearer ') and getattr(request, 'user', None) and request.user.is_authenticated:
            response.set_cookie('media_access', header[7:], httponly=True,
                                secure=request.is_secure(), samesite='Lax', path=settings.MEDIA_URL)
        return response


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def clear_media_session(request):
    response = Response({'status': 'signed out'})
    response.delete_cookie('media_access', path=settings.MEDIA_URL, samesite='Lax')
    return response


def can_read_file(user, obj):
    if user.role in ('admin', 'staff'):
        return True
    cdc = getattr(obj, 'cdc', None)
    if cdc:
        if user.role == 'cdw':
            return cdc.assigned_cdw_id == user.pk
        return user.role in ('cho', 'planning', 'city_planning')
    label = obj._meta.model_name
    if label == 'user':
        return True  # Profile pictures are already part of authenticated user displays.
    if label == 'curriculumguide':
        if user.role == 'cdw':
            return obj.status == 'active'
        return user.role in ('cho', 'planning', 'city_planning')
    if label in ('populationdatasubmission', 'populationdatahistory'):
        return user.role in ('cho', 'planning', 'city_planning')
    return False


@api_view(['GET', 'HEAD'])
@permission_classes([AllowAny])
def private_media(request, path):
    user = request.user
    if not user.is_authenticated:
        token = request.COOKIES.get('media_access')
        if not token:
            raise Http404
        auth = JWTAuthentication()
        try:
            user = auth.get_user(auth.get_validated_token(token))
        except AuthenticationFailed:
            raise Http404
    for model in apps.get_app_config('core').get_models():
        for field in model._meta.fields:
            if not isinstance(field, FileField):
                continue
            for obj in model.objects.filter(**{field.name: path}):
                if can_read_file(user, obj):
                    stored = getattr(obj, field.name)
                    try:
                        response = FileResponse(stored.open('rb'))
                    except (FileNotFoundError, OSError):
                        raise Http404
                    response['Cache-Control'] = 'private, no-store'
                    response['X-Content-Type-Options'] = 'nosniff'
                    return response
    raise Http404
