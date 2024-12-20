from django.shortcuts import render
from django.http import JsonResponse
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.response import Response
from rest_framework_simplejwt.settings import api_settings
from .models import Expense
from .serializers import ExpenseSerializer

# Create your views here.
class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()  # Define what data to query
    serializer_class = ExpenseSerializer  # Link the serializer
    permission_classes = [IsAuthenticated]  # Add this line to require authentication
    #permission_classes = [AllowAny]

class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        tokens = response.data
        response.set_cookie(
            key="accessToken",
            value=tokens["access"],
            httponly=True,
            secure=True,
            samesite="Strict",
            max_age=api_settings.ACCESS_TOKEN_LIFETIME.total_seconds(),
        )
        response.set_cookie(
            key="refreshToken",
            value=tokens["refresh"],
            httponly=True,
            secure=True,
            samesite="Strict",
            max_age=api_settings.REFRESH_TOKEN_LIFETIME.total_seconds(),
        )
        return response

class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        tokens = response.data
        response.set_cookie(
            key="accessToken",
            value=tokens["access"],
            httponly=True,
            secure=True,
            samesite="Strict",
            max_age=api_settings.ACCESS_TOKEN_LIFETIME.total_seconds(),
        )
        return response

#@csrf_exempt  # Optional: Use only if CSRF is causing issues during testing
def logout_view(request):
    if request.method == "POST":
        response = JsonResponse({"message": "Logged out"})
        response.delete_cookie("accessToken")
        response.delete_cookie("refreshToken")
        return response
    return JsonResponse({"error": "Invalid request method"}, status=405)