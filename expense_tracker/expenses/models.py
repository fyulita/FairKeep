from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

# Create your models here.
class Expense(models.Model):
    CATEGORY_CHOICES = [
        ('Home Supplies', 'Home Supplies'),
        ('Food', 'Food'),
        ('Transport', 'Transport'),
        ('Entertainment', 'Entertainment'),
        ('Periodic Expenses', 'Periodic Expenses'),
        ('Other', 'Other'),
    ]

    SPLIT_METHODS = [
        ('equal', 'Split Equally'),
        ('manual', 'Manual Amount Entry'),
        ('percentage', 'Percentage-Based'),
        ('ratio', 'Ratio-Based'),
        ('shares', 'Shares-Based'),
        ('excess', 'Excess Adjustment'),
        ('full_owed', 'You are owed full amount'),
        ('full_owe', 'You owe full amount'),
    ]

    name = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    date = models.DateTimeField(auto_now_add=True)
    expense_date = models.DateField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
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
    ]

    expense = models.ForeignKey(Expense, on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='activities_done')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    expense_name = models.CharField(max_length=100)
    expense_amount = models.DecimalField(max_digits=10, decimal_places=2)
    split_method = models.CharField(max_length=50, blank=True)
    expense_date = models.DateField(null=True, blank=True)
    involved_users = models.ManyToManyField(User, related_name='activities_involved')
    participants_snapshot = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.action} - {self.expense_name}"
