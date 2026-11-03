from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import AnnualEvaluation, AuthorityDocument, PermitRecord, SupervisoryVisit
from core.serializers import (
    AnnualEvaluationSerializer,
    AuthorityDocumentSerializer,
    PermitRecordSerializer,
    SupervisoryVisitSerializer,
)


class ComplianceBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def _can_access_cdc(self, user, cdc):
        if user.role in ['admin', 'staff', 'cho', 'planning', 'city_planning']:
            return True
        if user.role == 'cdw' and cdc.assigned_cdw_id == user.id:
            return True
        return False

    def _can_manage(self, user):
        return user.role in ['admin', 'staff']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        cdc_id = self.request.query_params.get('cdc')

        if user.role == 'cdw':
            queryset = queryset.filter(cdc__assigned_cdw=user)

        if cdc_id:
            queryset = queryset.filter(cdc_id=cdc_id)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cdc = serializer.validated_data['cdc']
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, cdc):
            return Response({'error': 'You are not allowed to create compliance records for this CDC.'}, status=status.HTTP_403_FORBIDDEN)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(serializer.instance).data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this compliance record.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_manage(request.user) or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'You are not allowed to update this compliance record.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role != 'admin' or not self._can_access_cdc(request.user, instance.cdc):
            return Response({'error': 'Only administrators can delete this compliance record.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class AuthorityDocumentViewSet(ComplianceBaseViewSet):
    queryset = AuthorityDocument.objects.select_related('cdc', 'cdc__barangay', 'verified_by').all()
    serializer_class = AuthorityDocumentSerializer

    def perform_create(self, serializer):
        serializer.save(verified_by=self.request.user)


class PermitRecordViewSet(ComplianceBaseViewSet):
    queryset = PermitRecord.objects.select_related('cdc', 'cdc__barangay', 'issued_by').all()
    serializer_class = PermitRecordSerializer

    def perform_create(self, serializer):
        serializer.save(issued_by=self.request.user)


class AnnualEvaluationViewSet(ComplianceBaseViewSet):
    queryset = AnnualEvaluation.objects.select_related('cdc', 'cdc__barangay', 'evaluated_by').all()
    serializer_class = AnnualEvaluationSerializer

    def perform_create(self, serializer):
        serializer.save(evaluated_by=self.request.user)


class SupervisoryVisitViewSet(ComplianceBaseViewSet):
    queryset = SupervisoryVisit.objects.select_related('cdc', 'cdc__barangay', 'supervisor').all()
    serializer_class = SupervisoryVisitSerializer

    def perform_create(self, serializer):
        serializer.save(supervisor=self.request.user)
