from django.db import models
from django.contrib.auth.models import User

class Autor(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    nome = models.CharField(max_length=100)
    nome_exibicao = models.CharField(max_length=100, blank=True, default='')
    email = models.EmailField(unique=True)
    bio = models.TextField(blank=True)

    def __str__(self):
        return self.nome


class Categoria(models.Model):
    nome = models.CharField(max_length=50)
    slug = models.SlugField(unique=True)
    cor = models.CharField(max_length=7, default='#3B82F6')

    def __str__(self):
        return self.nome
    
class Post(models.Model):
    titulo = models.CharField(max_length=200)
    conteudo = models.TextField()
    cor = models.CharField(max_length=7, default='#3B82F6')
    data_criacao = models.DateTimeField(auto_now_add=True)
    publicado = models.BooleanField(default=False)
    autor = models.ForeignKey(Autor, on_delete=models.CASCADE)
    categorias = models.ManyToManyField(Categoria)

    def __str__(self):
        return self.titulo
    