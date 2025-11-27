from django.contrib import admin
from .models import Expense, ExpenseSplit


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("name", "amount", "category", "expense_date", "date", "added_by", "paid_by", "split_method")
    list_filter = ("category", "split_method", "expense_date", "date")
    search_fields = ("name", "added_by__username", "paid_by__username")
    date_hierarchy = "date"


@admin.register(ExpenseSplit)
class ExpenseSplitAdmin(admin.ModelAdmin):
    list_display = ("expense", "user", "paid_amount", "owed_amount")
    search_fields = ("expense__name", "user__username")
