from django.shortcuts import render, get_object_or_404
from .models import Post

def listar_post(request):
    posts = Post.objects.filter(publicado=True).order_by('-data_criacao')
    return render(request, 'posts/listar.html', {'posts': posts})

def detalhe_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, publicado=True)
    return render(request, 'posts/detail.html', {'post': post})
