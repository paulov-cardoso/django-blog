from django.db import models
from django.contrib.auth.models import User


class Autor(models.Model):
    usuario      = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    nome         = models.CharField(max_length=100)
    nome_exibicao = models.CharField(max_length=100, blank=True, default='')
    email        = models.EmailField(unique=True)
    bio          = models.TextField(blank=True)
    foto_perfil  = models.ImageField(upload_to='fotos/perfil/', null=True, blank=True)
    foto_capa    = models.ImageField(upload_to='fotos/capa/', null=True, blank=True)

    def __str__(self):
        return self.nome_exibicao or self.nome

    @property
    def total_seguidores(self):
        return self.seguidores.count()

    @property
    def total_seguindo(self):
        return self.seguindo.count()


class Categoria(models.Model):
    nome = models.CharField(max_length=50)
    slug = models.SlugField(unique=True)
    cor  = models.CharField(max_length=7, default='#3B82F6')

    def __str__(self):
        return self.nome


class Post(models.Model):
    VISIBILIDADE_CHOICES = [
        ('privado',  'Privado'),
        ('feed',     'Feed de Ideias'),
        ('universo', 'Campo das Ideias'),
    ]

    titulo             = models.CharField(max_length=200)
    conteudo           = models.TextField()
    cor                = models.CharField(max_length=7, default='#3B82F6')
    data_criacao       = models.DateTimeField(auto_now_add=True)
    publicado          = models.BooleanField(default=False)
    visibilidade       = models.CharField(max_length=10, choices=VISIBILIDADE_CHOICES, default='privado')
    desistiu           = models.BooleanField(default=False)
    autor              = models.ForeignKey(Autor, on_delete=models.CASCADE, related_name='posts')
    categorias         = models.ManyToManyField(Categoria)
    autor_original     = models.ForeignKey(
        'Autor',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='posts_criados_originalmente',
    )
    procura_moderador  = models.BooleanField(default=False)
    limite_moderadores = models.PositiveIntegerField(default=5)

    @property
    def tem_moderador(self):
        return self.moderadores.filter(ativo=True).exists()

    @property
    def tem_interacoes_feed(self):
        # TODO Fase 8: adicionar checagem de 3+ comentadores distintos
        return self.candidaturas.filter(status='aceito').exists()

    @property
    def tem_interacoes(self):
        # TODO Fase 8: adicionar checagem de 3+ comentadores distintos
        return self.candidaturas.filter(status='aceito').exists()

    def __str__(self):
        return self.titulo


class Seguidor(models.Model):
    seguidor = models.ForeignKey(Autor, on_delete=models.CASCADE, related_name='seguindo')
    seguido  = models.ForeignKey(Autor, on_delete=models.CASCADE, related_name='seguidores')
    data     = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('seguidor', 'seguido')

    def __str__(self):
        return f"{self.seguidor} segue {self.seguido}"


class ModeradorPost(models.Model):
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
        return f"{self.autor} — {self.papel} em '{self.post}'"


class CandidaturaModerador(models.Model):
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('aceito',   'Aceito'),
        ('recusado', 'Recusado'),
    ]

    post      = models.ForeignKey(Post,  on_delete=models.CASCADE, related_name='candidaturas')
    candidato = models.ForeignKey(Autor, on_delete=models.CASCADE, related_name='candidaturas')
    mensagem  = models.TextField(blank=True)
    status    = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    data      = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'candidato')

    def __str__(self):
        return f"{self.candidato} → '{self.post}' ({self.status})"