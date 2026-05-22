/**
 * campo.js
 * CampoController — comportamentos específicos do Campo das Ideias.
 *
 * Substitui o <script> restante em grid_campo.html:
 *   - Estado e renderização do grid 2D
 *   - Drag (mouse e touch)
 *   - Snap e navegação por setas
 *   - Carregamento paginado
 *   - Modal de detalhe (abrirDetalhe / fecharDetalhe / reagirDetalhe)
 *   - Subthread do campo
 *   - Sub-abas (Explorar / Meus Notes)
 *   - carregarMeusNotes
 *
 * Depende de:
 *   - utils.js       → getCsrf
 *   - comentarios.js → ThreadManager (via window._criarThreadCampo)
 */

import { getCsrf } from './utils.js';

// ── Estado do grid ────────────────────────────────────────────────────────────

const _estado = {
    linhas: [], paginaY: 0, totalLinhas: 0, temMaisY: false,
    cardWidth: 280, cardHeight: 320, cols: 2, rows: 2,
    offsetX: 0, offsetY: 0, carregando: false,
};

// ── Breakpoints ───────────────────────────────────────────────────────────────

function _getCols() {
    const w = window.innerWidth;
    if (w >= 2560) return 4;
    if (w >= 1440) return 3;
    if (w >= 768)  return 2;
    return 2;
}

function _getRows() { return 2; }

function _getCardWidth() {
    const viewport = document.getElementById('campo-viewport');
    if (!viewport) return 280;
    const cols = _getCols();
    return Math.floor((viewport.clientWidth - (cols - 1) * 12) / cols);
}

// ── Carregar grid ─────────────────────────────────────────────────────────────

async function carregarGrid(py = 0, append = false) {
    if (_estado.carregando) return;
    _estado.carregando = true;
    _mostrarLoading(true);

    try {
        const cols = _getCols(), rows = _getRows();
        _estado.cols = cols; _estado.rows = rows;

        const res  = await fetch(`/api/campo/grid/?py=${py}&cols=${cols}&rows=${rows}`);
        const data = await res.json();

        _estado.linhas      = append ? _estado.linhas.concat(data.linhas) : data.linhas;
        _estado.paginaY     = data.pagina_y;
        _estado.totalLinhas = data.total_linhas;
        _estado.temMaisY    = data.tem_mais_y;
        if (!append) { _estado.offsetX = 0; _estado.offsetY = 0; }

        if (!_estado.linhas.length) {
            _mostrarLoading(false);
            document.getElementById('campo-vazio')?.classList.remove('hidden');
            return;
        }

        renderizarGrid();
    } catch (e) {
        console.error('[CampoController] Erro ao carregar grid:', e);
    } finally {
        _estado.carregando = false;
        _mostrarLoading(false);
    }
}

// ── Renderizar grid ───────────────────────────────────────────────────────────

function renderizarGrid() {
    const grid = document.getElementById('campo-grid');
    if (!grid) return;
    document.getElementById('campo-vazio')?.classList.add('hidden');

    _estado.cardWidth  = _getCardWidth();
    _estado.cardHeight = Math.round(_estado.cardWidth * 1.3);
    grid.innerHTML = '';

    _estado.linhas.forEach((linha, li) => {
        const rowEl = document.createElement('div');
        rowEl.className     = 'campo-linha flex gap-3';
        rowEl.dataset.linha = li;
        linha.forEach((card, ci) => rowEl.appendChild(_criarCardEl(card, li, ci)));
        grid.appendChild(rowEl);
    });

    _aplicarTransform();
}

