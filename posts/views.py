from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import login
from django.contrib import messages
from django.db.models import Q
from .models import Post, Autor, ModeradorPost, CandidaturaModerador, Seguidor, PostReacao
from .forms import PostForm, RegistroForm


# ── helpers ───────────────────────────────────────────────────────────────────

def _pode_desistir(post):
    """
    Retorna (pode: bool, motivo: str).
    Privado           → sempre pode.
    Feed sem coop     → pode (volta para privado).
    Feed com coop     → exige moderador eleito.
    Universo          → sempre exige moderador eleito.
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

    if post.visibilidade == 'universo':
        if tem_moderador:
            return True, ''
        return False, 'Posts no Campo das Ideias exigem pelo menos um moderador antes de você poder desistir.'

    return False, 'Visibilidade desconhecida.'


def _contexto_perfil(autor_perfil, request_user):
    """
    Monta o contexto reutilizável para renderizar o card de perfil.
    Só consulta posts privados quando for o próprio perfil.
    """
    autor_logado = getattr(request_user, 'autor', None) if request_user.is_authenticated else None
    eh_proprio_perfil = autor_logado is not None and autor_logado == autor_perfil

    # Perfil próprio vê tudo; perfil externo só vê feed+universo
    if eh_proprio_perfil:
        posts_visiveis = Post.objects.filter(
            autor=autor_perfil,
            publicado=True,
            visibilidade__in=['feed', 'universo'],
        ).order_by('-data_criacao')
    else:
        # Seguidores veem feed; todos veem universo
        segue = (
            autor_logado is not None
            and Seguidor.objects.filter(seguidor=autor_logado, seguido=autor_perfil).exists()
        )
        if segue:
            posts_visiveis = Post.objects.filter(
                autor=autor_perfil,
                publicado=True,
                visibilidade__in=['feed', 'universo'],
            ).order_by('-data_criacao')
        else:
            posts_visiveis = Post.objects.filter(
                autor=autor_perfil,
                publicado=True,
                visibilidade='universo',
            ).order_by('-data_criacao')

        segue_flag = autor_logado is not None and Seguidor.objects.filter(
            seguidor=autor_logado, seguido=autor_perfil
        ).exists()

        return {
            'autor_perfil':      autor_perfil,
            'posts_publicos':    posts_visiveis,
            'segue':             segue_flag,
            'eh_proprio_perfil': False,
            'total_privados':    0,
        }

    segue = False  # próprio perfil não segue a si mesmo
    return {
        'autor_perfil':      autor_perfil,
        'posts_publicos':    posts_visiveis,
        'segue':             segue,
        'eh_proprio_perfil': True,
        'total_privados':    Post.objects.filter(
            autor=autor_perfil, visibilidade='privado'
        ).count(),
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
        # Inclui privados NÃO publicados também (rascunhos)
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

    elif aba == 'universo':
        posts = Post.objects.filter(
            publicado=True,
            visibilidade='universo',
        ).order_by('-data_criacao')

    else:
        posts = Post.objects.none()

    return render(request, 'posts/home.html', {'posts': posts, 'aba': aba})


# ── perfil externo (carregado via fetch no modal) ─────────────────────────────

def perfil(request, username):
    user_perfil  = get_object_or_404(User, username=username)
    autor_perfil = get_object_or_404(Autor, usuario=user_perfil)
    return render(request, 'posts/perfil.html', _contexto_perfil(autor_perfil, request.user))


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
            post = form.save(commit=False)
            post.cor    = request.POST.get('cor', '#3B82F6')
            post.autor  = request.user.autor
            post.save()
            form.save_m2m()
            return redirect('/?aba=meus_notes&msg=note_criado')
    else:
        form = PostForm()

    return render(request, 'posts/criar.html', {'form': form})


# ── mudar visibilidade ────────────────────────────────────────────────────────

@login_required
def jogar_para_universo(request, post_id):
    if request.method != 'POST':
        return redirect('home')

    post = get_object_or_404(Post, id=post_id)

    if post.autor.usuario != request.user:
        return redirect('home')

    nova_visibilidade = request.POST.get('visibilidade', 'universo')
    opcoes_validas    = {'privado', 'feed', 'universo'}

    if nova_visibilidade not in opcoes_validas:
        return redirect('home')

    post.visibilidade = nova_visibilidade
    post.publicado    = nova_visibilidade != 'privado'
    post.save(update_fields=['visibilidade', 'publicado'])

    DESTINO_MSG = {
        'privado':  ('meus_notes', 'ideia_privada'),
        'feed':     ('feed',       'ideia_feed'),
        'universo': ('universo',   'ideia_universo'),
    }
    aba, msg = DESTINO_MSG[nova_visibilidade]
    return redirect(f'/?aba={aba}&msg={msg}')


# ── editar post ───────────────────────────────────────────────────────────────

_ABA_POR_VISIBILIDADE = {
    'privado':  'meus_notes',
    'feed':     'feed',
    'universo': 'universo',
}

@login_required
def editar_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)

    if post.autor.usuario != request.user:
        return redirect('home')

    if request.method == 'POST':
        form = PostForm(request.POST, instance=post)
        if form.is_valid():
            post = form.save(commit=False)
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

    autor_logado          = getattr(request.user, 'autor', None) if request.user.is_authenticated else None
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
        'bloqueio_retirar_feed':  post.visibilidade == 'universo' and post.tem_interacoes,
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
        reacao.delete()   # toggle: desfaz se já reagiu
    else:
        PostReacao.objects.create(post=post, autor=autor, tipo=tipo)

    # Retorna para a aba de origem passada via hidden input
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

    pode, motivo = _pode_desistir(post)
    if not pode:
        # Redireciona de volta com mensagem de erro via query param
        return redirect(f'/?aba=universo&erro=desistir_bloqueado')

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

    # Feed com cooperação ou universo com moderador: transfere autoria
    moderadores_ativos = post.moderadores.filter(ativo=True)
    if moderadores_ativos.exists():
        if not post.autor_original:
            post.autor_original = autor
        novo_dono = moderadores_ativos.first().autor
        moderadores_ativos.update(papel='dono')
        post.autor           = novo_dono
        post.desistiu        = True
        post.procura_moderador = False
        post.save(update_fields=['autor', 'autor_original', 'desistiu', 'procura_moderador'])

    return redirect('/?aba=universo&msg=desistiu')


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
    return redirect('/?aba=universo')


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

    # Seguidores do autor que ainda não são moderadores ativos neste post
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

        # Candidato deve seguir ou ser seguido pelo autor (segurança extra)
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

        # Aceita candidatura pendente se existir
        CandidaturaModerador.objects.filter(
            post=post, candidato=candidato, status='pendente'
        ).update(status='aceito')

        return redirect('/?aba=universo&msg=moderador_eleito')

    ERROS = {
        'privilegio_invalido': 'Privilégio selecionado inválido.',
        'nao_seguidor':        'O usuário selecionado não te segue.',
        'limite_atingido':     f'Limite de {post.limite_moderadores} moderadores atingido.',
    }
    erro_key = request.GET.get('erro', '')

    return render(request, 'posts/eleger_moderador.html', {
        'post':       post,
        'seguidores': seguidores,
        'busca':      busca,
        'privilegios': ModeradorPost.PRIVILEGIO_CHOICES,
        'erro':       ERROS.get(erro_key, ''),
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
        return redirect('/?aba=universo&erro=limite_atingido')

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

    return redirect('/?aba=universo&msg=moderador_eleito')


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
    return redirect('/?aba=universo')


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
            return redirect('home')
    else:
        form = RegistroForm()

    return render(request, 'posts/registrar.html', {'form': form})