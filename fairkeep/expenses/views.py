from django.db import transaction, models
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
import json
from django.http import JsonResponse, HttpResponse
from django.middleware.csrf import get_token
from rest_framework import viewsets, serializers, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from .models import Expense, ExpenseSplit, Activity
from .serializers import ExpenseSerializer, ActivitySerializer
import csv

# User detail (GET/PATCH) for profile updates
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def user_detail(request, user_id):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "display_name": f"{user.first_name} {user.last_name}".strip() or user.username,
        })

    if request.user.id != user.id:
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    if 'first_name' in data:
        user.first_name = data.get('first_name', '') or ''
    if 'last_name' in data:
        user.last_name = data.get('last_name', '') or ''
    if 'display_name' in data:
        display_parts = data.get('display_name', '').strip().split()
        if len(display_parts) >= 1:
            user.first_name = user.first_name or display_parts[0]
        if len(display_parts) >= 2 and not user.last_name:
            user.last_name = " ".join(display_parts[1:])
    user.save()

    return Response({
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "display_name": f"{user.first_name} {user.last_name}".strip() or user.username,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    current = request.data.get("current_password", "")
    new1 = request.data.get("new_password", "")
    new2 = request.data.get("confirm_password", "")

    if not current or not new1 or not new2:
        return Response({"detail": "All password fields are required."}, status=status.HTTP_400_BAD_REQUEST)
    if new1 != new2:
        return Response({"detail": "New passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)
    if len(new1) < 8:
        return Response({"detail": "New password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if not user.check_password(current):
        return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new1)
    user.save()
    return Response({"detail": "Password updated successfully."})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_expenses(request):
    user = request.user
    expenses = Expense.objects.filter(
        models.Q(participants=user)
        | models.Q(added_by=user)
        | models.Q(paid_by=user)
        | models.Q(expensesplit__user=user)
    ).distinct().order_by('expense_date', 'date', 'id').prefetch_related('expensesplit_set__user', 'paid_by', 'added_by')

    # collect involved users
    user_ids = {user.id}
    for exp in expenses:
        for s in exp.expensesplit_set.all():
            user_ids.add(s.user_id)
        user_ids.add(exp.added_by_id)
        user_ids.add(exp.paid_by_id)
    users_map = {u.id: u for u in User.objects.filter(id__in=user_ids)}

    def display_name(u):
        full = u.get_full_name()
        return full if full else u.username

    other_ids = sorted([uid for uid in user_ids if uid != user.id], key=lambda uid: display_name(users_map[uid]).lower())
    ordered_user_ids = [user.id] + other_ids
    ordered_user_names = [display_name(users_map[uid]) for uid in ordered_user_ids]

    tz_offset = 0
    try:
        tz_offset = int(request.GET.get("tz_offset", "0"))
    except ValueError:
        tz_offset = 0
    now_utc = timezone.now()
    # getTimezoneOffset is minutes to add to local to get UTC, so local = UTC - offset
    now_ts = now_utc - timedelta(minutes=tz_offset)
    response = HttpResponse(content_type='text/csv')
    filename = f"{user.username}_{now_ts.strftime('%Y-%m-%dT%H-%M-%S')}.csv"
    response['Content-Disposition'] = f'attachment; filename=\"{filename}\"'
    writer = csv.writer(response)
    header = ["Date", "Description", "Category", "Amount", "Currency", "CreatedBy", "PaidBy", "SplitMethod", "SplitOptions"] + ordered_user_names
    writer.writerow(header)

    for exp in expenses:
        splits = list(exp.expensesplit_set.all())
        net_by_user = {}
        for s in splits:
            net_by_user[s.user_id] = net_by_user.get(s.user_id, 0) + float(s.paid_amount) - float(s.owed_amount)

        split_options = {}
        if exp.split_method != 'equal':
            for s in splits:
                split_options[display_name(s.user)] = float(s.owed_amount)

        row = [
            exp.expense_date.isoformat(),
            exp.name,
            exp.category,
            float(exp.amount),
            exp.currency,
            display_name(exp.added_by),
            display_name(exp.paid_by),
            exp.split_method.title() if exp.split_method else "",
            json.dumps(split_options) if split_options else "",
        ]
        for uid in ordered_user_ids:
            row.append(net_by_user.get(uid, 0))
        writer.writerow(row)

    # Append download timestamp row (and a spacer)
    writer.writerow([])
    writer.writerow([])
    writer.writerow([now_ts.strftime("%Y-%m-%d %H:%M:%S")] + [""] * (len(header) - 1))

    return response
from rest_framework import status

import logging
logger = logging.getLogger(__name__)

def _log_activity(action, expense, actor, splits_data, participants_ids, payer_id):
    try:
        activity = Activity.objects.create(
            expense=expense if action != 'deleted' else None,
            actor=actor,
            action=action,
            expense_name=expense.name,
            expense_amount=expense.amount,
            split_method=expense.split_method,
            expense_date=expense.expense_date,
            currency=expense.currency,
            participants_snapshot=[int(p) for p in participants_ids],
        )
        involved = set(participants_ids)
        involved.add(payer_id)
        involved.add(expense.added_by_id)
        for split in splits_data:
            involved.add(int(split['user']))
        activity.involved_users.set(User.objects.filter(id__in=involved))
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")

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
        currency = data.get('currency', 'ARS')

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
        elif split_method in ['full_owed', 'full_owe']:
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
            for split in splits_data:
                ExpenseSplit.objects.create(
                    expense=expense,
                    user=User.objects.get(id=split['user']),
                    paid_amount=Decimal(str(split.get('paid_amount', 0))),
                    owed_amount=Decimal(str(split.get('owed_amount', 0))),
                )
            _log_activity('created', expense, self.request.user, splits_data, participants, payer_id)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        splits_data = list(request.data.get('splits', []))
        participants = request.data.get('participants', [])
        split_method = request.data.get('split_method')
        total_amount = Decimal(str(request.data.get('amount')))
        payer_id = int(request.data.get('paid_by'))
        currency = request.data.get('currency', instance.currency)

        normalized = {}
        for split in splits_data:
            uid = int(split['user'])
            entry = normalized.get(uid, {"user": uid, "paid_amount": Decimal('0'), "owed_amount": Decimal('0'), "value": Decimal('0')})
            entry["paid_amount"] += Decimal(str(split.get('paid_amount', 0)))
            entry["owed_amount"] += Decimal(str(split.get('owed_amount', 0)))
            entry["value"] += Decimal(str(split.get('value', 0)))
            normalized[uid] = entry
        splits_data = list(normalized.values())

        if split_method == 'manual':
            total_owed = sum(Decimal(str(split['owed_amount'])) for split in splits_data)
            if total_owed != total_amount:
                raise ValidationError("The total owed amounts must equal the expense amount.")
        elif split_method in ['full_owed', 'full_owe']:
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
            serializer.save()
            ExpenseSplit.objects.filter(expense=instance).delete()
            for split in splits_data:
                ExpenseSplit.objects.create(
                    expense=instance,
                    user=User.objects.get(id=split['user']),
                    paid_amount=Decimal(str(split.get('paid_amount', 0))),
                    owed_amount=Decimal(str(split.get('owed_amount', 0))),
                )
            _log_activity('updated', instance, request.user, splits_data, participants, payer_id)

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        splits = list(instance.expensesplit_set.all())
        participants_ids = [s.user_id for s in splits]
        payer_id = instance.paid_by_id
        splits_data = [
            {"user": s.user_id, "paid_amount": s.paid_amount, "owed_amount": s.owed_amount, "value": 0}
            for s in splits
        ]
        with transaction.atomic():
            response = super().destroy(request, *args, **kwargs)
            _log_activity('deleted', instance, request.user, splits_data, participants_ids, payer_id)
        return response

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
                key = (uid, expense.currency)
                dest = balances_map.setdefault(
                    key,
                    {
                        "user_id": uid,
                        "username": u.username,
                        "display_name": u.get_full_name() or u.username,
                        "amount": Decimal('0'),
                        "currency": expense.currency,
                    },
                )
                dest["amount"] += entry["owed"]
        else:
            my_entry = split_totals.get(current_user.id)
            if my_entry:
                key = (payer.id, expense.currency)
                dest = balances_map.setdefault(
                    key,
                    {
                        "user_id": payer.id,
                        "username": payer.username,
                        "display_name": payer.get_full_name() or payer.username,
                        "amount": Decimal('0'),
                        "currency": expense.currency,
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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def activities(request):
    user = request.user
    qs = Activity.objects.filter(involved_users=user).order_by('-created_at')[:100]
    serializer = ActivitySerializer(qs, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def settle_up(request):
    current_user = request.user
    target_id = request.data.get('user_id')
    currency = request.data.get('currency')
    if not target_id:
        return Response({"error": "user_id is required"}, status=400)
    if not currency:
        return Response({"error": "currency is required"}, status=400)
    try:
        target_user = User.objects.get(id=target_id)
    except User.DoesNotExist:
        return Response({"error": "user not found"}, status=404)

    # Compute net balance between current_user and target_user
    expenses = Expense.objects.filter(
        expensesplit__user=current_user
    ).filter(
        expensesplit__user=target_user
    ).filter(currency=currency).exclude(split_method__in=['full_owed', 'full_owe']).exclude(name__startswith="Settle with ").prefetch_related('expensesplit_set__user', 'paid_by').distinct()

    net = Decimal('0')
    for expense in expenses:
        splits = list(expense.expensesplit_set.all())

        split_totals = {}
        for s in splits:
            entry = split_totals.setdefault(
                s.user.id,
                {"owed": Decimal('0'), "paid": Decimal('0')},
            )
            entry["owed"] += Decimal(str(s.owed_amount))
            entry["paid"] += Decimal(str(s.paid_amount))

        if current_user.id not in split_totals or target_user.id not in split_totals:
            continue

        my_entry = split_totals.get(current_user.id, {"owed": Decimal('0'), "paid": Decimal('0')})
        other_entry = split_totals.get(target_user.id, {"owed": Decimal('0'), "paid": Decimal('0')})

        payer_id = expense.paid_by_id
        if payer_id == current_user.id:
            # target owes current user
            net += other_entry["owed"]
        elif payer_id == target_user.id:
            # current user owes target
            net -= my_entry["owed"]
        else:
            # third-party payer: no net between these two
            continue

    if net == 0:
        return Response({"message": "Nothing to settle"}, status=200)

    amount = abs(net)
    # Create settlement expense
    with transaction.atomic():
        if net > 0:
            # target owes current_user; target pays
            settlement = Expense.objects.create(
                name=f"Settle with {target_user.get_full_name() or target_user.username}",
                amount=amount,
                category="Other",
                expense_date=timezone.now().date(),
                paid_by=target_user,
                split_method="manual",
                added_by=current_user,
                currency=currency,
            )
            ExpenseSplit.objects.create(expense=settlement, user=target_user, paid_amount=amount, owed_amount=Decimal('0'))
            ExpenseSplit.objects.create(expense=settlement, user=current_user, paid_amount=Decimal('0'), owed_amount=amount)
            settlement.participants.set([current_user.id, target_user.id])
            _log_activity('settled', settlement, current_user, [
                {"user": target_user.id, "paid_amount": amount, "owed_amount": Decimal('0')},
                {"user": current_user.id, "paid_amount": Decimal('0'), "owed_amount": amount},
            ], [current_user.id, target_user.id], target_user.id)
        else:
            # current_user owes target; current_user pays
            settlement = Expense.objects.create(
                name=f"Settle with {target_user.get_full_name() or target_user.username}",
                amount=amount,
                category="Other",
                expense_date=timezone.now().date(),
                paid_by=current_user,
                split_method="manual",
                added_by=current_user,
                currency=currency,
            )
            ExpenseSplit.objects.create(expense=settlement, user=current_user, paid_amount=amount, owed_amount=Decimal('0'))
            ExpenseSplit.objects.create(expense=settlement, user=target_user, paid_amount=Decimal('0'), owed_amount=amount)
            settlement.participants.set([current_user.id, target_user.id])
            _log_activity('settled', settlement, current_user, [
                {"user": current_user.id, "paid_amount": amount, "owed_amount": Decimal('0')},
                {"user": target_user.id, "paid_amount": Decimal('0'), "owed_amount": amount},
            ], [current_user.id, target_user.id], current_user.id)

    return Response({"message": "Settled", "amount": str(amount), "with": target_user.id})

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
