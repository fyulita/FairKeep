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

import logging
logger = logging.getLogger(__name__)

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all().order_by('-date')
    serializer_class = ExpenseSerializer

    def perform_create(self, serializer):
        logger.debug(f"Incoming data: {self.request.data}")

        data = self.request.data
        print("Incoming Data:", data)  # Debugging
        splits_data = data.get('splits', [])
        print("Splits Data:", splits_data)  # Debugging
        participants = data.get('participants', [])
        print("Participants:", participants)  # Debugging
        split_method = data.get('split_method')
        print("Split Method:", split_method)  # Debugging
        total_amount = float(data['amount'])
        print("Total Amount:", total_amount)  # Debugging

        # Validate splits based on the selected method
        if split_method == 'manual':
            total_owed = sum(float(split['owed_amount']) for split in splits_data)
            if total_owed != total_amount:
                raise ValidationError("The total owed amounts must equal the expense amount.")

        elif split_method == 'percentage':
            total_percentage = sum(float(split['value']) for split in splits_data)
            if total_percentage != 100:
                raise ValidationError("The total percentages must equal 100%.")

        elif split_method == 'equal':
            if len(splits_data) != len(participants):
                raise ValidationError("Participants count must match splits count for equal split.")
            for split in splits_data:
                split['owed_amount'] = total_amount / len(participants)

        elif split_method == 'shares':
            total_shares = sum(split['value'] for split in splits_data)
            for split in splits_data:
                split['owed_amount'] = (split['value'] / total_shares) * total_amount

        elif split_method == 'excess':
            base_amount = total_amount / len(participants)
            for split in splits_data:
                split['owed_amount'] = base_amount + split.get('value', 0)

        with transaction.atomic():
            expense = serializer.save(added_by=self.request.user)
            for split in splits_data:
                ExpenseSplit.objects.create(
                    expense=expense,
                    user=User.objects.get(id=split['user']),
                    paid_amount=split.get('paid_amount', 0),
                    owed_amount=split.get('owed_amount', 0),
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
    return JsonResponse({"authenticated": True, "id": request.user.id, "username": request.user.username}, status=200)

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