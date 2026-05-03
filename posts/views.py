from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login
from .models import Post, Autor
from .forms import PostForm, RegistroForm


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

    return render(request, 'posts/home.html', {
        'posts': posts,
        'aba': aba
    })


@login_required
def editar_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, autor=request.user.autor)
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


@login_required
def jogar_para_universo(request, post_id):
    post = get_object_or_404(Post, id=post_id, autor=request.user.autor)
    if request.method == 'POST':
        visibilidade = request.POST.get('visibilidade', 'universo')
        post.visibilidade = visibilidade
        post.publicado = True
        post.save()
    return redirect('/?aba=meus_notes')


@login_required
def desistir_ideia(request, post_id):
    post = get_object_or_404(Post, id=post_id, autor=request.user.autor)
    if request.method == 'POST' and post.visibilidade == 'universo':
        post.desistiu = True
        post.save()
    return redirect('/?aba=universo')


def detalhe_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, publicado=True)
    return render(request, 'posts/detail.html', {'post': post})


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