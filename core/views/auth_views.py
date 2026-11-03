from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from core.serializers.auth_serializer import BarangaySerializer, UserProfileSerializer
from core.models import CDC, Barangay
from core.services.activity_log_service import ActivityLogService

User = get_user_model()

User = get_user_model()

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username_value = attrs.get(self.username_field)
        user_for_log = None

        if username_value:
            user_for_log = User.objects.filter(
                Q(username__iexact=username_value) | Q(email__iexact=username_value)
            ).first()
            if user_for_log:
                attrs[self.username_field] = user_for_log.get_username()

        try:
            data = super().validate(attrs)
        except Exception as e:
            ActivityLogService.log(
                user_for_log,
                'login_failed',
                f"Failed login attempt for {username_value or 'unknown account'}",
                target_type='user',
                target_id=getattr(user_for_log, 'id', None),
                metadata={'username_or_email': username_value or '', 'reason': str(e)},
            )
            raise serializers.ValidationError('Authentication failed. Check your username/email and password.')

        user = self.user
        if not user.is_active:
            ActivityLogService.log(
                user,
                'login_blocked',
                f"Inactive account login blocked for {user.username}",
                target_type='user',
                target_id=user.id,
            )
            raise serializers.ValidationError('This account is inactive. Please contact the CSWDO Admin.')

        role = user.role
        
        # If user has no role but is admin/staff, assign admin role
        if not role:
            if user.is_superuser or user.is_staff:
                role = 'admin'
            else:
                role = 'staff'  # Default role if none assigned

        data['role'] = role
        data['username'] = user.username
        data['email'] = user.email

        ActivityLogService.log(
            user,
            'login_success',
            f"{user.username} signed in",
            target_type='user',
            target_id=user.id,
        )

        # For CDW users, get their assigned barangays and set default if only one
        if role == 'cdw':
            cdcs = CDC.objects.filter(assigned_cdw=user).select_related('barangay')
            if cdcs.exists():
                if cdcs.count() == 1:
                    # Single barangay assignment - set it automatically
                    barangay = cdcs.first().barangay
                    data['selected_barangay'] = {
                        'id': barangay.id,
                        'name': barangay.name
                    }
                else:
                    # Multiple barangays - would need selection (but now handled in registration)
                    barangays = []
                    seen_barangays = set()
                    for cdc in cdcs:
                        if cdc.barangay.id not in seen_barangays:
                            barangays.append({
                                'id': cdc.barangay.id,
                                'name': cdc.barangay.name
                            })
                            seen_barangays.add(cdc.barangay.id)
                    
                    data['barangays'] = barangays
                    data['requires_barangay_selection'] = True
            else:
                data['barangays'] = []
                data['requires_barangay_selection'] = False

        return data

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class SetBarangayView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        barangay_id = request.data.get('barangay_id')

        if not barangay_id:
            return Response(
                {'error': 'Barangay ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify the user is assigned to this barangay via CDC
        cdcs = CDC.objects.filter(assigned_cdw=user, barangay_id=barangay_id)
        if not cdcs.exists():
            return Response(
                {'error': 'You are not assigned to this barangay'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Store selected barangay in session (you could also use a custom token claim)
        request.session['selected_barangay_id'] = barangay_id
        request.session['selected_barangay_name'] = cdcs.first().barangay.name

        return Response({
            'message': 'Barangay selected successfully',
            'selected_barangay': {
                'id': barangay_id,
                'name': cdcs.first().barangay.name
            }
        })


class BarangayListView(generics.ListAPIView):
    queryset = Barangay.objects.all()
    serializer_class = BarangaySerializer
    permission_classes = [permissions.AllowAny]


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
