from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import Expense, ExpenseSplit, ContactRequest, UserAvatar


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


@admin.register(ContactRequest)
class ContactRequestAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = (
        "from_user__username",
        "to_user__username",
        "from_user__first_name",
        "from_user__last_name",
        "to_user__first_name",
        "to_user__last_name",
    )


@admin.register(UserAvatar)
class UserAvatarAdmin(admin.ModelAdmin):
    list_display = ("user", "has_data")
    search_fields = ("user__username", "user__first_name", "user__last_name")

    @admin.display(boolean=True, description="Has avatar")
    def has_data(self, obj):
        return bool(obj.data)

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
