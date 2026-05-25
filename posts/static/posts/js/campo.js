/**
 * campo.js
 * CampoController — Rolamento Cubo Mágico.
 *
 * Mecânica:
 *   - N colunas verticais visíveis simultaneamente (5 em FHD, 3 em HD)
 *   - Cada coluna rola para cima/baixo de forma independente
 *   - Arrastar verticalmente dentro de uma coluna move só aquela coluna
 *   - Arrastar horizontalmente move o cubo inteiro (navega entre grupos de colunas)
 *   - Snap encaixa no card mais próximo por coluna
 *   - Scroll infinito por coluna: quando chega ao fim busca mais posts
 *
 * Depende de:
 *   - utils.js       → getCsrf
 *   - comentarios.js → ThreadManager (via window._criarThreadCampo)
 */

import { getCsrf } from './utils.js';

// ── Breakpoints ───────────────────────────────────────────────────────────────

function _getNumColunas() {
    const w = window.innerWidth;
    if (w >= 1920) return 5;  // FHD 27"
    if (w >= 1440) return 4;  // QHD / laptop grande
    if (w >= 1024) return 3;  // tablet landscape / HD 18.5"
    return 2;                 // mobile
}

function _getNumLinhas() {
    return 2; // sempre 2 linhas visíveis — face do cubo
}

function _getCardWidth(numColunas) {
    const viewport = document.getElementById('campo-viewport');
    if (!viewport) return 280;
    const gap = (numColunas - 1) * 8;
    return Math.floor((viewport.clientWidth - gap) / numColunas);
}

function _getCardHeight(cardWidth) {
    return Math.round(cardWidth * 1.4);
}

// ── Estado global do cubo ─────────────────────────────────────────────────────

const _cubo = {
    colunas:    [],
    numColunas: 5,
    numLinhas:  2,
    cardWidth:  280,
    cardHeight: 392,
    offsetX:    0,
    carregando: false,
};

function _criarEstadoColuna(index) {
    return {
        index,
        cards:      [],
        offsetY:    0,
        offset:     0,
        temMais:    false,
        carregando: false,
    };
}

// ── Carregar grid completo ────────────────────────────────────────────────────

async function carregarGrid() {
    if (_cubo.carregando) return;
    _cubo.carregando = true;
    _mostrarLoading(true);

    try {
        const numColunas = _getNumColunas();
        const numLinhas  = _getNumLinhas();
        _cubo.numColunas = numColunas;
        _cubo.numLinhas  = numLinhas;

        const res  = await fetch(`/api/campo/grid/?cols=${numColunas}&rows=${numLinhas}`);
        const data = await res.json();

        _cubo.cardWidth  = _getCardWidth(numColunas);
        _cubo.cardHeight = _getCardHeight(_cubo.cardWidth);
        _cubo.offsetX    = 0;

        _cubo.colunas = data.colunas.map(col => {
            const estado   = _criarEstadoColuna(col.index);
            estado.cards   = col.cards;
            estado.offset  = col.cards.length;
            estado.temMais = col.tem_mais;
            return estado;
        });

        if (_cubo.colunas.every(col => col.cards.length === 0)) {
            _mostrarVazio(true);
            return;
        }

        renderizarGrid();

    } catch (e) {
        console.error('[CampoController] Erro ao carregar grid:', e);
    } finally {
        _cubo.carregando = false;
        _mostrarLoading(false);
    }
}

// ── Carregar mais cards por coluna ────────────────────────────────────────────

async function _carregarMaisColuna(colIndex) {
    const col = _cubo.colunas[colIndex];
    if (!col || col.carregando || !col.temMais) return;
    col.carregando = true;

    try {
        const res  = await fetch(
            `/api/campo/coluna/${colIndex}/mais/?offset=${col.offset}&cols=${_cubo.numColunas}&rows=${_cubo.numLinhas}`
        );
        const data = await res.json();

        col.cards   = col.cards.concat(data.cards);
        col.offset += data.cards.length;
        col.temMais = data.tem_mais;

        const colEl = document.getElementById(`campo-col-${colIndex}`);
        if (colEl) {
            data.cards.forEach(card => colEl.appendChild(_criarCardEl(card, colIndex)));
        }
    } catch (e) {
        console.error(`[CampoController] Erro ao carregar mais da coluna ${colIndex}:`, e);
    } finally {
        col.carregando = false;
    }
}

// ── Renderizar grid ───────────────────────────────────────────────────────────

