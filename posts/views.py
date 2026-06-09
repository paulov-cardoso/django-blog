from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import login
from django.http import JsonResponse
from django.utils.text import slugify
from django.db.models import Q
from .models import (
    Post, Autor, ModeradorPost, CandidaturaModerador,
    Seguidor, PostReacao, Notificacao, Categoria,
    Comentario, VotoComentario,
    ScorePost, CampoInteracao, CampoCluster,
    CampoCardPenalidade, Bloco                 
)
from .forms import PostForm, RegistroForm, AutorForm
from .constants import GRID_COL, GRID_ROW, COLS_POR_LINHA

from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

# ── JWT decorator para views Django comuns ────────────────────────────────────

import functools
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

def jwt_required(view_func):
    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse({'erro': 'Token não fornecido.'}, status=401)
        raw_token = auth_header.split(' ', 1)[1]
        try:
            validated_token = AccessToken(raw_token)
            user_id = validated_token['user_id']
            request.user = User.objects.get(id=user_id)
        except (TokenError, InvalidToken, User.DoesNotExist):
            return JsonResponse({'erro': 'Token inválido ou expirado.'}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


# ── constantes ────────────────────────────────────────────────────────────────

_VISIBILIDADES_VALIDAS = {'privado', 'feed', 'campo'}

_ABA_POR_VISIBILIDADE = {
    'privado':  'notes_privados',
    'feed':     'feed',
    'campo':    'campo',
}

_DESTINO_MSG_VISIBILIDADE = {
    'privado': ('notes_privados', 'ideia_privada'),
    'feed':    ('feed',       'ideia_feed'),
    'campo':   ('campo',      'ideia_campo'),
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _pode_desistir(post):
    """
    Retorna (pode: bool, motivo: str).
    Privado          → sempre pode.
    Feed sem coop    → pode (volta para privado).
    Feed com coop    → exige moderador eleito.
    Campo das Ideias → sempre exige moderador eleito.
    """
    if post.visibilidade == 'privado':
        return True, ''

    tem_moderador = post.moderadores.filter(ativo=True).exists()

    if post.visibilidade == 'feed':
        tem_cooperacao = post.candidaturas.filter(status='aceito').exists()
        if not tem_cooperacao:
            return True, ''
        if tem_moderador:
            return True, ''
        return False, 'Este post tem cooperações aceitas. Eleja um moderador antes de desistir.'

    if post.visibilidade == 'campo':
        if tem_moderador:
            return True, ''
        return False, 'Posts no Campo das Ideias exigem pelo menos um moderador antes de você poder desistir.'

    return False, 'Visibilidade desconhecida.'


def _contexto_perfil(autor_perfil, request_user):
    """
    Monta o contexto reutilizável para renderizar o card de perfil.
    Só consulta posts privados quando for o próprio perfil.
    """
    autor_logado      = getattr(request_user, 'autor', None) if request_user.is_authenticated else None
    eh_proprio_perfil = autor_logado is not None and autor_logado == autor_perfil

    if eh_proprio_perfil:
        posts_visiveis = Post.objects.filter(
            autor=autor_perfil,
            publicado=True,
            visibilidade__in=['feed', 'campo'],
        ).order_by('-data_criacao')

        return {
            'autor_perfil':      autor_perfil,
            'posts_publicos':    posts_visiveis,
            'segue':             False,
            'eh_proprio_perfil': True,
            'total_privados':    Post.objects.filter(
                autor=autor_perfil, visibilidade='privado'
            ).count(),
        }

    segue = (
        autor_logado is not None
        and Seguidor.objects.filter(seguidor=autor_logado, seguido=autor_perfil).exists()
    )

    visibilidades = ['feed', 'campo'] if segue else ['campo']
    posts_visiveis = Post.objects.filter(
        autor=autor_perfil,
        publicado=True,
        visibilidade__in=visibilidades,
    ).order_by('-data_criacao')

    return {
        'autor_perfil':      autor_perfil,
        'posts_publicos':    posts_visiveis,
        'segue':             segue,
        'eh_proprio_perfil': False,
        'total_privados':    0,
    }


# ── home ──────────────────────────────────────────────────────────────────────

@login_required
def home(request):
    aba   = request.GET.get('aba', 'perfil')
    autor = request.user.autor

    if aba == 'perfil':
        return render(request, 'posts/home.html', {
            'aba': aba,
            **_contexto_perfil(autor, request.user),
        })

    if aba == 'notes_privados':
        posts = Post.objects.filter(
            autor=autor,
            visibilidade='privado',
        ).order_by('-data_criacao')

    elif aba == 'feed':
        seguindo_ids = Seguidor.objects.filter(
            seguidor=autor
        ).values_list('seguido_id', flat=True)

        posts = Post.objects.filter(
            publicado=True,
            visibilidade='feed',
        ).filter(
            Q(autor=autor) | Q(autor_id__in=seguindo_ids)
        ).order_by('-data_criacao')

        # Anota total de comentários por post
        from django.db.models import Count
        posts = posts.annotate(
            total_comentarios=Count(
                'comentarios',
                filter=Q(comentarios__removido=False),
            )
        )

    elif aba == 'campo':
        posts = Post.objects.filter(
            publicado=True,
            visibilidade='campo',
        ).order_by('-data_criacao')

    else:
        posts = Post.objects.none()

    return render(request, 'posts/home.html', {'posts': posts, 'aba': aba})


# ── perfil externo (carregado via fetch no modal) ─────────────────────────────

def perfil(request, username):
    user_perfil  = get_object_or_404(User, username=username)
    autor_perfil = get_object_or_404(Autor, usuario=user_perfil)
    return render(request, 'posts/perfil/perfil.html', _contexto_perfil(autor_perfil, request.user))


# ── editar perfil ─────────────────────────────────────────────────────────────

@login_required
def editar_perfil(request):
    autor = get_object_or_404(Autor, usuario=request.user)

    if request.method == 'POST':
        form = AutorForm(request.POST, request.FILES, instance=autor)
        if form.is_valid():
            form.save()
            return redirect('/?aba=perfil&msg=perfil_editado')
    else:
        form = AutorForm(instance=autor)

    return render(request, 'posts/perfil/editar_perfil.html', {'form': form, 'autor': autor})


# ── SEGUIR / DEIXAR DE SEGUIR ─────────────────────────────────────────────────

@login_required
def seguir_autor(request, username):
    if request.method != 'POST':
        return redirect('home')

    user_alvo    = get_object_or_404(User, username=username)
    autor_alvo   = get_object_or_404(Autor, usuario=user_alvo)
    autor_logado = request.user.autor

    if autor_logado == autor_alvo:
        return redirect('home')

    seguimento = Seguidor.objects.filter(seguidor=autor_logado, seguido=autor_alvo)
    if seguimento.exists():
        seguimento.delete()
    else:
        Seguidor.objects.create(seguidor=autor_logado, seguido=autor_alvo)
        Notificacao.objects.create(
            destinatario=autor_alvo,
            remetente=autor_logado,
            tipo='seguidor',
        )

    return redirect(request.META.get('HTTP_REFERER', '/'))


# ── criar post ────────────────────────────────────────────────────────────────

@login_required
def criar_post(request):
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post         = form.save(commit=False)
            post.cor     = request.POST.get('cor', '#3B82F6')
            post.autor   = request.user.autor
            visibilidade = request.POST.get('visibilidade', 'privado')

            if visibilidade not in _VISIBILIDADES_VALIDAS:
                visibilidade = 'privado'

            ids = request.POST.getlist('categorias_selecionadas')

            # Bloqueia criação pública sem categoria
            if visibilidade in ('feed', 'campo') and not ids:
                return redirect(
                    f'/novo/?titulo_inicial={request.POST.get("titulo", "")}'
                    f'&conteudo_inicial={request.POST.get("conteudo", "")}'
                    f'&titulo_capa_inicial={request.POST.get("titulo_capa", "")}'
                    f'&categorias_iniciais={",".join(ids)}'
                    f'&visibilidade={visibilidade}'
                    f'&erro=sem_categoria'
                )

            # Bloqueia publicação no feed sem capa
            if visibilidade == 'feed' and not request.FILES.get('imagem_capa_1'):
                return redirect(
                    f'/novo/?titulo_inicial={request.POST.get("titulo", "")}'
                    f'&conteudo_inicial={request.POST.get("conteudo", "")}'
                    f'&titulo_capa_inicial={request.POST.get("titulo_capa", "")}'
                    f'&categorias_iniciais={",".join(ids)}'
                    f'&visibilidade={visibilidade}'
                    f'&erro=sem_capa'
                )

            post.visibilidade = visibilidade
            post.publicado    = visibilidade != 'privado'

            if request.FILES.get('imagem_capa_1'):
                post.imagem_capa_1 = request.FILES['imagem_capa_1']
            if request.FILES.get('imagem_capa_2'):
                post.imagem_capa_2 = request.FILES['imagem_capa_2']

            post.save()

            if ids:
                post.categorias.set(Categoria.objects.filter(id__in=ids, aprovada=True))

            aba, msg = _DESTINO_MSG_VISIBILIDADE[visibilidade]
            return redirect(f'/?aba={aba}&msg={msg}')

    else:
        titulo_inicial      = request.GET.get('titulo_inicial', '').strip()
        conteudo_inicial    = request.GET.get('conteudo_inicial', '').strip()
        titulo_capa_inicial = request.GET.get('titulo_capa_inicial', '').strip()
        categorias_iniciais = request.GET.get('categorias_iniciais', '').strip()
        visibilidade        = request.GET.get('visibilidade', 'privado')

    if visibilidade not in _VISIBILIDADES_VALIDAS:
        visibilidade = 'privado'

    initial = {}
    if titulo_inicial:
        initial['titulo'] = titulo_inicial
    if conteudo_inicial:
        initial['conteudo'] = conteudo_inicial
    if titulo_capa_inicial:
        initial['titulo_capa'] = titulo_capa_inicial

    form = PostForm(initial=initial)

    return render(request, 'posts/posts/criar.html', {
        'form':                 form,
        'visibilidade':         visibilidade,
        'categorias_iniciais':  categorias_iniciais,
    })


# ── mudar visibilidade ────────────────────────────────────────────────────────

@login_required
def alterar_visibilidade(request, post_id):
    if request.method != 'POST':
        return redirect('home')

    post = get_object_or_404(Post, id=post_id)

    if post.autor.usuario != request.user:
        return redirect('home')

    nova_visibilidade = request.POST.get('visibilidade', 'campo')

    if nova_visibilidade not in _VISIBILIDADES_VALIDAS:
        return redirect('home')

    # Bloqueia publicação sem categoria
    if nova_visibilidade in ('feed', 'campo') and not post.categorias.exists():
        return redirect(f'/?aba=notes_privados&erro=sem_categoria&post_id={post_id}')

    # Bloqueia publicação no feed sem capa
    if nova_visibilidade == 'feed' and not post.tem_capa:
        return redirect(f'/?aba=notes_privados&erro=sem_capa&post_id={post_id}')

    post.visibilidade = nova_visibilidade
    post.publicado    = nova_visibilidade != 'privado'
    post.save(update_fields=['visibilidade', 'publicado'])

    aba, msg = _DESTINO_MSG_VISIBILIDADE[nova_visibilidade]
    return redirect(f'/?aba={aba}&msg={msg}')


# ── editar post ───────────────────────────────────────────────────────────────

@login_required
def editar_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)

    if post.autor.usuario != request.user:
        return redirect('home')

    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            post     = form.save(commit=False)
            post.cor = request.POST.get('cor', post.cor)

            if request.FILES.get('imagem_capa_1'):
                post.imagem_capa_1 = request.FILES['imagem_capa_1']
            if request.FILES.get('imagem_capa_2'):
                post.imagem_capa_2 = request.FILES['imagem_capa_2']

            post.save()

            ids = request.POST.getlist('categorias_selecionadas')
            if ids:
                post.categorias.set(Categoria.objects.filter(id__in=ids, aprovada=True))

            aba = _ABA_POR_VISIBILIDADE.get(post.visibilidade, 'notes_privados')
            return redirect(f'/?aba={aba}&msg=ideia_editada')
    else:
        form = PostForm(instance=post)

    return render(request, 'posts/posts/editar.html', {'form': form, 'post': post})


# ── detalhe público do post ───────────────────────────────────────────────────

def detalhe_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, publicado=True)
    pode, motivo = _pode_desistir(post)

    autor_logado           = getattr(request.user, 'autor', None) if request.user.is_authenticated else None
    candidaturas_pendentes = []
    ja_candidatou          = False

    if autor_logado:
        if post.autor == autor_logado:
            candidaturas_pendentes = post.candidaturas.filter(status='pendente')
        else:
            ja_candidatou = post.candidaturas.filter(candidato=autor_logado).exists()

    # ── Comentários ───────────────────────────────────────────────────────────

    comentarios_raiz_qs = (
        post.comentarios
        .filter(pai__isnull=True)
        .select_related('autor', 'autor__usuario')
        .prefetch_related('respostas__autor', 'respostas__autor__usuario', 'votos')
    )

    meus_votos = {}
    if autor_logado:
        ids_raiz = list(comentarios_raiz_qs.values_list('id', flat=True))
        ids_respostas = list(
            Comentario.objects.filter(pai_id__in=ids_raiz).values_list('id', flat=True)
        )
        todos_ids = ids_raiz + ids_respostas
        meus_votos = dict(
            VotoComentario.objects.filter(
                comentario_id__in=todos_ids,
                autor=autor_logado,
            ).values_list('comentario_id', 'valor')
        )

    comentarios_raiz = []
    for c in comentarios_raiz_qs:
        c.meu_voto = meus_votos.get(c.id)
        respostas = []
        for r in c.respostas.select_related('autor', 'autor__usuario').all():
            r.meu_voto = meus_votos.get(r.id)
            respostas.append(r)
        c.respostas_visiveis = respostas
        comentarios_raiz.append(c)

    total_comentarios    = post.comentarios.filter(removido=False).count()
    total_comentadores   = (
        post.comentarios
        .filter(removido=False)
        .values('autor')
        .distinct()
        .count()
    )

    return render(request, 'posts/posts/detail.html', {
        'post':                   post,
        'pode_desistir':          pode,
        'motivo_bloqueio':        motivo,
        'candidaturas_pendentes': candidaturas_pendentes,
        'moderadores_ativos':     post.moderadores.filter(ativo=True),
        'ja_candidatou':          ja_candidatou,
        'bloqueio_retirar_feed':  post.visibilidade == 'campo' and post.tem_interacoes,
        'comentarios_raiz':       comentarios_raiz,
        'total_comentarios':      total_comentarios,
        'total_comentadores':     total_comentadores,
    })

