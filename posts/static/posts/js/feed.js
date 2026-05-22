/**
 * feed.js
 * FeedController — comportamentos específicos do Feed de Ideias.
 *
 * Substitui o <script> temporário em card_feed.html:
 *   - reagir()
 *   - toggleCategoriasFeed()
 *   - toggleComentariosFeed()
 *   - _carregarPreviewComentarios()
 *
 * Exporta registrarFeedGlobal() que expõe as funções no window
 * para os onclick="" nos cards renderizados pelo Django.
 */

import { getCsrf } from './utils.js';

// ── Estado ────────────────────────────────────────────────────────────────────

const _painelCarregado = new Set();

// ── Reações ───────────────────────────────────────────────────────────────────

async function reagir(postId, tipo, btn) {
    try {
        const res  = await fetch(`/api/post/${postId}/reagir/${tipo}/`, {
            method:  'POST',
            headers: { 'X-CSRFToken': getCsrf() },
        });
        const data = await res.json();

        // Atualiza todos os contadores visíveis para este post
        [`total-${tipo}-${postId}`, `modal-total-${tipo}-${postId}`].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = data.total;
        });

        // Atualiza estado visual do botão clicado
        if (tipo === 'curtida') {
            btn.classList.toggle('text-red-400',  data.ativo);
            btn.classList.toggle('text-white/70', !data.ativo);
        } else {
            btn.classList.toggle('text-indigo-300', data.ativo);
            btn.classList.toggle('text-white/70',   !data.ativo);
        }
    } catch (e) { console.error('[FeedController] Erro ao reagir:', e); }
}

// ── Toggle categorias no card ─────────────────────────────────────────────────

function toggleCategoriasFeed(postId) {
    const container = document.getElementById(`cats-${postId}`);
    const label     = document.getElementById(`label-cat-${postId}`);
    if (!container || !label) return;

    const aberto = !container.classList.contains('hidden');
    container.classList.toggle('hidden', aberto);
    container.classList.toggle('flex',   !aberto);
    label.textContent = aberto ? 'Ver categorias' : 'Ocultar categorias';
}

// ── Preview de comentários no card (colapsável) ───────────────────────────────

async function toggleComentariosFeed(postId) {
    const painel = document.getElementById(`painel-comentarios-${postId}`);
    if (!painel) return;

    const aberto = !painel.classList.contains('hidden');
    painel.classList.toggle('hidden', aberto);

    if (!aberto && !_painelCarregado.has(postId)) {
        await _carregarPreviewComentarios(postId);
        _painelCarregado.add(postId);
    }
}

async function _carregarPreviewComentarios(postId) {
    const lista = document.getElementById(`lista-comentarios-${postId}`);
    if (!lista) return;

    try {
        const res  = await fetch(`/api/post/${postId}/comentarios/`);
        const data = await res.json();

        const totalEl = document.getElementById(`total-comentarios-${postId}`);
        if (totalEl) totalEl.textContent = data.total;

        if (!data.comentarios.length) {
            lista.innerHTML = '<p class="text-white/40 text-xs text-center py-2">Nenhum comentário ainda.</p>';
            return;
        }

        lista.innerHTML = data.comentarios.slice(0, 3).map(c => `
            <div class="text-white/80 text-xs py-1 border-b border-white/10 last:border-0">
                <span class="font-semibold">${c.autor ?? '[removido]'}</span>
                <span class="ml-1 text-white/50">
                    ${c.conteudo.substring(0, 80)}${c.conteudo.length > 80 ? '...' : ''}
                </span>
            </div>
        `).join('');

        if (data.total > 3) {
            lista.innerHTML += `
                <p class="text-xs text-white/40 text-center pt-1">
                    + ${data.total - 3} comentário${data.total - 3 > 1 ? 's' : ''} — abra o post para ver todos
                </p>`;
        }
    } catch {
        lista.innerHTML = '<p class="text-white/40 text-xs text-center">Erro ao carregar.</p>';
    }
}

// ── Export e globais ──────────────────────────────────────────────────────────

export function registrarFeedGlobal() {
    window.reagir                = reagir;
    window.toggleCategoriasFeed  = toggleCategoriasFeed;
    window.toggleComentariosFeed = toggleComentariosFeed;
}