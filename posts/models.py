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
    VISIBILIDADE_CHOICES = [
        ('privado',  'Privado'),
        ('feed',     'Feed de Ideias'),
        ('universo', 'Campo das Ideias'),
    ]

    titulo      = models.CharField(max_length=200)
    conteudo    = models.TextField()
    cor         = models.CharField(max_length=7, default='#3B82F6')
    data_criacao = models.DateTimeField(auto_now_add=True)
    publicado   = models.BooleanField(default=False)
    visibilidade = models.CharField(
        max_length=10,
        choices=VISIBILIDADE_CHOICES,
        default='privado'
    )
    desistiu    = models.BooleanField(default=False)
    autor       = models.ForeignKey(Autor, on_delete=models.CASCADE)
    categorias  = models.ManyToManyField(Categoria)

    autor_original = models.ForeignKey(
        'Autor',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='posts_criados_originalmente',
        help_text='Preservado quando autor desiste e moderador assume'
    )
    procura_moderador = models.BooleanField(default=False)
    limite_moderadores = models.PositiveIntegerField(
        default=5,
        help_text='Limite de moderadores que o autor pode indicar'
    )

    @property
    def tem_moderador(self):
        return self.moderadores.filter(ativo=True).exists()

    @property
    def tem_interacoes(self):
        """Bloqueia retorno ao Feed se houver candidatura aceita."""
        return self.candidaturas.filter(status='aceito').exists()
        # TODO Fase 8: adicionar checagem de 3+ comentadores distintos

    def __str__(self):
        return self.titulo


class ModeradorPost(models.Model):
    """Moderadores de um post — podem ser donos após desistência do autor."""

    PAPEL_CHOICES = [
        ('moderador', 'Moderador'),
        ('dono',      'Dono'),
    ]

    post  = models.ForeignKey(Post,  on_delete=models.CASCADE, related_name='moderadores')
    autor = models.ForeignKey(Autor, on_delete=models.CASCADE, related_name='moderacoes')
    papel = models.CharField(max_length=20, choices=PAPEL_CHOICES, default='moderador')
    ativo = models.BooleanField(default=True)
    data  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'autor')

    def __str__(self):
        return f"{self.autor.nome_exibicao} — {self.papel} em '{self.post.titulo}'"


class CandidaturaModerador(models.Model):

    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('aceito',   'Aceito'),
        ('recusado', 'Recusado'),
    ]

    post      = models.ForeignKey(Post,  on_delete=models.CASCADE, related_name='candidaturas')
    candidato = models.ForeignKey(Autor, on_delete=models.CASCADE, related_name='candidaturas')
    mensagem  = models.TextField(blank=True, help_text='Mensagem de apresentação do candidato')
    status    = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    data      = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'candidato')

    def __str__(self):
        return f"{self.candidato.nome_exibicao} → '{self.post.titulo}' ({self.status})"