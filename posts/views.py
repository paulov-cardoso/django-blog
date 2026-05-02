from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Post, Autor
from .forms import PostForm
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
from .forms import PostForm, RegistroForm

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
            return redirect('listar_posts')
    else:
        form = PostForm()
    return render(request, 'posts/criar.html', {'form': form})

@login_required
def listar_post(request):
    posts = Post.objects.filter(
        publicado=True,
        autor=request.user.autor
    ).order_by('-data_criacao')
    return render(request, 'posts/listar.html', {'posts': posts})

def detalhe_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, publicado=True)
    return render(request, 'posts/detail.html', {'post': post})

def registrar(request):
    if request.method == 'POST':
        form = RegistroForm(request.POST)
        if form.is_valid():
            user = form.save()
            nome_exibicao = form.cleaned_data.get('nome_exibicao')
            autor = user.autor
            autor.nome = nome_exibicao  # ← garante que nome nunca seja null
            autor.nome_exibicao = nome_exibicao
            autor.save()
            login(request, user)
            return redirect('listar_posts')
    else:
        form = RegistroForm()
    return render(request, 'posts/registrar.html', {'form': form})