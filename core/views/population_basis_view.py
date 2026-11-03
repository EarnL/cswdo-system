from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework import serializers
from core.models import CDC, PopulationDataSubmission, CDCBasisHistory, CDCPopulationBasis
from core.services.population_basis_service import review, apply_basis, basis_info, working_year


class PopulationBasisView(APIView):
    permission_classes = [IsAuthenticated]

    def get_cdc(self, request, cdc_id):
        cdc = get_object_or_404(CDC, pk=cdc_id)
        if request.user.role not in ['admin', 'staff'] and not (request.user.role == 'cdw' and cdc.assigned_cdw_id == request.user.pk):
            raise PermissionDenied('You do not have access to this CDC.')
        return cdc

    def get(self, request, cdc_id):
        cdc = self.get_cdc(request, cdc_id)
        year = working_year(cdc)
        updates = [review(cdc, item) for item in PopulationDataSubmission.objects.filter(
            status='current_basis', academic_year__start_year__gte=year.start_year).select_related('academic_year').order_by('-academic_year__start_year')]
        history = []
        for item in CDCBasisHistory.objects.filter(cdc=cdc).select_related('submission__academic_year', 'applied_by').order_by('-applied_at'):
            history.append({'id': item.pk, 'basis': basis_info(item.submission, cdc), 'applied_at': item.applied_at,
                            'applied_by': (item.applied_by.get_full_name() or item.applied_by.username) if item.applied_by else 'System',
                            'summary': item.summary})
        current = CDCPopulationBasis.objects.filter(cdc=cdc, academic_year=year).select_related('submission').first()
        return Response({'cdc': cdc.name, 'working_year': year.name,
                         'current': basis_info(current.submission, cdc) if current else None,
                         'updates': updates, 'history': history})

    def post(self, request, cdc_id):
        self.get_cdc(request, cdc_id)
        class Input(serializers.Serializer):
            submission = serializers.IntegerField(min_value=1)
        data = Input(data=request.data)
        data.is_valid(raise_exception=True)
        apply_basis(cdc_id, data.validated_data['submission'], request.user)
        return self.get(request, cdc_id)


class PopulationAdoptionStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['admin', 'staff']:
            raise PermissionDenied('Only CSWDO can view adoption status.')
        rows = []
        for submission in PopulationDataSubmission.objects.filter(status='current_basis').select_related('academic_year'):
            for cdc in CDC.objects.select_related('assigned_cdw').order_by('name'):
                basis = CDCPopulationBasis.objects.filter(cdc=cdc, academic_year=submission.academic_year).first()
                rows.append({'cdc': cdc.name, 'year': submission.academic_year.name,
                             'status': 'Applied' if basis and basis.submission_id == submission.pk else 'Pending review',
                             'applied_at': basis.applied_at if basis and basis.submission_id == submission.pk else None,
                             'cdw': cdc.assigned_cdw.username if cdc.assigned_cdw else 'Unassigned'})
        return Response(rows)