# ── CURTIR / CLIPAR POST ──────────────────────────────────────────────────────

@login_required
def reagir_post(request, post_id, tipo):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    TIPOS_VALIDOS = {'curtida', 'clip'}
    if tipo not in TIPOS_VALIDOS:
        return JsonResponse({'erro': 'Tipo inválido.'}, status=400)

    post  = get_object_or_404(Post, id=post_id, publicado=True)
    autor = request.user.autor

    reacao = PostReacao.objects.filter(post=post, autor=autor, tipo=tipo)
    if reacao.exists():
        reacao.delete()
        ativo = False
    else:
        PostReacao.objects.create(post=post, autor=autor, tipo=tipo)
        ativo = True

        if post.autor != autor:
            Notificacao.objects.create(
                destinatario=post.autor,
                remetente=autor,
                post=post,
                tipo=tipo,
            )

    total = PostReacao.objects.filter(post=post, tipo=tipo).count()
    return JsonResponse({'ativo': ativo, 'total': total})


# ── desistir da ideia ─────────────────────────────────────────────────────────

@login_required
def desistir_ideia(request, post_id):
    if request.method != 'POST':
        return redirect('home')

    post  = get_object_or_404(Post, id=post_id)
    autor = get_object_or_404(Autor, usuario=request.user)

    if post.autor != autor:
        return redirect('home')

    pode, _ = _pode_desistir(post)
    if not pode:
        return redirect('/?aba=campo&erro=desistir_bloqueado')

    if post.visibilidade == 'privado':
        post.delete()
        return redirect('/?aba=notes_privados&msg=desistiu')

    if post.visibilidade == 'feed':
        tem_cooperacao = post.candidaturas.filter(status='aceito').exists()
        if not tem_cooperacao:
            post.visibilidade = 'privado'
            post.publicado    = False
            post.save(update_fields=['visibilidade', 'publicado'])
            return redirect('/?aba=notes_privados&msg=desistiu')

    # Feed com cooperação ou campo com moderador: transfere autoria
    moderadores_ativos = post.moderadores.filter(ativo=True)
    if moderadores_ativos.exists():
        if not post.autor_original:
            post.autor_original = autor
        novo_dono = moderadores_ativos.first().autor
        moderadores_ativos.update(papel='dono')
        post.autor             = novo_dono
        post.desistiu          = True
        post.procura_moderador = False
        post.save(update_fields=['autor', 'autor_original', 'desistiu', 'procura_moderador'])

    return redirect('/?aba=campo&msg=desistiu')


