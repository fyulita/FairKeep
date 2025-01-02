from rest_framework import serializers
from .models import Expense, ExpenseSplit
from django.contrib.auth.models import User


class ExpenseSplitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseSplit
        fields = ['user', 'paid_amount', 'owed_amount']


class ExpenseSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, required=False)
    added_by = serializers.ReadOnlyField(source='added_by.username')

    class Meta:
        model = Expense
        fields = ['id', 'name', 'amount', 'category', 'date', 'added_by', 'participants', 'splits']

    def create(self, validated_data):
        splits_data = validated_data.pop('splits', [])
        expense = Expense.objects.create(**validated_data)
        
        # Create related splits
        for split_data in splits_data:
            ExpenseSplit.objects.create(expense=expense, **split_data)
        
        return expense