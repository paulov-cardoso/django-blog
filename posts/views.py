from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login
from django.contrib import messages
from .models import Post, Autor, ModeradorPost, CandidaturaModerador
from .forms import PostForm, RegistroForm


# ── helper — verifica interações bloqueantes ──────────────────────

def tem_interacoes_bloqueantes(post):
    if post.candidaturas.filter(status='aceito').exists():
        return True
    # TODO Fase 8: adicionar checagem de 3+ comentadores distintos
    return False


# ── helper — regra de desistência ─────────────────────────────────

def _pode_desistir(post):
    """
    Privado  → sempre pode (post será excluído).
    Feed sem colaboração → pode (post volta para privado).
    Feed com colaboração → exige moderador.
    Universo → sempre exige moderador.
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
        return (
            False,
            'Este post tem cooperações aceitas. '
            'Eleja um moderador antes de desistir.'
        )

    if post.visibilidade == 'universo':
        if tem_moderador:
            return True, ''
        return (
            False,
            'Posts no Campo das Ideias exigem pelo menos '
            'um moderador antes de você poder desistir.'
        )

    return False, 'Visibilidade desconhecida.'


# ── home ───────────────────────────────────────────────────────────

@login_required
def home(request):
    aba = request.GET.get('aba', 'meus_notes')

    if aba == 'meus_notes':
        posts = Post.objects.filter(
            autor=request.user.autor,
            publicado=True,
            visibilidade='privado'
        ).order_by('-data_criacao')
    elif aba == 'feed':
        posts = Post.objects.filter(
            publicado=True,
            visibilidade='feed'
        ).order_by('-data_criacao')
    elif aba == 'universo':
        posts = Post.objects.filter(
            publicado=True,
            visibilidade='universo'
        ).order_by('-data_criacao')
    else:
        posts = Post.objects.none()

    return render(request, 'posts/home.html', {'posts': posts, 'aba': aba})


# ── criar post ────────────────────────────────────────────────────

@login_required
def criar_post(request):
    if request.method == 'POST':
        form = PostForm(request.POST)
        cor = request.POST.get('cor', '#3B82F6')
        if form.is_valid():
            post = form.save(commit=False)
            post.cor = cor
            post.autor = request.user.autor
            post.save()
            form.save_m2m()
            return redirect('/?aba=meus_notes')
    else:
        form = PostForm()
    return render(request, 'posts/criar.html', {'form': form})


# ── editar post ───────────────────────────────────────────────────

@login_required
def editar_post(request, post_id):
    # Bloqueia edição se o usuário não for mais o autor atual
    post = get_object_or_404(Post, id=post_id)
    if post.autor.usuario != request.user:
        messages.error(request, 'Você não tem permissão para editar este post.')
        return redirect('/?aba=meus_notes')

    if request.method == 'POST':
        form = PostForm(request.POST, instance=post)
        cor = request.POST.get('cor', post.cor)
        if form.is_valid():
            post = form.save(commit=False)
            post.cor = cor
            post.save()
            form.save_m2m()
            return redirect('/?aba=meus_notes')
    else:
        form = PostForm(instance=post)
    return render(request, 'posts/editar.html', {'form': form, 'post': post})


# ── detalhe do post ───────────────────────────────────────────────

def detalhe_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, publicado=True)

    pode, motivo = _pode_desistir(post)
    bloqueio_retirar_feed = (
        post.visibilidade == 'universo' and tem_interacoes_bloqueantes(post)
    )

    autor_logado = None
    candidaturas_pendentes = []
    ja_candidatou = False

    if request.user.is_authenticated:
        autor_logado = getattr(request.user, 'autor', None)
        if autor_logado:
            if post.autor == autor_logado:
                candidaturas_pendentes = post.candidaturas.filter(status='pendente')
            else:
                ja_candidatou = post.candidaturas.filter(
                    candidato=autor_logado
                ).exists()

    moderadores_ativos = post.moderadores.filter(ativo=True)

    return render(request, 'posts/detail.html', {
        'post':                   post,
        'pode_desistir':          pode,
        'motivo_bloqueio':        motivo,
        'candidaturas_pendentes': candidaturas_pendentes,
        'moderadores_ativos':     moderadores_ativos,
        'ja_candidatou':          ja_candidatou,
        'bloqueio_retirar_feed':  bloqueio_retirar_feed,
    })


# ── mudar visibilidade ────────────────────────────────────────────

@login_required
def jogar_para_universo(request, post_id):
    post = get_object_or_404(Post, id=post_id)

    # Bloqueia se o usuário não for o autor atual
    if post.autor.usuario != request.user:
        messages.error(request, 'Você não tem permissão para mover este post.')
        return redirect('/?aba=meus_notes')

    if request.method == 'POST':
        visibilidade = request.POST.get('visibilidade', 'universo')
        post.visibilidade = visibilidade
        post.publicado = True
        post.save()

    aba = 'meus_notes'
    if post.visibilidade == 'feed':
        aba = 'feed'
    elif post.visibilidade == 'universo':
        aba = 'universo'

    return redirect(f'/?aba={aba}')


# ── desistir da ideia ─────────────────────────────────────────────

@login_required
def desistir_ideia(request, post_id):
    post  = get_object_or_404(Post, id=post_id)
    autor = get_object_or_404(Autor, usuario=request.user)

    if post.autor != autor:
        messages.error(request, 'Você não é o autor deste post.')
        return redirect('/?aba=meus_notes')

    pode, motivo = _pode_desistir(post)

    if not pode:
        messages.error(request, motivo)
        return redirect('/?aba=universo')

    # Cenário 1 — privado: exclui permanentemente
    if post.visibilidade == 'privado':
        post.delete()
        return redirect('/?aba=meus_notes')

    # Cenário 2 — feed sem colaboração: volta para privado
    if post.visibilidade == 'feed':
        tem_cooperacao = post.candidaturas.filter(status='aceito').exists()
        if not tem_cooperacao:
            post.visibilidade = 'privado'
            post.desistiu = False
            post.save()
            return redirect('/?aba=meus_notes')

    # Cenários 3 e 4 — tem moderador: transfere propriedade
    moderadores_ativos = post.moderadores.filter(ativo=True)
    if moderadores_ativos.exists():
        if not post.autor_original:
            post.autor_original = autor

        moderadores_ativos.update(papel='dono')
        novo_dono = moderadores_ativos.first().autor
        post.autor = novo_dono
        post.desistiu = True
        post.procura_moderador = False
        post.save()

        return redirect('/?aba=universo')

    # Sem moderador — não deveria chegar aqui, mas por segurança:
    return redirect('/?aba=universo')


# ── candidatar-se a moderador ─────────────────────────────────────

@login_required
def candidatar_moderador(request, post_id):
    post      = get_object_or_404(Post, id=post_id)
    candidato = get_object_or_404(Autor, usuario=request.user)

    if post.autor == candidato:
        messages.error(request, 'Você já é o autor deste post.')
        return redirect('/?aba=universo')

    ja_existe = CandidaturaModerador.objects.filter(
        post=post, candidato=candidato
    ).exists()
    if ja_existe:
        messages.info(request, 'Você já se candidatou a este post.')
        return redirect('/?aba=universo')

    mensagem = request.POST.get('mensagem', '')
    CandidaturaModerador.objects.create(
        post=post,
        candidato=candidato,
        mensagem=mensagem,
        status='pendente'
    )
    return redirect('/?aba=universo')


# ── eleger moderador ──────────────────────────────────────────────

@login_required
def eleger_moderador(request, post_id, candidatura_id):
    post        = get_object_or_404(Post, id=post_id)
    autor       = get_object_or_404(Autor, usuario=request.user)
    candidatura = get_object_or_404(CandidaturaModerador, id=candidatura_id, post=post)

    if post.autor != autor:
        messages.error(request, 'Apenas o autor pode eleger moderadores.')
        return redirect('/?aba=universo')

    ativos = post.moderadores.filter(ativo=True).count()
    if ativos >= post.limite_moderadores:
        messages.error(request, f'Limite de {post.limite_moderadores} moderadores atingido.')
        return redirect('/?aba=universo')

    candidatura.status = 'aceito'
    candidatura.save()

    ModeradorPost.objects.get_or_create(
        post=post,
        autor=candidatura.candidato,
        defaults={'papel': 'moderador', 'ativo': True}
    )

    if post.procura_moderador:
        post.procura_moderador = False
        post.save()

    return redirect('/?aba=universo')


# ── recusar candidatura ───────────────────────────────────────────

@login_required
def recusar_candidatura(request, post_id, candidatura_id):
    post        = get_object_or_404(Post, id=post_id)
    autor       = get_object_or_404(Autor, usuario=request.user)
    candidatura = get_object_or_404(CandidaturaModerador, id=candidatura_id, post=post)

    if post.autor != autor:
        messages.error(request, 'Apenas o autor pode recusar candidaturas.')
        return redirect('/?aba=universo')

    candidatura.status = 'recusado'
    candidatura.save()
    return redirect('/?aba=universo')


# ── registro ──────────────────────────────────────────────────────

def registrar(request):
    if request.method == 'POST':
        form = RegistroForm(request.POST)
        if form.is_valid():
            user = form.save()
            nome_exibicao = form.cleaned_data.get('nome_exibicao')
            autor = user.autor
            autor.nome = nome_exibicao
            autor.nome_exibicao = nome_exibicao
            autor.save()
            login(request, user)
            return redirect('home')
    else:
        form = RegistroForm()
    return render(request, 'posts/registrar.html', {'form': form})