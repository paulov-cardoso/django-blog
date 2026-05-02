from django.db.models.signals import post_save
from django.contrib.auth.models import User
from django.dispatch import receiver
from .models import Autor

@receiver(post_save, sender=User)
def criar_autor(sender, instance, created, **kwargs):
    if created:
        Autor.objects.create(
            usuario=instance,
            nome=instance.username,       
            nome_exibicao=instance.username,
            email=instance.email or f'{instance.username}@blognotes.com'
        )