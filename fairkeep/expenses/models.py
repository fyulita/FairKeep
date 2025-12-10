from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Q

# Create your models here.
class Expense(models.Model):
    CATEGORY_CHOICES = [
        ('Home Supplies', 'Home Supplies'),
        ('Food', 'Food'),
        ('Transport', 'Transport'),
        ('Entertainment', 'Entertainment'),
        ('Periodic Expenses', 'Periodic Expenses'),
        ('Health', 'Health'),
        ('Other', 'Other'),
    ]

    SPLIT_METHODS = [
        ('equal', 'Split Equally'),
        ('personal', 'Personal'),
        ('manual', 'Manual Amount Entry'),
        ('percentage', 'Percentage-Based'),
        ('ratio', 'Ratio-Based'),
        ('shares', 'Shares-Based'),
        ('excess', 'Excess Adjustment'),
        ('full_owed', 'You are owed full amount'),
        ('full_owe', 'You owe full amount'),
    ]

    CURRENCY_CHOICES = [
        ('ARS', 'Peso Argentino'),
        ('UYU', 'Peso Uruguayo'),
        ('CLP', 'Peso Chileno'),
        ('MXN', 'Peso Mexicano'),
        ('BRL', 'Real Brasilero'),
        ('USD', 'Dolar EEUU'),
        ('EUR', 'Euro'),
        ('GBP', 'Libras'),
        ('JPY', 'Yenes'),
        ('PYG', 'Guaranies Paraguayos'),
        ('AUD', 'Dolar Australiano'),
        ('KRW', 'Won Coreano'),
    ]

    name = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    date = models.DateTimeField(auto_now_add=True)
    expense_date = models.DateField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='ARS')
    added_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='added_expenses')
    participants = models.ManyToManyField(User, through='ExpenseSplit', related_name='shared_expenses')
    paid_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='paid_expenses')
    split_method = models.CharField(max_length=50, choices=SPLIT_METHODS)
    split_details = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} - {self.amount}"

class ExpenseSplit(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    owed_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.user.username} owes {self.owed_amount} for {self.expense.name}"


class Activity(models.Model):
    ACTION_CHOICES = [
        ('created', 'Created'),
        ('updated', 'Updated'),
        ('deleted', 'Deleted'),
        ('settled', 'Settled'),
    ]

    expense = models.ForeignKey(Expense, on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='activities_done')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    expense_name = models.CharField(max_length=100)
    expense_amount = models.DecimalField(max_digits=10, decimal_places=2)
    split_method = models.CharField(max_length=50, blank=True)
    expense_date = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=3, choices=Expense.CURRENCY_CHOICES, default='ARS')
    involved_users = models.ManyToManyField(User, related_name='activities_involved')
    participants_snapshot = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.action} - {self.expense_name}"


class ContactRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contact_requests_sent')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contact_requests_received')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['from_user', 'to_user'], name='unique_contact_request'),
        ]

    def __str__(self):
        return f"{self.from_user} -> {self.to_user} ({self.status})"

    @staticmethod
    def accepted_contacts(user):
        accepted = ContactRequest.objects.filter(
            status='accepted'
        ).filter(Q(from_user=user) | Q(to_user=user))
        contact_ids = set()
        for req in accepted:
            contact_ids.add(req.from_user_id if req.to_user_id == user.id else req.to_user_id)
        return contact_ids


class UserAvatar(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='avatar')
    data = models.TextField(blank=True, default='')

    def __str__(self):
        return f"Avatar for {self.user.username}"
