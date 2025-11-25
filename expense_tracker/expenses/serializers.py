from rest_framework import serializers
from .models import Expense, ExpenseSplit
from django.contrib.auth.models import User


class ExpenseSplitSerializer(serializers.ModelSerializer):
    value = serializers.FloatField(required=False, write_only=True, default=0)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ExpenseSplit
        fields = ['user', 'paid_amount', 'owed_amount', 'value']


class ExpenseSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, required=False)
    added_by = serializers.ReadOnlyField(source='added_by.username')
    participants = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True)

    class Meta:
        model = Expense
        fields = ['id', 'name', 'amount', 'category', 'date', 'added_by', 'participants', 'paid_by', 'splits', 'split_method']

    def create(self, validated_data):
        splits_data = validated_data.pop('splits', [])
        participants = validated_data.pop('participants', [])
        expense = Expense.objects.create(**validated_data)
        expense.participants.set(participants)

        for split_data in splits_data:
            split_data.pop('value', None)  # value is used for calculations but not stored
            ExpenseSplit.objects.create(expense=expense, **split_data)

        return expense
