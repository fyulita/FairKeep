from django.db import transaction
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
import json
from django.http import JsonResponse
from django.middleware.csrf import get_token
from rest_framework import viewsets, serializers
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from .models import Expense, ExpenseSplit
from .serializers import ExpenseSerializer

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all().order_by('-date')
    serializer_class = ExpenseSerializer

    def perform_create(self, serializer):
        data = self.request.data
        
        print("Received data:", data)  # Debug log
        serializer.save(added_by=self.request.user)

        splits_data = data.get('splits', [])
        with transaction.atomic():
            expense = serializer.save(added_by=self.request.user)
            total_paid = sum(float(split['paid_amount']) for split in splits_data)
            if total_paid != expense.amount:
                raise ValidationError({"amount": "Total paid must equal the expense amount."})

            for split in splits_data:
                user = User.objects.get(id=split['user'])
                ExpenseSplit.objects.create(
                    expense=expense,
                    user=user,
                    paid_amount=float(split['paid_amount']),
                    owed_amount=float(split['owed_amount'])
                )

@login_required
def calculate_balances(request):
    balances = {}
    splits = ExpenseSplit.objects.filter(user=request.user)
    for split in splits:
        other_user = split.expense.added_by if split.expense.added_by != request.user else None
        if other_user:
            balances[other_user.username] = balances.get(other_user.username, 0) + split.owed_amount - split.paid_amount
    return JsonResponse(balances)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def balances(request):
    user = request.user
    splits = ExpenseSplit.objects.filter(user=user)
    balances = [
        {
            "user": split.expense.added_by.username,
            "amount": split.owed_amount - split.paid_amount
        }
        for split in splits if split.expense.added_by != user
    ]
    return Response(balances)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    users = User.objects.all()
    user_data = [{"id": user.id, "username": user.username} for user in users]
    return Response(user_data)

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
        try:
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
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid request body."}, status=400)
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