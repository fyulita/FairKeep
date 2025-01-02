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

    name = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    date = models.DateTimeField(auto_now_add=True)
    added_by = models.ForeignKey(User, related_name='added_expenses', on_delete=models.CASCADE)
    participants = models.ManyToManyField(User, through='ExpenseSplit', related_name='shared_expenses')

    def __str__(self):
        return f"{self.name} - {self.amount}"

    def clean(self):
        if self.amount < 0:
            raise ValidationError('Amount must be non-negative.')

class ExpenseSplit(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    owed_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.user.username} owes {self.owed_amount} for {self.expense.name}"