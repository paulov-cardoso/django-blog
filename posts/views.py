from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import login
from django.db.models import Q

from .models import Post, Autor, ModeradorPost, CandidaturaModerador, Seguidor, PostReacao, Notificacao
from .forms import PostForm, RegistroForm, AutorForm


# ── constantes ────────────────────────────────────────────────────────────────

_VISIBILIDADES_VALIDAS = {'privado', 'feed', 'campo'}

_ABA_POR_VISIBILIDADE = {
    'privado': 'meus_notes',
    'feed':    'feed',
    'campo':   'campo',
}

_DESTINO_MSG_VISIBILIDADE = {
    'privado': ('meus_notes', 'ideia_privada'),
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

    if aba == 'meus_notes':
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
    return render(request, 'posts/perfil.html', _contexto_perfil(autor_perfil, request.user))


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

    return render(request, 'posts/editar_perfil.html', {'form': form, 'autor': autor})


# ── seguir / deixar de seguir ─────────────────────────────────────────────────

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

    return redirect(request.META.get('HTTP_REFERER', '/'))


# ── criar post ────────────────────────────────────────────────────────────────

@login_required
def criar_post(request):
    if request.method == 'POST':
        form = PostForm(request.POST)
        if form.is_valid():
            post              = form.save(commit=False)
            post.cor          = request.POST.get('cor', '#3B82F6')
            post.autor        = request.user.autor
            visibilidade      = request.POST.get('visibilidade', 'privado')

            if visibilidade not in _VISIBILIDADES_VALIDAS:
                visibilidade = 'privado'

            post.visibilidade = visibilidade
            post.publicado    = visibilidade != 'privado'
            post.save()
            form.save_m2m()

            aba, msg = _DESTINO_MSG_VISIBILIDADE[visibilidade]
            return redirect(f'/?aba={aba}&msg={msg}')
    else:
        titulo_inicial = request.GET.get('titulo_inicial', '').strip()
        visibilidade   = request.GET.get('visibilidade', 'privado')

        if visibilidade not in _VISIBILIDADES_VALIDAS:
            visibilidade = 'privado'

        form = PostForm(initial={'titulo': titulo_inicial} if titulo_inicial else {})

    return render(request, 'posts/criar.html', {
        'form':         form,
        'visibilidade': visibilidade,
    })


# ── mudar visibilidade ────────────────────────────────────────────────────────

@login_required
def alterar_visibilidade(request, post_id):
    """
    Transição de visibilidade: privado ↔ feed ↔ campo.
    """
    if request.method != 'POST':
        return redirect('home')

    post = get_object_or_404(Post, id=post_id)

    if post.autor.usuario != request.user:
        return redirect('home')

    nova_visibilidade = request.POST.get('visibilidade', 'campo')

    if nova_visibilidade not in _VISIBILIDADES_VALIDAS:
        return redirect('home')

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
        form = PostForm(request.POST, instance=post)
        if form.is_valid():
            post     = form.save(commit=False)
            post.cor = request.POST.get('cor', post.cor)
            post.save()
            form.save_m2m()
            aba = _ABA_POR_VISIBILIDADE.get(post.visibilidade, 'meus_notes')
            return redirect(f'/?aba={aba}&msg=ideia_editada')
    else:
        form = PostForm(instance=post)

    return render(request, 'posts/editar.html', {'form': form, 'post': post})


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

    return render(request, 'posts/detail.html', {
        'post':                   post,
        'pode_desistir':          pode,
        'motivo_bloqueio':        motivo,
        'candidaturas_pendentes': candidaturas_pendentes,
        'moderadores_ativos':     post.moderadores.filter(ativo=True),
        'ja_candidatou':          ja_candidatou,
        'bloqueio_retirar_feed':  post.visibilidade == 'campo' and post.tem_interacoes,
    })


# ── curtir / clipar post ──────────────────────────────────────────────────────

@login_required
def reagir_post(request, post_id, tipo):
    if request.method != 'POST':
        return redirect('home')

    TIPOS_VALIDOS = {'curtida', 'clip'}
    if tipo not in TIPOS_VALIDOS:
        return redirect('home')

    post  = get_object_or_404(Post, id=post_id, publicado=True)
    autor = request.user.autor

    reacao = PostReacao.objects.filter(post=post, autor=autor, tipo=tipo)
    if reacao.exists():
        reacao.delete()
    else:
        PostReacao.objects.create(post=post, autor=autor, tipo=tipo)

    aba = request.POST.get('aba', 'feed')
    return redirect(f'/?aba={aba}')


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
        return redirect('/?aba=meus_notes&msg=desistiu')

    if post.visibilidade == 'feed':
        tem_cooperacao = post.candidaturas.filter(status='aceito').exists()
        if not tem_cooperacao:
            post.visibilidade = 'privado'
            post.publicado    = False
            post.save(update_fields=['visibilidade', 'publicado'])
            return redirect('/?aba=meus_notes&msg=desistiu')

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

    return render(request, 'posts/eleger_moderador.html', {
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

    return render(request, 'posts/registrar.html', {'form': form})


# ── notificações ──────────────────────────────────────────────────────────────

@login_required
def notificacoes(request, canal):
    """
    canal = 'sino' (interações) ou 'carta' (colaboração/moderação)
    """
    autor = request.user.autor
    tipos = Notificacao.TIPOS_SINO if canal == 'sino' else Notificacao.TIPOS_CARTA

    itens = Notificacao.objects.filter(
        destinatario=autor, tipo__in=tipos
    ).select_related('remetente', 'post')

    itens.filter(lida=False).update(lida=True)

    return render(request, 'posts/notificacoes.html', {
        'itens': itens,
        'canal': canal,
    })