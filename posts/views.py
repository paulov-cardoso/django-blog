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
    CampoCardPenalidade,
)
from .forms import PostForm, RegistroForm, AutorForm


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


# ── Campo das ideias ──────────────────────────────────────────────

# ── ROLAMENTO CUBO MÁGICO ─────────────────────────────────
#
# Arquitetura de dados:
#   O grid é composto por N colunas verticais independentes.
#   Cada coluna tem seu próprio pool de posts e pode ser paginada separadamente.
#   O frontend exibe sempre `linhas_visiveis` posts por coluna (padrão: 2).
#   O usuário rola cada coluna individualmente para cima/baixo.
#
# Endpoint principal:  GET /api/campo/grid/
#   Retorna todas as colunas com os primeiros `linhas` posts cada.
#
# Endpoint de paginação: GET /api/campo/coluna/<col_index>/mais/
#   Retorna mais posts para uma coluna específica (scroll infinito por coluna).

import math
import json
from django.db.models import Count
from django.utils import timezone


def _calcular_score(post, agora=None):
    """
    Score = curtidas×3 + clips×2 + comentários×5 com decaimento temporal.
    Decaimento gravitacional: divide pela idade em horas elevada a 1.5.
    """
    if agora is None:
        agora = timezone.now()

    curtidas    = post.reacoes.filter(tipo='curtida').count()
    clips       = post.reacoes.filter(tipo='clip').count()
    comentarios = post.comentarios.filter(removido=False).count()

    raw         = (curtidas * 3) + (clips * 2) + (comentarios * 5)
    idade_horas = max((agora - post.data_criacao).total_seconds() / 3600, 1)
    score       = raw / math.pow(idade_horas, 1.5)

    return round(score, 4)


def _recalcular_scores_campo():
    """Recalcula ScorePost para todos os posts do campo."""
    agora = timezone.now()
    posts = Post.objects.filter(
        publicado=True,
        visibilidade='campo',
    ).prefetch_related('reacoes', 'comentarios')

    for post in posts:
        score = _calcular_score(post, agora)
        ScorePost.objects.update_or_create(
            post=post,
            defaults={'score': score},
        )


def _afinidade_usuario(autor):
    """
    Retorna dict {categoria_id: peso_normalizado} baseado nas interações do usuário.
    Camada B do algoritmo — ativo apenas com ≥10 interações registradas.
    """
    interacoes = CampoInteracao.objects.filter(autor=autor).select_related('post')
    if interacoes.count() < 10:
        return {}

    pesos = {}
    for inter in interacoes:
        peso_direcao = {'open': 5, 'down': 2, 'up': 2, 'left': 1, 'right': 1}.get(inter.direcao, 1)
        peso_tempo   = min(inter.tempo_ms / 1000, 10)
        peso_total   = peso_direcao + peso_tempo

        for cat in inter.post.categorias.all():
            pesos[cat.id] = pesos.get(cat.id, 0) + peso_total

    if pesos:
        max_peso = max(pesos.values())
        pesos    = {k: v / max_peso for k, v in pesos.items()}

    return pesos


def _serializar_card(post):
    """Serializa um post para o formato esperado pelo frontend do Campo."""
    score_cache = getattr(post, 'score_cache', None)
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
        'score':       score_cache.score if score_cache else 0,
        'curtidas':    post.total_curtidas,
        'clips':       post.total_clips,
        'data':        post.data_criacao.strftime('%d/%m/%Y'),
        'procura_mod': post.procura_moderador,
        'url_detalhe': f'/post/{post.id}/',
    }


def _montar_colunas(autor, num_colunas=5, linhas_visiveis=2):
    """
    Distribui os posts do Campo em N colunas verticais independentes.

    Lógica de distribuição:
      1. Obtém todos os posts ordenados por score + afinidade (Camada A + B).
      2. Distribui em round-robin pelas colunas: post 0 → col 0, post 1 → col 1, ...
         Isso garante que posts de alta relevância apareçam em colunas diferentes,
         e que cada coluna tenha uma mistura de conteúdo ao invés de uma coluna
         dominada por um único cluster de categorias.
      3. Cada coluna retorna os primeiros `linhas_visiveis` posts visíveis
         e o total para o frontend saber se há mais para paginar.

    Retorna lista de dicts com estrutura:
      [
        {"index": 0, "cards": [...], "total": N, "tem_mais": bool},
        ...
      ]
    """
    posts_campo = Post.objects.filter(
        publicado=True,
        visibilidade='campo',
    ).prefetch_related('categorias', 'reacoes', 'comentarios', 'score_cache')

    # Garante que scores existam para posts novos
    ids_sem_score = posts_campo.exclude(
        id__in=ScorePost.objects.values_list('post_id', flat=True)
    ).values_list('id', flat=True)
    if ids_sem_score:
        _recalcular_scores_campo()
        # Recarrega com scores atualizados
        posts_campo = Post.objects.filter(
            publicado=True,
            visibilidade='campo',
        ).prefetch_related('categorias', 'reacoes', 'comentarios', 'score_cache')

    afinidade = _afinidade_usuario(autor)

    def _score_final(post):
        base  = getattr(post, 'score_cache', None)
        base  = base.score if base else 0
        boost = sum(
            afinidade.get(cat_id, 0)
            for cat_id in post.categorias.values_list('id', flat=True)
        )
        return base + (boost * 5)

    posts_ordenados = sorted(posts_campo, key=_score_final, reverse=True)

    # Distribui em round-robin pelas colunas
    colunas_posts = [[] for _ in range(num_colunas)]
    for i, post in enumerate(posts_ordenados):
        colunas_posts[i % num_colunas].append(post)

    colunas = []
    for idx, posts_col in enumerate(colunas_posts):
        cards_visiveis = [_serializar_card(p) for p in posts_col[:linhas_visiveis]]
        colunas.append({
            'index':    idx,
            'cards':    cards_visiveis,
            'total':    len(posts_col),
            'tem_mais': len(posts_col) > linhas_visiveis,
        })

    return colunas


