from django.db import models
from django.contrib.auth.models import User

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
    ]

    name = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    date = models.DateTimeField(auto_now_add=True)
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
