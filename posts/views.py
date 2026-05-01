from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Post, Autor
from .forms import PostForm
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login

@login_required
def criar_post(request):
    if request.method == 'POST':
        form = PostForm(request.POST)
        cor = request.POST.get('cor', '#3B82F6')
        if form.is_valid():
            post = form.save(commit=False)
            post.cor = cor
            autor = Autor.objects.first()
            post.autor = autor
            post.save()
            form.save_m2m()
            return redirect('listar_posts')
    else:
        form = PostForm()
    return render(request, 'posts/criar.html', {'form': form})

def listar_post(request):
    posts = Post.objects.filter(publicado=True).order_by('-data_criacao')
    return render(request, 'posts/listar.html', {'posts': posts})

def detalhe_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, publicado=True)
    return render(request, 'posts/detail.html', {'post': post})

def registrar(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('listar_posts')
    else:
        form = UserCreationForm()
    return render(request, 'posts/registrar.html', {'form': form})