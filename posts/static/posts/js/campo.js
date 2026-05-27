// ── campo.js — Rolamento Cubo Mágico Infinito ────────────────────────────────
// Malha 2D infinita de cards. O usuário enxerga um viewport fixo (numLinhas ×
// numColunas). Cada linha tem offset horizontal independente. Cada coluna tem
// offset vertical independente. Mover uma linha altera a composição das
// colunas; mover uma coluna altera a composição das linhas. Novos cards
// revelados vêm aleatoriamente do pool global.
//
// Dependências: utils.js → getCsrf

import { getCsrf } from './utils.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const BATCH_SIZE     = 40;    // cards por requisição ao pool
const PREFETCH_AHEAD = 8;     // prefetch quando pool disponível < N
const GAP            = 8;     // px entre cards
const SPRING_MS      = 420;   // duração do snap spring
const SPRING_EASING  = 'cubic-bezier(0.22, 1.2, 0.36, 1)'; // overshoot leve
const EVAPORATE_MS   = 1800;  // fade-out ao penalizar card

// ── Breakpoints ───────────────────────────────────────────────────────────────

function _getNumColunas() {
    const w = window.innerWidth;
    if (w >= 1920) return 5;
    if (w >= 1440) return 4;
    if (w >= 1024) return 3;
    return 2;
}

function _getDimensoesCard(numColunas) {
    const viewport = document.getElementById('campo-viewport');
    if (!viewport) return { width: 280, height: 392 };
    const totalGap = (numColunas - 1) * GAP;
    const width    = Math.floor((viewport.clientWidth - totalGap) / numColunas);
    const height   = Math.round(width * 1.4);
    return { width, height };
}

// ── Estado global ─────────────────────────────────────────────────────────────

const _m = {
    // ── Malha infinita ─────────────────────────────────────────────────────
    // malha[row][col] = card | null
    // row e col são coordenadas absolutas na malha — podem crescer
    // indefinidamente em qualquer direção.
    malha: {},

    // ── Viewport ───────────────────────────────────────────────────────────
    // Coordenada do canto superior esquerdo do viewport na malha.
    // O usuário vê malha[vRow..vRow+numLinhas-1][vCol..vCol+numColunas-1]
    vRow: 0,
    vCol: 0,

    // ── Offsets independentes por linha e coluna ────────────────────────────
    // offsetLinha[row] = deslocamento em número de cards para a esquerda
    // offsetColuna[col] = deslocamento em número de cards para cima
    // Ambos são relativos ao viewport atual.
    offsetLinha:  {},  // { [row]: number }
    offsetColuna: {},  // { [col]: number }

    // ── Dimensões ──────────────────────────────────────────────────────────
    numLinhas:  2,
    numColunas: 5,
    cardWidth:  280,
    cardHeight: 392,

    // ── Pool ───────────────────────────────────────────────────────────────
    pool:           [],
    temMais:        true,
    carregandoPool: false,

    // ── Drag ───────────────────────────────────────────────────────────────
    drag: {
        ativo:       false,
        eixo:        null,   // 'x' | 'y'
        startX:      0,
        startY:      0,
        pixelAtual:  0,      // px deslocados do inicio do drag
        alvoIndex:   null,   // índice da linha (eixo x) ou coluna (eixo y) no viewport
        alvoMalha:   null,   // coordenada absoluta na malha
        arrastou:    false,
        tempoInicio: 0,
    },

    // ── Controle ───────────────────────────────────────────────────────────
    penalizados: new Set(),
    iniciado:    false,
};

// ── Pool — carregamento e acesso aleatório ────────────────────────────────────

async function _carregarPool() {
    if (_m.carregandoPool || !_m.temMais) return;
    _m.carregandoPool = true;
    try {
        const offset = _m.pool.length;
        const res    = await fetch(
            `/api/campo/pool/?offset=${offset}&limit=${BATCH_SIZE}`
        );
        const data   = await res.json();
        _m.pool      = _m.pool.concat(data.cards);
        _m.temMais   = data.tem_mais;
    } catch (e) {
        console.error('[CuboMagico] Erro ao carregar pool:', e);
    } finally {
        _m.carregandoPool = false;
    }
}

