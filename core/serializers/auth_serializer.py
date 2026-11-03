from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.utils import timezone
from core.models import Barangay, CDC

User = get_user_model()

class BarangaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Barangay
        fields = ('id', 'name')


class UserProfileSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = (  
            'id', 'username', 'first_name', 'last_name', 'email', 'role',
            'profile_picture', 'profile_picture_url', 'bio', 'phone_number', 
            'date_of_birth', 'address', 'emergency_contact_name', 
            'emergency_contact_number', 'department', 'position', 'employee_id'
        )
        read_only_fields = ('id', 'username', 'role')
    
    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
        return None


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    barangay_id = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'password', 'confirm_password', 'barangay_id')

    def validate_role(self, value):
        if value == 'admin':
            raise serializers.ValidationError('Main admin accounts cannot be created from the public registration form.')
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        # For CDW role, barangay_id is required
        if attrs.get('role') == 'cdw' and not attrs.get('barangay_id'):
            raise serializers.ValidationError({'barangay_id': 'Barangay selection is required for CDW role.'})

        return attrs

    def create(self, validated_data):
        barangay_id = validated_data.pop('barangay_id', None)
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # If CDW and barangay specified, create CDC assignment
        if user.role == 'cdw' and barangay_id:
            try:
                barangay = Barangay.objects.get(id=barangay_id)
                # Create a CDC for this barangay and assign the CDW
                from core.models import CDC
                cdc, created = CDC.objects.get_or_create(
                    barangay=barangay,
                    defaults={'name': f'CDC - {barangay.name}', 'max_capacity': 50, 'current_enrollment': 0, 'latitude': 0, 'longitude': 0}
                )
                cdc.assigned_cdw = user
                cdc.save()
            except Barangay.DoesNotExist:
                raise serializers.ValidationError({'barangay_id': 'Invalid barangay selected.'})

        return user


class UserManagementSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    cdc_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    assigned_cdc = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'profile_picture_url',
            'role',
            'department',
            'position',
            'office_source',
            'assigned_cdc',
            'cdc_id',
            'is_active',
            'last_login',
            'created_by',
            'created_by_username',
            'created_at',
            'updated_at',
            'deactivated_at',
            'password',
        )
        read_only_fields = (
            'id',
            'last_login',
            'created_by',
            'created_by_username',
            'created_at',
            'updated_at',
            'deactivated_at',
        )

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def get_assigned_cdc(self, obj):
        cdc = obj.assigned_cdcs.select_related('barangay').first()
        if not cdc:
            return None
        return {
            'id': cdc.id,
            'name': cdc.name,
            'barangay_name': cdc.barangay.name,
        }

    def validate(self, attrs):
        role = attrs.get('role', getattr(self.instance, 'role', None))
        cdc_id = attrs.get('cdc_id', None)
        office_source = attrs.get('office_source', getattr(self.instance, 'office_source', None))
        request = self.context.get('request')

        if self.instance is None:
            if not role:
                raise serializers.ValidationError({'role': 'Role is required when creating an account.'})
            if not attrs.get('password'):
                raise serializers.ValidationError({'password': 'Temporary password is required when creating an account.'})

        if (
            self.instance is not None
            and request
            and self.instance == request.user
            and attrs.get('is_active') is False
        ):
            raise serializers.ValidationError({'is_active': 'Administrators cannot deactivate their own account.'})

        if role == 'cdw':
            has_existing_cdc = bool(self.instance and self.instance.assigned_cdcs.exists())
            if not cdc_id and not has_existing_cdc:
                raise serializers.ValidationError({'cdc_id': 'CDC assignment is required for CDW accounts.'})
            if cdc_id:
                try:
                    CDC.objects.get(id=cdc_id)
                except CDC.DoesNotExist as exc:
                    raise serializers.ValidationError({'cdc_id': 'Selected CDC does not exist.'}) from exc

        if role in ['cho', 'planning']:
            attrs['office_source'] = 'cho' if role == 'cho' else 'city_planning'

        if role not in ['cho', 'planning']:
            attrs['office_source'] = 'cswdo' if role in ['admin', 'staff'] else None

        return attrs

    def create(self, validated_data):
        cdc_id = validated_data.pop('cdc_id', None)
        password = validated_data.pop('password', None)
        request = self.context.get('request')
        if request and getattr(request.user, 'is_authenticated', False):
            validated_data['created_by'] = request.user

        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        self._sync_cdw_assignment(user, cdc_id)
        return user

    def update(self, instance, validated_data):
        cdc_id = validated_data.pop('cdc_id', None)
        password = validated_data.pop('password', None)
        previous_role = instance.role
        previous_active = instance.is_active

        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        if previous_active and instance.is_active is False:
            instance.deactivated_at = timezone.now()
        elif not previous_active and instance.is_active is True:
            instance.deactivated_at = None
        instance.save()

        if instance.role == 'cdw':
            self._sync_cdw_assignment(instance, cdc_id)
        elif previous_role == 'cdw' or cdc_id is not None:
            instance.assigned_cdcs.update(assigned_cdw=None)

        return instance

    def _sync_cdw_assignment(self, user, cdc_id):
        if user.role != 'cdw' or not cdc_id:
            return
        user.assigned_cdcs.exclude(id=cdc_id).update(assigned_cdw=None)
        CDC.objects.filter(id=cdc_id).update(assigned_cdw=user)
