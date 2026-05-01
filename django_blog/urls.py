"""
URL configuration for django_blog project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
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
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('posts.urls')),
    path('login/', auth_views.LoginView.as_view(template_name='posts/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='/'), name='logout'),
    path('senha/reset/', auth_views.PasswordResetView.as_view(
        template_name='posts/senha_reset.html',
        email_template_name='posts/senha_reset_email.html',
        success_url='/senha/reset/enviado/'
    ), name='password_reset'),

    path('senha/reset/enviado/', auth_views.PasswordResetDoneView.as_view(
        template_name='posts/senha_reset_enviado.html'
    ), name='password_reset_done'),

    path('senha/reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='posts/senha_reset_confirmar.html',
        success_url='/senha/reset/concluido/'
    ), name='password_reset_confirm'),

    path('senha/reset/concluido/', auth_views.PasswordResetCompleteView.as_view(
        template_name='posts/senha_reset_concluido.html'
    ), name='password_reset_complete'),
]
