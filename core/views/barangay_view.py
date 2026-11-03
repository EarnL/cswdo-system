from rest_framework import viewsets
from core.models import Barangay
from core.serializers import BarangaySerializer
from core.permissions import AuthenticatedReadManagerWrite

class BarangayViewSet(viewsets.ModelViewSet):
    queryset = Barangay.objects.all()
    serializer_class = BarangaySerializer
    permission_classes = [AuthenticatedReadManagerWrite]