# ── candidatar-se a moderador ─────────────────────────────────────────────────

@login_required
def candidatar_moderador(request, post_id):
    if request.method != 'POST':
        return redirect('home')

    post      = get_object_or_404(Post, id=post_id)
    candidato = get_object_or_404(Autor, usuario=request.user)

    if post.autor == candidato:
        return redirect('home')

    CandidaturaModerador.objects.get_or_create(
        post=post,
        candidato=candidato,
        defaults={
            'mensagem': request.POST.get('mensagem', ''),
            'status':   'pendente',
        },
    )
    return redirect('/?aba=campo')


# ── página de eleição de moderador ────────────────────────────────────────────

@login_required
def pagina_eleger_moderador(request, post_id):
    post  = get_object_or_404(Post, id=post_id)
    autor = get_object_or_404(Autor, usuario=request.user)

    if post.autor != autor:
        return redirect('home')

    moderadores_atuais_ids = post.moderadores.filter(
        ativo=True
    ).values_list('autor_id', flat=True)

    seguidores = Autor.objects.filter(
        seguidores__seguido=autor
    ).exclude(
        id__in=moderadores_atuais_ids
    ).exclude(
        id=autor.id
    ).select_related('usuario')

    busca = request.GET.get('q', '').strip()
    if busca:
        seguidores = seguidores.filter(nome_exibicao__icontains=busca)

    if request.method == 'POST':
        candidato_id = request.POST.get('candidato_id')
        privilegio   = request.POST.get('privilegio', 'somente_edicao')

        privilegios_validos = {p[0] for p in ModeradorPost.PRIVILEGIO_CHOICES}
        if privilegio not in privilegios_validos:
            return redirect(f'/post/{post_id}/eleger/?erro=privilegio_invalido')

        candidato = get_object_or_404(Autor, id=candidato_id)

        if not Seguidor.objects.filter(seguidor=candidato, seguido=autor).exists():
            return redirect(f'/post/{post_id}/eleger/?erro=nao_seguidor')

        if post.moderadores.filter(ativo=True).count() >= post.limite_moderadores:
            return redirect(f'/post/{post_id}/eleger/?erro=limite_atingido')

        moderador, criado = ModeradorPost.objects.get_or_create(
            post=post,
            autor=candidato,
            defaults={'papel': 'moderador', 'privilegio': privilegio, 'ativo': True},
        )
        if not criado:
            moderador.ativo      = True
            moderador.privilegio = privilegio
            moderador.save(update_fields=['ativo', 'privilegio'])

        if privilegio == 'novo_dono':
            post.autor_original = autor
            post.autor          = candidato
            moderador.papel     = 'dono'
            moderador.save(update_fields=['papel'])
            post.save(update_fields=['autor', 'autor_original'])

        CandidaturaModerador.objects.filter(
            post=post, candidato=candidato, status='pendente'
        ).update(status='aceito')

        return redirect('/?aba=campo&msg=moderador_eleito')

    ERROS = {
        'privilegio_invalido': 'Privilégio selecionado inválido.',
        'nao_seguidor':        'O usuário selecionado não te segue.',
        'limite_atingido':     f'Limite de {post.limite_moderadores} moderadores atingido.',
    }

    return render(request, 'posts/moderacao/eleger_moderador.html', {
        'post':       post,
        'seguidores': seguidores,
        'busca':      busca,
        'privilegios': ModeradorPost.PRIVILEGIO_CHOICES,
        'erro':       ERROS.get(request.GET.get('erro', ''), ''),
    })


# ── eleger moderador via candidatura (ação rápida do painel) ──────────────────

@login_required
def eleger_moderador(request, post_id, candidatura_id):
    if request.method != 'POST':
        return redirect('home')

    post        = get_object_or_404(Post, id=post_id)
    autor       = get_object_or_404(Autor, usuario=request.user)
    candidatura = get_object_or_404(CandidaturaModerador, id=candidatura_id, post=post)

    if post.autor != autor:
        return redirect('home')

    if post.moderadores.filter(ativo=True).count() >= post.limite_moderadores:
        return redirect('/?aba=campo&erro=limite_atingido')

    candidatura.status = 'aceito'
    candidatura.save(update_fields=['status'])

    ModeradorPost.objects.get_or_create(
        post=post,
        autor=candidatura.candidato,
        defaults={'papel': 'moderador', 'privilegio': 'somente_edicao', 'ativo': True},
    )

    if post.procura_moderador:
        post.procura_moderador = False
        post.save(update_fields=['procura_moderador'])

    return redirect('/?aba=campo&msg=moderador_eleito')


# ── recusar candidatura ───────────────────────────────────────────────────────

@login_required
def recusar_candidatura(request, post_id, candidatura_id):
    if request.method != 'POST':
        return redirect('home')

    post        = get_object_or_404(Post, id=post_id)
    autor       = get_object_or_404(Autor, usuario=request.user)
    candidatura = get_object_or_404(CandidaturaModerador, id=candidatura_id, post=post)

    if post.autor != autor:
        return redirect('home')

    candidatura.status = 'recusado'
    candidatura.save(update_fields=['status'])
    return redirect('/?aba=campo')




# ── API DE CATEGORIAS ─────────────────────────────────────────────────────────

import json
import re

@login_required
def buscar_categorias(request):
    """Retorna categorias aprovadas que contenham o termo buscado."""
    termo = request.GET.get('q', '').strip()
    if len(termo) < 2:
        return JsonResponse({'categorias': []})

    categorias = Categoria.objects.filter(
        nome__icontains=termo,
        aprovada=True,
    ).values('id', 'nome', 'cor')[:10]

    return JsonResponse({'categorias': list(categorias)})


@login_required
def criar_categoria(request):
    """Cria uma nova categoria validada. Retorna JSON."""
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido.'}, status=400)

    nome = dados.get('nome', '').strip()

    # Validator
    erros = _validar_nome_categoria(nome)
    if erros:
        return JsonResponse({'erro': erros[0]}, status=422)

    slug = slugify(nome)

    # Evita duplicata case-insensitive
    if Categoria.objects.filter(nome__iexact=nome).exists():
        categoria = Categoria.objects.get(nome__iexact=nome)
        return JsonResponse({
            'id':   categoria.id,
            'nome': categoria.nome,
            'cor':  categoria.cor,
            'ja_existia': True,
        })

    autor = get_object_or_404(Autor, usuario=request.user)
    categoria = Categoria.objects.create(
        nome=nome,
        slug=slug,
        criada_por=autor,
    )
    return JsonResponse({
        'id':   categoria.id,
        'nome': categoria.nome,
        'cor':  categoria.cor,
        'ja_existia': False,
    }, status=201)


def _validar_nome_categoria(nome: str) -> list[str]:
    """
    Retorna lista de erros. Lista vazia = válido.
    Regras: só letras (incluindo acentos), uma palavra, 3–30 chars.
    """
    erros = []
    if len(nome) < 3:
        erros.append('Mínimo de 3 caracteres.')
    if len(nome) > 30:
        erros.append('Máximo de 30 caracteres.')
    if ' ' in nome:
        erros.append('Apenas uma palavra, sem espaços.')
    if not re.fullmatch(r'[A-Za-zÀ-ÿ]+', nome):
        erros.append('Apenas letras, sem números ou caracteres especiais.')
    return erros


# ── ──────────────────────────────────────────────────────────────────


def buscar_categoria_por_ids(request):
    ids_str = request.GET.get('ids', '')
    ids     = [int(i) for i in ids_str.split(',') if i.strip().isdigit()]
    cats    = Categoria.objects.filter(id__in=ids, aprovada=True).values('id', 'nome', 'cor')
    return JsonResponse({'categorias': list(cats)})


# ── registro ──────────────────────────────────────────────────────────────────

def registrar(request):
    if request.method == 'POST':
        form = RegistroForm(request.POST)
        if form.is_valid():
            user              = form.save()
            nome_exibicao     = form.cleaned_data.get('nome_exibicao', '')
            autor             = user.autor
            autor.nome        = nome_exibicao
            autor.nome_exibicao = nome_exibicao
            autor.save(update_fields=['nome', 'nome_exibicao'])
            login(request, user)
            return redirect('/?aba=perfil&msg=bem_vindo')
    else:
        form = RegistroForm()

    return render(request, 'posts/auth/registrar.html', {'form': form})


