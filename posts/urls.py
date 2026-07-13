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
    api_listar_blocos, api_criar_bloco, api_clipar_em_bloco, api_remover_card_bloco, api_desfazer_bloco, api_destruir_bloco,
    api_salvar_posicao_bloco, api_auth_login, api_auth_registrar, api_auth_logout, api_auth_refresh, api_auth_me,
    api_auth_senha_reset, api_auth_senha_confirmar,
)

urlpatterns = [
    # ── ISOLADO NA FASE A ──────────────────────────────────────────────────────
    # A view 'home' renderiza o Feed legado (Django Templates). Comentada porque
    # o FeedPage.tsx (React) é só um stub e não há mais link algum na UI ativa
    # apontando para esta rota.
    # path('', home, name='home'),
    # path('post/<int:post_id>/', detalhe_post, name='detalhe_post'),
    # path('novo/', criar_post, name='criar_post'),

    path('registrar/', registrar, name='registrar'),

    # Auth JWT — ATIVO (usado pelo LoginPage/RegistrarPage/SenhaResetPage em React)
    path('api/auth/login/',            api_auth_login,           name='api_auth_login'),
    path('api/auth/registrar/',        api_auth_registrar,       name='api_auth_registrar'),
    path('api/auth/logout/',           api_auth_logout,          name='api_auth_logout'),
    path('api/auth/refresh/',          api_auth_refresh,         name='api_auth_refresh'),
    path('api/auth/me/',               api_auth_me,              name='api_auth_me'),
    path('api/auth/senha/reset/',      api_auth_senha_reset,     name='api_auth_senha_reset'),
    path('api/auth/senha/confirmar/',  api_auth_senha_confirmar, name='api_auth_senha_confirmar'),

    # ── ISOLADO NA FASE A: categorias só eram usadas no Composer do Feed legado ──
    # path('api/categorias/buscar/',  buscar_categorias,        name='buscar_categorias'),
    # path('api/categorias/criar/',   criar_categoria,          name='criar_categoria'),
    # path('api/categorias/por-ids/', buscar_categoria_por_ids, name='buscar_categorias_por_ids'),

    # ── ISOLADO NA FASE A: comentários só existem em posts de Feed/Campo ────────
    # path('api/post/<int:post_id>/comentarios/',                       comentarios_post,        name='comentarios_post'),
    # path('api/post/<int:post_id>/comentar/',                          comentar_json,           name='comentar_json'),
    # path('api/comentario/<int:comentario_id>/votar/<str:direcao>/',   votar_comentario_json,   name='votar_comentario_json'),
    # path('api/comentario/<int:comentario_id>/excluir/',               excluir_comentario_json, name='excluir_comentario_json'),

    # ── ISOLADO NA FASE A: busca de usuários era para o Perfil/Social ───────────
    # path('api/usuarios/buscar/', buscar_usuarios_json, name='buscar_usuarios_json'),

    # ── ISOLADO NA FASE A: reações existem só em posts de Feed ──────────────────
    # path('api/post/<int:post_id>/reagir/<str:tipo>/', reagir_post, name='reagir_post'),

    # ── ISOLADO NA FASE A: Campo das Ideias — CampoPage.tsx é stub ──────────────
    # path('api/campo/grid/',                        campo_grid_json,           name='campo_grid_json'),
    # path('api/campo/interacao/',                   registrar_interacao_campo, name='registrar_interacao_campo'),
    # path('api/campo/postar/',                      criar_post_campo,          name='criar_post_campo'),
    # path('api/campo/meus-notes/',                  meus_notes_campo,          name='meus_notes_campo'),
    # path('api/campo/linha/<int:row_index>/mais/',  campo_linha_mais,          name='campo_linha_mais'),
    # path('api/campo/penalizar-card/',              penalizar_card_campo,      name='penalizar_card_campo'),
    # path('api/campo/pool/',                        campo_pool_json,           name='campo_pool_json'),

    # Notes privados — API — ATIVO (é o Mural Infinito, o V1 inteiro depende disso)
    path('api/notes/privados/',                    api_notes_privados,        name='api_notes_privados'),
    path('api/notes/criar/',                       api_criar_note,            name='api_criar_note'),
    path('api/notes/<int:post_id>/excluir/',       api_excluir_note,          name='api_excluir_note'),
    path('api/notes/<int:post_id>/publicar/',      api_publicar_note,         name='api_publicar_note'),
    path('api/notes/<int:note_id>/posicao/',       api_salvar_posicao_note,   name='api_salvar_posicao_note'),

    # Notes privados — BLOCOS — ATIVO
    path('api/blocos/',                               api_listar_blocos,      name='api_listar_blocos'),
    path('api/blocos/criar/',                         api_criar_bloco,        name='api_criar_bloco'),
    path('api/blocos/<int:bloco_id>/clipar/',          api_clipar_em_bloco,    name='api_clipar_em_bloco'),
    path('api/blocos/<int:bloco_id>/remover-card/',   api_remover_card_bloco, name='api_remover_card_bloco'),
    path('api/blocos/<int:bloco_id>/desfazer/',       api_desfazer_bloco,     name='api_desfazer_bloco'),
    path('api/blocos/<int:bloco_id>/destruir/',       api_destruir_bloco,     name='api_destruir_bloco'),
    path('api/blocos/<int:bloco_id>/posicao/',        api_salvar_posicao_bloco, name='api_salvar_posicao_bloco'),

    # ── ISOLADO NA FASE A: renderização de comentários em tela cheia (legado) ───
    # path('post/<int:post_id>/comentar/',                         comentar,             name='comentar'),
    # path('post/<int:post_id>/comentar/<int:pai_id>/responder/',  responder_comentario, name='responder_comentario'),
    # path('comentario/<int:comentario_id>/votar/<str:direcao>/',  votar_comentario,     name='votar_comentario'),
    # path('comentario/<int:comentario_id>/excluir/',              excluir_comentario,   name='excluir_comentario'),

    # ── ISOLADO NA FASE A: visibilidade/edição eram do Feed legado ──────────────
    # path('post/<int:post_id>/visibilidade/', alterar_visibilidade, name='alterar_visibilidade'),
    # path('post/<int:post_id>/desistir/',     desistir_ideia,       name='desistir_ideia'),
    # path('post/<int:post_id>/editar/',       editar_post,          name='editar_post'),

    # ── ISOLADO NA FASE A: moderação era do Feed legado ──────────────────────────
    # path('post/<int:post_id>/candidatar/',                   candidatar_moderador,    name='candidatar_moderador'),
    # path('post/<int:post_id>/eleger/',                       pagina_eleger_moderador, name='pagina_eleger_moderador'),
    # path('post/<int:post_id>/eleger/<int:candidatura_id>/',  eleger_moderador,        name='eleger_moderador'),
    # path('post/<int:post_id>/recusar/<int:candidatura_id>/', recusar_candidatura,     name='recusar_candidatura'),

    # ── ISOLADO NA FASE A: notificações eram sobre seguidores/comentários ───────
    # path('notificacoes/<str:canal>/', notificacoes, name='notificacoes'),

    # ── ISOLADO NA FASE A: perfil e social ───────────────────────────────────────
    # path('perfil/editar/',                              editar_perfil,    name='editar_perfil'),
    # path('perfil/<str:username>/',                      perfil,           name='perfil'),
    # path('perfil/<str:username>/seguir/',               seguir_autor,     name='seguir_autor'),
    # path('perfil/<str:username>/seguidores/',            lista_seguidores, name='lista_seguidores'),
    # path('perfil/<str:username>/seguindo/',              lista_seguindo,   name='lista_seguindo'),

    # ── ISOLADO NA FASE A: busca de usuários (Perfil/Social) ─────────────────────
    # path('usuarios/buscar/', buscar_usuarios, name='buscar_usuarios'),
]