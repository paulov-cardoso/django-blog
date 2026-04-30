from django import forms
from .models import Post, Categoria

class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ['titulo', 'conteudo', 'categorias', 'publicado']
        widgets = {
            'titulo': forms.TextInput(attrs={
                'class': 'w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
                'placeholder': 'Título do note...'
            }),
            'conteudo': forms.Textarea(attrs={
                'class': 'w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
                'rows': 6,
                'placeholder': 'Escreva seu note aqui...'
            }),
            'categorias': forms.CheckboxSelectMultiple(),
        }