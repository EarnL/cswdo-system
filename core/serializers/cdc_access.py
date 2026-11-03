from django.db.models import Model
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied


class AssignedCDCSerializer(serializers.ModelSerializer):
    """Validate ownership after subclass validation, including writable relations."""

    def run_validation(self, data=serializers.empty):
        attrs = super().run_validation(data)
        request = self.context.get('request')
        if not request or request.user.role != 'cdw':
            return attrs
        original = getattr(self.instance, 'cdc', None)
        destination = attrs.get('cdc', original)
        for center in (original, destination):
            if center and center.assigned_cdw_id != request.user.pk:
                raise PermissionDenied('You can only manage records for your assigned CDC.')
        for field, value in attrs.items():
            values = value if isinstance(value, (list, tuple)) else [value]
            for related in values:
                if isinstance(related, Model) and hasattr(related, 'cdc_id') and related.cdc_id:
                    if related.cdc.assigned_cdw_id != request.user.pk:
                        raise PermissionDenied('The selected record belongs to another CDC.')
                    if destination and related.cdc_id != destination.pk:
                        raise serializers.ValidationError({field: 'Select a record from the same CDC.'})
        return attrs
