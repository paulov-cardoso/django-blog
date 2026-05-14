from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

from .models import Post, Autor


class PostForm(forms.ModelForm):
    class Meta:
        model  = Post
        fields = ['titulo', 'conteudo', 'publicado']
        widgets = {
            'titulo': forms.TextInput(attrs={
                'class':       'w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
                'placeholder': 'Título do note...',
            }),
            'conteudo': forms.Textarea(attrs={
                'class':       'w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
                'rows':        6,
                'placeholder': 'Escreva seu note aqui...',
            }),
        }


class RegistroForm(UserCreationForm):
    nome_exibicao = forms.CharField(
        max_length=100,
        required=True,
        label='Como quer ser chamado?',
    )

    class Meta:
        model  = User
        fields = ['username', 'nome_exibicao', 'password1', 'password2']


class AutorForm(forms.ModelForm):
    class Meta:
        model  = Autor
        fields = ['nome_exibicao', 'bio', 'foto_perfil', 'foto_capa']
        widgets = {
            'nome_exibicao': forms.TextInput(attrs={
                'class':       'w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400',
                'placeholder': 'Seu nome de exibição...',
            }),
            'bio': forms.Textarea(attrs={
                'class':       'w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none',
                'rows':        3,
                'placeholder': 'Conte um pouco sobre você...',
            }),
            'foto_perfil': forms.FileInput(attrs={
                'class':  'hidden',
                'accept': 'image/*',
                'id':     'input-foto-perfil',
            }),
            'foto_capa': forms.FileInput(attrs={
                'class':  'hidden',
                'accept': 'image/*',
                'id':     'input-foto-capa',
            }),
        }