// Retorna um card aleatório do pool disponível (não consome — apenas sorteia)
function _cardAleatorio() {
    if (!_m.pool.length) return null;
    if (_m.pool.length <= PREFETCH_AHEAD && _m.temMais) _carregarPool();
    const idx = Math.floor(Math.random() * _m.pool.length);
    return _m.pool[idx];
}

// ── Malha — acesso e preenchimento ───────────────────────────────────────────

function _getCell(row, col) {
    return _m.malha[row]?.[col] ?? null;
}

function _setCell(row, col, card) {
    if (!_m.malha[row]) _m.malha[row] = {};
    _m.malha[row][col] = card;
}

// Garante que malha[row][col] tem um card; se não tiver, sorteia do pool
function _garantirCell(row, col) {
    if (!_getCell(row, col)) {
        const card = _cardAleatorio();
        if (card) _setCell(row, col, card);
    }
    return _getCell(row, col);
}

// Preenche o viewport visível + 1 card de margem em cada direção
function _preencherViewport() {
    for (let r = _m.vRow - 1; r <= _m.vRow + _m.numLinhas; r++) {
        for (let c = _m.vCol - 1; c <= _m.vCol + _m.numColunas; c++) {
            _garantirCell(r, c);
        }
    }
}

// ── Renderização ──────────────────────────────────────────────────────────────

function _renderizarGrid() {
    const viewport = document.getElementById('campo-viewport');
    const grid     = document.getElementById('campo-grid');
    if (!grid || !viewport) return;

    _mostrarVazio(false);

    const { width, height } = _getDimensoesCard(_m.numColunas);
    _m.cardWidth  = width;
    _m.cardHeight = height;

    const alturaViewport = (height * _m.numLinhas) + GAP * (_m.numLinhas - 1);
    viewport.style.height   = `${alturaViewport}px`;
    viewport.style.overflow = 'hidden';
    viewport.style.position = 'relative';
    viewport.style.cursor   = 'grab';

    grid.innerHTML = '';
    grid.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: ${GAP}px;
        will-change: transform;
    `;

    for (let vi = 0; vi < _m.numLinhas; vi++) {
        const row     = _m.vRow + vi;
        const linhaEl = _criarLinhaEl(vi, row);
        grid.appendChild(linhaEl);
    }
}

function _criarLinhaEl(viewIndex, malhaRow) {
    const linhaEl = document.createElement('div');
    linhaEl.id    = `campo-linha-${viewIndex}`;
    linhaEl.dataset.malhaRow = malhaRow;
    linhaEl.style.cssText = `
        display: flex;
        flex-direction: row;
        gap: ${GAP}px;
        flex-shrink: 0;
        height: ${_m.cardHeight}px;
        transform: translateX(0px);
        will-change: transform;
    `;

    for (let vi = 0; vi < _m.numColunas; vi++) {
        const col  = _m.vCol + vi;
        const card = _getCell(malhaRow, col);
        if (card) {
            linhaEl.appendChild(_criarCardEl(card, viewIndex, vi, malhaRow, col));
        }
    }

    return linhaEl;
}

// Aplica translateX a uma linha (em pixels)
function _setTranslateXLinha(viewIndex, px, transicao = false) {
    const el = document.getElementById(`campo-linha-${viewIndex}`);
    if (!el) return;
    el.style.transition = transicao
        ? `transform ${SPRING_MS}ms ${SPRING_EASING}`
        : 'none';
    el.style.transform = `translateX(${px}px)`;
}

// Aplica translateY a um card específico (para movimento de coluna)
function _setTranslateYCard(viewRow, viewCol, py, transicao = false) {
    const el = document.querySelector(
        `#campo-linha-${viewRow} .campo-card[data-vcol="${viewCol}"]`
    );
    if (!el) return;
    el.style.transition = transicao
        ? `transform ${SPRING_MS}ms ${SPRING_EASING}`
        : 'none';
    el.style.transform = `translateY(${py}px)`;
}

