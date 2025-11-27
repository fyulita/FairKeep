from rest_framework import serializers
from .models import Expense, ExpenseSplit
from django.contrib.auth.models import User


class ExpenseSplitSerializer(serializers.ModelSerializer):
    value = serializers.FloatField(required=False, default=0)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ExpenseSplit
        fields = ['user', 'paid_amount', 'owed_amount', 'value']


class ExpenseSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, required=False, source='expensesplit_set')
    added_by = serializers.ReadOnlyField(source='added_by.username')
    added_by_display = serializers.SerializerMethodField()
    participants = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True)
    paid_by_username = serializers.ReadOnlyField(source='paid_by.username')
    paid_by_display = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            'id',
            'name',
            'amount',
            'category',
            'date',
            'expense_date',
            'added_by',
            'added_by_display',
            'participants',
            'paid_by',
            'paid_by_username',
            'paid_by_display',
            'splits',
            'split_method',
        ]

    def get_added_by_display(self, obj):
        full = obj.added_by.get_full_name()
        return full if full else obj.added_by.username

    def get_paid_by_display(self, obj):
        full = obj.paid_by.get_full_name()
        return full if full else obj.paid_by.username

    def create(self, validated_data):
        splits_data = validated_data.pop('expensesplit_set', [])
        validated_data.pop('participants', None)  # handled in view via splits_data
        expense = Expense.objects.create(**validated_data)

        return expense

    def update(self, instance, validated_data):
        # Avoid nested writes; handled in view
        validated_data.pop('expensesplit_set', None)
        validated_data.pop('participants', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
