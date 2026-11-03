from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Barangay, CDC, Performance, User


class ManagementEndpointAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.barangay = Barangay.objects.create(name='Access test', population_children_3_4=10)
        self.center = CDC.objects.create(
            name='Access test center', barangay=self.barangay,
            latitude=0, longitude=0, max_capacity=30, current_enrollment=0,
        )

    def authenticate(self, role):
        self.client.force_authenticate(User(username=f'access_{role}', role=role))

    def test_anonymous_requests_are_rejected_before_any_computation(self):
        with patch('core.views.performance_view.compute_performance_score') as list_compute, patch(
            'core.views.performance_compute_view.compute_performance_score'
        ) as explicit_compute:
            for endpoint in ['barangays', 'performance']:
                for method, suffix in [('get', ''), ('post', ''), ('put', '1/'), ('patch', '1/'), ('delete', '1/')]:
                    with self.subTest(endpoint=endpoint, method=method):
                        response = getattr(self.client, method)(f'/api/{endpoint}/{suffix}', {}, format='json')
                        self.assertEqual(response.status_code, 401)
            self.assertEqual(self.client.post('/api/compute-performance/').status_code, 401)
            list_compute.assert_not_called()
            explicit_compute.assert_not_called()
        self.assertEqual(Barangay.objects.count(), 1)
        self.assertFalse(Performance.objects.exists())

    def test_non_manager_roles_cannot_write_or_recompute(self):
        for role in ['cdw', 'cho', 'planning', None]:
            self.authenticate(role)
            for endpoint in ['barangays', 'performance']:
                for method, suffix in [('post', ''), ('put', '1/'), ('patch', '1/'), ('delete', '1/')]:
                    with self.subTest(role=role, endpoint=endpoint, method=method):
                        response = getattr(self.client, method)(f'/api/{endpoint}/{suffix}', {}, format='json')
                        self.assertEqual(response.status_code, 403)
            self.assertEqual(self.client.post('/api/compute-performance/').status_code, 403)

    def test_authenticated_non_managers_can_read_without_recomputing(self):
        for role in ['cdw', 'cho', 'planning']:
            self.authenticate(role)
            with patch('core.views.performance_view.compute_performance_score') as compute:
                self.assertEqual(self.client.get('/api/barangays/').status_code, 200)
                self.assertEqual(self.client.get('/api/performance/').status_code, 200)
                compute.assert_not_called()

    def test_managers_can_manage_barangays_and_recompute(self):
        for role in ['admin', 'staff']:
            self.authenticate(role)
            response = self.client.post('/api/barangays/', {'name': role, 'population_children_3_4': 20})
            self.assertEqual(response.status_code, 201)
            endpoint = f"/api/barangays/{response.data['id']}/"
            self.assertEqual(self.client.patch(endpoint, {'name': f'{role} updated'}).status_code, 200)
            self.assertEqual(self.client.delete(endpoint).status_code, 204)
            self.assertEqual(self.client.post('/api/compute-performance/').status_code, 200)
            self.assertTrue(Performance.objects.filter(cdc=self.center).exists())

    def test_api_default_requires_authentication(self):
        from rest_framework.decorators import api_view
        from rest_framework.response import Response
        from rest_framework.test import APIRequestFactory

        @api_view(['GET'])
        def unconfigured_endpoint(request):
            return Response({'ok': True})

        response = unconfigured_endpoint(APIRequestFactory().get('/'))
        self.assertEqual(response.status_code, 401)

    def test_login_remains_public(self):
        response = self.client.post('/api/token/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_public_map_remains_public(self):
        self.assertEqual(self.client.get('/api/public-map/').status_code, 200)
