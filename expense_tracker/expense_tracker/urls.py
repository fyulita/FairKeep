"""
URL configuration for expense_tracker project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from expenses.views import ExpenseViewSet, login_view, logout_view, csrf_token_view, check_session_view, balances, user_list, activities, settle_up, user_detail, change_password

router = DefaultRouter()
router.register(r'expenses', ExpenseViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),  # API endpoints
    path('api/login/', login_view, name='login'),  # Login endpoint
    path('api/logout/', logout_view, name='logout'),  # Logout endpoint
    path('api/csrf/', csrf_token_view, name='csrf_token'),
    path('api/check-session/', check_session_view, name='check_session'),
    path('api/balances/', balances, name='balances'),
    path('api/users/', user_list, name='user_list'),
    path('api/users/<int:user_id>/', user_detail, name='user_detail'),
    path('api/change-password/', change_password, name='change_password'),
    path('api/activities/', activities, name='activities'),
    path('api/settle/', settle_up, name='settle_up'),
]