function _criarCardEl(card, li, ci) {
    const el = document.createElement('div');
    el.className    = 'campo-card flex-shrink-0 rounded-2xl overflow-hidden relative';
    el.style.width  = `${_estado.cardWidth}px`;
    el.style.height = `${_estado.cardHeight}px`;
    el.dataset.id = card.id;
    el.dataset.li = li;
    el.dataset.ci = ci;

    const bg = card.imagem_capa
        ? `<img src="${card.imagem_capa}" class="absolute inset-0 w-full h-full object-cover" alt="">`
        : `<div class="absolute inset-0" style="background:linear-gradient(135deg,${card.cor}cc,${card.cor}44)"></div>`;

    const cats = card.categorias.slice(0, 2).map(c =>
        `<span class="text-xs font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm"
               style="background:${c.cor}40;color:${c.cor};border:1px solid ${c.cor}60">${c.nome}</span>`
    ).join('');

    const avatar = card.foto_autor
        ? `<img src="${card.foto_autor}" class="w-6 h-6 rounded-full object-cover" alt="">`
        : `<div class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">
               ${card.autor.charAt(0).toUpperCase()}</div>`;

    el.innerHTML = `
        ${bg}
        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>
        ${card.procura_mod
            ? `<div class="absolute top-2 right-2 bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                   🤝 Procura Mod
               </div>` : ''}
        <div class="absolute inset-x-0 bottom-0 p-3">
            <div class="flex flex-wrap gap-1 mb-2">${cats}</div>
            <h3 class="text-white font-bold text-sm leading-snug line-clamp-2 mb-2 drop-shadow">
                ${card.titulo_capa || card.titulo}</h3>
            <p class="text-white/70 text-xs leading-relaxed line-clamp-2 mb-2">${card.conteudo}</p>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                    ${avatar}
                    <span class="text-white/70 text-xs">${card.autor}</span>
                </div>
                <div class="flex items-center gap-2 text-white/60 text-xs">
                    <span>❤️ ${card.curtidas}</span>
                    <span>📌 ${card.clips}</span>
                </div>
            </div>
        </div>`;

    _registrarEventosCard(el, card);
    return el;
}

function _registrarEventosCard(el, card) {
    let cliques = 0, timerClique = null, _dragMoveu = false;

    el.addEventListener('click', () => {
        if (_dragMoveu) return;
        cliques++;
        if (cliques === 1) {
            timerClique = setTimeout(() => {
                cliques = 0;
                _registrarInteracao(card.id, 'open', 0);
                abrirDetalhe(card);
            }, 220);
        } else {
            clearTimeout(timerClique);
            cliques = 0;
            window.location.href = card.url_detalhe;
        }
    });
    el.addEventListener('mousedown', () => { _dragMoveu = false; });
    el.addEventListener('mousemove', () => { _dragMoveu = true; });
}

// ── Drag ──────────────────────────────────────────────────────────────────────

function _configurarDrag() {
    const viewport = document.getElementById('campo-viewport');
    if (!viewport) return;

    let arrastando = false, startX = 0, startY = 0;
    let startOffX = 0, startOffY = 0, tempoInicio = 0, cardAtivo = null;

    function _getCardAtual() {
        return {
            li: Math.max(0, Math.round(-_estado.offsetY / (_estado.cardHeight + 12))),
            ci: Math.max(0, Math.round(-_estado.offsetX / (_estado.cardWidth  + 12))),
        };
    }

    function _dispararInteracao(dx, dy, tempo) {
        const direcao = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'left' : 'right')
            : (dy > 0 ? 'up'   : 'down');
        const card = _estado.linhas[cardAtivo?.li]?.[cardAtivo?.ci];
        if (card) _registrarInteracao(card.id, direcao, tempo);
    }

    viewport.addEventListener('mousedown', (e) => {
        arrastando = true;
        startX = e.clientX; startY = e.clientY;
        startOffX = _estado.offsetX; startOffY = _estado.offsetY;
        tempoInicio = Date.now(); cardAtivo = _getCardAtual();
        viewport.style.cursor = 'grabbing';
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!arrastando) return;
        _estado.offsetX = startOffX + (e.clientX - startX);
        _estado.offsetY = startOffY + (e.clientY - startY);
        _aplicarTransform(false);
    });

    window.addEventListener('mouseup', (e) => {
        if (!arrastando) return;
        arrastando = false;
        viewport.style.cursor = 'grab';
        const dx = e.clientX - startX, dy = e.clientY - startY;
        _snapGrid();
        if (Math.abs(dx) > 40 || Math.abs(dy) > 40) {
            _dispararInteracao(dx, dy, Date.now() - tempoInicio);
        }
    });

    viewport.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        arrastando = true;
        startX = t.clientX; startY = t.clientY;
        startOffX = _estado.offsetX; startOffY = _estado.offsetY;
        tempoInicio = Date.now(); cardAtivo = _getCardAtual();
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
        if (!arrastando) return;
        const t = e.touches[0];
        _estado.offsetX = startOffX + (t.clientX - startX);
        _estado.offsetY = startOffY + (t.clientY - startY);
        _aplicarTransform(false);
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
        if (!arrastando) return;
        arrastando = false;
        const t = e.changedTouches[0];
        _snapGrid();
        _dispararInteracao(t.clientX - startX, t.clientY - startY, Date.now() - tempoInicio);
    });
}