# ── NOTIFICAÇÕES ──────────────────────────────────────────────────────────────

@login_required
def notificacoes(request, canal):
    """
    canal = 'sino' | 'carta' | 'pessoa'
    """
    CANAIS_VALIDOS = {'sino', 'carta', 'pessoa'}
    if canal not in CANAIS_VALIDOS:
        return redirect('home')

    autor = request.user.autor

    mapa_tipos = {
        'sino':   Notificacao.TIPOS_SINO,
        'carta':  Notificacao.TIPOS_CARTA,
        'pessoa': Notificacao.TIPOS_PESSOA,
    }
    tipos = mapa_tipos[canal]

    itens = Notificacao.objects.filter(
        destinatario=autor, tipo__in=tipos
    ).select_related('remetente', 'post')

    itens.filter(lida=False).update(lida=True)

    return render(request, 'posts/notificacoes/notificacoes.html', {
        'itens': itens,
        'canal': canal,
    })


# ── Comentários ───────────────────────────────────────────────────────────────

@login_required
def comentar(request, post_id):
    if request.method != 'POST':
        return redirect('home')

    post     = get_object_or_404(Post, id=post_id, publicado=True)
    conteudo = request.POST.get('conteudo', '').strip()

    if not conteudo:
        return redirect('detalhe_post', post_id=post_id)

    Comentario.objects.create(
        post=post,
        autor=request.user.autor,
        conteudo=conteudo,
    )

    Notificacao.objects.create(
        destinatario=post.autor,
        remetente=request.user.autor,
        post=post,
        tipo='comentario',
    )

    return redirect('detalhe_post', post_id=post_id)


@login_required
def responder_comentario(request, post_id, pai_id):
    if request.method != 'POST':
        return redirect('home')

    post     = get_object_or_404(Post,       id=post_id, publicado=True)
    pai      = get_object_or_404(Comentario, id=pai_id,  post=post)
    conteudo = request.POST.get('conteudo', '').strip()

    if not conteudo:
        return redirect('detalhe_post', post_id=post_id)

    Comentario.objects.create(
        post=post,
        autor=request.user.autor,
        pai=pai,
        conteudo=conteudo,
    )

    # Notifica o autor do comentário pai (se não for ele mesmo)
    if pai.autor != request.user.autor:
        Notificacao.objects.create(
            destinatario=pai.autor,
            remetente=request.user.autor,
            post=post,
            tipo='comentario',
        )

    return redirect('detalhe_post', post_id=post_id)


@login_required
def votar_comentario(request, comentario_id, direcao):
    if request.method != 'POST':
        return redirect('home')

    DIRECOES_VALIDAS = {'up', 'down'}
    if direcao not in DIRECOES_VALIDAS:
        return redirect('home')

    comentario = get_object_or_404(Comentario, id=comentario_id)
    autor      = request.user.autor
    valor      = 1 if direcao == 'up' else -1

    voto_existente = VotoComentario.objects.filter(
        comentario=comentario, autor=autor
    ).first()

    if voto_existente:
        if voto_existente.valor == valor:
            # Mesmo voto: desfaz
            voto_existente.delete()
        else:
            # Voto oposto: troca
            voto_existente.valor = valor
            voto_existente.save(update_fields=['valor'])
    else:
        VotoComentario.objects.create(
            comentario=comentario,
            autor=autor,
            valor=valor,
        )

    return redirect('detalhe_post', post_id=comentario.post_id)


@login_required
def excluir_comentario(request, comentario_id):
    if request.method != 'POST':
        return redirect('home')

    comentario   = get_object_or_404(Comentario, id=comentario_id)
    autor_logado = request.user.autor

    eh_autor      = comentario.autor == autor_logado
    eh_dono_post  = comentario.post.autor == autor_logado
    eh_moderador  = comentario.post.moderadores.filter(
        autor=autor_logado, ativo=True
    ).exists()

    if not (eh_autor or eh_dono_post or eh_moderador):
        return redirect('home')

    # Soft delete: preserva o thread, exibe "[comentário removido]"
    comentario.removido = True
    comentario.save(update_fields=['removido'])

    return redirect('detalhe_post', post_id=comentario.post_id)



# ── Search de usuários ────────────────────────────────────────────────────────

@login_required
def buscar_usuarios(request):
    termo = request.GET.get('q', '').strip()
    autor_logado = request.user.autor

    resultados = []
    if termo:
        candidatos = Autor.objects.filter(
            Q(nome_exibicao__icontains=termo) | Q(usuario__username__icontains=termo)
        ).exclude(
            id=autor_logado.id
        ).select_related('usuario')[:20]

        seguindo_ids = set(
            Seguidor.objects.filter(
                seguidor=autor_logado,
                seguido__in=candidatos,
            ).values_list('seguido_id', flat=True)
        )

        for autor in candidatos:
            resultados.append({
                'autor':  autor,
                'seguindo': autor.id in seguindo_ids,
            })

    return render(request, 'posts/social/buscar_usuarios.html', {
        'resultados': resultados,
        'termo':      termo,
    })


# ── Search de usuários JSON ────────────────────────────────────────────────────────


def buscar_usuarios_json(request):
    termo        = request.GET.get('q', '').strip()
    autor_logado = getattr(request.user, 'autor', None) if request.user.is_authenticated else None

    if len(termo) < 2:
        return JsonResponse({'usuarios': []})

    qs = Autor.objects.filter(
        Q(nome_exibicao__icontains=termo) | Q(usuario__username__icontains=termo)
    ).select_related('usuario')

    if autor_logado:
        qs = qs.exclude(id=autor_logado.id)

    resultado = [
        {
            'username':      a.usuario.username,
            'nome_exibicao': a.nome_exibicao or a.nome,
            'foto':          a.foto_perfil.url if a.foto_perfil else None,
        }
        for a in qs[:10]
        if a.usuario
    ]

    return JsonResponse({'usuarios': resultado})



# ── Lista de seguidores / seguindo ───────────────────────────────────────────

@login_required
def lista_seguidores(request, username):
    user_perfil  = get_object_or_404(User, username=username)
    autor_perfil = get_object_or_404(Autor, usuario=user_perfil)
    autor_logado = request.user.autor

    autores = Autor.objects.filter(
        seguindo__seguido=autor_perfil
    ).select_related('usuario')

    seguindo_ids = set(
        Seguidor.objects.filter(
            seguidor=autor_logado,
            seguido__in=autores,
        ).values_list('seguido_id', flat=True)
    )

    lista = [
        {'autor': a, 'seguindo': a.id in seguindo_ids}
        for a in autores
    ]

    return render(request, 'posts/social/lista_seguidores.html', {
        'autor_perfil': autor_perfil,
        'lista':        lista,
        'tipo':         'seguidores',
    })




@login_required
def lista_seguindo(request, username):
    user_perfil  = get_object_or_404(User, username=username)
    autor_perfil = get_object_or_404(Autor, usuario=user_perfil)
    autor_logado = request.user.autor

    autores = Autor.objects.filter(
        seguidores__seguidor=autor_perfil
    ).select_related('usuario')

    seguindo_ids = set(
        Seguidor.objects.filter(
            seguidor=autor_logado,
            seguido__in=autores,
        ).values_list('seguido_id', flat=True)
    )

    lista = [
        {'autor': a, 'seguindo': a.id in seguindo_ids}
        for a in autores
    ]

    return render(request, 'posts/social/lista_seguidores.html', {
        'autor_perfil': autor_perfil,
        'lista':        lista,
        'tipo':         'seguindo',
    })




def _serializar_comentario(comentario, meus_votos, profundidade=0):
    respostas = []
    for r in comentario.respostas.all().select_related(
        'autor', 'autor__usuario'
    ).prefetch_related('votos', 'respostas'):
        respostas.append(_serializar_comentario(r, meus_votos, profundidade + 1))

    return {
        'id':           comentario.id,
        'autor':        comentario.autor.nome_exibicao if not comentario.removido else None,
        'username':     comentario.autor.usuario.username if not comentario.removido else None,
        'foto':         comentario.autor.foto_perfil.url if (not comentario.removido and comentario.autor.foto_perfil) else None,
        'conteudo':     comentario.conteudo_exibido,
        'removido':     comentario.removido,
        'score':        comentario.score,
        'meu_voto':     meus_votos.get(comentario.id),
        'criado_em':    comentario.criado_em.isoformat(),
        'editado':      comentario.editado,
        'profundidade': profundidade,
        'respostas':    respostas,
    }


