from django.urls import path
from .views import (
    home, perfil, seguir_autor,
    criar_post, editar_post, detalhe_post,
    alterar_visibilidade, desistir_ideia,
    candidatar_moderador, eleger_moderador,
    pagina_eleger_moderador, recusar_candidatura,
    registrar, reagir_post, notificacoes,
    editar_perfil, buscar_categorias, criar_categoria, buscar_categoria_por_ids
    )


urlpatterns = [
    path('', home, name='home'),
    path('post/<int:post_id>/', detalhe_post, name='detalhe_post'),
    path('novo/', criar_post, name='criar_post'),
    path('registrar/', registrar, name='registrar'),

    # API DE CATEGORIAS
    path('api/categorias/buscar/',  buscar_categorias, name='buscar_categorias'),
    path('api/categorias/criar/',   criar_categoria,   name='criar_categoria'),
    path('api/categorias/por-ids/', buscar_categoria_por_ids, name='buscar_categorias_por_ids'),

    # visibilidade
    path('post/<int:post_id>/visibilidade/', alterar_visibilidade, name='alterar_visibilidade'),
    path('post/<int:post_id>/desistir/',     desistir_ideia,       name='desistir_ideia'),
    path('post/<int:post_id>/editar/',       editar_post,          name='editar_post'),

    # moderação
    path('post/<int:post_id>/candidatar/',                   candidatar_moderador,    name='candidatar_moderador'),
    path('post/<int:post_id>/eleger/',                       pagina_eleger_moderador, name='pagina_eleger_moderador'),
    path('post/<int:post_id>/eleger/<int:candidatura_id>/',  eleger_moderador,        name='eleger_moderador'),
    path('post/<int:post_id>/recusar/<int:candidatura_id>/', recusar_candidatura,     name='recusar_candidatura'),

    # reações
    path('post/<int:post_id>/reagir/<str:tipo>/', reagir_post, name='reagir_post'),

    # notificações
    path('notificacoes/<str:canal>/', notificacoes, name='notificacoes'),

    # perfil e social
    path('perfil/editar/',                editar_perfil,    name='editar_perfil'),
    path('perfil/<str:username>/',        perfil,           name='perfil'),
    path('perfil/<str:username>/seguir/', seguir_autor,     name='seguir_autor'),
]
