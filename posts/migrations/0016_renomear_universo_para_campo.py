from django.db import migrations


def universo_para_campo(apps, schema_editor):
    Post = apps.get_model('posts', 'Post')
    Post.objects.filter(visibilidade='universo').update(visibilidade='campo')


def campo_para_universo(apps, schema_editor):
    # Rollback: desfaz a migração se necessário
    Post = apps.get_model('posts', 'Post')
    Post.objects.filter(visibilidade='campo').update(visibilidade='universo')


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0015_notificacao'),  # ajuste para o número correto da sua última migration
    ]

    operations = [
        migrations.RunPython(universo_para_campo, campo_para_universo),
    ]