def comentarios_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, publicado=True)

    raiz_qs = (
        post.comentarios
        .filter(pai__isnull=True)
        .select_related('autor', 'autor__usuario')
        .prefetch_related('votos')
    )

    autor_logado = getattr(request.user, 'autor', None) if request.user.is_authenticated else None
    meus_votos   = {}

    if autor_logado:
        todos_ids = list(post.comentarios.values_list('id', flat=True))
        meus_votos = dict(
            VotoComentario.objects.filter(
                comentario_id__in=todos_ids,
                autor=autor_logado,
            ).values_list('comentario_id', 'valor')
        )

    arvore = [_serializar_comentario(c, meus_votos, 0) for c in raiz_qs]

    total_comentadores = (
        post.comentarios
        .filter(removido=False)
        .values('autor')
        .distinct()
        .count()
    )

    return JsonResponse({
        'comentarios':        arvore,
        'total':              post.comentarios.filter(removido=False).count(),
        'total_comentadores': total_comentadores,
        'pode_forumizar':     total_comentadores >= 5,
    })



@login_required
def comentar_json(request, post_id):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    post  = get_object_or_404(Post, id=post_id, publicado=True)
    autor = request.user.autor

    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido.'}, status=400)

    conteudo = dados.get('conteudo', '').strip()
    pai_id   = dados.get('pai_id')

    if not conteudo:
        return JsonResponse({'erro': 'Comentário vazio.'}, status=400)

    pai = None
    if pai_id:
        pai = get_object_or_404(Comentario, id=pai_id, post=post)

    comentario = Comentario.objects.create(
        post=post,
        autor=autor,
        pai=pai,
        conteudo=conteudo,
    )

    if pai:
        # Notificação de resposta ao autor do comentário pai
        if pai.autor != autor:
            Notificacao.objects.create(
                destinatario=pai.autor,
                remetente=autor,
                post=post,
                tipo='resposta',
            )
    else:
        # Notificação de comentário ao autor do post
        if post.autor != autor:
            Notificacao.objects.create(
                destinatario=post.autor,
                remetente=autor,
                post=post,
                tipo='comentario',
            )

    # Calcula profundidade para o frontend saber em qual geração está
    profundidade = 0
    cursor = comentario
    while cursor.pai:
        profundidade += 1
        cursor = cursor.pai

    return JsonResponse({
        'id':           comentario.id,
        'autor':        autor.nome_exibicao,
        'username':     autor.usuario.username,
        'foto':         autor.foto_perfil.url if autor.foto_perfil else None,
        'conteudo':     comentario.conteudo,
        'score':        0,
        'meu_voto':     None,
        'removido':     False,
        'editado':      False,
        'respostas':    [],
        'criado_em':    comentario.criado_em.isoformat(),
        'profundidade': profundidade,
        'pai_id':       pai_id,
    }, status=201)


@login_required
def votar_comentario_json(request, comentario_id, direcao):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    DIRECOES_VALIDAS = {'up', 'down'}
    if direcao not in DIRECOES_VALIDAS:
        return JsonResponse({'erro': 'Direção inválida.'}, status=400)

    comentario = get_object_or_404(Comentario, id=comentario_id)
    autor      = request.user.autor
    valor      = 1 if direcao == 'up' else -1

    voto_existente = VotoComentario.objects.filter(
        comentario=comentario, autor=autor
    ).first()

    if voto_existente:
        if voto_existente.valor == valor:
            voto_existente.delete()
            meu_voto = None
        else:
            voto_existente.valor = valor
            voto_existente.save(update_fields=['valor'])
            meu_voto = valor
    else:
        VotoComentario.objects.create(
            comentario=comentario, autor=autor, valor=valor
        )
        meu_voto = valor

    return JsonResponse({
        'score':    comentario.score,
        'meu_voto': meu_voto,
    })


@login_required
def excluir_comentario_json(request, comentario_id):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    comentario   = get_object_or_404(Comentario, id=comentario_id)
    autor_logado = request.user.autor

    eh_autor     = comentario.autor == autor_logado
    eh_dono_post = comentario.post.autor == autor_logado
    eh_moderador = comentario.post.moderadores.filter(
        autor=autor_logado, ativo=True
    ).exists()

    if not (eh_autor or eh_dono_post or eh_moderador):
        return JsonResponse({'erro': 'Sem permissão.'}, status=403)

    comentario.removido = True
    comentario.save(update_fields=['removido'])

    return JsonResponse({'ok': True})




# ── ALGORÍTIMO Cubo Mágico ──────────────────────────────────

# ── Campo das Ideias — Rolamento Cubo Mágico ──────────────────────────────────


import math
import json
from django.utils import timezone


def _calcular_score(post, agora=None):
    if agora is None:
        agora = timezone.now()
    curtidas    = post.reacoes.filter(tipo='curtida').count()
    clips       = post.reacoes.filter(tipo='clip').count()
    comentarios = post.comentarios.filter(removido=False).count()
    raw         = (curtidas * 3) + (clips * 2) + (comentarios * 5)
    idade_horas = max((agora - post.data_criacao).total_seconds() / 3600, 1)
    return round(raw / math.pow(idade_horas, 1.5), 4)


def _recalcular_scores_campo():
    agora = timezone.now()
    # FIX C: select_related para evitar N+1 em autor e reações
    posts = Post.objects.filter(
        publicado=True, visibilidade='campo'
    ).select_related(
        'autor', 'autor__usuario'
    ).prefetch_related('reacoes', 'comentarios')
    for post in posts:
        ScorePost.objects.update_or_create(
            post=post, defaults={'score': _calcular_score(post, agora)}
        )


def _afinidade_usuario(autor):
    interacoes = CampoInteracao.objects.filter(autor=autor).select_related('post')
    if interacoes.count() < 10:
        return {}
    pesos = {}
    for inter in interacoes:
        peso = {'open': 5, 'down': 2, 'up': 2, 'left': 1, 'right': 1}.get(inter.direcao, 1)
        peso += min(inter.tempo_ms / 1000, 10)
        for cat in inter.post.categorias.all():
            pesos[cat.id] = pesos.get(cat.id, 0) + peso
    if pesos:
        mx = max(pesos.values())
        pesos = {k: v / mx for k, v in pesos.items()}
    return pesos


def _serializar_card(post):
    # FIX A: score_cache agora chega via select_related — acesso direto sem getattr
    try:
        score = post.score_cache.score
    except Exception:
        score = 0
    return {
        'id':          post.id,
        'titulo':      post.titulo,
        'titulo_capa': post.titulo_capa,
        'conteudo':    post.conteudo[:120] + ('...' if len(post.conteudo) > 120 else ''),
        'cor':         post.cor,
        'autor':       post.autor.nome_exibicao,
        'username':    post.autor.usuario.username if post.autor.usuario else '',
        'foto_autor':  post.autor.foto_perfil.url if post.autor.foto_perfil else None,
        'imagem_capa': post.imagem_capa_1.url if post.imagem_capa_1 else None,
        'categorias':  [{'nome': c.nome, 'cor': c.cor} for c in post.categorias.all()],
        'score':       score,
        'curtidas':    post.total_curtidas,
        'clips':       post.total_clips,
        'data':        post.data_criacao.strftime('%d/%m/%Y'),
        'procura_mod': post.procura_moderador,
        'url_detalhe': f'/post/{post.id}/',
    }


def _posts_ordenados(autor):
    # FIX A + C: select_related para score_cache (OneToOne reversa) e autor__usuario
    posts_campo = Post.objects.filter(
        publicado=True, visibilidade='campo'
    ).select_related(
        'autor', 'autor__usuario', 'score_cache'
    ).prefetch_related('categorias', 'reacoes', 'comentarios')

    ids_sem_score = posts_campo.exclude(
        id__in=ScorePost.objects.values_list('post_id', flat=True)
    ).values_list('id', flat=True)

    if ids_sem_score:
        _recalcular_scores_campo()
        # FIX A + C: repete select_related após recalcular
        posts_campo = Post.objects.filter(
            publicado=True, visibilidade='campo'
        ).select_related(
            'autor', 'autor__usuario', 'score_cache'
        ).prefetch_related('categorias', 'reacoes', 'comentarios')

    afinidade = _afinidade_usuario(autor)

    penalizados_ids = set(
        CampoCardPenalidade.objects.filter(autor=autor)
        .values_list('post_id', flat=True)
    )

    def _score_final(post):
        if post.id in penalizados_ids:
            return -9999
        try:
            base = post.score_cache.score
        except Exception:
            base = 0
        boost = sum(
            afinidade.get(cat_id, 0)
            for cat_id in post.categorias.values_list('id', flat=True)
        )
        return base + (boost * 5)

    return sorted(posts_campo, key=_score_final, reverse=True)


