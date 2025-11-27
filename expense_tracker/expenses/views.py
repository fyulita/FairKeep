from django.db import transaction, models
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from decimal import Decimal
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

    def get_queryset(self):
        user = self.request.user
        return Expense.objects.filter(
            models.Q(participants=user)
            | models.Q(added_by=user)
            | models.Q(paid_by=user)
            | models.Q(expensesplit__user=user)
        ).distinct().order_by('-date')

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
        total_amount = Decimal(str(data['amount']))
        print("Total Amount:", total_amount)  # Debugging
        payer_id = int(data.get('paid_by'))

        # Normalize splits by user to avoid duplicates
        normalized = {}
        for split in splits_data:
            uid = int(split['user'])
            entry = normalized.get(uid, {"user": uid, "paid_amount": Decimal('0'), "owed_amount": Decimal('0'), "value": Decimal('0')})
            entry["paid_amount"] += Decimal(str(split.get('paid_amount', 0)))
            entry["owed_amount"] += Decimal(str(split.get('owed_amount', 0)))
            entry["value"] += Decimal(str(split.get('value', 0)))
            normalized[uid] = entry
        splits_data = list(normalized.values())

        # Validate splits based on the selected method
        if split_method == 'manual':
            total_owed = sum(Decimal(str(split['owed_amount'])) for split in splits_data)
            if total_owed != total_amount:
                raise ValidationError("The total owed amounts must equal the expense amount.")

        elif split_method == 'percentage':
            total_percentage = sum(Decimal(str(split['value'])) for split in splits_data)
            if abs(total_percentage - Decimal('100')) > Decimal('0.0001'):
                raise ValidationError("The total percentages must equal 100%.")
            for split in splits_data:
                split['owed_amount'] = (total_amount * Decimal(str(split.get('value', 0))) / Decimal('100')).quantize(Decimal('0.01'))

        elif split_method == 'equal':
            if len(splits_data) != len(participants):
                raise ValidationError("Participants count must match splits count for equal split.")
            for split in splits_data:
                split['owed_amount'] = (total_amount / Decimal(len(participants))).quantize(Decimal('0.01'))

        elif split_method == 'shares':
            total_shares = Decimal(sum(Decimal(str(split['value'])) for split in splits_data))
            if total_shares == 0:
                raise ValidationError("Total shares must be greater than 0.")
            for split in splits_data:
                split['owed_amount'] = (Decimal(str(split['value'])) / total_shares * total_amount).quantize(Decimal('0.01'))

        elif split_method == 'excess':
            total_excess = sum(Decimal(str(split.get('value', 0))) for split in splits_data)
            base_amount = (total_amount - total_excess) / Decimal(len(participants))
            for split in splits_data:
                split['owed_amount'] = (base_amount + Decimal(str(split.get('value', 0)))).quantize(Decimal('0.01'))

        with transaction.atomic():
            expense = serializer.save(added_by=self.request.user)
            # Ensure participants include payer and all split users
            unique_participants = set(participants)
            unique_participants.add(payer_id)
            for split in splits_data:
                unique_participants.add(int(split['user']))
            expense.participants.set(unique_participants)
            for split in splits_data:
                ExpenseSplit.objects.create(
                    expense=expense,
                    user=User.objects.get(id=split['user']),
                    paid_amount=Decimal(str(split.get('paid_amount', 0))),
                    owed_amount=Decimal(str(split.get('owed_amount', 0))),
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
    current_user = request.user
    balances_map = {}

    expenses = Expense.objects.filter(
        models.Q(participants=current_user)
        | models.Q(added_by=current_user)
        | models.Q(paid_by=current_user)
        | models.Q(expensesplit__user=current_user)
    ).prefetch_related('expensesplit_set__user', 'paid_by').distinct()
    for expense in expenses:
        payer = expense.paid_by
        splits = list(expense.expensesplit_set.all())

        # Normalizar: agrupar por usuario para evitar duplicados
        split_totals = {}
        for s in splits:
            entry = split_totals.setdefault(
                s.user.id,
                {
                    "user": s.user,
                    "owed": Decimal('0'),
                    "paid": Decimal('0'),
                },
            )
            entry["owed"] += Decimal(str(s.owed_amount))
            entry["paid"] += Decimal(str(s.paid_amount))

        if payer == current_user:
            for uid, entry in split_totals.items():
                if uid == current_user.id:
                    continue
                u = entry["user"]
                dest = balances_map.setdefault(
                    uid,
                    {
                        "user_id": uid,
                        "username": u.username,
                        "display_name": u.get_full_name() or u.username,
                        "amount": Decimal('0'),
                    },
                )
                dest["amount"] += entry["owed"]
        else:
            my_entry = split_totals.get(current_user.id)
            if my_entry:
                dest = balances_map.setdefault(
                    payer.id,
                    {
                        "user_id": payer.id,
                        "username": payer.username,
                        "display_name": payer.get_full_name() or payer.username,
                        "amount": Decimal('0'),
                    },
                )
                dest["amount"] -= my_entry["owed"]

    # Convertir Decimals a float
    result = []
    for v in balances_map.values():
        v["amount"] = float(v["amount"])
        result.append(v)

    return Response(result)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    users = User.objects.all()
    user_data = [{
        "id": user.id,
        "username": user.username,
        "display_name": user.get_full_name() or user.username,
    } for user in users]
    return Response(user_data)

@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({"message": "CSRF cookie set"})

@login_required
def check_session_view(request):
    return JsonResponse({
        "authenticated": True,
        "id": request.user.id,
        "username": request.user.username,
        "display_name": request.user.get_full_name() or request.user.username,
    }, status=200)

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
