from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login
from django.contrib import messages
from .models import Post, Autor, ModeradorPost, CandidaturaModerador, Seguidor
from .forms import PostForm, RegistroForm


# ── helpers ───────────────────────────────────────────────────────

def _pode_desistir(post):
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


def _contexto_perfil(autor_perfil, usuario_logado):
    autor_logado = getattr(usuario_logado, 'autor', None) if usuario_logado.is_authenticated else None

    posts_publicos = Post.objects.filter(
        autor=autor_perfil,
        publicado=True,
        visibilidade__in=['feed', 'universo']
    ).order_by('-data_criacao')

    segue = (
        autor_logado is not None and
        autor_logado != autor_perfil and
        Seguidor.objects.filter(seguidor=autor_logado, seguido=autor_perfil).exists()
    )

    eh_proprio_perfil = autor_logado == autor_perfil

    return {
        'autor_perfil':      autor_perfil,
        'posts_publicos':    posts_publicos,
        'segue':             segue,
        'eh_proprio_perfil': eh_proprio_perfil,
        'total_privados':    Post.objects.filter(autor=autor_perfil,visibilidade='privado').count() if eh_proprio_perfil else 0,
    }


# ── home ──────────────────────────────────────────────────────────

@login_required
def home(request):
    aba = request.GET.get('aba', 'perfil')
    autor = request.user.autor

    if aba == 'perfil':
        contexto_perfil = _contexto_perfil(autor, request.user)
        return render(request, 'posts/home.html', {
            'aba': aba,
            **contexto_perfil,
        })

    if aba == 'meus_notes':
        posts = Post.objects.filter(
            autor=autor,
            publicado=True,
            visibilidade='privado'
        ).order_by('-data_criacao')

    elif aba == 'feed':
        seguindo_ids = Seguidor.objects.filter(
            seguidor=autor
        ).values_list('seguido_id', flat=True)
        posts = Post.objects.filter(
            publicado=True,
            visibilidade='feed',
            autor__in=seguindo_ids
        ).order_by('-data_criacao')

    elif aba == 'universo':
        posts = Post.objects.filter(
            publicado=True,
            visibilidade='universo'
        ).order_by('-data_criacao')

    else:
        posts = Post.objects.none()

    return render(request, 'posts/home.html', {'posts': posts, 'aba': aba})


# ── perfil de outro usuário (abre via modal) ──────────────────────

def perfil(request, username):
    from django.contrib.auth.models import User
    user_perfil = get_object_or_404(User, username=username)
    autor_perfil = get_object_or_404(Autor, usuario=user_perfil)
    contexto = _contexto_perfil(autor_perfil, request.user)
    return render(request, 'posts/perfil.html', contexto)


# ── seguir / deixar de seguir ─────────────────────────────────────

@login_required
def seguir_autor(request, username):
    from django.contrib.auth.models import User
    user_alvo = get_object_or_404(User, username=username)
    autor_alvo = get_object_or_404(Autor, usuario=user_alvo)
    autor_logado = request.user.autor

    if autor_logado == autor_alvo:
        return redirect('perfil', username=username)

    seguimento = Seguidor.objects.filter(seguidor=autor_logado, seguido=autor_alvo)
    if seguimento.exists():
        seguimento.delete()
    else:
        Seguidor.objects.create(seguidor=autor_logado, seguido=autor_alvo)

    return redirect(request.META.get('HTTP_REFERER', '/'))


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

    autor_logado = getattr(request.user, 'autor', None) if request.user.is_authenticated else None
    candidaturas_pendentes = []
    ja_candidatou = False

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


# ── mudar visibilidade ────────────────────────────────────────────

@login_required
def jogar_para_universo(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    if post.autor.usuario != request.user:
        messages.error(request, 'Você não tem permissão para mover este post.')
        return redirect('/?aba=meus_notes')

    if request.method == 'POST':
        post.visibilidade = request.POST.get('visibilidade', 'universo')
        post.publicado = True
        post.save()

    destino = {'privado': 'meus_notes', 'feed': 'feed', 'universo': 'universo'}
    return redirect(f'/?aba={destino.get(post.visibilidade, "meus_notes")}')


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

    if post.visibilidade == 'privado':
        post.delete()
        return redirect('/?aba=meus_notes')

    if post.visibilidade == 'feed':
        tem_cooperacao = post.candidaturas.filter(status='aceito').exists()
        if not tem_cooperacao:
            post.visibilidade = 'privado'
            post.desistiu = False
            post.save()
            return redirect('/?aba=meus_notes')

    moderadores_ativos = post.moderadores.filter(ativo=True)
    if moderadores_ativos.exists():
        if not post.autor_original:
            post.autor_original = autor
        moderadores_ativos.update(papel='dono')
        post.autor = moderadores_ativos.first().autor
        post.desistiu = True
        post.procura_moderador = False
        post.save()

    return redirect('/?aba=universo')


# ── candidatar-se a moderador ─────────────────────────────────────

@login_required
def candidatar_moderador(request, post_id):
    post      = get_object_or_404(Post, id=post_id)
    candidato = get_object_or_404(Autor, usuario=request.user)

    if post.autor == candidato:
        return redirect('/?aba=universo')

    if not CandidaturaModerador.objects.filter(post=post, candidato=candidato).exists():
        CandidaturaModerador.objects.create(
            post=post,
            candidato=candidato,
            mensagem=request.POST.get('mensagem', ''),
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
        return redirect('/?aba=universo')

    if post.moderadores.filter(ativo=True).count() >= post.limite_moderadores:
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
            autor = user.autor
            nome_exibicao = form.cleaned_data.get('nome_exibicao')
            autor.nome = nome_exibicao
            autor.nome_exibicao = nome_exibicao
            autor.save()
            login(request, user)
            return redirect('home')
    else:
        form = RegistroForm()
    return render(request, 'posts/registrar.html', {'form': form})