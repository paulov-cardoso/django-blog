# Synapsoo

> **Ideias são maiores que perfis.**
> Do lembrete do dia a dia à ideia disruptiva colaborativa — o lugar onde nenhuma ideia morre por falta de foco ou motivação.

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.13-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0-092e20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-prod-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Status](https://img.shields.io/badge/status-em%20desenvolvimento-f59e0b)]()
[![License](https://img.shields.io/badge/license-MIT-22c55e)](./LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/paulov-cardoso/django-blog)](https://github.com/paulov-cardoso/django-blog/commits/main)

</div>

---

## Índice

- [O que é](#-o-que-é)
- [Dois pilares](#-dois-pilares)
- [Funcionalidades](#-funcionalidades)
- [Fluxo de uma ideia](#-fluxo-de-uma-ideia)
- [Entroncamento de comentários](#-entroncamento-de-comentários)
- [Rolamento Cubo Mágico](#-rolamento-cubo-mágico)
- [Arquitetura frontend](#-arquitetura-frontend)
- [Stack](#️-stack)
- [Como rodar localmente](#-como-rodar-localmente)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Roadmap](#-roadmap)
- [Autor](#-autor)

---

## 💡 O que é?

O **Synapsoo** é um sistema de anotações de ideias — do lembrete simples do dia a dia à grande ideia disruptiva compartilhada para colaboração com amigos ou com o mundo.

Funciona como um sistema de **foco**, **antiesquecimento** e **antiprocrastinação**, com um **Modo TDAH** projetado para combater dispersão, bloqueio mental, *brain fog* e déficit de atenção.

O resultado: ideias ignoram as limitações humanas — inclusive a desmotivação — e se transformam em **força coletiva**.

> [!NOTE]
> No Synapsoo, a primeira pessoa é a dona da ideia — mas a ideia pode se tornar maior que ela.

---

## 🏛️ Dois pilares

### 📓 Refúgio Particular
Espaço privado de anotações. Lembretes, referências, rascunhos. Com o **Modo TDAH** ativado, o ambiente vira produtividade assistida: guias interativos, micro-steps e timer Pomodoro integrado.

### 🌍 Incubador de Ideias
Ideias públicas que "pairam" esperando colaboração. Comentários infinitos estilo Reddit com entroncamento visual, moderação coletiva e continuidade garantida — se o autor desistir, a comunidade assume.

---

## 🚀 Funcionalidades

### ✅ Implementadas

- Autenticação completa — login, cadastro, recuperação de senha
- Nova identidade visual premium — fundo gradiente lilás/roxo/rosa, card com glassmorphism e textura metálica fosca, canvas com post-its caindo, mascote Psoo
- Password validator animado com checks de força no cadastro
- Toast de boas-vindas animado pós-cadastro
- Sistema de visibilidade em 3 níveis: **Privado → Feed de Ideias → Campo das Ideias**
- Composer modal por aba — Notes Privados (simples), Feed (com capa obrigatória), Campo (sem capa)
- Dropdown *"O que fazer com a ideia?"* com modais de confirmação por cenário
- Sistema de moderação com candidatura, eleição de moderadores e privilégios configuráveis
- Transferência de autoria ao moderador quando o autor desiste
- Fluxo de desistência com regras por cenário (privado, feed com/sem cooperação, campo)
- Badge *"Procura-se Moderador"* e proteção de ideias com vida coletiva
- Página de eleição de moderadores com busca de seguidores e seleção de privilégios
- Perfil de usuário com foto de capa e foto de perfil em losango
- Sistema de seguidores e feed personalizado (próprios posts + posts de quem você segue)
- Listas de seguidores e seguindo clicáveis no perfil
- Busca de usuários por nome ou @username com modal sobreposto
- Feed estilo tabloid/revista — imagem de capa full-card com título sobreposto e gradiente
- Capa obrigatória (imagem principal + opcional secundária + título de capa) para posts no Feed
- Reações em posts — curtida ❤️ e clip 📌 sem refresh de página via fetch
- Categorias com autocomplete, validator animado e restauração após erros de validação
- Modal universal de post compartilhado entre Feed e Campo — conteúdo, imagens e comentários
- Comentários infinitos threaded com **Entroncamento de Comentários** (ver seção abaixo)
- Votos em comentários com toggle (upvote ▲ / downvote ▼) e score em tempo real
- Soft delete de comentários — preserva o thread, exibe `[comentário removido]`
- @mention automático ao responder um comentário
- Sistema de notificações em 3 canais:
  - 🔔 **Sino** — curtidas, clips, comentários e respostas
  - ✉️ **Carta** — candidaturas e eleições de moderador
  - 👤 **Pessoas** — novos seguidores
- Modal de perfil externo carregado via `fetch` com botão Seguir/Deixar de seguir
- Toast PRG animado com lâmpada ao completar ações
- Campo das Ideias com **Rolamento Cubo Mágico** — colunas independentes e algoritmo de dupla camada (ver seção abaixo)
- Frontend refatorado em ES Modules — 11 módulos, zero JS inline nos templates

### 🔄 Em desenvolvimento

- Rolamento Cubo Mágico — reescrita de `campo.js` com colunas independentes
- Animação da Psoo no login após autenticação
- Aba Forumização — threads promovidas por profundidade ou volume de participantes
- Modo TDAH — tunnel vision, Pomodoro, micro-steps, gamificação
- Kanban de ideias com drag and drop
- UX mobile e dark mode
- Login social (Google, GitHub)
- Deploy no Railway

---

## 🔄 Fluxo de uma ideia

Criação (Privado)
│
├──▶  Feed de Ideias  ──▶  Campo das Ideias
│          │                      │
│     [sem cooperação]       [com moderador]
│          │                      │
│     volta para             transfere autoria
│      Privado               ao moderador
│
└──▶  Excluída permanentemente

> [!TIP]
> Posts no **Campo das Ideias** com interações não podem ser removidos pelo autor — eles pertencem à comunidade.

> [!WARNING]
> Para desistir de uma ideia no Campo das Ideias é obrigatório eleger pelo menos um moderador antes. O moderador eleito assume a autoria; o autor original é preservado nos créditos.

---

## 🌿 Entroncamento de Comentários

O Synapsoo tem um sistema único de threading chamado **Entroncamento de Comentários**. Comentários formam troncos que se ramificam infinitamente, com comportamento adaptado à profundidade da conversa:

| Geração | Comportamento |
|---------|---------------|
| 1ª a 4ª | Exibidas no modal do post — ocultas por padrão, expansíveis ao clicar |
| 5ª | Abre em modal sobreposto — "Thread aprofundada" |
| 6ª+ | Alerta de forumização — thread promovida à aba Forumização |

**Forumização** ocorre quando qualquer um destes critérios é atingido primeiro:
- Thread atinge a 6ª geração de comentários
- Thread reúne 5 ou mais comentadores distintos no mesmo tronco

Quando forumizada, a thread sai do modal e ganha uma aba própria para debate estruturado.

---

## 🎲 Rolamento Cubo Mágico

O Campo das Ideias usa uma mecânica de navegação única chamada **Rolamento Cubo Mágico** — diferente de qualquer feed existente.

Em vez de mover o grid inteiro como uma câmera, cada coluna vertical se move **independentemente**, como as fatias de um cubo mágico físico. Arrastar verticalmente dentro de uma coluna move apenas aquela coluna — as outras ficam paradas.

| Monitor | Resolução | Colunas visíveis | Linhas visíveis | Cards |
|---------|-----------|-----------------|-----------------|-------|
| 27" FHD | 1920×1080 | 5 | 2 | 10 |
| 18.5" HD | 1366×768 | 3 | 2 | 6 |

**Algoritmo de dupla camada:**
- **Camada A** (sempre ativa) — agrupa posts por categorias compartilhadas, cada coluna é um cluster temático
- **Camada B** (≥10 interações) — refina por afinidade de comportamento: scroll, tempo no card, aberturas de modal

**Score com decaimento gravitacional:**

score = (curtidas×3 + clips×2 + comentários×5) ÷ idade_horas^1.5

A metáfora é literal: um campo onde ideias coexistem no espaço, e você navega por elas como exploraria um território — girando fatias para descobrir o que está por trás.

---

## 🧩 Arquitetura frontend

O frontend foi refatorado em 6 etapas para eliminar JavaScript inline dos templates. Os templates agora contêm apenas HTML estrutural — todo o comportamento vive em módulos ES carregados via `main.js`.

### Módulos JS (`posts/static/posts/js/`)

| Arquivo | Responsabilidade |
|---|---|
| `main.js` | Entry point — importa todos os módulos, registra globais, instancia controllers |
| `utils.js` | `getCsrf`, `timesince`, `abrirModal`, `fecharModal` — funções puras |
| `config.js` | Lê o bloco `#bn-config` do Django e exporta `{ isAuth, meUsername, meAvatar }` |
| `categoria.js` | `CategorySelector` — autocomplete, validator e criação de categorias |
| `image-upload.js` | `ImageUploadWidget` — preview e remoção de imagens de capa |
| `comentarios.js` | `ThreadManager` — threading completo, subthread, forumização, votos, exclusão |
| `modal-universal.js` | `ModalUniversal` singleton — abre, fecha e popula o modal de post |
| `composer.js` | `PostComposer` — abre, valida e publica posts via composer modal |
| `feed.js` | `FeedController` — reações, toggle de categorias, preview de comentários |
| `campo.js` | `CampoController` — grid 2D, drag, snap, modal de detalhe, sub-abas |
| `notes.js` | `NotesController` — composer bar dos Notes Privados |

### Resultado da refatoração

| Template | Antes | Depois |
|---|---|---|
| `grid_campo.html` | ~1400 linhas (~1100 JS) | 354 linhas (0 JS) |
| `card_feed.html` | ~800 linhas (~600 JS) | 227 linhas (0 JS) |
| `composer_bar.html` | ~500 linhas (~350 JS) | 0 JS |
| `modal_post_universal.html` | ~600 linhas (~450 JS) | 0 JS |

### Padrão de dados Django → JS

Dados de sessão são injetados via bloco JSON no `base.html`, eliminando interpolações Django dentro de arquivos JS:

```html
<script type="application/json" id="bn-config">
{
  "isAuth":     true,
  "meUsername": "paulo",
  "meAvatar":   "/media/fotos/paulo.jpg"
}
</script>
```

---

## 🛠️ Stack

| Camada    | Tecnologia                            |
|-----------|---------------------------------------|
| Backend   | Python 3.13 + Django 6.0              |
| Frontend  | Tailwind CSS v4 Standalone (sem Node) |
| JS        | ES Modules nativos (sem bundler)      |
| Banco     | PostgreSQL (produção) / SQLite (dev)  |
| Imagens   | Pillow                                |
| Deploy    | Railway *(planejado)*                 |

---

## ⚙️ Como rodar localmente

**Pré-requisitos:** Python 3.13+

```bash
# 1. Clone o repositório
git clone https://github.com/paulov-cardoso/django-blog.git
cd django-blog

# 2. Crie e ative o ambiente virtual
python -m venv venv
source venv/bin/activate        # Linux/Mac
source venv/Scripts/activate    # Windows

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Configure as variáveis de ambiente
cp .env.example .env
# edite o .env com suas configurações

# 5. Rode as migrations
python manage.py migrate

# 6. Colete os arquivos estáticos
python manage.py collectstatic --noinput

# 7. Crie o superusuário (opcional)
python manage.py createsuperuser

# 8. Inicie o servidor
python manage.py runserver
```

> [!NOTE]
> Sem `DB_NAME` definido no `.env`, o projeto usa **SQLite automaticamente**. Ideal para rodar localmente sem configurar PostgreSQL.

---

## 🔑 Variáveis de ambiente

Crie um `.env` na raiz do projeto baseado no `.env.example`:

<details>
<summary>Ver todas as variáveis</summary>

```env
# Obrigatório
SECRET_KEY=sua-secret-key-aqui

# Banco de dados
# Omitir DB_NAME para usar SQLite em desenvolvimento
DB_NAME=blog_db
DB_USER=postgres
DB_PASSWORD=sua-senha
DB_HOST=localhost
DB_PORT=5432
```

</details>

A chave `SECRET_KEY` pode ser gerada com:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## 📁 Estrutura do projeto

<details>
<summary>Ver estrutura</summary>

django-blog/
├── django_blog/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── posts/
│   ├── models.py
│   ├── views.py
│   ├── urls.py
│   ├── forms.py
│   ├── context_processors.py
│   ├── templatetags/
│   │   ├── init.py
│   │   └── comentario_tags.py
│   ├── static/posts/
│   │   ├── js/
│   │   │   ├── main.js
│   │   │   ├── utils.js
│   │   │   ├── config.js
│   │   │   ├── categoria.js
│   │   │   ├── image-upload.js
│   │   │   ├── comentarios.js
│   │   │   ├── modal-universal.js
│   │   │   ├── composer.js
│   │   │   ├── feed.js
│   │   │   ├── campo.js
│   │   │   └── notes.js
│   │   └── images/
│   │       └── Oficial_Soo.png
│   └── templates/posts/
│       ├── base.html
│       ├── home.html
│       ├── auth/
│       │   ├── login.html
│       │   ├── registrar.html
│       │   ├── senha_reset.html
│       │   ├── senha_reset_confirmar.html
│       │   ├── senha_reset_enviado.html
│       │   └── senha_reset_concluido.html
│       ├── perfil/
│       │   ├── perfil.html
│       │   └── editar_perfil.html
│       ├── posts/
│       │   ├── criar.html
│       │   ├── editar.html
│       │   ├── detail.html
│       │   └── listar.html
│       ├── moderacao/
│       │   └── eleger_moderador.html
│       ├── notificacoes/
│       │   └── notificacoes.html
│       ├── social/
│       │   ├── buscar_usuarios.html
│       │   └── lista_seguidores.html
│       └── partials/
│           ├── abas_nav.html
│           ├── perfil/
│           │   ├── card_perfil.html
│           │   └── painel_ideias.html
│           ├── feed/
│           │   ├── composer_bar.html
│           │   └── card_feed.html
│           ├── notes/
│           │   ├── composer_bar_notes.html
│           │   ├── card_note.html
│           │   └── modais_notes.html
│           ├── campo/
│           │   ├── grid_campo.html
│           │   └── modais_campo.html
│           └── shared/
│               ├── dropdown_post.html
│               ├── modal_perfil_externo.html
│               ├── modal_post_universal.html
│               ├── moderadores_painel.html
│               └── comentario_node.html
├── media/
├── staticfiles/
├── .env.example
├── manage.py
├── requirements.txt
└── README.md

</details>

---

## 📍 Roadmap

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Base visual — Tailwind, navbar, cards, modais | ✅ Concluído |
| 2 | Formulários — criar/editar, validações, color picker | ✅ Concluído |
| 3 | Autenticação completa | ✅ Concluído |
| 4 | Individualização — posts por usuário | ✅ Concluído |
| 5 | Sistema de visibilidade — Privado / Feed / Campo | ✅ Concluído |
| 6 | Moderação e desistência | ✅ Concluído |
| 7 | Perfil, seguidores e notificações | ✅ Concluído |
| 8 | Capa obrigatória no Feed — tabloid/revista | ✅ Concluído |
| 9 | Comentários infinitos threaded + Entroncamento | ✅ Concluído |
| 10 | Reações AJAX, modal universal, busca de usuários | ✅ Concluído |
| 11 | Campo das Ideias — grid 2D + algoritmo dupla camada | ✅ Concluído |
| 12 | Composer bar para Notes Privados | ✅ Concluído |
| 13 | Refatoração frontend — ES Modules, 11 módulos, zero JS inline | ✅ Concluído |
| 14 | Nova identidade visual Synapsoo — fluxo auth completo + mascote Psoo | ✅ Concluído |
| 15 | Rolamento Cubo Mágico — colunas independentes no Campo das Ideias | 🔄 Em andamento |
| 16 | Animação da Psoo no login após autenticação | ⏳ Planejado |
| 17 | Aba Forumização — lógica real de threads promovidas | ⏳ Planejado |
| 18 | Modo TDAH — tunnel vision, Pomodoro, gamificação | ⏳ Planejado |
| 19 | Kanban de ideias — drag and drop | ⏳ Planejado |
| 20 | Componentes reutilizáveis auth — mini design system | ⏳ Planejado |
| 21 | UX avançada — mobile, dark mode, busca global | ⏳ Planejado |
| 22 | Login social — Google, GitHub, SendGrid | ⏳ Planejado |
| 23 | Deploy — Railway, SEO, sitemap, domínio | ⏳ Planejado |

---

## 👤 Autor

**Paulo V. Cardoso**
[github.com/paulov-cardoso](https://github.com/paulov-cardoso)

---

<div align="center">
  <sub>Feito com Django + Tailwind CSS · © 2026 Synapsoo</sub>
</div>
