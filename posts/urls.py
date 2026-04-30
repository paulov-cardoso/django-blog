from django.urls import path
from .views import listar_post, detalhe_post

urlpatterns = [
    path('', listar_post, name='listar_posts'),
    path('post/<int:post_id>', detalhe_post, name='detalhe_post'),
]
