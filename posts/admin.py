from django.contrib import admin
from .models import Autor,Categoria, Post

@admin.register(Autor)
class Autor(admin.ModelAdmin):
    list_display = ['nome', 'email']
    search_fields = ['nome', 'email']

@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ['nome', 'slug']
    search_fields = ['nome', 'slug']
    prepopulated_fields = {"slug": ("nome",)}

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'autor', 'publicado', 'data_criacao']
    list_filter = ['publicado', 'data_criacao', 'autor']
    search_fields = ['titulo', 'conteudo']
    filter_horizontal = ['categorias']
    date_hierarchy = 'data_criacao'