from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
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

# Remove email from admin forms/list to avoid storing/editing redundant data
admin.site.unregister(User)

@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "first_name", "last_name", "is_staff")
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "password1", "password2", "first_name", "last_name"),
            },
        ),
    )
