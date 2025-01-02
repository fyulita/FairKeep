from django.test import TestCase, Client
from django.contrib.auth.models import User
from expenses.models import Expense

class AuthTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(username='testuser', password='testpass')

        # Fetch CSRF token
        response = self.client.get('/api/csrf/')
        self.csrf_token = response.cookies.get('csrftoken').value

    def test_login_with_csrf(self):
        response = self.client.post(
            '/api/login/',
            {'username': 'testuser', 'password': 'testpass'},
            HTTP_X_CSRFTOKEN=self.csrf_token,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

    def test_logout(self):
        self.client.login(username='testuser', password='testpass')
        response = self.client.post(
            '/api/logout/',
            HTTP_X_CSRFTOKEN=self.csrf_token
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies['csrftoken'].value, '')
        self.assertEqual(response.cookies['sessionid'].value, '')

    def test_unauthenticated_access(self):
        response = self.client.get('/api/expenses/')
        self.assertEqual(response.status_code, 403)

    def test_session_validation(self):
        self.client.login(username='testuser', password='testpass')
        response = self.client.get('/api/check-session/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"authenticated": True})

    def test_invalid_login(self):
        response = self.client.post(
            '/api/login/',
            {'username': 'wronguser', 'password': 'wrongpass'},
            HTTP_X_CSRFTOKEN=self.csrf_token,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 401)

    def test_missing_csrf_token(self):
        response = self.client.post(
            '/api/expenses/',
            {'name': 'Test Expense', 'amount': 100, 'category': 'Food'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)  # Forbidden