// ── Card element ──────────────────────────────────────────────────────────────

function _criarCardEl(card, viewRow, viewCol, malhaRow, malhaCol) {
    const el = document.createElement('div');
    el.className = 'campo-card';
    el.dataset.malhaRow  = malhaRow;
    el.dataset.malhaCol  = malhaCol;
    el.dataset.vcol      = viewCol;
    el.dataset.vrow      = viewRow;
    el.dataset.cardId    = card.id;
    el.dataset.username  = card.username || '';
    el.dataset.arrastou  = 'false';
    el.style.cssText = `
        width: ${_m.cardWidth}px;
        height: ${_m.cardHeight}px;
        flex-shrink: 0;
        border-radius: 16px;
        overflow: hidden;
        position: relative;
        cursor: pointer;
    `;

    const bg = card.imagem_capa
        ? `<img src="${card.imagem_capa}"
               style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
               alt="" draggable="false">`
        : `<div style="position:absolute;inset:0;
               background:linear-gradient(135deg,${card.cor}cc,${card.cor}44);"></div>`;

    const cats = (card.categorias || []).slice(0, 2).map(c =>
        `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;
            background:${c.cor}40;color:${c.cor};border:1px solid ${c.cor}60;
            backdrop-filter:blur(4px);">${c.nome}</span>`
    ).join('');

    const avatar = card.foto_autor
        ? `<img src="${card.foto_autor}"
               style="width:22px;height:22px;border-radius:50%;object-fit:cover;"
               alt="" draggable="false">`
        : `<div style="width:22px;height:22px;border-radius:50%;
               background:rgba(255,255,255,0.2);display:flex;align-items:center;
               justify-content:center;color:white;font-weight:700;font-size:11px;">
               ${(card.autor || '?').charAt(0).toUpperCase()}</div>`;

    const ehProprio  = _ehProprioAutor(card.username);
    const dropdown   = ehProprio ? '' : _htmlDropdown(card);

    el.innerHTML = `
        ${bg}
        <div style="position:absolute;inset:0;
            background:linear-gradient(to top,rgba(0,0,0,0.88) 0%,
            rgba(0,0,0,0.28) 55%,transparent 100%);"></div>
        ${card.procura_mod
            ? `<div style="position:absolute;top:8px;right:8px;background:#f97316;
                   color:white;font-size:11px;padding:2px 8px;border-radius:999px;
                   font-weight:600;">🤝 Procura Mod</div>` : ''}
        <div style="position:absolute;inset-inline:0;bottom:0;padding:12px;">
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">${cats}</div>
            <h3 style="color:white;font-weight:700;font-size:13px;line-height:1.35;
                margin:0 0 6px;display:-webkit-box;-webkit-line-clamp:2;
                -webkit-box-orient:vertical;overflow:hidden;">
                ${card.titulo_capa || card.titulo}</h3>
            <p style="color:rgba(255,255,255,0.65);font-size:11px;line-height:1.5;
                margin:0 0 8px;display:-webkit-box;-webkit-line-clamp:2;
                -webkit-box-orient:vertical;overflow:hidden;">${card.conteudo}</p>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:6px;">
                    ${avatar}
                    <span style="color:rgba(255,255,255,0.65);font-size:11px;">
                        ${card.autor}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;
                    color:rgba(255,255,255,0.55);font-size:11px;">
                    <span>❤️ ${card.curtidas}</span>
                    <span>📌 ${card.clips}</span>
                </div>
            </div>
        </div>
        ${dropdown}
    `;

    _registrarEventosCard(el, card);
    return el;
}

function _ehProprioAutor(username) {
    try {
        const cfg = JSON.parse(
            document.getElementById('bn-config')?.textContent || '{}'
        );
        return cfg.meUsername && cfg.meUsername === username;
    } catch { return false; }
}

// ── Dropdown ··· ──────────────────────────────────────────────────────────────

function _htmlDropdown(card) {
    return `
        <div class="card-menu-wrap" style="
            position:absolute;bottom:12px;right:12px;z-index:10;">
            <button class="card-menu-btn" data-card-id="${card.id}"
                    aria-label="Opções do card"
                    style="background:rgba(0,0,0,0.35);
                        border:1px solid rgba(255,255,255,0.15);
                        color:rgba(255,255,255,0.55);border-radius:999px;
                        width:28px;height:28px;display:flex;align-items:center;
                        justify-content:center;font-size:14px;font-weight:700;
                        letter-spacing:1px;cursor:pointer;backdrop-filter:blur(6px);
                        transition:color 0.2s,transform 0.2s,background 0.2s;
                        padding:0;">···</button>
            <div class="card-menu-dropdown" style="
                display:none;position:absolute;bottom:34px;right:0;
                background:rgba(15,10,30,0.92);
                border:1px solid rgba(255,255,255,0.10);border-radius:12px;
                padding:6px;min-width:190px;backdrop-filter:blur(16px);
                box-shadow:0 8px 32px rgba(0,0,0,0.4);overflow:hidden;">
                <button class="card-menu-item" data-action="repetitivo"
                        data-post-id="${card.id}"
                        style="${_estiloItem()}">🔁 Post repetitivo</button>
                <button class="card-menu-item" data-action="ver"
                        data-post-id="${card.id}"
                        style="${_estiloItem()}">⛶ Ver post completo</button>
                <button class="card-menu-item" data-action="seguir"
                        data-username="${card.username}"
                        data-post-id="${card.id}"
                        style="${_estiloItem()}">➕ Seguir autor</button>
                <div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>
                <button class="card-menu-item" data-action="reportar"
                        data-post-id="${card.id}"
                        style="${_estiloItem('rgba(239,68,68,0.15)', '#ef4444')}">
                        🚩 Reportar</button>
            </div>
        </div>`;
}

function _estiloItem(bg = 'transparent', cor = 'rgba(255,255,255,0.80)') {
    return `display:block;width:100%;text-align:left;background:${bg};color:${cor};
        border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:500;
        cursor:pointer;transition:background 0.15s;font-family:'Poppins',sans-serif;
        white-space:nowrap;`;
}

// ── Eventos do card ───────────────────────────────────────────────────────────

function _registrarEventosCard(el, card) {
    const btn = el.querySelector('.card-menu-btn');
    const dd  = el.querySelector('.card-menu-dropdown');

    if (btn && dd) {
        btn.addEventListener('mouseenter', () => {
            btn.style.color      = 'rgba(255,255,255,0.95)';
            btn.style.transform  = 'scale(1.12)';
            btn.style.background = 'rgba(0,0,0,0.55)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.color      = 'rgba(255,255,255,0.55)';
            btn.style.transform  = 'scale(1)';
            btn.style.background = 'rgba(0,0,0,0.35)';
        });
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const aberto = dd.style.display === 'block';
            _fecharDropdowns();
            if (!aberto) dd.style.display = 'block';
        });
        dd.querySelectorAll('.card-menu-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = item.dataset.action === 'reportar'
                    ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = item.dataset.action === 'reportar'
                    ? 'rgba(239,68,68,0.15)' : 'transparent';
            });
            item.addEventListener('click', e => {
                e.stopPropagation();
                _fecharDropdowns();
                _executarAcao(item.dataset.action, card, el);
            });
        });
    }

    let cliques = 0, timer = null;
    el.addEventListener('click', e => {
        if (e.target.closest('.card-menu-wrap')) return;
        if (el.dataset.arrastou === 'true') return;
        cliques++;
        if (cliques === 1) {
            timer = setTimeout(() => {
                cliques = 0;
                _registrarInteracao(card.id, 'open', 0);
                abrirDetalhe(card);
            }, 220);
        } else {
            clearTimeout(timer);
            cliques = 0;
            window.location.href = card.url_detalhe;
        }
    });
}

document.addEventListener('click', e => {
    if (!e.target.closest('.card-menu-wrap')) _fecharDropdowns();
});

function _fecharDropdowns() {
    document.querySelectorAll('.card-menu-dropdown').forEach(d => {
        d.style.display = 'none';
    });
}

// ── Ações do dropdown ─────────────────────────────────────────────────────────

async function _executarAcao(acao, card, cardEl) {
    if (acao === 'repetitivo') await _penalizarCard(card, cardEl);
    if (acao === 'ver')        abrirDetalhe(card);
    if (acao === 'seguir')     await _seguirAutor(card, cardEl);
    if (acao === 'reportar')   _toast('🚩 Obrigado pelo feedback!');
}

async function _penalizarCard(card, cardEl) {
    try {
        await fetch('/api/campo/penalizar-card/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
            body:   JSON.stringify({ post_id: card.id }),
        });
    } catch (e) { console.error(e); }

    _m.penalizados.add(card.id);
    cardEl.style.transition = `opacity ${EVAPORATE_MS}ms ease`;
    cardEl.style.opacity    = '0';

    setTimeout(() => {
        const vrow = parseInt(cardEl.dataset.vrow);
        const vcol = parseInt(cardEl.dataset.vcol);
        const row  = parseInt(cardEl.dataset.malhaRow);
        const col  = parseInt(cardEl.dataset.malhaCol);
        const novo = _cardAleatorio();
        if (novo) {
            _setCell(row, col, novo);
            const novoEl = _criarCardEl(novo, vrow, vcol, row, col);
            cardEl.replaceWith(novoEl);
        } else {
            cardEl.remove();
        }
    }, EVAPORATE_MS);
}

async function _seguirAutor(card, cardEl) {
    try {
        await fetch(`/perfil/${card.username}/seguir/`, {
            method: 'POST', headers: { 'X-CSRFToken': getCsrf() },
        });
        const btn = cardEl.querySelector('[data-action="seguir"]');
        if (btn) {
            btn.textContent   = '✓ Seguindo';
            btn.disabled      = true;
            btn.style.opacity = '0.5';
            btn.style.cursor  = 'default';
        }
    } catch (e) { console.error(e); }
}

// ── Drag ──────────────────────────────────────────────────────────────────────

function _configurarDrag() {
    const viewport = document.getElementById('campo-viewport');
    if (!viewport) return;

    const drag = _m.drag;

    function _viewRowAt(clientY) {
        const rect = viewport.getBoundingClientRect();
        const relY = clientY - rect.top;
        return Math.max(0, Math.min(
            Math.floor(relY / (_m.cardHeight + GAP)),
            _m.numLinhas - 1
        ));
    }

    function _viewColAt(clientX) {
        const rect = viewport.getBoundingClientRect();
        const relX = clientX - rect.left;
        return Math.max(0, Math.min(
            Math.floor(relX / (_m.cardWidth + GAP)),
            _m.numColunas - 1
        ));
    }

    function _iniciar(x, y) {
        drag.ativo       = true;
        drag.arrastou    = false;
        drag.eixo        = null;
        drag.startX      = x;
        drag.startY      = y;
        drag.pixelAtual  = 0;
        drag.tempoInicio = Date.now();
        drag.viewRow     = _viewRowAt(y);
        drag.viewCol     = _viewColAt(x);
        drag.alvoMalhaRow = _m.vRow + drag.viewRow;
        drag.alvoMalhaCol = _m.vCol + drag.viewCol;
        viewport.style.cursor = 'grabbing';
    }

    function _mover(x, y) {
        if (!drag.ativo) return;
        const dx = x - drag.startX;
        const dy = y - drag.startY;

        if (!drag.eixo && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            drag.eixo = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
        if (!drag.eixo) return;
        drag.arrastou = true;

        if (drag.eixo === 'x') {
            // Move a linha inteira no eixo X
            drag.pixelAtual = dx;
            _setTranslateXLinha(drag.viewRow, dx, false);
        } else {
            // Move todos os cards da coluna no eixo Y
            drag.pixelAtual = dy;
            for (let vi = 0; vi < _m.numLinhas; vi++) {
                _setTranslateYCard(vi, drag.viewCol, dy, false);
            }
        }
    }

    function _finalizar(x, y) {
        if (!drag.ativo) return;
        drag.ativo = false;
        viewport.style.cursor = 'grab';

        const dx    = x - drag.startX;
        const dy    = y - drag.startY;
        const tempo = Date.now() - drag.tempoInicio;

        if (drag.arrastou) {
            // Suprime click nos cards arrastados
            const seletor = drag.eixo === 'x'
                ? `#campo-linha-${drag.viewRow} .campo-card`
                : `.campo-card[data-vcol="${drag.viewCol}"]`;
            document.querySelectorAll(seletor).forEach(el => {
                el.dataset.arrastou = 'true';
                setTimeout(() => { el.dataset.arrastou = 'false'; }, 80);
            });
        }

        if (drag.eixo === 'x') {
            _snapLinha(drag.viewRow, drag.alvoMalhaRow, dx, tempo);
        } else if (drag.eixo === 'y') {
            _snapColuna(drag.viewCol, drag.alvoMalhaCol, dy, tempo);
        }
    }

    // Mouse
    viewport.addEventListener('mousedown', e => {
        if (e.target.closest('.card-menu-wrap')) return;
        _iniciar(e.clientX, e.clientY);
        e.preventDefault();
    });
    window.addEventListener('mousemove', e => _mover(e.clientX, e.clientY));
    window.addEventListener('mouseup',   e => _finalizar(e.clientX, e.clientY));

    // Touch
    viewport.addEventListener('touchstart', e => {
        if (e.target.closest('.card-menu-wrap')) return;
        const t = e.touches[0];
        _iniciar(t.clientX, t.clientY);
    }, { passive: true });
    viewport.addEventListener('touchmove', e => {
        const t = e.touches[0];
        _mover(t.clientX, t.clientY);
    }, { passive: true });
    viewport.addEventListener('touchend', e => {
        const t = e.changedTouches[0];
        _finalizar(t.clientX, t.clientY);
    });
}

