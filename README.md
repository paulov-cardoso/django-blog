# Synapsoo

> **Ideias são maiores que perfis.**  
> Do lembrete do dia a dia à ideia disruptiva colaborativa — o lugar onde nenhuma ideia morre por falta de foco ou motivação.

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.13-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0-092e20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
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
- [Rolamento Sliding Puzzle](#-rolamento-sliding-puzzle)
- [Entroncamento de Comentários](#-entroncamento-de-comentários)
- [Stack](#️-stack)
- [Como rodar localmente](#-como-rodar-localmente)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Roadmap](#-roadmap)
- [Autor](#-autor)

---

## 💡 O que é?

O **Synapsoo** é uma plataforma de gestão e descoberta de ideias que funciona em três camadas progressivas: do rascunho privado à ideia colaborativa pública.

Funciona como um sistema de **foco**, **antiesquecimento** e **antiprocrastinação**, com um **Modo TDAH** (planejado) projetado para combater dispersão, bloqueio mental e déficit de atenção.

> No Synapsoo, a primeira pessoa é dona da ideia — mas a ideia pode se tornar maior que ela.

---

## 🏛️ Dois pilares

**📓 Refúgio Particular — Notes Privados**  
Espaço privado no formato de post-its digitais. Lembretes, referências, rascunhos. Cada note pode ser publicado no Feed ou enviado ao Campo das Ideias quando estiver pronto.

**🌍 Incubador de Ideias — Feed + Campo**  
Ideias públicas com comentários infinitos threaded, moderação coletiva e continuidade garantida — se o autor desistir, a comunidade assume.

---

## 🚀 Funcionalidades

### ✅ Implementadas

- Autenticação completa — login, cadastro, recuperação de senha
- Sistema de visibilidade em 3 níveis: **Privado → Feed de Ideias → Campo das Ideias**
- Notes Privados em React — grid de post-its com cores, composer e dropdown de ações
- Feed de Ideias estilo tabloid — imagem full-card, capa obrigatória, feed personalizado
- Campo das Ideias com **Rolamento Sliding Puzzle** — malha 2D infinita navegável por drag
- Algoritmo de recomendação com score de decaimento gravitacional e afinidade comportamental
- Sistema de moderação — candidatura, eleição, privilégios e transferência de autoria
- Comentários infinitos threaded com **Entroncamento** (ver seção abaixo)
- Votos em comentários com toggle e score em tempo real
- Reações em posts — curtida ❤️ e clip 📌 via AJAX
- Perfil com foto de capa, seguidores, seguindo e modal externo
- Busca de usuários por nome ou @username
- Notificações em 3 canais: 🔔 Sino · ✉️ Carta · 👤 Pessoas
- Design system unificado — identidade visual do Campo aplicada em todo o projeto

### 🔄 Em desenvolvimento

- Campo das Ideias em React — propagação cruzada do Sliding Puzzle
- Feed de Ideias em React
- Roteamento React por `?aba=`

---

## 🎲 Rolamento Sliding Puzzle

O Campo das Ideias usa uma mecânica de navegação única. Em vez de mover o grid como uma câmera, cada linha e cada coluna se movem **independentemente** dentro de uma viewport fixa.

O usuário não navega pela malha — ele movimenta as esteiras que a atravessam.

**Recomposição cruzada:** mover uma linha altera a composição de todas as colunas. Mover uma coluna altera a composição de todas as linhas. A nova configuração se torna o estado válido da sessão.

**Esteiras infinitas:** quando o conteúdo sai por um lado, novo conteúdo entra pelo outro, abastecido pelo algoritmo — sem reutilização circular.

| Monitor | Resolução | Colunas | Linhas | Cards visíveis |
|---------|-----------|---------|--------|----------------|
| 27" FHD | 1920×1080 | 5 | 2 | 10 |
| 18.5" HD | 1366×768 | 4 | 2 | 8 |
| Laptop | 1024px+ | 3 | 2 | 6 |
| Mobile | < 1024px | 2 | 2 | 4 |

**Score com decaimento gravitacional:**
```
score = (curtidas×3 + clips×2 + comentários×5) ÷ idade_horas^1.5
```

---

## 🌿 Entroncamento de Comentários

Sistema único de threading onde comentários formam troncos que se ramificam infinitamente:

| Geração | Comportamento |
|---------|---------------|
| 1ª a 4ª | No modal do post — ocultas por padrão, expansíveis |
| 5ª | Abre em modal sobreposto "Thread aprofundada" |
| 6ª+ | Alerta de forumização — thread promovida à aba Forumização |

Forumização também ocorre quando 5+ comentadores distintos participam do mesmo tronco.

---

## 🛠️ Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.13 + Django 6.0 |
| Frontend | React 18 + TypeScript 5 |
| Bundler | Vite 5 |
| Estilização | Tailwind CSS v4 |
| Banco (dev) | SQLite |
| Banco (prod) | PostgreSQL |
| Imagens | Pillow |
| Deploy | Railway *(planejado)* |

> A autenticação permanece em Django Templates. Todo o restante do frontend está sendo migrado para React + TypeScript a partir da Fase 15.

---

## ⚙️ Como rodar localmente

**Pré-requisitos:** Python 3.13+ e Node.js 20+

```bash
# 1. Clone e entre na pasta
git clone https://github.com/paulov-cardoso/django-blog.git
cd django-blog

# 2. Ambiente virtual Python
python -m venv venv
source venv/Scripts/activate   # Windows
# source venv/bin/activate     # Linux/Mac

# 3. Dependências Python
pip install -r requirements.txt

# 4. Variáveis de ambiente
cp .env.example .env
# Sem DB_NAME no .env → usa SQLite automaticamente

# 5. Banco e superusuário
python manage.py migrate
python manage.py createsuperuser  # opcional

# 6. Dependências Node
cd frontend && npm install && cd ..
```

### Desenvolvimento (4 terminais)

```bash
# Terminal 1 — Django
python manage.py runserver

# Terminal 2 — Tailwind
python manage.py tailwind start

# Terminal 3 — Vite/React
cd frontend && npm run dev

# Terminal 4 — comandos gerais
```

| Serviço | URL |
|---------|-----|
| Frontend React | http://localhost:5173 |
| Backend Django | http://localhost:8000 |

---

## 📁 Estrutura do projeto

```
django-blog/
├── django_blog/         # configurações Django
├── posts/
│   ├── models.py        # Post, Autor, Categoria, Comentario, ScorePost...
│   ├── views.py         # views + APIs JSON
│   ├── urls.py
│   └── templates/posts/ # templates Django (auth + legado)
├── frontend/            # React + TypeScript
│   ├── src/
│   │   ├── design/
│   │   │   └── tokens.ts        # design system centralizado
│   │   ├── components/layout/   # Navbar, TabBar, AppLayout
│   │   ├── pages/               # NotesPage, FeedPage, CampoPage...
│   │   └── modules/campo/       # motor do Sliding Puzzle
│   └── vite.config.ts   # proxy /api/ → Django :8000
├── media/
├── manage.py
└── requirements.txt
```

---

## 📍 Roadmap

| Fase | Descrição | Status |
|------|-----------|--------|
| 1–10 | Auth, perfil, feed, notes, moderação, social, reações, comentários | ✅ Concluído |
| 11 | Campo das Ideias — grid 2D + algoritmo dupla camada | ✅ Concluído |
| 12–13 | Composer Notes + Refatoração ES Modules | ✅ Concluído |
| 14 | Fix layout imersivo + fix render do Campo | ✅ Concluído |
| **15** | **Setup React + TS · Design system · Notes Privados em React** | **🔄 Em andamento** |
| 16 | Feed de Ideias em React | ⏳ Próximo |
| 17 | Campo das Ideias em React — Sliding Puzzle com propagação cruzada | ⏳ Próximo |
| 18 | Perfil e Forumização em React | ⏳ Planejado |
| 19 | Animação da Psoo no login | ⏳ Planejado |
| 20 | Modo TDAH — tunnel vision, Pomodoro, gamificação | ⏳ Planejado |
| 21 | Kanban de ideias | ⏳ Planejado |
| 22 | UX mobile completa | ⏳ Planejado |
| 23 | Login social — Google, GitHub | ⏳ Planejado |
| 24 | Deploy — Railway, PostgreSQL, domínio | ⏳ Planejado |

---

## 👤 Autor

**Paulo V. Cardoso**  
[github.com/paulov-cardoso](https://github.com/paulov-cardoso)

---

<div align="center">
  <sub>Feito com Django/Python + React + Typescript + Tailwind CSS · © 2026 Synapsoo</sub>
</div>