function renderizarGrid() {
    const viewport = document.getElementById('campo-viewport');
    const grid     = document.getElementById('campo-grid');
    if (!grid || !viewport) return;

    _mostrarVazio(false);

    _cubo.cardWidth  = _getCardWidth(_cubo.numColunas);
    _cubo.cardHeight = _getCardHeight(_cubo.cardWidth);

    // Altura fixa = exatamente 2 cards + 1 gap
    const alturaViewport = (_cubo.cardHeight * _cubo.numLinhas) + (8 * (_cubo.numLinhas - 1));
    viewport.style.height   = `${alturaViewport}px`;
    viewport.style.overflow = 'hidden';

    grid.innerHTML          = '';
    grid.style.display      = 'flex';
    grid.style.flexDirection = 'row';
    grid.style.gap          = '8px';
    grid.style.transform    = `translateX(${_cubo.offsetX}px)`;
    grid.style.transition   = 'none';
    grid.style.willChange   = 'transform';

    _cubo.colunas.forEach((col, i) => {
        const colEl = document.createElement('div');
        colEl.id              = `campo-col-${i}`;
        colEl.className       = 'campo-coluna flex-shrink-0 flex flex-col gap-2';
        colEl.style.width     = `${_cubo.cardWidth}px`;
        colEl.style.transform = `translateY(${col.offsetY}px)`;
        colEl.style.transition = 'none';
        colEl.style.willChange = 'transform';

        col.cards.forEach(card => colEl.appendChild(_criarCardEl(card, i)));
        grid.appendChild(colEl);
    });
}

// ── Criar card element ────────────────────────────────────────────────────────

function _criarCardEl(card, colIndex) {
    const el = document.createElement('div');
    el.className      = 'campo-card flex-shrink-0 rounded-2xl overflow-hidden relative cursor-pointer';
    el.style.width    = `${_cubo.cardWidth}px`;
    el.style.height   = `${_cubo.cardHeight}px`;
    el.dataset.id     = card.id;
    el.dataset.col    = colIndex;
    el.dataset.arrastou = 'false';

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
                   🤝 Procura Mod</div>` : ''}
        <div class="absolute inset-x-0 bottom-0 p-3">
            <div class="flex flex-wrap gap-1 mb-2">${cats}</div>
            <h3 class="text-white font-bold text-sm leading-snug line-clamp-2 mb-2 drop-shadow">
                ${card.titulo_capa || card.titulo}</h3>
            <p class="text-white/70 text-xs leading-relaxed line-clamp-2 mb-2">${card.conteudo}</p>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">${avatar}
                    <span class="text-white/70 text-xs">${card.autor}</span></div>
                <div class="flex items-center gap-2 text-white/60 text-xs">
                    <span>❤️ ${card.curtidas}</span><span>📌 ${card.clips}</span></div>
            </div>
        </div>`;

    _registrarEventosCard(el, card);
    return el;
}

function _registrarEventosCard(el, card) {
    let cliques = 0, timerClique = null;

    el.addEventListener('click', () => {
        if (el.dataset.arrastou === 'true') return;
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
}

// ── Drag — detecção de eixo e coluna ─────────────────────────────────────────

function _configurarDrag() {
    const viewport = document.getElementById('campo-viewport');
    if (!viewport) return;

    let arrastando  = false;
    let startX      = 0;
    let startY      = 0;
    let startOffX   = 0;
    let startOffY   = 0;
    let eixo        = null;
    let colAtiva    = null;
    let tempoInicio = 0;
    let cardAtivoId = null;
    let arrastou    = false;

    function _getColIndex(clientX) {
        const rect = viewport.getBoundingClientRect();
        const relX = clientX - rect.left - _cubo.offsetX;
        const step = _cubo.cardWidth + 8;
        return Math.max(0, Math.min(
            Math.floor(relX / step),
            _cubo.colunas.length - 1
        ));
    }

    function _iniciarDrag(x, y) {
        arrastando  = true;
        arrastou    = false;
        startX      = x;
        startY      = y;
        eixo        = null;
        tempoInicio = Date.now();
        colAtiva    = _getColIndex(x);
        startOffX   = _cubo.offsetX;
        startOffY   = _cubo.colunas[colAtiva]?.offsetY ?? 0;

        const colEl = document.getElementById(`campo-col-${colAtiva}`);
        cardAtivoId = colEl?.querySelector('.campo-card')?.dataset.id ?? null;

        viewport.style.cursor = 'grabbing';
    }

    function _moverDrag(x, y) {
        if (!arrastando) return;
        const dx = x - startX;
        const dy = y - startY;

        if (!eixo && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            eixo = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
        if (!eixo) return;
        arrastou = true;

        if (eixo === 'y' && colAtiva !== null) {
            const col   = _cubo.colunas[colAtiva];
            if (!col) return;
            col.offsetY = startOffY + dy;
            const colEl = document.getElementById(`campo-col-${colAtiva}`);
            if (colEl) {
                colEl.style.transition = 'none';
                colEl.style.transform  = `translateY(${col.offsetY}px)`;
            }
        } else if (eixo === 'x') {
            _cubo.offsetX = startOffX + dx;
            const grid = document.getElementById('campo-grid');
            if (grid) {
                grid.style.transition = 'none';
                grid.style.transform  = `translateX(${_cubo.offsetX}px)`;
            }
        }
    }

    function _finalizarDrag(x, y) {
        if (!arrastando) return;
        arrastando = false;
        viewport.style.cursor = 'grab';

        const tempo = Date.now() - tempoInicio;

        if (arrastou && colAtiva !== null) {
            const colEl = document.getElementById(`campo-col-${colAtiva}`);
            colEl?.querySelectorAll('.campo-card').forEach(el => {
                el.dataset.arrastou = 'true';
                setTimeout(() => { el.dataset.arrastou = 'false'; }, 50);
            });
        }

        if (eixo === 'y' && colAtiva !== null) {
            _snapColuna(colAtiva);
            if (cardAtivoId) {
                const dy      = y - startY;
                const direcao = dy > 0 ? 'up' : 'down';
                _registrarInteracao(parseInt(cardAtivoId), direcao, tempo);
            }
        } else if (eixo === 'x') {
            _snapHorizontal();
        }
    }

    viewport.addEventListener('mousedown', (e) => { _iniciarDrag(e.clientX, e.clientY); e.preventDefault(); });
    window.addEventListener('mousemove',   (e) => _moverDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup',     (e) => _finalizarDrag(e.clientX, e.clientY));

    viewport.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        _iniciarDrag(t.clientX, t.clientY);
    }, { passive: true });
    viewport.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        _moverDrag(t.clientX, t.clientY);
    }, { passive: true });
    viewport.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        _finalizarDrag(t.clientX, t.clientY);
    });
}

