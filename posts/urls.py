from django.urls import path
from .views import listar_post

urlpatterns = [
    path('', listar_post, name='listar_posts')
]
