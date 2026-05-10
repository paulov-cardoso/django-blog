from django.urls import path
from .views import (
    home, perfil, seguir_autor,
    criar_post, editar_post, detalhe_post,
    jogar_para_universo, desistir_ideia,
    candidatar_moderador, eleger_moderador,
    pagina_eleger_moderador, recusar_candidatura,
    registrar,
)

urlpatterns = [
    path('', home, name='home'),
    path('post/<int:post_id>/', detalhe_post, name='detalhe_post'),
    path('novo/', criar_post, name='criar_post'),
    path('registrar/', registrar, name='registrar'),

    # visibilidade
    path('post/<int:post_id>/jogar/',    jogar_para_universo, name='jogar_para_universo'),
    path('post/<int:post_id>/desistir/', desistir_ideia,      name='desistir_ideia'),
    path('post/<int:post_id>/editar/',   editar_post,         name='editar_post'),

    # moderação
    path('post/<int:post_id>/candidatar/',                   candidatar_moderador,    name='candidatar_moderador'),
    path('post/<int:post_id>/eleger/',                       pagina_eleger_moderador, name='pagina_eleger_moderador'),
    path('post/<int:post_id>/eleger/<int:candidatura_id>/',  eleger_moderador,        name='eleger_moderador'),
    path('post/<int:post_id>/recusar/<int:candidatura_id>/', recusar_candidatura,     name='recusar_candidatura'),

    # perfil e social
    path('perfil/<str:username>/',        perfil,       name='perfil'),
    path('perfil/<str:username>/seguir/', seguir_autor, name='seguir_autor'),
]