// ── Snap com spring — linha (eixo X) ─────────────────────────────────────────

function _snapLinha(viewRow, malhaRow, dx, tempoMs) {
    const step   = _m.cardWidth + GAP;
    // Quantos cards foram deslocados (arredonda para o snap mais próximo)
    const cards  = Math.round(-dx / step);
    // Atualiza offset da linha na malha
    _m.offsetLinha[malhaRow] = (_m.offsetLinha[malhaRow] ?? 0) + cards;

    const snapPx = 0; // após propagar, a linha volta ao ponto 0 do viewport

    // Propaga o movimento: revela novos cards na malha para essa linha
    if (cards !== 0) {
        _propagarMovimentoLinha(viewRow, malhaRow, cards);
    }

    // Spring: anima a linha de volta ao ponto de encaixe (0px)
    _setTranslateXLinha(viewRow, 0, true);

    // Registra interação
    const cardCentro = _getCell(malhaRow, _m.vCol + Math.floor(_m.numColunas / 2));
    if (cardCentro) {
        _registrarInteracao(cardCentro.id, dx > 0 ? 'right' : 'left', tempoMs);
    }
}

// ── Snap com spring — coluna (eixo Y) ────────────────────────────────────────

function _snapColuna(viewCol, malhaCol, dy, tempoMs) {
    const step  = _m.cardHeight + GAP;
    const cards = Math.round(-dy / step);
    _m.offsetColuna[malhaCol] = (_m.offsetColuna[malhaCol] ?? 0) + cards;

    if (cards !== 0) {
        _propagarMovimentoColuna(viewCol, malhaCol, cards);
    }

    // Spring: anima todos os cards da coluna de volta ao Y=0
    for (let vi = 0; vi < _m.numLinhas; vi++) {
        _setTranslateYCard(vi, viewCol, 0, true);
    }

    const cardCentro = _getCell(
        _m.vRow + Math.floor(_m.numLinhas / 2), malhaCol
    );
    if (cardCentro) {
        _registrarInteracao(cardCentro.id, dy > 0 ? 'down' : 'up', tempoMs);
    }
}

