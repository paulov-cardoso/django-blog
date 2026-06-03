from django.urls import path
from .views import (
    home, perfil, seguir_autor, criar_post, editar_post, detalhe_post, alterar_visibilidade, desistir_ideia,
    candidatar_moderador, eleger_moderador, pagina_eleger_moderador, recusar_candidatura, registrar, reagir_post, 
    notificacoes, editar_perfil, buscar_categorias, criar_categoria, buscar_categoria_por_ids, buscar_usuarios, 
    buscar_usuarios_json, comentar, responder_comentario, votar_comentario, excluir_comentario, comentarios_post, 
    comentar_json, votar_comentario_json, excluir_comentario_json, lista_seguidores, lista_seguindo, campo_grid_json, 
    registrar_interacao_campo, criar_post_campo, meus_notes_campo, campo_linha_mais, penalizar_card_campo, campo_pool_json,
    api_notes_privados, api_notes_privados, api_criar_note, api_excluir_note, api_publicar_note,
    api_notes_privados, api_criar_note, api_excluir_note, api_publicar_note, api_salvar_posicao_note,
)

urlpatterns = [
    path('', home, name='home'),
    path('post/<int:post_id>/', detalhe_post, name='detalhe_post'),
    path('novo/', criar_post, name='criar_post'),
    path('registrar/', registrar, name='registrar'),

    # API de categorias
    path('api/categorias/buscar/',  buscar_categorias,        name='buscar_categorias'),
    path('api/categorias/criar/',   criar_categoria,          name='criar_categoria'),
    path('api/categorias/por-ids/', buscar_categoria_por_ids, name='buscar_categorias_por_ids'),

    # API de comentários (JSON)
    path('api/post/<int:post_id>/comentarios/',                       comentarios_post,        name='comentarios_post'),
    path('api/post/<int:post_id>/comentar/',                          comentar_json,           name='comentar_json'),
    path('api/comentario/<int:comentario_id>/votar/<str:direcao>/',   votar_comentario_json,   name='votar_comentario_json'),
    path('api/comentario/<int:comentario_id>/excluir/',               excluir_comentario_json, name='excluir_comentario_json'),

    # API de busca de usuários (JSON)
    path('api/usuarios/buscar/', buscar_usuarios_json, name='buscar_usuarios_json'),

    # API de reações (JSON)
    path('api/post/<int:post_id>/reagir/<str:tipo>/', reagir_post, name='reagir_post'),

    # Campo das Ideias — API
    path('api/campo/grid/',                        campo_grid_json,           name='campo_grid_json'),
    path('api/campo/interacao/',                   registrar_interacao_campo, name='registrar_interacao_campo'),
    path('api/campo/postar/',                      criar_post_campo,          name='criar_post_campo'),
    path('api/campo/meus-notes/',                  meus_notes_campo,          name='meus_notes_campo'),
    path('api/campo/linha/<int:row_index>/mais/',  campo_linha_mais,          name='campo_linha_mais'),
    path('api/campo/penalizar-card/',              penalizar_card_campo,      name='penalizar_card_campo'),
    path('api/campo/pool/',                        campo_pool_json,           name='campo_pool_json'),

    # Notes privados — API
    path('api/notes/privados/',                    api_notes_privados,        name='api_notes_privados'),
    path('api/notes/criar/',                       api_criar_note,            name='api_criar_note'),
    path('api/notes/<int:post_id>/excluir/',       api_excluir_note,          name='api_excluir_note'),
    path('api/notes/<int:post_id>/publicar/',      api_publicar_note,         name='api_publicar_note'),
    path('api/notes/<int:note_id>/posicao/',       api_salvar_posicao_note,   name='api_salvar_posicao_note'),

    # Rotas legadas (para detail.html em tela cheia)
    path('post/<int:post_id>/comentar/',                         comentar,             name='comentar'),
    path('post/<int:post_id>/comentar/<int:pai_id>/responder/',  responder_comentario, name='responder_comentario'),
    path('comentario/<int:comentario_id>/votar/<str:direcao>/',  votar_comentario,     name='votar_comentario'),
    path('comentario/<int:comentario_id>/excluir/',              excluir_comentario,   name='excluir_comentario'),

    # Visibilidade
    path('post/<int:post_id>/visibilidade/', alterar_visibilidade, name='alterar_visibilidade'),
    path('post/<int:post_id>/desistir/',     desistir_ideia,       name='desistir_ideia'),
    path('post/<int:post_id>/editar/',       editar_post,          name='editar_post'),

    # Moderação
    path('post/<int:post_id>/candidatar/',                   candidatar_moderador,    name='candidatar_moderador'),
    path('post/<int:post_id>/eleger/',                       pagina_eleger_moderador, name='pagina_eleger_moderador'),
    path('post/<int:post_id>/eleger/<int:candidatura_id>/',  eleger_moderador,        name='eleger_moderador'),
    path('post/<int:post_id>/recusar/<int:candidatura_id>/', recusar_candidatura,     name='recusar_candidatura'),

    # Notificações
    path('notificacoes/<str:canal>/', notificacoes, name='notificacoes'),

    # Perfil e social
    path('perfil/editar/',                              editar_perfil,    name='editar_perfil'),
    path('perfil/<str:username>/',                      perfil,           name='perfil'),
    path('perfil/<str:username>/seguir/',               seguir_autor,     name='seguir_autor'),
    path('perfil/<str:username>/seguidores/',            lista_seguidores, name='lista_seguidores'),
    path('perfil/<str:username>/seguindo/',              lista_seguindo,   name='lista_seguindo'),

    # Search de usuários
    path('usuarios/buscar/', buscar_usuarios, name='buscar_usuarios'),
]