// ── Snap ──────────────────────────────────────────────────────────────────────

function _snapGrid() {
    const stepX = _estado.cardWidth  + 12;
    const stepY = _estado.cardHeight + 12;
    const maxC  = Math.max(0, ..._estado.linhas.map(l => l.length)) - _estado.cols;
    const maxL  = _estado.linhas.length - _estado.rows;

    _estado.offsetX = Math.max(-(maxC * stepX), Math.min(0, Math.round(_estado.offsetX / stepX) * stepX));
    _estado.offsetY = Math.max(-(maxL * stepY), Math.min(0, Math.round(_estado.offsetY / stepY) * stepY));
    _aplicarTransform(true);

    if (_estado.offsetY <= -((_estado.linhas.length - _estado.rows - 1) * stepY)
        && _estado.temMaisY && !_estado.carregando) {
        carregarGrid(_estado.paginaY + _estado.rows, true);
    }
}

function moverGrid(direcao) {
    const stepX = _estado.cardWidth  + 12;
    const stepY = _estado.cardHeight + 12;
    if (direcao === 'right') _estado.offsetX -= stepX;
    if (direcao === 'left')  _estado.offsetX += stepX;
    if (direcao === 'down')  _estado.offsetY -= stepY;
    if (direcao === 'up')    _estado.offsetY += stepY;
    _snapGrid();
}

function _aplicarTransform(animado = true) {
    const grid = document.getElementById('campo-grid');
    if (!grid) return;
    grid.style.transition = animado
        ? 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)'
        : 'none';
    grid.style.transform = `translate(${_estado.offsetX}px, ${_estado.offsetY}px)`;
}

// ── Interação ─────────────────────────────────────────────────────────────────

async function _registrarInteracao(postId, direcao, tempoMs) {
    try {
        await fetch('/api/campo/interacao/', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
            body:    JSON.stringify({ post_id: postId, direcao, tempo_ms: tempoMs }),
        });
    } catch { /* silencioso */ }
}

// ── Modal de detalhe ──────────────────────────────────────────────────────────

const _modalCarregado = new Set();

function abrirDetalhe(card) {
    const modal = document.getElementById('modal-detalhe-campo');
    if (!modal) return;

    document.getElementById('detalhe-campo-link').href = card.url_detalhe;

    const capaWrapper = document.getElementById('detalhe-capa-wrapper');
    if (card.imagem_capa) {
        document.getElementById('detalhe-capa-imgs').innerHTML =
            `<img src="${card.imagem_capa}" class="w-full h-56 object-cover" alt="">`;
        document.getElementById('detalhe-titulo-capa').textContent = card.titulo_capa || card.titulo;
        capaWrapper.classList.remove('hidden');
    } else {
        capaWrapper.classList.add('hidden');
    }

    document.getElementById('detalhe-cats').innerHTML = card.categorias.map(c =>
        `<span class="text-xs font-semibold px-3 py-1 rounded-full"
               style="background:${c.cor}25;color:${c.cor}">${c.nome}</span>`
    ).join('');

    document.getElementById('detalhe-titulo').textContent   = card.titulo;
    document.getElementById('detalhe-conteudo').textContent = card.conteudo;
    document.getElementById('detalhe-data').textContent     = '📅 ' + card.data;

    const autorBtn = document.getElementById('detalhe-autor-btn');
    autorBtn.textContent = '✍️ ' + card.autor;
    autorBtn.onclick     = () => window.abrirModalPerfil?.(card.username);

    document.getElementById('detalhe-total-curtida').textContent = card.curtidas;
    document.getElementById('detalhe-total-clip').textContent    = card.clips;
    document.getElementById('detalhe-btn-curtida').onclick = () => _reagirDetalhe(card.id, 'curtida');
    document.getElementById('detalhe-btn-clip').onclick    = () => _reagirDetalhe(card.id, 'clip');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    const thread = window._criarThreadCampo?.(card.id);
    if (thread) {
        const btnComentar = document.getElementById('detalhe-btn-comentar');
        if (btnComentar) btnComentar.onclick = () => thread.enviar(null);

        window._abrirSubthreadCampo = (pid, cid) => _abrirSubthreadCampo(pid, cid, thread);
    }

    if (!_modalCarregado.has(card.id)) {
        thread?.carregar();
        _modalCarregado.add(card.id);
    }
}