// ── Propagação — linha afeta colunas ─────────────────────────────────────────
//
// Quando a linha malhaRow desloca `cards` posições para a esquerda (cards > 0)
// ou direita (cards < 0), os cards visíveis nessa linha mudam. Cada coluna
// do viewport agora tem um card diferente na posição dessa linha.
// Precisamos:
// 1. Calcular quais células da malha estão agora visíveis nessa linha
// 2. Garantir que essas células têm cards
// 3. Atualizar o DOM da linha com os novos cards
// 4. As colunas "percebem" automaticamente porque o card em malha[malhaRow][col]
//    foi atualizado — na próxima movimentação de coluna, o card correto é usado.

function _propagarMovimentoLinha(viewRow, malhaRow, deltaCards) {
    // Nova posição inicial da coluna visível para essa linha
    // offsetLinha[malhaRow] acumulou o delta, então recalculamos vCol efetivo
    const vColEfetivo = _m.vCol + (_m.offsetLinha[malhaRow] ?? 0) - deltaCards;

    // Garante células para as novas colunas visíveis
    for (let vi = 0; vi < _m.numColunas; vi++) {
        const col = vColEfetivo + deltaCards + vi;
        _garantirCell(malhaRow, col);
    }

    // Reconstrói o DOM da linha com os cards corretos
    _reconstruirLinha(viewRow, malhaRow);
}