def _montar_linhas(autor, num_linhas=2, cards_por_linha=5):
    posts = _posts_ordenados(autor)

    linhas_posts = [[] for _ in range(num_linhas)]
    for i, post in enumerate(posts):
        linhas_posts[i % num_linhas].append(post)

    resultado = []
    for idx, posts_linha in enumerate(linhas_posts):
        cards_visiveis = [_serializar_card(p) for p in posts_linha[:cards_por_linha]]
        resultado.append({
            'index':    idx,
            'cards':    cards_visiveis,
            'total':    len(posts_linha),
            'tem_mais': len(posts_linha) > cards_por_linha,
        })

    return resultado


def _paginar_linha(autor, row_index, num_linhas=2, offset=0, cards=5):
    posts = _posts_ordenados(autor)

    linhas_posts = [[] for _ in range(num_linhas)]
    for i, post in enumerate(posts):
        linhas_posts[i % num_linhas].append(post)

    if row_index >= len(linhas_posts):
        return {'cards': [], 'tem_mais': False}

    posts_linha = linhas_posts[row_index]
    fatia       = posts_linha[offset: offset + cards]

    return {
        'cards':    [_serializar_card(p) for p in fatia],
        'tem_mais': (offset + cards) < len(posts_linha),
        'offset':   offset + cards,
    }


@login_required
def campo_grid_json(request):
    autor   = request.user.autor
    colunas = int(request.GET.get('cols', 5))
    linhas  = int(request.GET.get('rows', 2))
    colunas = max(2, min(colunas, 8))
    linhas  = max(1, min(linhas, 4))

    resultado = _montar_linhas(autor, num_linhas=linhas, cards_por_linha=colunas)

    return JsonResponse({
        'linhas':      resultado,
        'num_linhas':  linhas,
        'num_colunas': colunas,
    })


@login_required
def campo_linha_mais(request, row_index):
    autor      = request.user.autor
    offset     = int(request.GET.get('offset', 0))
    num_linhas = int(request.GET.get('rows', 2))
    cards      = int(request.GET.get('cols', 5))

    resultado = _paginar_linha(
        autor,
        row_index=row_index,
        num_linhas=num_linhas,
        offset=offset,
        cards=cards,
    )

    return JsonResponse(resultado)


@login_required
def registrar_interacao_campo(request):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)
    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido.'}, status=400)

    post_id  = dados.get('post_id')
    direcao  = dados.get('direcao', 'open')
    tempo_ms = dados.get('tempo_ms', 0)

    if direcao not in {'up', 'down', 'left', 'right', 'open'}:
        return JsonResponse({'erro': 'Direção inválida.'}, status=400)

    post = get_object_or_404(Post, id=post_id, publicado=True, visibilidade='campo')
    CampoInteracao.objects.create(
        autor=request.user.autor,
        post=post,
        direcao=direcao,
        tempo_ms=int(tempo_ms),
    )
    return JsonResponse({'ok': True})


@login_required
def criar_post_campo(request):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)
    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido.'}, status=400)

    titulo   = dados.get('titulo', '').strip()
    conteudo = dados.get('conteudo', '').strip()
    cat_ids  = dados.get('categorias', [])

    if not titulo:
        return JsonResponse({'erro': 'Título obrigatório.'}, status=400)
    if not conteudo:
        return JsonResponse({'erro': 'Conteúdo obrigatório.'}, status=400)
    if not cat_ids:
        return JsonResponse({'erro': 'Ao menos uma categoria é obrigatória.'}, status=400)

    autor = request.user.autor
    post  = Post.objects.create(
        titulo=titulo, conteudo=conteudo, autor=autor,
        visibilidade='campo', publicado=True,
    )
    post.categorias.set(Categoria.objects.filter(id__in=cat_ids, aprovada=True))
    ScorePost.objects.create(post=post, score=_calcular_score(post))

    return JsonResponse({'ok': True, 'id': post.id}, status=201)


@login_required
def meus_notes_campo(request):
    autor = request.user.autor
    posts = Post.objects.filter(
        autor=autor, visibilidade='campo', publicado=True
    ).select_related(
        'score_cache'
    ).order_by('-data_criacao')

    return JsonResponse({
        'posts': [
            {
                'id':       p.id,
                'titulo':   p.titulo,
                'conteudo': p.conteudo[:100],
                'score':    p.score_cache.score if hasattr(p, 'score_cache') else 0,
                'curtidas': p.total_curtidas,
                'clips':    p.total_clips,
                'data':     p.data_criacao.strftime('%d/%m/%Y'),
            }
            for p in posts
        ]
    })


@login_required
def campo_pool_json(request):
    autor  = request.user.autor
    offset = max(0, int(request.GET.get('offset', 0)))
    # FIX B: limite aumentado de 50 para 100 — frontend solicita 60 por batch
    limit  = max(1, min(int(request.GET.get('limit', 20)), 100))

    posts_ordenados = _posts_ordenados(autor)
    fatia           = posts_ordenados[offset: offset + limit]

    return JsonResponse({
        'cards':    [_serializar_card(p) for p in fatia],
        'offset':   offset,
        'limit':    limit,
        'total':    len(posts_ordenados),
        'tem_mais': (offset + limit) < len(posts_ordenados),
    })



@jwt_required
def api_notes_privados(request):
    autor = request.user.autor
    posts = Post.objects.filter(
    autor=autor,
    visibilidade='privado',
    ).exclude(
        canvas_x=-9999.0,
        canvas_y=-9999.0,
    ).prefetch_related('categorias').order_by('-data_criacao')

    return JsonResponse({
        'posts': [
            {
                'id':          p.id,
                'titulo':      p.titulo,
                'titulo_capa': p.titulo_capa,
                'conteudo':    p.conteudo,
                'cor':         p.cor,
                'data':        p.data_criacao.strftime('%d/%m/%Y %H:%M'),
                'imagem_capa': p.imagem_capa_1.url if p.imagem_capa_1 else None,
                'categorias':  [{'nome': c.nome, 'cor': c.cor} for c in p.categorias.all()],
                'curtidas':    p.total_curtidas,
                'clips':       p.total_clips,
                'url_editar':  f'/post/{p.id}/editar/',
                'url_detalhe': f'/post/{p.id}/',
                'canvas_x':     p.canvas_x,
                'canvas_y':     p.canvas_y,
                'canvas_ordem': p.canvas_ordem,
            }
            for p in posts
        ]
    })



@login_required
def penalizar_card_campo(request):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido.'}, status=400)

    post_id = dados.get('post_id')
    if not post_id:
        return JsonResponse({'erro': 'post_id obrigatório.'}, status=400)

    post = get_object_or_404(Post, id=post_id, publicado=True, visibilidade='campo')

    if post.autor.usuario == request.user:
        return JsonResponse({'erro': 'Não é possível penalizar seu próprio post.'}, status=403)

    CampoCardPenalidade.objects.get_or_create(
        autor=request.user.autor,
        post=post,
    )

    return JsonResponse({'ok': True, 'post_id': post_id})


