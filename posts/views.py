from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Post
from .forms import PostForm

@login_required
def criar_post(request):
    if request.method == 'POST':
        form = PostForm(request.POST)
        if form.is_valid():
            post = form.save(commit=False)
            post.autor = request.user.autor
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
