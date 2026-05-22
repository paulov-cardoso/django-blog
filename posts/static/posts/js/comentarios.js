/**
 * comentarios.js
 * Classe ThreadManager — sistema completo de comentários threaded.
 *
 * Substitui as 3 implementações paralelas em:
 *   - card_feed.html    (renderComentario, prefixos comentario-modal- / score- / respostas- / form-resposta-)
 *   - grid_campo.html   (renderComentarioCampo, prefixos cc- / sc- / rs- / fr-)
 *   - modal_post_universal.html (muRenderComentario, prefixos mu-c- / mu-sc- / mu-rs- / mu-fr-)
 *
 * Uso:
 *   import { ThreadManager } from './comentarios.js';
 *
 *   const thread = new ThreadManager({
 *       postId:         42,
 *       containerID:    'mu-comentarios',
 *       totalEl:        'mu-total-comentarios',
 *       composerEl:     'mu-composer',
 *       prefix:         'mu',
 *       onForumizar:    () => abrirForum(),
 *       onSubthread:    (postId, comentarioId) => abrirSubthread(postId, comentarioId),
 *   });
 *
 *   await thread.carregar();
 */

import { getCsrf, timesince } from './utils.js';
import Config from './config.js';

const PROF_MAX     = 4;   // profundidade máxima no modal principal
const PROF_SUBTHR  = 5;   // profundidade que abre subthread
// profundidade 6+ → forumização