// ── Propagação — coluna afeta linhas ─────────────────────────────────────────

function _propagarMovimentoColuna(viewCol, malhaCol, deltaCards) {
    const vRowEfetivo = _m.vRow + (_m.offsetColuna[malhaCol] ?? 0) - deltaCards;

    // Garante células para as novas linhas visíveis nessa coluna
    for (let vi = 0; vi < _m.numLinhas; vi++) {
        const row = vRowEfetivo + deltaCards + vi;
        _garantirCell(row, malhaCol);
    }

    // Atualiza o card de cada linha do viewport na posição dessa coluna
    for (let vi = 0; vi < _m.numLinhas; vi++) {
        const malhaRow = _m.vRow + vi + (_m.offsetColuna[malhaCol] ?? 0);
        const card     = _getCell(malhaRow, malhaCol);
        if (!card) continue;

        const cardEl = document.querySelector(
            `#campo-linha-${vi} .campo-card[data-vcol="${viewCol}"]`
        );
        if (cardEl) {
            const novoEl = _criarCardEl(card, vi, viewCol, malhaRow, malhaCol);
            cardEl.replaceWith(novoEl);
        }
    }
}

// ── Reconstrução de linha no DOM ──────────────────────────────────────────────

function _reconstruirLinha(viewRow, malhaRow) {
    const linhaEl = document.getElementById(`campo-linha-${viewRow}`);
    if (!linhaEl) return;

    // Limpa e reconstrói os cards da linha com base no offset atual
    linhaEl.innerHTML = '';
    linhaEl.style.transform  = 'translateX(0px)';
    linhaEl.style.transition = 'none';

    const offsetCards = _m.offsetLinha[malhaRow] ?? 0;
    for (let vi = 0; vi < _m.numColunas; vi++) {
        const col  = _m.vCol + offsetCards + vi;
        const card = _garantirCell(malhaRow, col);
        if (card) {
            linhaEl.appendChild(_criarCardEl(card, viewRow, vi, malhaRow, col));
        }
    }
}

