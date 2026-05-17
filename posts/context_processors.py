from .models import Notificacao


def notificacoes(request):
    if not request.user.is_authenticated:
        return {'notif_sino': 0, 'notif_carta': 0, 'notif_pessoa': 0}

    autor = getattr(request.user, 'autor', None)
    if not autor:
        return {'notif_sino': 0, 'notif_carta': 0, 'notif_pessoa': 0}

    nao_lidas = Notificacao.objects.filter(destinatario=autor, lida=False)

    return {
        'notif_sino':   nao_lidas.filter(tipo__in=Notificacao.TIPOS_SINO).count(),
        'notif_carta':  nao_lidas.filter(tipo__in=Notificacao.TIPOS_CARTA).count(),
        'notif_pessoa': nao_lidas.filter(tipo__in=Notificacao.TIPOS_PESSOA).count(),
    }