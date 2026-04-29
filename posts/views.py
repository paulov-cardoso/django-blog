from django.shortcuts import render
from .models import Post

def listar_post(request):
    posts = Post.objects.filter(publicado=True).order_by('-data_criacao')
    return render(request, 'posts/listar.html', {'posts': posts})