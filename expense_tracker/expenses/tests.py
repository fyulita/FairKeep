from django.test import TestCase, Client

# Create your tests here.
class AuthTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpass')

    def test_login_and_csrf_protection(self):
        # Log in the user
        response = self.client.post('/api/token/', {'username': 'testuser', 'password': 'testpass'})
        self.assertEqual(response.status_code, 200)

        # Verify CSRF token works
        csrf_token = response.cookies['csrftoken'].value
        response = self.client.post(
            '/api/expenses/', 
            {'name': 'Test Expense', 'amount': 100}, 
            HTTP_X_CSRFTOKEN=csrf_token
        )
        self.assertEqual(response.status_code, 201)

    def test_logout(self):
        # Log in
        self.client.post('/api/token/', {'username': 'testuser', 'password': 'testpass'})
        
        # Log out
        response = self.client.post('/api/logout/')
        self.assertEqual(response.status_code, 200)

        # Verify cookies are cleared
        self.assertNotIn('accessToken', response.cookies)
        self.assertNotIn('refreshToken', response.cookies)
