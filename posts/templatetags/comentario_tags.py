from django import template
from posts.models import PostReacao

register = template.Library()


@register.inclusion_tag('posts/partials/shared/comentario_node.html', takes_context=True)
def render_comentario(context, comentario, post, profundidade=0):
    return {
        'comentario':   comentario,
        'post':         post,
        'profundidade': profundidade,
        'user':         context['user'],
    }


@register.filter
def curtida_ativa(post, user):
    if not user or not user.is_authenticated:
        return False
    try:
        return PostReacao.objects.filter(
            post=post, autor=user.autor, tipo='curtida'
        ).exists()
    except Exception:
        return False


@register.filter
def clip_ativo(post, user):
    if not user or not user.is_authenticated:
        return False
    try:
        return PostReacao.objects.filter(
            post=post, autor=user.autor, tipo='clip'
        ).exists()
    except Exception:
        return False