from django.shortcuts import render
from django.conf import settings
import json
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.middleware.csrf import get_token
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.utils.decorators import method_decorator
from .models import Expense
from .serializers import ExpenseSerializer

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()  # Define what data to query
    serializer_class = ExpenseSerializer  # Link the serializer
    permission_classes = [IsAuthenticated]  # Add this line to require authentication

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({"message": "CSRF cookie set"})

@login_required
def check_session_view(request):
    return JsonResponse({"authenticated": True}, status=200)

@csrf_protect
def login_view(request):
    if request.method == "POST":
        if settings.DEBUG:
            print("CSRF Headers:", request.headers)  # Debugging: Check for Origin and CSRF headers
            print("CSRF Cookie:", request.COOKIES.get("csrftoken"))
        body = json.loads(request.body)
        username = body.get("username")
        password = body.get("password")
        
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            # Generate a CSRF token
            csrf_token = get_token(request)
            return JsonResponse({"message": "Login successful", "csrftoken": csrf_token})
        else:
            return JsonResponse({"error": "Invalid username or password"}, status=401)
    return JsonResponse({"error": "Invalid request method"}, status=405)

@csrf_protect
def logout_view(request):
    if request.method == "POST":
        logout(request)
        response = JsonResponse({"message": "Logged out"})
        response.delete_cookie("csrftoken", path="/", domain=None)
        response.delete_cookie("sessionid", path="/", domain=None)
        return response
    return JsonResponse({"error": "Invalid request method"}, status=405)