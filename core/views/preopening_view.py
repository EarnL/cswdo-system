from pathlib import Path

from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import CDC, PreOpeningRequirement
from core.services.preopening_service import SECTIONS, preparation_summary


class PreparationInput(serializers.Serializer):
    data = serializers.JSONField()
    evidence = serializers.FileField(required=False)

    def validate_evidence(self, value):
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('Choose a file smaller than 10 MB.')
        if Path(value.name).suffix.lower() not in ['.pdf', '.jpg', '.jpeg', '.png']:
            raise serializers.ValidationError('Choose a PDF, JPG or PNG file.')
        return value


class PreOpeningView(APIView):
    permission_classes = [IsAuthenticated]

    def center(self, request, cdc_id):
        centers = CDC.objects.all()
        if request.user.role == 'cdw':
            centers = centers.filter(assigned_cdw=request.user)
        elif request.user.role not in ['admin', 'staff']:
            raise PermissionDenied('Only assigned CDWs and CSWDO reviewers can access preparation records.')
        return get_object_or_404(centers, pk=cdc_id)

    def get(self, request, cdc_id, section=None):
        center = self.center(request, cdc_id)
        if section:
            record = get_object_or_404(PreOpeningRequirement, cdc=center, section=section)
            if not record.evidence:
                raise ValidationError('No supporting file has been uploaded.')
            response = FileResponse(record.evidence.open('rb'), as_attachment=True, filename=Path(record.evidence.name).name)
            response['Cache-Control'] = 'no-store'
            return response
        records = {record.section: record for record in center.preopening_requirements.all()}
        sections = []
        for definition in SECTIONS:
            record = records.get(definition['key'])
            data = record.data if record else {}
            if not record and definition['key'] == 'basic':
                data = {key: str(getattr(center, 'max_capacity' if key == 'capacity' else key, '') or '')
                        for key, label, kind in definition['fields']}
            sections.append({**definition, 'data': data, 'filename': Path(record.evidence.name).name if record and record.evidence else '',
                             'updated_at': record.updated_at if record else None})
        return Response({'cdc': {'id': center.pk, 'name': center.name, 'barangay': center.barangay.name},
                         'sections': sections, **preparation_summary(center)})

    @transaction.atomic
    def put(self, request, cdc_id, section):
        center = self.center(request, cdc_id)
        if request.user.role != 'cdw':
            raise PermissionDenied('Only the assigned CDW can edit this preparation.')
        definition = next((item for item in SECTIONS if item['key'] == section), None)
        if not definition:
            raise ValidationError('Choose a valid requirement section.')
        inputs = PreparationInput(data=request.data)
        inputs.is_valid(raise_exception=True)
        data = inputs.validated_data['data']
        allowed = {key for key, label, kind in definition['fields']}
        if not isinstance(data, dict) or set(data) - allowed:
            raise ValidationError({'data': 'Only fields from this preparation form are allowed.'})
        if any(not isinstance(value, str) or len(value) > 5000 for value in data.values()):
            raise ValidationError({'data': 'Use text of at most 5,000 characters per field.'})
        capacity = data.get('capacity', '').strip()
        if capacity and (len(capacity) > 5 or not capacity.isdecimal() or not 1 <= int(capacity) <= 10000):
            raise ValidationError({'capacity': 'Enter a number between 1 and 10,000.'})
        CDC.objects.select_for_update().get(pk=center.pk)
        record, created = PreOpeningRequirement.objects.get_or_create(cdc=center, section=section)
        record.data = {key: value.strip() for key, value in data.items()}
        if 'evidence' in inputs.validated_data:
            record.evidence = inputs.validated_data['evidence']
        record.save()
        return Response(preparation_summary(center))