// ── Navegação por botões (acessibilidade) ─────────────────────────────────────

function moverLinha(viewRow, direcao) {
    const malhaRow = _m.vRow + viewRow;
    const delta    = direcao === 'esquerda' ? 1 : -1;
    _m.offsetLinha[malhaRow] = (_m.offsetLinha[malhaRow] ?? 0) + delta;
    _propagarMovimentoLinha(viewRow, malhaRow, delta);
    _setTranslateXLinha(viewRow, 0, true);
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

// ── Toast ─────────────────────────────────────────────────────────────────────

function _toast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:rgba(15,10,30,0.92);color:white;padding:10px 20px;
        border-radius:999px;font-size:13px;font-family:'Poppins',sans-serif;
        backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.12);
        z-index:999999;opacity:0;transition:opacity 0.3s;pointer-events:none;`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 2500);
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
            `<img src="${card.imagem_capa}"
                  style="width:100%;height:224px;object-fit:cover;" alt="">`;
        document.getElementById('detalhe-titulo-capa').textContent =
            card.titulo_capa || card.titulo;
        capaWrapper.classList.remove('hidden');
    } else {
        capaWrapper.classList.add('hidden');
    }

    document.getElementById('detalhe-cats').innerHTML = (card.categorias || []).map(c =>
        `<span style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;
                      background:${c.cor}25;color:${c.cor};">${c.nome}</span>`
    ).join('');

    document.getElementById('detalhe-titulo').textContent   = card.titulo;
    document.getElementById('detalhe-conteudo').textContent = card.conteudo;
    document.getElementById('detalhe-data').textContent     = '📅 ' + card.data;

    const autorBtn = document.getElementById('detalhe-autor-btn');
    autorBtn.textContent = '✍️ ' + card.autor;
    autorBtn.onclick     = () => window.abrirModalPerfil?.(card.username);

    document.getElementById('detalhe-total-curtida').textContent = card.curtidas;
    document.getElementById('detalhe-total-clip').textContent    = card.clips;
    document.getElementById('detalhe-btn-curtida').onclick =
        () => _reagirDetalhe(card.id, 'curtida');
    document.getElementById('detalhe-btn-clip').onclick =
        () => _reagirDetalhe(card.id, 'clip');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    const thread = window._criarThreadCampo?.(card.id);
    if (thread) {
        const btnComentar = document.getElementById('detalhe-btn-comentar');
        if (btnComentar) btnComentar.onclick = () => thread.enviar(null);
        window._abrirSubthreadCampo = (pid, cid) =>
            _abrirSubthreadCampo(pid, cid, thread);
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
               class="block bg-white rounded-xl border border-gray-100 shadow-sm
                      px-5 py-4 hover:border-orange-200 transition">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-800 truncate">${p.titulo}</h4>
                        <p class="text-xs text-gray-400 mt-0.5">${p.conteudo}</p>
                    </div>
                    <div class="flex-shrink-0 text-right">
                        <p class="text-xs text-gray-400">${p.data}</p>
                        <p class="text-xs text-orange-500 font-semibold mt-1">
                            ❤️ ${p.curtidas} · 📌 ${p.clips}</p>
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

async function _init() {
    if (!document.getElementById('campo-grid-wrapper')) return;
    if (_m.iniciado) return;
    _m.iniciado = true;

    _mostrarLoading(true);

    _m.numColunas = _getNumColunas();
    _m.numLinhas  = 2;
    _m.vRow       = 0;
    _m.vCol       = 0;

    await _carregarPool();

    if (!_m.pool.length) {
        _mostrarLoading(false);
        _mostrarVazio(true);
        return;
    }

    _preencherViewport();
    _mostrarLoading(false);
    _renderizarGrid();
    _configurarDrag();

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            _m.numColunas = _getNumColunas();
            const { width, height } = _getDimensoesCard(_m.numColunas);
            _m.cardWidth  = width;
            _m.cardHeight = height;
            _preencherViewport();
            _renderizarGrid();
            _configurarDrag();
        }, 300);
    });
}

// ── Export e globais ──────────────────────────────────────────────────────────

export function registrarCampoGlobal() {
    window.fecharDetalhe        = fecharDetalhe;
    window.mostrarSubaba        = mostrarSubaba;
    window.fecharSubthreadCampo = fecharSubthreadCampo;
    window.moverLinha           = moverLinha;
}

export function iniciarCampo() {
    _init();
}