def _paginar_coluna(autor, col_index, num_colunas=5, offset=0, linhas=2):
    """
    Retorna mais cards para uma coluna específica a partir de `offset`.
    Usado pelo endpoint de paginação individual de coluna.
    """
    posts_campo = Post.objects.filter(
        publicado=True,
        visibilidade='campo',
    ).prefetch_related('categorias', 'reacoes', 'comentarios', 'score_cache')

    afinidade = _afinidade_usuario(autor)

    def _score_final(post):
        base  = getattr(post, 'score_cache', None)
        base  = base.score if base else 0
        boost = sum(
            afinidade.get(cat_id, 0)
            for cat_id in post.categorias.values_list('id', flat=True)
        )
        return base + (boost * 5)

    posts_ordenados = sorted(posts_campo, key=_score_final, reverse=True)

    # Reconstrói a mesma distribuição round-robin
    colunas_posts = [[] for _ in range(num_colunas)]
    for i, post in enumerate(posts_ordenados):
        colunas_posts[i % num_colunas].append(post)

    if col_index >= len(colunas_posts):
        return {'cards': [], 'tem_mais': False}

    posts_col   = colunas_posts[col_index]
    fatia       = posts_col[offset: offset + linhas]
    cards       = [_serializar_card(p) for p in fatia]
    tem_mais    = (offset + linhas) < len(posts_col)

    return {
        'cards':    cards,
        'tem_mais': tem_mais,
        'offset':   offset + linhas,
    }


@login_required
def campo_grid_json(request):
    """
    Endpoint principal do Campo das Ideias — Rolamento Cubo Mágico.

    GET /api/campo/grid/?cols=5&rows=2

    Retorna todas as colunas com os primeiros `rows` cards cada.
    O frontend usa essa resposta para montar a face inicial do cubo.
    """
    autor    = request.user.autor
    colunas  = int(request.GET.get('cols', 5))
    linhas   = int(request.GET.get('rows', 2))

    colunas = max(2, min(colunas, 8))
    linhas  = max(1, min(linhas, 4))

    resultado = _montar_colunas(autor, num_colunas=colunas, linhas_visiveis=linhas)

    return JsonResponse({
        'colunas':     resultado,
        'num_colunas': colunas,
        'linhas':      linhas,
    })


@login_required
def campo_coluna_mais(request, col_index):
    """
    Endpoint de paginação por coluna — Rolamento Cubo Mágico.

    GET /api/campo/coluna/<col_index>/mais/?offset=2&cols=5&rows=2

    Chamado quando o usuário rola uma coluna específica até o fim.
    Retorna os próximos `rows` cards daquela coluna a partir de `offset`.
    """
    autor      = request.user.autor
    offset     = int(request.GET.get('offset', 0))
    num_colunas = int(request.GET.get('cols', 5))
    linhas     = int(request.GET.get('rows', 2))

    resultado = _paginar_coluna(
        autor,
        col_index=col_index,
        num_colunas=num_colunas,
        offset=offset,
        linhas=linhas,
    )

    return JsonResponse(resultado)


@login_required
def registrar_interacao_campo(request):
    """Registra navegação do usuário no grid para alimentar o algoritmo."""
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    try:
        dados = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido.'}, status=400)

    post_id  = dados.get('post_id')
    direcao  = dados.get('direcao', 'open')
    tempo_ms = dados.get('tempo_ms', 0)

    DIRECOES_VALIDAS = {'up', 'down', 'left', 'right', 'open'}
    if direcao not in DIRECOES_VALIDAS:
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
    """Composer exclusivo do Campo das Ideias — sem capa obrigatória."""
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
        titulo=titulo,
        conteudo=conteudo,
        autor=autor,
        visibilidade='campo',
        publicado=True,
    )

    categorias = Categoria.objects.filter(id__in=cat_ids, aprovada=True)
    post.categorias.set(categorias)

    score = _calcular_score(post)
    ScorePost.objects.create(post=post, score=score)

    return JsonResponse({
        'ok':  True,
        'id':  post.id,
        'msg': 'Ideia publicada no Campo das Ideias!',
    }, status=201)


@login_required
def meus_notes_campo(request):
    """Sub-aba: notes do usuário logado publicados no campo."""
    autor = request.user.autor
    posts = Post.objects.filter(
        autor=autor,
        visibilidade='campo',
        publicado=True,
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