// ── Snap por coluna ───────────────────────────────────────────────────────────

function _snapColuna(colIndex) {
    const col   = _cubo.colunas[colIndex];
    const colEl = document.getElementById(`campo-col-${colIndex}`);
    if (!col || !colEl) return;

    const step      = _cubo.cardHeight + 8;
    const maxOffset = 0;
    const minOffset = -((col.cards.length - _cubo.numLinhas) * step);

    let snapY   = Math.round(col.offsetY / step) * step;
    snapY       = Math.max(minOffset, Math.min(maxOffset, snapY));
    col.offsetY = snapY;

    colEl.style.transition = 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)';
    colEl.style.transform  = `translateY(${snapY}px)`;

    // Carrega mais se chegou perto do fim
    if (snapY <= minOffset + step && col.temMais) {
        _carregarMaisColuna(colIndex);
    }
}

// ── Snap horizontal ───────────────────────────────────────────────────────────

function _snapHorizontal() {
    const grid = document.getElementById('campo-grid');
    if (!grid) return;

    const step      = _cubo.cardWidth + 8;
    const viewWidth = document.getElementById('campo-viewport')?.clientWidth ?? 0;
    const totalW    = _cubo.colunas.length * step;
    const minOffset = Math.min(0, -(totalW - viewWidth));
    const maxOffset = 0;

    let snapX     = Math.round(_cubo.offsetX / step) * step;
    snapX         = Math.max(minOffset, Math.min(maxOffset, snapX));
    _cubo.offsetX = snapX;

    grid.style.transition = 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)';
    grid.style.transform  = `translateX(${snapX}px)`;
}

// ── Navegação por botões ──────────────────────────────────────────────────────

function moverColuna(colIndex, direcao) {
    const col = _cubo.colunas[colIndex];
    if (!col) return;
    const step  = _cubo.cardHeight + 8;
    col.offsetY += direcao === 'up' ? step : -step;
    _snapColuna(colIndex);
}

function moverHorizontal(direcao) {
    const step    = _cubo.cardWidth + 8;
    _cubo.offsetX += direcao === 'esquerda' ? step : -step;
    _snapHorizontal();
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
            method: 'POST', headers: { 'X-CSRFToken': getCsrf() },
        });
        const data = await res.json();
        document.getElementById(
            tipo === 'curtida' ? 'detalhe-total-curtida' : 'detalhe-total-clip'
        ).textContent = data.total;
    } catch (e) { console.error(e); }
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
               class="block bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 hover:border-orange-200 transition">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-800 truncate">${p.titulo}</h4>
                        <p class="text-xs text-gray-400 mt-0.5">${p.conteudo}</p>
                    </div>
                    <div class="flex-shrink-0 text-right">
                        <p class="text-xs text-gray-400">${p.data}</p>
                        <p class="text-xs text-orange-500 font-semibold mt-1">❤️ ${p.curtidas} · 📌 ${p.clips}</p>
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

function _mostrarVazio(sim) {
    document.getElementById('campo-vazio')?.classList.toggle('hidden', !sim);
}

// ── Init ──────────────────────────────────────────────────────────────────────

function _init() {
    if (!document.getElementById('campo-grid-wrapper')) return;
    carregarGrid();
    _configurarDrag();
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            _cubo.numColunas = _getNumColunas();
            carregarGrid();
        }, 300);
    });
}

// ── Export e globais ──────────────────────────────────────────────────────────

export function registrarCampoGlobal() {
    window.fecharDetalhe        = fecharDetalhe;
    window.mostrarSubaba        = mostrarSubaba;
    window.fecharSubthreadCampo = fecharSubthreadCampo;
    window.moverColuna          = moverColuna;
    window.moverHorizontal      = moverHorizontal;
}

export function iniciarCampo() {
    _init();
}