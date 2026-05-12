from .models import Notificacao


def notificacoes(request):
    """
    Injeta notif_sino e notif_carta em todos os templates.
    Retorna zeros quando o usuário não está autenticado ou não tem Autor.
    """
    if not request.user.is_authenticated:
        return {'notif_sino': 0, 'notif_carta': 0}

    autor = getattr(request.user, 'autor', None)
    if not autor:
        return {'notif_sino': 0, 'notif_carta': 0}

    nao_lidas = Notificacao.objects.filter(destinatario=autor, lida=False)

    return {
        'notif_sino':  nao_lidas.filter(tipo__in=Notificacao.TIPOS_SINO).count(),
        'notif_carta': nao_lidas.filter(tipo__in=Notificacao.TIPOS_CARTA).count(),
    }