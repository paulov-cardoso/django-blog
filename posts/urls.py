from django.urls import path
from .views import home, detalhe_post, criar_post, registrar, jogar_para_universo, desistir_ideia, editar_post

urlpatterns = [
    path('', home, name='home'),
    path('post/<int:post_id>/', detalhe_post, name='detalhe_post'),
    path('novo/', criar_post, name='criar_post'),
    path('registrar/', registrar, name='registrar'),
    path('post/<int:post_id>/jogar/', jogar_para_universo, name='jogar_para_universo'),
    path('post/<int:post_id>/desistir/', desistir_ideia, name='desistir_ideia'),
    path('post/<int:post_id>/editar/', editar_post, name='editar_post'),
]