function fecharDetalhe() {
    const modal = document.getElementById('modal-detalhe-campo');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

async function _reagirDetalhe(postId, tipo) {
    try {
        const res  = await fetch(`/api/post/${postId}/reagir/${tipo}/`, {
            method:  'POST',
            headers: { 'X-CSRFToken': getCsrf() },
        });
        const data = await res.json();
        const elId = tipo === 'curtida' ? 'detalhe-total-curtida' : 'detalhe-total-clip';
        document.getElementById(elId).textContent = data.total;
    } catch (e) { console.error('[CampoController] Erro ao reagir:', e); }
}

// ── Subthread ─────────────────────────────────────────────────────────────────

function _abrirSubthreadCampo(postId, comentarioId, thread) {
    const modal    = document.getElementById('modal-subthread-campo');
    const conteudo = document.getElementById('conteudo-subthread-campo');
    if (!modal || !conteudo) return;
    conteudo.innerHTML = '';

    const pai = thread.buscar(comentarioId);
    if (pai?.respostas) {
        pai.respostas.forEach(r => {
            if (r.respostas?.length) {
                const m = document.getElementById('modal-forum-campo');
                if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
                return;
            }
            conteudo.appendChild(thread._renderComentario(r, 0));
        });
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharSubthreadCampo(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('modal-subthread-campo');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// ── Sub-abas ──────────────────────────────────────────────────────────────────

function mostrarSubaba(qual) {
    const ativo   = 'px-4 py-1.5 rounded-full text-sm font-semibold transition bg-orange-500 text-white';
    const inativo = 'px-4 py-1.5 rounded-full text-sm font-semibold transition bg-gray-100 text-gray-600 hover:bg-gray-200';

    const grid = document.getElementById('painel-grid');
    const meus = document.getElementById('painel-meus');
    const btnG = document.getElementById('subaba-grid');
    const btnM = document.getElementById('subaba-meus');

    if (qual === 'grid') {
        grid?.classList.remove('hidden'); meus?.classList.add('hidden');
        if (btnG) btnG.className = ativo;
        if (btnM) btnM.className = inativo;
    } else {
        grid?.classList.add('hidden'); meus?.classList.remove('hidden');
        if (btnG) btnG.className = inativo;
        if (btnM) btnM.className = ativo;
        carregarMeusNotes();
    }
}

async function carregarMeusNotes() {
    const lista = document.getElementById('lista-meus-notes');
    if (!lista) return;
    lista.innerHTML = '<p class="text-sm text-gray-400 text-center py-6">Carregando...</p>';

    try {
        const res  = await fetch('/api/campo/meus-notes/');
        const data = await res.json();

        if (!data.posts.length) {
            lista.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Você ainda não publicou no Campo das Ideias.</p>';
            return;
        }

        lista.innerHTML = data.posts.map(p => `
            <a href="/post/${p.id}/"
               class="block bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4
                      hover:border-orange-200 transition">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-800 truncate">${p.titulo}</h4>
                        <p class="text-xs text-gray-400 mt-0.5">${p.conteudo}</p>
                    </div>
                    <div class="flex-shrink-0 text-right">
                        <p class="text-xs text-gray-400">${p.data}</p>
                        <p class="text-xs text-orange-500 font-semibold mt-1">
                            ❤️ ${p.curtidas} · 📌 ${p.clips}
                        </p>
                    </div>
                </div>
            </a>`).join('');
    } catch {
        lista.innerHTML = '<p class="text-sm text-gray-400 text-center">Erro ao carregar.</p>';
    }
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function _mostrarLoading(sim) {
    document.getElementById('campo-loading')?.classList.toggle('hidden', !sim);
}

// ── Init ──────────────────────────────────────────────────────────────────────

function _init() {
    if (!document.getElementById('campo-grid-wrapper')) return;

    carregarGrid(0);
    _configurarDrag();

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => renderizarGrid(), 200);
    });
}

// ── Export e globais ──────────────────────────────────────────────────────────

export function registrarCampoGlobal() {
    window.moverGrid           = moverGrid;
    window.fecharDetalhe       = fecharDetalhe;
    window.mostrarSubaba       = mostrarSubaba;
    window.fecharSubthreadCampo = fecharSubthreadCampo;
}

export function iniciarCampo() {
    _init();
}