export class ThreadManager {
    /**
     * @param {{
     *   postId:      number,
     *   containerID: string,
     *   totalElID:   string,
     *   composerID:  string,
     *   prefix:      string,
     *   onForumizar: function,
     *   onSubthread: function(postId, comentarioId),
     *   cardTotalID?: string,
     * }} opcoes
     */
    constructor(opcoes) {
        this._postId      = opcoes.postId;
        this._prefix      = opcoes.prefix;
        this._onForumizar = opcoes.onForumizar ?? (() => {});
        this._onSubthread = opcoes.onSubthread ?? (() => {});
        this._arvore      = [];

        this._containerEl  = document.getElementById(opcoes.containerID);
        this._totalEl      = document.getElementById(opcoes.totalElID  ?? '');
        this._composerEl   = document.getElementById(opcoes.composerID ?? '');
        this._cardTotalEl  = document.getElementById(opcoes.cardTotalID ?? '');

        if (this._composerEl) {
            this._composerEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.enviar(null);
            });
        }
    }

    // ── API pública ───────────────────────────────────────────────────────────

    /** Carrega comentários do servidor e renderiza. */
    async carregar() {
        if (!this._containerEl) return;
        this._containerEl.innerHTML =
            '<p class="text-sm text-gray-400 text-center py-4">Carregando...</p>';

        try {
            const res  = await fetch(`/api/post/${this._postId}/comentarios/`);
            const data = await res.json();

            this._arvore = data.comentarios;
            this._atualizarTotal(data.total);

            if (data.pode_forumizar) { this._onForumizar(); return; }

            this._renderizarArvore();
        } catch {
            if (this._containerEl) {
                this._containerEl.innerHTML =
                    '<p class="text-sm text-gray-400 text-center">Erro ao carregar comentários.</p>';
            }
        }
    }

    /** Envia um novo comentário ou resposta. */
    async enviar(paiId) {
        const taId     = paiId ? `${this._prefix}-tr-${paiId}` : (this._composerEl?.id ?? '');
        const textarea = document.getElementById(taId) ?? this._composerEl;
        if (!textarea) return;

        const conteudo = textarea.value.trim();
        if (!conteudo) return;

        try {
            const res = await fetch(`/api/post/${this._postId}/comentar/`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body:    JSON.stringify({ conteudo, pai_id: paiId }),
            });
            if (!res.ok) return;
            const novo = await res.json();

            textarea.value = '';
            this._atualizarTotal((parseInt(this._totalEl?.textContent?.replace(/\D/g, '') ?? '0') + 1));

            if (paiId) {
                if (novo.profundidade >= PROF_SUBTHR) { this._onForumizar(); return; }
                const rs = document.getElementById(`${this._prefix}-rs-${paiId}`);
                if (rs) {
                    rs.classList.remove('hidden');
                    rs.appendChild(this._renderComentario(novo, novo.profundidade));
                }
                this._fecharFormResposta(paiId);
            } else {
                this._arvore.push(novo);
                this._containerEl?.querySelector('p.text-gray-400')?.remove();
                this._containerEl?.appendChild(this._renderComentario(novo, 0));
            }
        } catch (e) { console.error('[ThreadManager] Erro ao enviar:', e); }
    }

    /** Vota em um comentário (up ou down). */
    async votar(comentarioId, direcao) {
        try {
            const res  = await fetch(`/api/comentario/${comentarioId}/votar/${direcao}/`, {
                method:  'POST',
                headers: { 'X-CSRFToken': getCsrf() },
            });
            const data = await res.json();
            const sc   = document.getElementById(`${this._prefix}-sc-${comentarioId}`);
            if (sc) sc.textContent = data.score;
        } catch (e) { console.error('[ThreadManager] Erro ao votar:', e); }
    }

    /** Exclui (soft delete) um comentário. */
    async excluir(comentarioId) {
        if (!confirm('Remover este comentário?')) return;
        try {
            await fetch(`/api/comentario/${comentarioId}/excluir/`, {
                method:  'POST',
                headers: { 'X-CSRFToken': getCsrf() },
            });
            const el = document.getElementById(`${this._prefix}-c-${comentarioId}`);
            const p  = el?.querySelector('p.text-sm');
            if (p) {
                p.textContent = '[comentário removido]';
                p.className   = 'text-sm italic text-gray-400 leading-relaxed mb-1';
            }
            el?.querySelector('.thread-acoes')?.remove();
        } catch (e) { console.error('[ThreadManager] Erro ao excluir:', e); }
    }

    /** Retorna os comentários raiz da árvore em memória. */
    get arvore() { return this._arvore; }

    /** Busca um comentário por ID na árvore recursivamente. */
    buscar(id, lista = this._arvore) {
        for (const c of lista) {
            if (c.id === id) return c;
            if (c.respostas) {
                const found = this.buscar(id, c.respostas);
                if (found) return found;
            }
        }
        return null;
    }

    // ── Renderização ──────────────────────────────────────────────────────────

    _renderizarArvore() {
        if (!this._containerEl) return;

        if (!this._arvore.length) {
            this._containerEl.innerHTML =
                '<p class="text-sm text-gray-400 text-center py-6">Nenhum comentário ainda. Seja o primeiro!</p>';
            return;
        }

        this._containerEl.innerHTML = '';
        this._arvore.forEach(c => this._containerEl.appendChild(this._renderComentario(c, 0)));
    }

    _renderComentario(c, prof) {
        if (prof >= 6) { this._onForumizar(); return document.createTextNode(''); }

        const p   = this._prefix;
        const div = document.createElement('div');
        div.id        = `${p}-c-${c.id}`;
        div.className = 'flex gap-2';

        if (prof > 0) {
            div.style.marginLeft  = `${Math.min(prof * 16, 64)}px`;
            div.style.borderLeft  = '2px solid #e5e7eb';
            div.style.paddingLeft = '12px';
        }

        const avatarHtml = c.foto
            ? `<img src="${c.foto}" class="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" alt="">`
            : `<div class="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center
                           text-gray-500 font-bold text-xs flex-shrink-0 mt-0.5">
                   ${c.autor ? c.autor[0].toUpperCase() : '✕'}
               </div>`;

        const upCls   = c.meu_voto === 1  ? 'text-green-500 font-semibold' : 'text-gray-400 hover:text-green-500';
        const downCls = c.meu_voto === -1 ? 'text-red-400 font-semibold'  : 'text-gray-400 hover:text-red-400';

        const temRespostas  = c.respostas && c.respostas.length > 0;
        const abreSubthread = prof >= PROF_MAX;

        const labelRespostas = temRespostas
            ? (abreSubthread
                ? `<button data-action="subthread" data-pai="${c.id}"
                           class="text-xs text-indigo-500 hover:text-indigo-700 transition mt-1 block">
                       🧵 Ver ${c.respostas.length} resposta${c.respostas.length > 1 ? 's' : ''} (thread aprofundada)
                   </button>`
                : `<button data-action="toggle-respostas" data-id="${c.id}"
                           id="${p}-btn-rs-${c.id}"
                           class="text-xs text-gray-400 hover:text-gray-600 transition mt-1 block">
                       ▶ Ver ${c.respostas.length} resposta${c.respostas.length > 1 ? 's' : ''}
                   </button>`)
            : '';

        div.innerHTML = `
            <div class="flex-shrink-0">${avatarHtml}</div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                    ${c.autor
                        ? `<a href="/perfil/${c.username}/"
                              class="text-xs font-semibold text-gray-800 hover:text-indigo-600">${c.autor}</a>`
                        : `<span class="text-xs font-semibold text-gray-400">[removido]</span>`}
                    <span class="text-xs text-gray-400">${timesince(c.criado_em)}</span>
                    ${c.editado && !c.removido ? '<span class="text-xs text-gray-400">(editado)</span>' : ''}
                    ${prof > 0 ? `<span class="text-xs text-indigo-300 font-semibold">geração ${prof + 1}</span>` : ''}
                </div>
                <p class="text-sm leading-relaxed mb-1 ${c.removido ? 'italic text-gray-400' : 'text-gray-700'}">${c.conteudo}</p>
                ${!c.removido ? `
                <div class="thread-acoes flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    ${Config.isAuth ? `
                    <button data-action="votar" data-id="${c.id}" data-dir="up"
                            class="${upCls} transition">▲</button>
                    ` : ''}
                    <span class="font-semibold text-gray-600 tabular-nums"
                          id="${p}-sc-${c.id}">${c.score}</span>
                    ${Config.isAuth ? `
                    <button data-action="votar" data-id="${c.id}" data-dir="down"
                            class="${downCls} transition">▼</button>
                    <button data-action="responder" data-id="${c.id}" data-username="${c.username ?? ''}"
                            class="hover:text-indigo-500 transition ml-1">💬 Responder</button>
                    ` : ''}
                    ${Config.isAuth && c.username === Config.meUsername ? `
                    <button data-action="excluir" data-id="${c.id}"
                            class="hover:text-red-500 transition">🗑️</button>
                    ` : ''}
                </div>
                <div id="${p}-fr-${c.id}" class="hidden mt-2"></div>
                ${labelRespostas}
                <div id="${p}-rs-${c.id}" class="hidden mt-3 space-y-3"></div>
                ` : ''}
            </div>`;

        // Delega eventos — sem onclick inline
        div.addEventListener('click', (e) => this._handleClick(e, c, prof));

        // Pré-carrega respostas ocultas (gerações 1–4)
        if (temRespostas && !abreSubthread) {
            setTimeout(() => {
                const rs = div.querySelector(`#${p}-rs-${c.id}`);
                if (rs) c.respostas.forEach(r => rs.appendChild(this._renderComentario(r, prof + 1)));
            }, 0);
        }

        return div;
    }

    // ── Delegação de eventos ──────────────────────────────────────────────────

    _handleClick(e, c, prof) {
        const btn    = e.target.closest('[data-action]');
        if (!btn) return;
        e.stopPropagation();

        const action = btn.dataset.action;
        const id     = parseInt(btn.dataset.id);

        switch (action) {
            case 'votar':
                this.votar(id, btn.dataset.dir);
                break;
            case 'responder':
                this._abrirFormResposta(id, this._postId, btn.dataset.username);
                break;
            case 'excluir':
                this.excluir(id);
                break;
            case 'toggle-respostas':
                this._toggleRespostas(id);
                break;
            case 'subthread':
                this._onSubthread(this._postId, parseInt(btn.dataset.pai));
                break;
        }
    }

    // ── Toggle respostas ──────────────────────────────────────────────────────

    _toggleRespostas(id) {
        const div = document.getElementById(`${this._prefix}-rs-${id}`);
        const btn = document.getElementById(`${this._prefix}-btn-rs-${id}`);
        if (!div) return;
        const abrindo = div.classList.contains('hidden');
        div.classList.toggle('hidden', !abrindo);
        if (btn) {
            btn.innerHTML = btn.innerHTML
                .replace(abrindo ? '▶' : '▼', abrindo ? '▼' : '▶')
                .replace(abrindo ? 'Ver' : 'Ocultar', abrindo ? 'Ocultar' : 'Ver');
        }
    }

    // ── Form de resposta ──────────────────────────────────────────────────────

    _abrirFormResposta(comentarioId, postId, username) {
        const container = document.getElementById(`${this._prefix}-fr-${comentarioId}`);
        if (!container) return;

        // Toggle: fecha se já estava aberto
        if (!container.classList.contains('hidden') && container.innerHTML !== '') {
            this._fecharFormResposta(comentarioId);
            return;
        }

        const mention = username ? `@${username} ` : '';
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex gap-2 mt-1">
                <div class="flex-1">
                    <textarea id="${this._prefix}-tr-${comentarioId}" rows="2"
                              class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800
                                     focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"></textarea>
                    <div class="flex justify-end gap-2 mt-1">
                        <button data-action-close="${comentarioId}"
                                class="text-xs text-gray-400 hover:text-gray-600 px-3 py-1 rounded-full transition">
                            Cancelar
                        </button>
                        <button data-action-reply="${comentarioId}"
                                class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold
                                       px-4 py-1 rounded-full transition">
                            Responder
                        </button>
                    </div>
                </div>
            </div>`;

        container.querySelector(`[data-action-close="${comentarioId}"]`)
            .addEventListener('click', () => this._fecharFormResposta(comentarioId));
        container.querySelector(`[data-action-reply="${comentarioId}"]`)
            .addEventListener('click', () => this.enviar(comentarioId));

        const ta = document.getElementById(`${this._prefix}-tr-${comentarioId}`);
        if (ta) { ta.value = mention; ta.focus(); ta.setSelectionRange(mention.length, mention.length); }
    }

    _fecharFormResposta(comentarioId) {
        const container = document.getElementById(`${this._prefix}-fr-${comentarioId}`);
        if (!container) return;
        container.classList.add('hidden');
        container.innerHTML = '';
    }

    // ── Utilitários privados ──────────────────────────────────────────────────

    _atualizarTotal(total) {
        if (this._totalEl)    this._totalEl.textContent    = `(${total})`;
        if (this._cardTotalEl) this._cardTotalEl.textContent = total;
    }
}