from django.test import TestCase
from rest_framework.test import APIClient

from core.models import User


class CityPlanningMonitoringTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='planning_monitor', password='test', role='planning'
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_monitoring_sources_are_available(self):
        for url in [
            '/api/heatmap/',
            '/api/integration/population-metrics/',
            '/api/integration/enrollment/',
            '/api/integration/gap-analysis/',
            '/api/cdcs/',
            '/api/academic-years/',
        ]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_planning_cannot_modify_monitoring_sources(self):
        for url in [
            '/api/integration/population-metrics/',
            '/api/integration/enrollment/',
            '/api/cdcs/',
            '/api/children/',
            '/api/academic-years/',
        ]:
            with self.subTest(url=url):
                response = self.client.post(url, {}, format='json')
                self.assertEqual(response.status_code, 403, response.data)