@jwt_required
def api_criar_note(request):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Metodo nao permitido.'}, status=405)

    # FormData (com imagem) ou JSON puro
    content_type = request.content_type or ''
    if 'multipart' in content_type:
        titulo   = request.POST.get('titulo', '').strip()
        conteudo = request.POST.get('conteudo', '').strip()
        cor      = request.POST.get('cor', '#3B82F6').strip()
        canvas_x     = float(request.POST.get('canvas_x', 0))
        canvas_y     = float(request.POST.get('canvas_y', 0))
        canvas_ordem = int(request.POST.get('canvas_ordem', 0))
    else:
        try:
            dados = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'erro': 'JSON invalido.'}, status=400)
        titulo   = dados.get('titulo', '').strip()
        conteudo = dados.get('conteudo', '').strip()
        cor      = dados.get('cor', '#3B82F6').strip()
        canvas_x     = float(dados.get('canvas_x', 0))
        canvas_y     = float(dados.get('canvas_y', 0))
        canvas_ordem = int(dados.get('canvas_ordem', 0))

    if not titulo:
        return JsonResponse({'erro': 'Titulo obrigatorio.'}, status=400)
    if not conteudo:
        return JsonResponse({'erro': 'Conteudo obrigatorio.'}, status=400)

    post = Post.objects.create(
        titulo=titulo,
        conteudo=conteudo,
        cor=cor,
        autor=request.user.autor,
        visibilidade='privado',
        publicado=False,
        canvas_x=canvas_x,
        canvas_y=canvas_y,
        canvas_ordem=canvas_ordem,
    )

    # Salva imagem se enviada
    if request.FILES.get('imagem_capa'):
        post.imagem_capa_1 = request.FILES['imagem_capa']
        post.save(update_fields=['imagem_capa_1'])

    return JsonResponse({
        'ok': True,
        'post': {
            'id':          post.id,
            'titulo':      post.titulo,
            'titulo_capa': post.titulo_capa,
            'conteudo':    post.conteudo,
            'cor':         post.cor,
            'data':        post.data_criacao.strftime('%d/%m/%Y %H:%M'),
            'imagem_capa': post.imagem_capa_1.url if post.imagem_capa_1 else None,
            'categorias':  [],
            'curtidas':    0,
            'clips':       0,
            'url_editar':  f'/post/{post.id}/editar/',
            'url_detalhe': f'/post/{post.id}/',
        }
    }, status=201)


@jwt_required
def api_excluir_note(request, post_id):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Metodo nao permitido.'}, status=405)

    post = get_object_or_404(Post, id=post_id, autor=request.user.autor, visibilidade='privado')
    post.delete()
    return JsonResponse({'ok': True})


@jwt_required
def api_publicar_note(request, post_id):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Metodo nao permitido.'}, status=405)

    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON invalido.'}, status=400)

    destino = dados.get('destino', '')
    if destino not in ('feed', 'campo'):
        return JsonResponse({'erro': 'Destino invalido.'}, status=400)

    post = get_object_or_404(Post, id=post_id, autor=request.user.autor)

    if not post.categorias.exists():
        return JsonResponse({'erro': 'sem_categoria'}, status=422)

    if destino == 'feed' and not post.tem_capa:
        return JsonResponse({'erro': 'sem_capa'}, status=422)

    post.visibilidade = destino
    post.publicado    = True
    post.save(update_fields=['visibilidade', 'publicado'])

    return JsonResponse({'ok': True, 'destino': destino})



@jwt_required
def api_salvar_posicao_note(request, note_id):
    if request.method != 'POST':
        return JsonResponse({'ok': False, 'erro': 'metodo_invalido'}, status=405)
    try:
        autor = request.user.autor
        post  = autor.posts.get(id=note_id, visibilidade='privado')
    except Exception:
        return JsonResponse({'ok': False, 'erro': 'not_found'}, status=404)
    try:
        dados = json.loads(request.body)
        post.canvas_x    = float(dados['x'])
        post.canvas_y    = float(dados['y'])
        if 'ordem' in dados:
            post.canvas_ordem = int(dados['ordem'])
        post.save(update_fields=['canvas_x', 'canvas_y', 'canvas_ordem'])
    except (KeyError, ValueError, TypeError):
        return JsonResponse({'ok': False, 'erro': 'dados_invalidos'}, status=400)
    return JsonResponse({'ok': True})



def _serializar_bloco(bloco):
    """Serializa um Bloco para JSON, incluindo os cards na ordem correta."""
    cards_map = {c.id: c for c in bloco.cards.prefetch_related('categorias').all()}
    cards_ordenados = []
    for cid in bloco.card_ids_ordenados:
        card = cards_map.get(cid)
        if card:
            cards_ordenados.append({
                'id':          card.id,
                'titulo':      card.titulo,
                'titulo_capa': card.titulo_capa,
                'conteudo':    card.conteudo,
                'cor':         card.cor,
                'data':        card.data_criacao.strftime('%d/%m/%Y %H:%M'),
                'imagem_capa': card.imagem_capa_1.url if card.imagem_capa_1 else None,
                'categorias':  [{'nome': c.nome, 'cor': c.cor} for c in card.categorias.all()],
                'curtidas':    card.total_curtidas,
                'clips':       card.total_clips,
                'url_editar':  f'/post/{card.id}/editar/',
                'url_detalhe': f'/post/{card.id}/',
                'canvas_x':    card.canvas_x,
                'canvas_y':    card.canvas_y,
                'canvas_ordem': card.canvas_ordem,
            })
    return {
        'id':           bloco.id,
        'nome':         bloco.nome,
        'card_ids':     bloco.card_ids_ordenados,
        'cards':        cards_ordenados,
        'canvas_x':     bloco.canvas_x,
        'canvas_y':     bloco.canvas_y,
        'canvas_ordem': bloco.canvas_ordem,
    }
 
 
@jwt_required
def api_listar_blocos(request):
    """GET /api/blocos/ — retorna todos os blocos do usuário logado."""
    autor  = request.user.autor
    blocos = Bloco.objects.filter(autor=autor).prefetch_related('cards', 'cards__categorias')
    return JsonResponse({'blocos': [_serializar_bloco(b) for b in blocos]})
 
 
@jwt_required
def api_criar_bloco(request):
    """
    POST /api/blocos/criar/
    Body: { nome, card_id, canvas_x, canvas_y, canvas_ordem }
    Cria o bloco com o primeiro card. Zera as coordenadas do card piloto.
    """
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)
    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido.'}, status=400)

    nome         = dados.get('nome', '').strip()
    card_id      = dados.get('card_id')
    canvas_x     = float(dados.get('canvas_x', 0))
    canvas_y     = float(dados.get('canvas_y', 0))
    canvas_ordem = int(dados.get('canvas_ordem', 0))

    if not nome:
        return JsonResponse({'erro': 'Nome obrigatório.'}, status=400)
    if not card_id:
        return JsonResponse({'erro': 'card_id obrigatório.'}, status=400)

    autor = request.user.autor
    card  = get_object_or_404(Post, id=card_id, autor=autor, visibilidade='privado')

    card.canvas_x     = -9999.0
    card.canvas_y     = -9999.0
    card.canvas_ordem = 0
    card.save(update_fields=['canvas_x', 'canvas_y', 'canvas_ordem'])

    bloco = Bloco.objects.create(
        nome=nome,
        autor=autor,
        card_ids_ordenados=[card.id],
        canvas_x=canvas_x,
        canvas_y=canvas_y,
        canvas_ordem=canvas_ordem,
    )
    bloco.cards.add(card)

    return JsonResponse({'ok': True, 'bloco': _serializar_bloco(bloco)}, status=201)

 
 
@jwt_required
def api_clipar_em_bloco(request, bloco_id):
    """
    POST /api/blocos/<bloco_id>/clipar/
    Body: { card_id }
    Adiciona card ao bloco. Novo card vai para o índice 0 (frente da pilha).
    Zera as coordenadas de canvas do card clipado para liberar a célula.
    """
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)
    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido.'}, status=400)

    card_id = dados.get('card_id')
    if not card_id:
        return JsonResponse({'erro': 'card_id obrigatório.'}, status=400)

    autor = request.user.autor
    bloco = get_object_or_404(Bloco, id=bloco_id, autor=autor)
    card  = get_object_or_404(Post, id=card_id, autor=autor, visibilidade='privado')

    if card.id not in bloco.card_ids_ordenados:
        card.canvas_x     = -9999.0
        card.canvas_y     = -9999.0
        card.canvas_ordem = 0
        card.save(update_fields=['canvas_x', 'canvas_y', 'canvas_ordem'])

        bloco.card_ids_ordenados = [card.id] + bloco.card_ids_ordenados
        bloco.cards.add(card)
        bloco.save(update_fields=['card_ids_ordenados'])

    return JsonResponse({'ok': True, 'bloco': _serializar_bloco(bloco)})
 
 
@jwt_required
def api_remover_card_bloco(request, bloco_id):
    """
    POST /api/blocos/<bloco_id>/remover-card/
    Body: { card_id }
    Remove card do bloco. Se ficar vazio, o bloco é destruído.
    Retorna o card para o canvas com posição restaurada.
    """
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)
    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido.'}, status=400)
 
    card_id = dados.get('card_id')
    if not card_id:
        return JsonResponse({'erro': 'card_id obrigatório.'}, status=400)
 
    autor = request.user.autor
    bloco = get_object_or_404(Bloco, id=bloco_id, autor=autor)
    card  = get_object_or_404(Post, id=card_id)
 
    bloco.card_ids_ordenados = [cid for cid in bloco.card_ids_ordenados if cid != card_id]
    bloco.cards.remove(card)
 
    if not bloco.card_ids_ordenados:
        bloco.delete()
        return JsonResponse({'ok': True, 'bloco_destruido': True})
 
    bloco.save(update_fields=['card_ids_ordenados'])
    return JsonResponse({'ok': True, 'bloco_destruido': False, 'bloco': _serializar_bloco(bloco)})
 
 
