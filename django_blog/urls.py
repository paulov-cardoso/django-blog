from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views
from django.conf import settings
from django.conf.urls.static import static

_AUTH_TEMPLATES = 'posts/auth/'

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('posts.urls')),

    path('login/', auth_views.LoginView.as_view(
        template_name=_AUTH_TEMPLATES + 'login.html',
    ), name='login'),

    path('logout/', auth_views.LogoutView.as_view(
        next_page='/',
    ), name='logout'),

    path('senha/reset/', auth_views.PasswordResetView.as_view(
        template_name=_AUTH_TEMPLATES + 'senha_reset.html',
        email_template_name=_AUTH_TEMPLATES + 'senha_reset_email.html',
        success_url='/senha/reset/enviado/',
    ), name='password_reset'),

    path('senha/reset/enviado/', auth_views.PasswordResetDoneView.as_view(
        template_name=_AUTH_TEMPLATES + 'senha_reset_enviado.html',
    ), name='password_reset_done'),

    path('senha/reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name=_AUTH_TEMPLATES + 'senha_reset_confirmar.html',
        success_url='/senha/reset/concluido/',
    ), name='password_reset_confirm'),

    path('senha/reset/concluido/', auth_views.PasswordResetCompleteView.as_view(
        template_name=_AUTH_TEMPLATES + 'senha_reset_concluido.html',
    ), name='password_reset_complete'),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)