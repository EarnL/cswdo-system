"""
URL configuration for cswdo_system project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from core.private_media import private_media, clear_media_session
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connection


def health(request):
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
    response = JsonResponse({'status': 'ok'})
    response['Cache-Control'] = 'no-store'
    return response

urlpatterns = [
    path('health/', health, name='health'),
    path('api/media-session/logout/', clear_media_session),
    path('media/<path:path>', private_media, name='private-media'),
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),  # your main API
]