@jwt_required
def api_desfazer_bloco(request, bloco_id):
    """
    POST /api/blocos/<bloco_id>/desfazer/
    Dissolve o bloco e devolve todos os cards ao canvas com posições livres.
    Varre o grid de cima para baixo, esquerda para direita, 7 colunas por linha.
    """
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    autor = request.user.autor
    bloco = get_object_or_404(Bloco, id=bloco_id, autor=autor)

    ocupadas = set(
        (round(x / GRID_COL), round(y / GRID_ROW))
        for x, y in Post.objects.filter(autor=autor, visibilidade='privado')
        .exclude(id__in=bloco.card_ids_ordenados)
        .values_list('canvas_x', 'canvas_y')
    )

    blocos_outros = Bloco.objects.filter(autor=autor).exclude(id=bloco_id)
    for b in blocos_outros.values_list('canvas_x', 'canvas_y'):
        ocupadas.add((round(b[0] / GRID_COL), round(b[1] / GRID_ROW)))

    def proxima_posicao_livre():
        for lin in range(9999):
            for col in range(COLS_POR_LINHA):
                if (col, lin) not in ocupadas:
                    ocupadas.add((col, lin))
                    return (col * GRID_COL, lin * GRID_ROW)
        return (0, 0)

    cards_restaurados = []
    for card in bloco.cards.prefetch_related('categorias').all():
        x, y = proxima_posicao_livre()
        card.canvas_x     = x
        card.canvas_y     = y
        card.canvas_ordem = 0
        card.save(update_fields=['canvas_x', 'canvas_y', 'canvas_ordem'])

        cards_restaurados.append({
            'id':          card.id,
            'titulo':      card.titulo,
            'titulo_capa': card.titulo_capa,
            'conteudo':    card.conteudo,
            'cor':         card.cor,
            'data':        card.data_criacao.strftime('%d/%m/%Y %H:%M'),
            'imagem_capa': card.imagem_capa_1.url if card.imagem_capa_1 else None,
            'categorias':  [{'nome': c.nome, 'cor': c.cor} for c in card.categorias.all()],
            'curtidas':    card.total_curtidas,
            'clips':       card.total_clips,
            'url_editar':  f'/post/{card.id}/editar/',
            'url_detalhe': f'/post/{card.id}/',
            'canvas_x':    x,
            'canvas_y':    y,
            'canvas_ordem': 0,
        })

    bloco.delete()
    return JsonResponse({'ok': True, 'cards_restaurados': cards_restaurados})
 
 
@jwt_required
def api_destruir_bloco(request, bloco_id):
    """
    POST /api/blocos/<bloco_id>/destruir/
    Destrói o bloco E todos os seus cards permanentemente.
    """
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)
 
    autor = request.user.autor
    bloco = get_object_or_404(Bloco, id=bloco_id, autor=autor)
 
    card_ids = list(bloco.card_ids_ordenados)
    bloco.delete()
    Post.objects.filter(id__in=card_ids, autor=autor, visibilidade='privado').delete()
 
    return JsonResponse({'ok': True, 'cards_destruidos': card_ids})
 
 
@jwt_required
def api_salvar_posicao_bloco(request, bloco_id):
    """
    POST /api/blocos/<bloco_id>/posicao/
    Body: { x, y, ordem }
    """
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)
    try:
        dados        = json.loads(request.body)
        autor        = request.user.autor
        bloco        = get_object_or_404(Bloco, id=bloco_id, autor=autor)
        bloco.canvas_x    = float(dados['x'])
        bloco.canvas_y    = float(dados['y'])
        bloco.canvas_ordem = int(dados.get('ordem', bloco.canvas_ordem))
        bloco.save(update_fields=['canvas_x', 'canvas_y', 'canvas_ordem'])
    except (KeyError, ValueError, TypeError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)
    return JsonResponse({'ok': True})



# ── AUTH JWT ──────────────────────────────────────────────────────────────────

def _tokens_para(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
    }


def _dados_usuario(user):
    autor = getattr(user, 'autor', None)
    return {
        'id':             user.id,
        'username':       user.username,
        'nome_exibicao':  autor.nome_exibicao if autor else user.username,
        'foto':           autor.foto_perfil.url if (autor and autor.foto_perfil) else None,
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def api_auth_login(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    if not username or not password:
        return Response({'erro': 'Usuário e senha são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

    # Permite login por email
    if '@' in username:
        try:
            user_obj = User.objects.get(email=username)
            username = user_obj.username
        except User.DoesNotExist:
            return Response({'erro': 'Usuário ou senha incorretos.'}, status=status.HTTP_401_UNAUTHORIZED)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({'erro': 'Usuário ou senha incorretos.'}, status=status.HTTP_401_UNAUTHORIZED)

    return Response({**_tokens_para(user), 'usuario': _dados_usuario(user)})


@api_view(['POST'])
@permission_classes([AllowAny])
def api_auth_registrar(request):
    username      = request.data.get('username', '').strip()
    nome_exibicao = request.data.get('nome_exibicao', '').strip()
    password1     = request.data.get('password1', '')
    password2     = request.data.get('password2', '')

    erros = {}

    if not username:
        erros['username'] = 'Usuário obrigatório.'
    elif User.objects.filter(username=username).exists():
        erros['username'] = 'Este usuário já está em uso.'

    if not nome_exibicao:
        erros['nome_exibicao'] = 'Nome de exibição obrigatório.'

    if not password1:
        erros['password1'] = 'Senha obrigatória.'
    elif len(password1) < 8:
        erros['password1'] = 'Mínimo de 8 caracteres.'
    elif password1 != password2:
        erros['password2'] = 'As senhas não coincidem.'

    if erros:
        return Response({'erros': erros}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    user = User.objects.create_user(username=username, password=password1)
    autor = user.autor
    autor.nome          = nome_exibicao
    autor.nome_exibicao = nome_exibicao
    autor.save(update_fields=['nome', 'nome_exibicao'])

    return Response({**_tokens_para(user), 'usuario': _dados_usuario(user)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_auth_logout(request):
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'erro': 'refresh token obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        return Response({'erro': 'Token inválido ou já expirado.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_auth_refresh(request):
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'erro': 'refresh token obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        token  = RefreshToken(refresh_token)
        return Response({'access': str(token.access_token), 'refresh': str(token)})
    except TokenError:
        return Response({'erro': 'Token inválido ou expirado.'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_auth_me(request):
    return Response({'usuario': _dados_usuario(request.user)})


@api_view(['POST'])
@permission_classes([AllowAny])
def api_auth_senha_reset(request):
    """Envia email com link de reset apontando para o frontend React."""
    email = request.data.get('email', '').strip()
    if not email:
        return Response({'erro': 'Email obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Responde OK mesmo assim — não revela se o email existe
        return Response({'ok': True})

    uid   = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link  = f"{settings.FRONTEND_URL}/senha/confirmar/{uid}/{token}/"

    send_mail(
        subject='Redefinição de senha — Synapsoo',
        message=f'Clique no link para redefinir sua senha:\n\n{link}\n\nO link expira em 24 horas.',
        from_email='noreply@synapsoo.com',
        recipient_list=[email],
        fail_silently=False,
    )

    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([AllowAny])
def api_auth_senha_confirmar(request):
    """Valida uid + token e define a nova senha."""
    uid       = request.data.get('uid', '')
    token     = request.data.get('token', '')
    password1 = request.data.get('password1', '')
    password2 = request.data.get('password2', '')

    if not all([uid, token, password1, password2]):
        return Response({'erro': 'Todos os campos são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

    if password1 != password2:
        return Response({'erros': {'password2': 'As senhas não coincidem.'}}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    if len(password1) < 8:
        return Response({'erros': {'password1': 'Mínimo de 8 caracteres.'}}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    try:
        pk   = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=pk)
    except (User.DoesNotExist, ValueError, TypeError):
        return Response({'erro': 'Link inválido.'}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({'erro': 'Link expirado ou inválido.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password1)
    user.save()

    return Response({'ok': True})