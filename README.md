# Blognotes

> **Ideias são maiores que perfis.**
> Do lembrete do dia a dia à ideia disruptiva colaborativa — o lugar onde nenhuma ideia morre por falta de foco ou motivação.

![Python](https://img.shields.io/badge/Python-3.13-blue)
![Django](https://img.shields.io/badge/Django-6.0-green)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📸 Interface

> *Screenshots serão adicionados conforme o projeto avança.*

---

## ✨ O que é o Blognotes?

O Blognotes é um sistema de anotações de ideias que varia desde um lembrete simples do dia a dia até uma grande ideia disruptiva compartilhada para colaboração e comentários com amigos ou com o mundo inteiro.

Funcionando como um sistema de **foco**, **antiesquecimento** e **antiprocrastinação**, o Blognotes contém o **Modo TDAH** — projetado para combater dispersão, bloqueio mental, *brain fog*, *mind blank* e déficit de atenção sustentada e seletiva.

O resultado: ideias ignoram todas essas problemáticas humanas, até mesmo a desmotivação, e se transformam em **força coletiva** para sair do papel para a prática.

> No Blognotes, a primeira pessoa é a dona da ideia — mas a ideia pode se tornar maior que ela.

---

## 🏛️ Dois pilares

**📓 Refúgio Particular**
Espaço privado de anotações do dia a dia. Lembretes, referências, rascunhos. Com o Modo TDAH ativado, o ambiente se transforma em produtividade assistida com guias interativos, micro-steps e timer Pomodoro.

**🌍 Incubador de Ideias**
Ideias públicas que "pairam" esperando colaboração. Sistema de comentários infinitos estilo Reddit, moderação coletiva e continuidade garantida — se o autor desistir, a comunidade assume.

---

## 🚀 Funcionalidades

### Implementadas
- [x] Autenticação completa (login, cadastro, recuperação de senha)
- [x] Sistema de visibilidade em 3 níveis — Privado / Feed de Ideias / Campo das Ideias
- [x] Dropdown "O que fazer com a ideia?" com modais de confirmação em cada ação
- [x] Sistema de moderação com candidatura, eleição e transferência de autoria
- [x] Fluxo de desistência com regras por cenário (privado, feed, campo)
- [x] Badge "Procura-se Moderador" e proteção de ideias com vida coletiva
- [x] Perfil de usuário com foto de capa (retângulo) e foto de perfil (losango)
- [x] Sistema de seguidores e feed personalizado por quem você segue
- [x] Modal de perfil de outros usuários com botão Seguir/Deixar de seguir

### Em desenvolvimento
- [ ] Upload de fotos de perfil e capa
- [ ] Editar perfil (bio, nome, fotos)
- [ ] Comentários infinitos estilo Reddit (threaded)
- [ ] Modo TDAH (tunnel vision, pomodoro, gamificação)
- [ ] Kanban de ideias
- [ ] Aba Trending
- [ ] Curtir e reagir ideias
- [ ] Busca global
- [ ] Login social (Google, GitHub)
- [ ] Deploy

---

## 🛠️ Stack

| Camada    | Tecnologia                        |
|-----------|-----------------------------------|
| Backend   | Python 3.13 + Django 6.0          |
| Frontend  | Tailwind CSS v4 (standalone)      |
| Banco     | PostgreSQL (produção) / SQLite (dev) |
| Imagens   | Pillow                            |
| Deploy    | Railway (planejado)               |

---

## ⚙️ Como rodar localmente

**Pré-requisitos:** Python 3.13+

```bash
# 1. Clone o repositório
git clone https://github.com/paulov-cardoso/django-blog.git
cd django-blog

# 2. Crie e ative o ambiente virtual
python -m venv venv
source venv/Scripts/activate  # Windows
source venv/bin/activate       # Linux/Mac

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Configure as variáveis de ambiente
cp .env.example .env
# edite o .env com suas configurações

# 5. Rode as migrations
python manage.py migrate

# 6. Crie o superusuário
python manage.py createsuperuser

# 7. Inicie o servidor
python manage.py runserver
```

---

## 🔑 Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
SECRET_KEY=sua-secret-key-aqui

# Banco de dados — omitir DB_NAME para usar SQLite em desenvolvimento
DB_NAME=blog_db
DB_USER=postgres
DB_PASSWORD=sua-senha
DB_HOST=localhost
DB_PORT=5432
```

> Sem `DB_NAME` definido, o projeto usa SQLite automaticamente. Ideal para desenvolvimento local.

---

## 📍 Roadmap
✅ Fase 1  — Base visual (Tailwind, navbar, cards, modais)
✅ Fase 2  — Formulários (criar/editar, validações, color picker)
✅ Fase 3  — Autenticação completa
✅ Fase 4  — Individualização (posts por usuário)
✅ Fase 5  — Sistema de visibilidade (Privado / Feed / Campo das Ideias)
✅ Fase 6  — Moderação e desistência (parcial)
✅ Fase 7  — Perfil e seguidores (parcial)
⏳ Fase 6  — Moderação (restante: colaborador, histórico, expulsão)
⏳ Fase 7  — Social (restante: upload, editar perfil, trending, curtidas)
⏳ Fase 8  — Comentários infinitos (threaded, upvote, notificações)
⏳ Fase 9  — Modo TDAH (tunnel vision, pomodoro, micro-steps, gamificação)
⏳ Fase 10 — Kanban de ideias (drag and drop, alertas)
⏳ Fase 11 — UX avançada (mobile, dark mode, busca global)
⏳ Fase 12 — Login social (Google, GitHub, SendGrid)
⏳ Fase 13 — Deploy (Railway, SEO, sitemap, domínio)


## 👤 Autor

**Paulo V. Cardoso**
[github.com/paulov-cardoso](https://github.com/paulov-cardoso)
