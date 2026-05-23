import { getCsrf } from './utils.js';

// ── Estado ────────────────────────────────────────────────────────────────────

const _estado = {
    postId: null,
};

// ── Abrir ─────────────────────────────────────────────────────────────────────

function abrir(card) {
    _estado.postId = card.id;

    const modal = document.getElementById('modal-post-universal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    _popularCapa(card);
    _popularMeta(card);
    _popularReacoes(card);
    _popularComentarios(card);
}

function _popularCapa(card) {
    const capaWrapper = document.getElementById('mu-capa-wrapper');
    const capaImgs    = document.getElementById('mu-capa-imgs');
    const tituloCapa  = document.getElementById('mu-titulo-capa');

    if (card.imagem_capa) {
        capaImgs.innerHTML = card.imagem_capa_2
            ? `<div class="grid grid-cols-2 h-56">
                   <img src="${card.imagem_capa}" class="w-full h-full object-cover" alt="">
                   <img src="${card.imagem_capa_2}" class="w-full h-full object-cover" alt="">
               </div>`
            : `<img src="${card.imagem_capa}" class="w-full h-56 object-cover" alt="">`;
        tituloCapa.textContent = card.titulo_capa || card.titulo;
        capaWrapper.classList.remove('hidden');
    } else {
        capaWrapper.classList.add('hidden');
    }
}

function _popularMeta(card) {
    document.getElementById('mu-link-tela-cheia').href   = card.url_detalhe || `/post/${card.id}/`;
    document.getElementById('mu-titulo').textContent      = card.titulo;
    document.getElementById('mu-data').textContent        = '📅 ' + (card.data || '');
    document.getElementById('mu-conteudo').textContent    = card.conteudo_completo || card.conteudo;

    document.getElementById('mu-cats').innerHTML = (card.categorias || []).map(c =>
        `<span class="text-xs font-semibold px-3 py-1 rounded-full"
               style="background:${c.cor}25;color:${c.cor}">${c.nome}</span>`
    ).join('');

    const autorBtn = document.getElementById('mu-autor-btn');
    autorBtn.textContent = '✍️ ' + card.autor;
    autorBtn.onclick     = () => window.abrirModalPerfil?.(card.username);

    const autorOrigEl = document.getElementById('mu-autor-original');
    if (card.autor_original) {
        autorOrigEl.textContent = `💡 Ideia original de ${card.autor_original}`;
        autorOrigEl.classList.remove('hidden');
    } else {
        autorOrigEl.classList.add('hidden');
    }
}

function _popularReacoes(card) {
    document.getElementById('mu-total-curtida').textContent = card.curtidas ?? 0;
    document.getElementById('mu-total-clip').textContent    = card.clips    ?? 0;
    document.getElementById('mu-btn-curtida').onclick = () => _reagir(card.id, 'curtida');
    document.getElementById('mu-btn-clip').onclick    = () => _reagir(card.id, 'clip');
}

function _popularComentarios(card) {
    const composer = document.getElementById('mu-composer');
    if (composer) composer.value = '';

    document.getElementById('mu-comentarios').innerHTML =
        '<p class="text-sm text-gray-400 text-center py-4">Carregando...</p>';
    document.getElementById('mu-total-comentarios').textContent = '';

    const thread = window._criarThreadModal?.(card.id);
    if (!thread) return;

    document.getElementById('mu-btn-comentar').onclick = () => thread.enviar(null);
    thread.carregar();
}

// ── Fechar ────────────────────────────────────────────────────────────────────

function fechar() {
    const modal = document.getElementById('modal-post-universal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
    _estado.postId = null;
}

function fecharFora(event) {
    if (event.target === event.currentTarget) fechar();
}

// ── Reagir ────────────────────────────────────────────────────────────────────

async function _reagir(postId, tipo) {
    try {
        const res  = await fetch(`/api/post/${postId}/reagir/${tipo}/`, {
            method:  'POST',
            headers: { 'X-CSRFToken': getCsrf() },
        });
        const data = await res.json();

        const muId = tipo === 'curtida' ? 'mu-total-curtida' : 'mu-total-clip';
        document.getElementById(muId).textContent = data.total;

        // Sincroniza contadores visíveis no card do feed/campo
        [`total-${tipo}-${postId}`, `modal-total-${tipo}-${postId}`].forEach(elId => {
            const el = document.getElementById(elId);
            if (el) el.textContent = data.total;
        });
    } catch (e) { console.error('[ModalUniversal] Erro ao reagir:', e); }
}

// ── Subthread ─────────────────────────────────────────────────────────────────

function abrirSubthread(postId, comentarioId) {
    const modal    = document.getElementById('mu-modal-subthread');
    const conteudo = document.getElementById('mu-subthread-conteudo');
    if (!modal || !conteudo) return;
    conteudo.innerHTML = '';

    const thread = window._threadsModal?.[postId];
    if (!thread) return;

    const pai = thread.buscar(comentarioId);
    if (pai?.respostas) {
        pai.respostas.forEach(r => {
            if (r.respostas?.length) { abrirForum(); return; }
            conteudo.appendChild(thread._renderComentario(r, 0));
        });
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharSubthread(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('mu-modal-subthread');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// ── Forumização ───────────────────────────────────────────────────────────────

function abrirForum() {
    const modal = document.getElementById('mu-modal-forum');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function fecharForum() {
    const modal = document.getElementById('mu-modal-forum');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// ── Exports e globais ─────────────────────────────────────────────────────────
// Funções chamadas via onclick="" nos templates — precisam estar no window.

export function registrarModalUniversalGlobal() {
    window.modalUniversalAbrir       = abrir;
    window.modalUniversalFechar      = fechar;
    window.modalUniversalFecharFora  = fecharFora;
    window.muFecharSubthread         = fecharSubthread;
    window.muFecharForum             = fecharForum;

    // Callbacks usados pelo ThreadManager via window._criarThreadModal
    window._muAbrirForum    = abrirForum;
    window._muAbrirSubthread = abrirSubthread;
}