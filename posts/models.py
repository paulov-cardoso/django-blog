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
    
    @property
    def total_curtidas(self):
        return self.reacoes.filter(tipo='curtida').count()

    @property
    def total_clips(self):
        return self.reacoes.filter(tipo='clip').count()

    def __str__(self):
        return self.titulo
    

class PostReacao(models.Model):
    TIPO_CHOICES = [
        ('curtida', 'Curtida'),
        ('clip',    'Clip'),      # "salvar para acompanhar de perto"
    ]

    post   = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reacoes')
    autor  = models.ForeignKey(Autor, on_delete=models.CASCADE, related_name='reacoes')
    tipo   = models.CharField(max_length=10, choices=TIPO_CHOICES)
    data   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'autor', 'tipo')

    def __str__(self):
        return f"{self.autor} → {self.tipo} em '{self.post}'"


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

    PRIVILEGIO_CHOICES = [
        ('novo_dono',                   'Novo dono da ideia'),
        ('edicao_e_moderacao',          'Edição e moderação de comentários'),
        ('somente_edicao',              'Somente edição'),
    ]

    post      = models.ForeignKey(Post,  on_delete=models.CASCADE, related_name='moderadores')
    autor     = models.ForeignKey(Autor, on_delete=models.CASCADE, related_name='moderacoes')
    papel     = models.CharField(max_length=20, choices=PAPEL_CHOICES, default='moderador')
    privilegio = models.CharField(
        max_length=30, choices=PRIVILEGIO_CHOICES, default='somente_edicao'
    )
    ativo     = models.BooleanField(default=True)
    data      = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'autor')

    def __str__(self):
        return f"{self.autor} — {self.papel} ({self.privilegio}) em '{self.post}'"


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
    
    
class Notificacao(models.Model):
    TIPO_CHOICES = [
        ('curtida',      'Curtida'),
        ('clip',         'Clip'),
        ('comentario',   'Comentário'),
        ('candidatura',  'Candidatura a moderador'),
        ('eleicao',      'Eleito moderador'),
        ('recusa',       'Candidatura recusada'),
    ]

    # Tipos que vão para o sino (interações)
    TIPOS_SINO = {'curtida', 'clip', 'comentario'}
    # Tipos que vão para a carta (colaboração/moderação)
    TIPOS_CARTA = {'candidatura', 'eleicao', 'recusa'}

    destinatario = models.ForeignKey(
        Autor, on_delete=models.CASCADE, related_name='notificacoes'
    )
    remetente    = models.ForeignKey(
        Autor, on_delete=models.CASCADE, related_name='notificacoes_enviadas',
        null=True, blank=True
    )
    post         = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='notificacoes',
        null=True, blank=True
    )
    tipo         = models.CharField(max_length=20, choices=TIPO_CHOICES)
    lida         = models.BooleanField(default=False)
    data         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data']

    def __str__(self):
        return f"{self.tipo} → {self.destinatario} ({'lida' if self.lida else 'não lida'})"

    @property
    def eh_sino(self):
        return self.tipo in self.TIPOS_SINO

    @property
    def eh_carta(self):
        return self.tipo in self.TIPOS_CARTA