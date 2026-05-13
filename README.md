# Blognotes

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
- [Stack](#️-stack)
- [Como rodar localmente](#-como-rodar-localmente)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Roadmap](#-roadmap)
- [Autor](#-autor)

---

## 💡 O que é?

O **Blognotes** é um sistema de anotações de ideias — do lembrete simples do dia a dia à grande ideia disruptiva compartilhada para colaboração com amigos ou com o mundo.

Funciona como um sistema de **foco**, **antiesquecimento** e **antiprocrastinação**, com um **Modo TDAH** projetado para combater dispersão, bloqueio mental, *brain fog* e déficit de atenção.

O resultado: ideias ignoram as limitações humanas — inclusive a desmotivação — e se transformam em **força coletiva**.

> [!NOTE]
> No Blognotes, a primeira pessoa é a dona da ideia — mas a ideia pode se tornar maior que ela.

---

## 🏛️ Dois pilares

### 📓 Refúgio Particular
Espaço privado de anotações. Lembretes, referências, rascunhos. Com o **Modo TDAH** ativado, o ambiente vira produtividade assistida: guias interativos, micro-steps e timer Pomodoro integrado.

### 🌍 Incubador de Ideias
Ideias públicas que "pairam" esperando colaboração. Comentários infinitos estilo Reddit, moderação coletiva e continuidade garantida — se o autor desistir, a comunidade assume.

---

## 🚀 Funcionalidades

### ✅ Implementadas

- Autenticação completa — login, cadastro, recuperação de senha
- Password validator animado com checks de força no cadastro
- Toast de boas-vindas animado pós-cadastro
- Sistema de visibilidade em 3 níveis: **Privado → Feed de Ideias → Campo das Ideias**
- Dropdown *"O que fazer com a ideia?"* com modais de confirmação por cenário
- Sistema de moderação com candidatura, eleição de moderadores e privilégios configuráveis
- Transferência de autoria ao moderador quando o autor desiste
- Fluxo de desistência com regras por cenário (privado, feed com/sem cooperação, campo)
- Badge *"Procura-se Moderador"* e proteção de ideias com vida coletiva
- Página de eleição de moderadores com busca de seguidores e seleção de privilégios
- Perfil de usuário com foto de capa e foto de perfil em losango
- Sistema de seguidores e feed personalizado (próprios posts + posts de quem você segue)
- Feed estilo Instagram com avatar, tempo relativo, reações e composer bar
- Reações em posts — curtida ❤️ e clip 📌 com toggle
- Composer bar no feed com título pré-preenchido e visibilidade automática
- Modal de perfil externo carregado via `fetch` com botão Seguir/Deixar de seguir
- Sistema de notificações — sino 🔔 (interações) e carta ✉️ (colaboração/moderação)
- Toast PRG animado com lâmpada ao completar ações

### 🔄 Em desenvolvimento

- Upload de fotos de perfil e capa
- Editar perfil (bio, nome, fotos)
- Comentários infinitos threaded (estilo Reddit)
- Modo TDAH — tunnel vision, Pomodoro, micro-steps, gamificação
- Kanban de ideias com drag and drop
- Aba Trending
- Busca global
- Login social (Google, GitHub)
- Deploy no Railway

---

## 🔄 Fluxo de uma ideia

```
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
```

> [!TIP]
> Posts no **Campo das Ideias** com interações não podem ser removidos pelo autor — eles pertencem à comunidade.

> [!WARNING]
> Para desistir de uma ideia no Campo das Ideias é obrigatório eleger pelo menos um moderador antes. O moderador eleito assume a autoria; o autor original é preservado nos créditos.

---

## 🛠️ Stack

| Camada    | Tecnologia                            |
|-----------|---------------------------------------|
| Backend   | Python 3.13 + Django 6.0              |
| Frontend  | Tailwind CSS v4 Standalone (sem Node) |
| Banco     | PostgreSQL (produção)                 |
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

# 6. Crie o superusuário (opcional)
python manage.py createsuperuser

# 7. Inicie o servidor
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

```
django-blog/
├── django_blog/                  # Configurações do projeto Django
│   ├── settings.py               # Banco dinâmico (PostgreSQL/SQLite via .env)
│   ├── urls.py
│   └── wsgi.py
├── posts/                        # App principal
│   ├── models.py                 # Post, Autor, Seguidor, ModeradorPost, CandidaturaModerador, PostReacao, Notificacao
│   ├── views.py
│   ├── urls.py
│   ├── forms.py
│   ├── context_processors.py     # Contadores de notificação injetados globalmente
│   └── templates/posts/
│       ├── base.html             # Layout global — navbar, toast, abas
│       ├── home.html             # Orquestrador das 4 abas (~30 linhas)
│       ├── auth/                 # Autenticação
│       │   ├── login.html
│       │   ├── registrar.html
│       │   ├── senha_reset.html
│       │   ├── senha_reset_confirmar.html
│       │   ├── senha_reset_enviado.html
│       │   └── senha_reset_concluido.html
│       ├── perfil/               # Perfil de usuário
│       │   ├── perfil.html
│       │   └── editar_perfil.html
│       ├── posts/                # Posts individuais
│       │   ├── criar.html
│       │   ├── editar.html
│       │   ├── detail.html
│       │   └── listar.html
│       ├── moderacao/
│       │   └── eleger_moderador.html
│       ├── notificacoes/
│       │   └── notificacoes.html
│       └── partials/             # Componentes reutilizáveis
│           ├── abas_nav.html
│           ├── perfil/
│           │   ├── card_perfil.html
│           │   └── painel_ideias.html
│           ├── feed/
│           │   ├── composer_bar.html
│           │   ├── card_feed.html
│           │   └── modais_feed.html
│           ├── notes/
│           │   ├── card_note.html
│           │   └── modais_notes.html
│           ├── campo/
│           │   ├── card_campo.html
│           │   └── modais_campo.html
│           └── shared/
│               ├── dropdown_post.html
│               ├── modal_perfil_externo.html
│               └── moderadores_painel.html
├── media/                        # Uploads de fotos (gitignored)
├── .env.example
├── manage.py
└── requirements.txt
```

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
| 6 | Moderação e desistência | 🔄 Parcial |
| 7 | Perfil e seguidores | 🔄 Parcial |
| 8 | Comentários infinitos threaded | ⏳ Planejado |
| 9 | Modo TDAH — tunnel vision, Pomodoro, gamificação | ⏳ Planejado |
| 10 | Kanban de ideias — drag and drop, alertas | ⏳ Planejado |
| 11 | UX avançada — mobile, dark mode, busca global | ⏳ Planejado |
| 12 | Login social — Google, GitHub, SendGrid | ⏳ Planejado |
| 13 | Deploy — Railway, SEO, sitemap, domínio | ⏳ Planejado |

---

## 👤 Autor

**Paulo V. Cardoso**
[github.com/paulov-cardoso](https://github.com/paulov-cardoso)

---

<div align="center">
  <sub>Feito com Django + Tailwind CSS · © 2026</sub>
</div>
