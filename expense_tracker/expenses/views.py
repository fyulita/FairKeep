from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import Expense
from .serializers import ExpenseSerializer

# Create your views here.
class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()  # Define what data to query
    serializer_class = ExpenseSerializer  # Link the serializer
    #permission_classes = [IsAuthenticated]  # Add this line to require authentication
    permission_classes = [AllowAny]