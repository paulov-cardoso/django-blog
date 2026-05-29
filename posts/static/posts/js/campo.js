import { getCsrf } from './utils.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const BATCH_SIZE     = 60;
const PREFETCH_AHEAD = 10;
const GAP            = 8;
const BUF            = 5;
const DRAG_THRESHOLD = 8;
const SNAP_MS        = 300;
const SNAP_EASING    = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
const EVAPORATE_MS   = 1600;

// ── Breakpoints ───────────────────────────────────────────────────────────────

function getNumColunas() {
    const w = window.innerWidth;
    if (w >= 1920) return 5;
    if (w >= 1440) return 4;
    if (w >= 1024) return 3;
    return 2;
}

function getDimensoesCard(numColunas) {
    const vp = document.getElementById('campo-viewport');
    if (!vp) return { width: 280, height: 392 };
    const totalGap = (numColunas - 1) * GAP;
    const width    = Math.floor((vp.clientWidth - totalGap) / numColunas);
    const height   = Math.round(width * 1.4);
    return { width, height };
}

// ── Altura disponível ─────────────────────────────────────────────────────────

function calcularAlturaViewport() {
    const nav  = document.getElementById('synapsoo-nav');
    const abas = document.getElementById('barra-abas');
    const navH  = nav  ? nav.getBoundingClientRect().height  : 44;
    const abasH = abas ? abas.getBoundingClientRect().height : 36;
    return window.innerHeight - navH - abasH;
}

// ── Estado ────────────────────────────────────────────────────────────────────

const E = {
    malha:        {},
    pool:         [],
    poolOffset:   0,
    temMais:      true,
    carregando:   false,
    origemLinha:  0,
    origemColuna: 0,
    dragOffsetX:  {},
    dragOffsetY:  {},
    VP_LINHAS:    2,
    VP_COLUNAS:   3,
    cardWidth:    280,
    cardHeight:   392,
    drag: {
        ativo: false, eixo: null, startX: 0, startY: 0,
        startOff: 0, alvo: null, arrastou: false,
        tempoInicio: 0, linhaAbsIdx: 0, colunaAbsIdx: 0,
    },
    penalizados:    new Set(),
    iniciado:       false,
    _navObserver:   null,
};

const stepX = () => E.cardWidth  + GAP;
const stepY = () => E.cardHeight + GAP;

// ── Pool ──────────────────────────────────────────────────────────────────────

async function carregarPool(forcar = false) {
    if (E.carregando) return;
    if (!forcar && !E.temMais) return;
    E.carregando = true;
    try {
        const offset = E.pool.length;
        const res    = await fetch(`/api/campo/pool/?offset=${offset}&limit=${BATCH_SIZE}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data   = await res.json();
        E.pool    = E.pool.concat(data.cards);
        E.temMais = data.tem_mais;
        console.debug('[Campo] pool carregado:', E.pool.length, 'cards. tem_mais:', E.temMais);
    } catch (e) {
        console.error('[Campo] Erro ao carregar pool:', e);
    } finally {
        E.carregando = false;
    }
}

function proximoCard() {
    if (E.poolOffset >= E.pool.length) return null;
    const card = E.pool[E.poolOffset++];
    if (E.pool.length - E.poolOffset <= PREFETCH_AHEAD && E.temMais) carregarPool();
    return card;
}

// ── Malha ─────────────────────────────────────────────────────────────────────

function getCard(r, c)       { return E.malha[r]?.[c] ?? null; }
function setCard(r, c, card) { if (!E.malha[r]) E.malha[r] = {}; E.malha[r][c] = card; }

function garantirCard(r, c) {
    if (!getCard(r, c)) { const card = proximoCard(); if (card) setCard(r, c, card); }
    return getCard(r, c);
}

function preencherZona() {
    const r0 = E.origemLinha  - BUF, r1 = E.origemLinha  + E.VP_LINHAS  + BUF;
    const c0 = E.origemColuna - BUF, c1 = E.origemColuna + E.VP_COLUNAS + BUF;
    for (let r = r0; r < r1; r++)
        for (let c = c0; c < c1; c++)
            garantirCard(r, c);
}

// ── Commit ────────────────────────────────────────────────────────────────────

function commitLinhaOffset(rowAbs, deltaCards) {
    if (deltaCards === 0) return;
    const rowData = E.malha[rowAbs] ?? {};
    const nova    = {};
    for (const col in rowData) nova[parseInt(col) - deltaCards] = rowData[col];
    E.malha[rowAbs] = nova;
    const c0 = E.origemColuna - BUF, c1 = E.origemColuna + E.VP_COLUNAS + BUF;
    for (let c = c0; c < c1; c++) garantirCard(rowAbs, c);
}

function commitColunaOffset(colAbs, deltaCards) {
    if (deltaCards === 0) return;
    const colData = {};
    for (const row in E.malha) {
        const r = parseInt(row);
        if (E.malha[row][colAbs] !== undefined) {
            colData[r - deltaCards] = E.malha[row][colAbs];
            delete E.malha[row][colAbs];
        }
    }
    for (const row in colData) {
        if (!E.malha[row]) E.malha[row] = {};
        E.malha[row][colAbs] = colData[row];
    }
    const r0 = E.origemLinha - BUF, r1 = E.origemLinha + E.VP_LINHAS + BUF;
    for (let r = r0; r < r1; r++) garantirCard(r, colAbs);
}

// ── Renderização ──────────────────────────────────────────────────────────────

function renderGrid() {
    const vp   = document.getElementById('campo-viewport');
    const grid = document.getElementById('campo-grid');
    if (!grid || !vp) return;

    mostrarVazio(false);

    const { width, height } = getDimensoesCard(E.VP_COLUNAS);
    E.cardWidth  = width;
    E.cardHeight = height;

    // Viewport ocupa o wrapper inteiro — não sobrescrever height aqui.
    // A altura visual é controlada pelo wrapper via ajustarLayout().
    vp.style.overflow = 'hidden';
    vp.style.position = 'absolute';
    vp.style.inset    = '0';

    grid.innerHTML = '';
    grid.style.cssText = [
        'display:flex', 'flex-direction:column', `gap:${GAP}px`,
        'will-change:transform', 'position:relative',
        `transform:translateY(${-(BUF * stepY())}px)`
    ].join(';');

    const totalLinhas  = E.VP_LINHAS  + BUF * 2;
    const totalColunas = E.VP_COLUNAS + BUF * 2;

    for (let vi = 0; vi < totalLinhas; vi++) {
        const rowAbs = E.origemLinha - BUF + vi;
        grid.appendChild(criarLinhaEl(vi, rowAbs, totalColunas));
    }
}

function criarLinhaEl(vi, rowAbs, totalColunas) {
    const el = document.createElement('div');
    el.id             = `campo-linha-${rowAbs}`;
    el.className      = 'campo-linha';
    el.dataset.rowAbs = rowAbs;
    el.dataset.vi     = vi;

    const offsetX = E.dragOffsetX[rowAbs] ?? 0;
    el.style.cssText = [
        'display:flex', 'flex-direction:row', `gap:${GAP}px`,
        'flex-shrink:0', `height:${E.cardHeight}px`,
        `transform:translateX(${-(BUF * stepX()) + offsetX}px)`,
        'will-change:transform'
    ].join(';');

    for (let vj = 0; vj < totalColunas; vj++) {
        const colAbs  = E.origemColuna - BUF + vj;
        const card    = getCard(rowAbs, colAbs);
        if (!card) continue;
        const cardEl  = criarCardEl(card, rowAbs, colAbs);
        const offsetY = E.dragOffsetY[colAbs] ?? 0;
        cardEl.style.opacity = calcOpacidadeCard(vi, vj, offsetX, offsetY) ? '1' : '0';
        el.appendChild(cardEl);
    }
    return el;
}

function calcOpacidadeCard(vi, vj, offsetLinhaX, offsetColunaY) {
    // viewW/viewH usam dimensões reais: N cards + (N-1) gaps, sem o gap extra do fim
    const viewW = E.VP_COLUNAS * E.cardWidth  + (E.VP_COLUNAS - 1) * GAP;
    const viewH = E.VP_LINHAS  * E.cardHeight + (E.VP_LINHAS  - 1) * GAP;

    const cardLeft  = (vj - BUF) * stepX() + offsetLinhaX;
    const cardRight = cardLeft + E.cardWidth;

    const cardTop    = (vi - BUF) * stepY() + offsetColunaY;
    const cardBottom = cardTop + E.cardHeight;

    return (cardRight > 0 && cardLeft < viewW) && (cardBottom > 0 && cardTop < viewH);
}

function aplicarOffsetLinha(rowAbs, px, animado = false) {
    E.dragOffsetX[rowAbs] = px;
    const el = document.getElementById(`campo-linha-${rowAbs}`);
    if (!el) return;
    el.style.transition = animado ? `transform ${SNAP_MS}ms ${SNAP_EASING}` : 'none';
    el.style.transform  = `translateX(${-(BUF * stepX()) + px}px)`;

    const vi = parseInt(el.dataset.vi);
    el.querySelectorAll('.campo-card').forEach(cardEl => {
        const colAbs  = parseInt(cardEl.dataset.colAbs);
        const vj      = colAbs - (E.origemColuna - BUF);
        const offsetY = E.dragOffsetY[colAbs] ?? 0;
        cardEl.style.opacity = calcOpacidadeCard(vi, vj, px, offsetY) ? '1' : '0';
    });
}

function aplicarOffsetColuna(colAbs, py, animado = false) {
    E.dragOffsetY[colAbs] = py;
    const totalLinhas = E.VP_LINHAS + BUF * 2;

    for (let vi = 0; vi < totalLinhas; vi++) {
        const rowAbs  = E.origemLinha - BUF + vi;
        const linhaEl = document.getElementById(`campo-linha-${rowAbs}`);
        if (!linhaEl) continue;
        const cardEl  = linhaEl.querySelector(`.campo-card[data-col-abs="${colAbs}"]`);
        if (!cardEl) continue;

        cardEl.style.transition = animado
            ? `transform ${SNAP_MS}ms ${SNAP_EASING}, opacity 0.12s`
            : 'none';
        cardEl.style.transform  = `translateY(${py}px)`;

        const vj      = colAbs - (E.origemColuna - BUF);
        const offsetX = E.dragOffsetX[rowAbs] ?? 0;
        cardEl.style.opacity = calcOpacidadeCard(vi, vj, offsetX, py) ? '1' : '0';
    }
}

// ── Snap + Commit ─────────────────────────────────────────────────────────────

function snapLinha(rowAbs) {
    const atual  = E.dragOffsetX[rowAbs] ?? 0;
    const delta  = Math.round(atual / stepX());
    aplicarOffsetLinha(rowAbs, delta * stepX(), true);
    setTimeout(() => {
        commitLinhaOffset(rowAbs, -delta);
        E.dragOffsetX[rowAbs] = 0;
        rerenderLinha(rowAbs);
        preencherZona();
    }, SNAP_MS + 30);
}

function snapColuna(colAbs) {
    const atual  = E.dragOffsetY[colAbs] ?? 0;
    const delta  = Math.round(atual / stepY());
    aplicarOffsetColuna(colAbs, delta * stepY(), true);
    setTimeout(() => {
        commitColunaOffset(colAbs, -delta);
        E.dragOffsetY[colAbs] = 0;
        rerenderColuna(colAbs);
        preencherZona();
    }, SNAP_MS + 30);
}

// ── Re-render parcial ─────────────────────────────────────────────────────────

function rerenderLinha(rowAbs) {
    const linhaEl = document.getElementById(`campo-linha-${rowAbs}`);
    if (!linhaEl) return;
    const vi           = parseInt(linhaEl.dataset.vi);
    const totalColunas = E.VP_COLUNAS + BUF * 2;
    linhaEl.innerHTML  = '';
    linhaEl.style.transition = 'none';
    linhaEl.style.transform  = `translateX(${-(BUF * stepX())}px)`;
    for (let vj = 0; vj < totalColunas; vj++) {
        const colAbs  = E.origemColuna - BUF + vj;
        const card    = getCard(rowAbs, colAbs);
        if (!card) continue;
        const cardEl  = criarCardEl(card, rowAbs, colAbs);
        const offsetY = E.dragOffsetY[colAbs] ?? 0;
        cardEl.style.opacity = calcOpacidadeCard(vi, vj, 0, offsetY) ? '1' : '0';
        linhaEl.appendChild(cardEl);
    }
}

function rerenderColuna(colAbs) {
    const totalLinhas = E.VP_LINHAS + BUF * 2;
    for (let vi = 0; vi < totalLinhas; vi++) {
        const rowAbs  = E.origemLinha - BUF + vi;
        const linhaEl = document.getElementById(`campo-linha-${rowAbs}`);
        if (!linhaEl) continue;
        const old  = linhaEl.querySelector(`.campo-card[data-col-abs="${colAbs}"]`);
        const card = getCard(rowAbs, colAbs);
        if (!card || !old) continue;
        const vj   = colAbs - (E.origemColuna - BUF);
        const novo = criarCardEl(card, rowAbs, colAbs);
        novo.style.opacity = calcOpacidadeCard(vi, vj, E.dragOffsetX[rowAbs] ?? 0, 0) ? '1' : '0';
        old.replaceWith(novo);
    }
}

// ── Card element ──────────────────────────────────────────────────────────────

function criarCardEl(card, rowAbs, colAbs) {
    const el = document.createElement('div');
    el.className        = 'campo-card';
    el.dataset.id       = card.id;
    el.dataset.rowAbs   = rowAbs;
    el.dataset.colAbs   = colAbs;
    el.dataset.username = card.username || '';
    el.dataset.arrastou = 'false';
    el.style.cssText = [
        `width:${E.cardWidth}px`, `height:${E.cardHeight}px`,
        'flex-shrink:0', 'border-radius:16px', 'overflow:hidden',
        'position:relative', 'cursor:pointer', 'transition:opacity 0.12s'
    ].join(';');

    const bg = card.imagem_capa
        ? `<img src="${card.imagem_capa}" draggable="false"
               style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" alt="">`
        : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${card.cor}cc,${card.cor}44);"></div>`;

    const cats = (card.categorias || []).slice(0, 2).map(c =>
        `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;
            background:${c.cor}40;color:${c.cor};border:1px solid ${c.cor}60;
            backdrop-filter:blur(4px);">${c.nome}</span>`
    ).join('');

    const avatar = card.foto_autor
        ? `<img src="${card.foto_autor}" draggable="false"
               style="width:22px;height:22px;border-radius:50%;object-fit:cover;" alt="">`
        : `<div style="width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.2);
               display:flex;align-items:center;justify-content:center;
               color:white;font-weight:700;font-size:11px;">
               ${(card.autor || '?').charAt(0).toUpperCase()}</div>`;

    const dropdown = ehProprioAutor(card.username) ? '' : htmlDropdown(card);

    el.innerHTML = `
        ${bg}
        <div style="position:absolute;inset:0;background:linear-gradient(to top,
             rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.28) 55%,transparent 100%);"></div>
        ${card.procura_mod
            ? `<div style="position:absolute;top:8px;right:8px;background:#f97316;
                    color:white;font-size:11px;padding:2px 8px;border-radius:999px;
                    font-weight:600;">Procura Mod</div>` : ''}
        <div style="position:absolute;inset-inline:0;bottom:0;padding:12px;">
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">${cats}</div>
            <h3 style="color:white;font-weight:700;font-size:13px;line-height:1.35;margin:0 0 6px;
                       display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
                       overflow:hidden;">${card.titulo_capa || card.titulo}</h3>
            <p style="color:rgba(255,255,255,0.65);font-size:11px;line-height:1.5;margin:0 0 8px;
                      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
                      overflow:hidden;">${card.conteudo}</p>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:6px;">
                    ${avatar}
                    <span style="color:rgba(255,255,255,0.65);font-size:11px;">${card.autor}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;
                            color:rgba(255,255,255,0.55);font-size:11px;">
                    <span>❤️ ${card.curtidas}</span>
                    <span>📌 ${card.clips}</span>
                </div>
            </div>
        </div>
        ${dropdown}`;

    registrarEventosCard(el, card);
    return el;
}

function ehProprioAutor(username) {
    try {
        const cfg = JSON.parse(document.getElementById('bn-config')?.textContent || '{}');
        return cfg.meUsername && cfg.meUsername === username;
    } catch { return false; }
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function htmlDropdown(card) {
    const item = (bg = 'transparent', cor = 'rgba(255,255,255,0.80)') =>
        `display:block;width:100%;text-align:left;background:${bg};color:${cor};
         border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:500;
         cursor:pointer;transition:background 0.15s;font-family:'Poppins',sans-serif;
         white-space:nowrap;`;
    return `
        <div class="card-menu-wrap" style="position:absolute;bottom:12px;right:12px;z-index:10;">
            <button class="card-menu-btn" data-card-id="${card.id}" aria-label="Opcoes"
                    style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.15);
                           color:rgba(255,255,255,0.55);border-radius:999px;width:28px;height:28px;
                           display:flex;align-items:center;justify-content:center;font-size:14px;
                           font-weight:700;letter-spacing:1px;cursor:pointer;
                           backdrop-filter:blur(6px);padding:0;
                           transition:color .2s,transform .2s,background .2s;">···</button>
            <div class="card-menu-dropdown"
                 style="display:none;position:absolute;bottom:34px;right:0;
                        background:rgba(15,10,30,0.92);border:1px solid rgba(255,255,255,0.10);
                        border-radius:12px;padding:6px;min-width:190px;
                        backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.4);">
                <button class="card-menu-item" data-action="repetitivo" data-post-id="${card.id}"
                        style="${item()}">🔁 Post repetitivo</button>
                <button class="card-menu-item" data-action="ver" data-post-id="${card.id}"
                        style="${item()}">⛶ Ver post completo</button>
                <button class="card-menu-item" data-action="seguir"
                        data-username="${card.username}" data-post-id="${card.id}"
                        style="${item()}">➕ Seguir autor</button>
                <div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>
                <button class="card-menu-item" data-action="reportar" data-post-id="${card.id}"
                        style="${item('rgba(239,68,68,0.15)', '#ef4444')}">🚩 Reportar</button>
            </div>
        </div>`;
}

// ── Eventos do card ───────────────────────────────────────────────────────────

function registrarEventosCard(el, card) {
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
            fecharTodosDropdowns();
            if (!aberto) dd.style.display = 'block';
        });
        dd.querySelectorAll('.card-menu-item').forEach(it => {
            it.addEventListener('mouseenter', () => {
                it.style.background = it.dataset.action === 'reportar'
                    ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)';
            });
            it.addEventListener('mouseleave', () => {
                it.style.background = it.dataset.action === 'reportar'
                    ? 'rgba(239,68,68,0.15)' : 'transparent';
            });
            it.addEventListener('click', e => {
                e.stopPropagation();
                fecharTodosDropdowns();
                executarAcaoDropdown(it.dataset.action, card, el);
            });
        });
    }

    let cliques = 0, timerClique = null;
    el.addEventListener('click', e => {
        if (e.target.closest('.card-menu-wrap')) return;
        if (el.dataset.arrastou === 'true') return;
        cliques++;
        if (cliques === 1) {
            timerClique = setTimeout(() => {
                cliques = 0;
                registrarInteracao(card.id, 'open', 0);
                abrirDetalhe(card);
            }, 220);
        } else {
            clearTimeout(timerClique);
            cliques = 0;
            window.location.href = card.url_detalhe;
        }
    });
}

function fecharTodosDropdowns() {
    document.querySelectorAll('.card-menu-dropdown').forEach(d => { d.style.display = 'none'; });
}
document.addEventListener('click', e => {
    if (!e.target.closest('.card-menu-wrap')) fecharTodosDropdowns();
});

// ── Ações dropdown ────────────────────────────────────────────────────────────

async function executarAcaoDropdown(acao, card, cardEl) {
    switch (acao) {
        case 'repetitivo': await penalizarCard(card, cardEl); break;
        case 'ver':        abrirDetalhe(card); break;
        case 'seguir':     await seguirAutor(card, cardEl); break;
        case 'reportar':   mostrarToast('Obrigado pelo feedback!'); break;
    }
}

async function penalizarCard(card, cardEl) {
    try {
        await fetch('/api/campo/penalizar-card/', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
            body:    JSON.stringify({ post_id: card.id }),
        });
    } catch (e) { console.error('[Campo] penalizar:', e); }
    E.penalizados.add(card.id);
    cardEl.style.transition = `opacity ${EVAPORATE_MS}ms ease`;
    cardEl.style.opacity    = '0';
    setTimeout(() => {
        const r = parseInt(cardEl.dataset.rowAbs);
        const c = parseInt(cardEl.dataset.colAbs);
        const prox = proximoCard();
        if (prox) { setCard(r, c, prox); cardEl.replaceWith(criarCardEl(prox, r, c)); }
        else { cardEl.remove(); }
    }, EVAPORATE_MS);
}

async function seguirAutor(card, cardEl) {
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
    } catch (e) { console.error('[Campo] seguir:', e); }
}

// ── Drag ──────────────────────────────────────────────────────────────────────

function configurarDrag() {
    const vp = document.getElementById('campo-viewport');
    if (!vp) return;
    const drag = E.drag;

    const viewIdxLinha  = y => { const r = vp.getBoundingClientRect();
        return Math.max(0, Math.min(Math.floor((y - r.top)  / stepY()), E.VP_LINHAS  - 1)); };
    const viewIdxColuna = x => { const r = vp.getBoundingClientRect();
        return Math.max(0, Math.min(Math.floor((x - r.left) / stepX()), E.VP_COLUNAS - 1)); };

    function iniciar(x, y) {
        drag.ativo = true; drag.arrastou = false; drag.eixo = null;
        drag.startX = x; drag.startY = y; drag.tempoInicio = Date.now();
        drag.linhaAbsIdx  = E.origemLinha  + viewIdxLinha(y);
        drag.colunaAbsIdx = E.origemColuna + viewIdxColuna(x);
        vp.style.cursor = 'grabbing';
    }

    function mover(x, y) {
        if (!drag.ativo) return;
        const dx = x - drag.startX, dy = y - drag.startY;
        if (!drag.eixo && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            drag.eixo     = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            drag.alvo     = drag.eixo === 'x' ? drag.linhaAbsIdx : drag.colunaAbsIdx;
            drag.startOff = drag.eixo === 'x'
                ? (E.dragOffsetX[drag.alvo] ?? 0)
                : (E.dragOffsetY[drag.alvo] ?? 0);
        }
        if (!drag.eixo) return;
        drag.arrastou = true;
        const off = drag.startOff + (drag.eixo === 'x' ? dx : dy);
        if (drag.eixo === 'x') aplicarOffsetLinha(drag.alvo, off, false);
        else                   aplicarOffsetColuna(drag.alvo, off, false);
    }

    function finalizar(x, y) {
        if (!drag.ativo) return;
        drag.ativo = false; vp.style.cursor = 'grab';
        const dx   = x - drag.startX, dy = y - drag.startY;
        const tempo = Date.now() - drag.tempoInicio;
        if (drag.arrastou) marcarArrastados(drag.eixo, drag.alvo);
        if (drag.eixo === 'x' && drag.alvo !== null) {
            snapLinha(drag.alvo);
            const card = getCard(drag.alvo, E.origemColuna + Math.floor(E.VP_COLUNAS / 2));
            if (card) registrarInteracao(card.id, dx > 0 ? 'right' : 'left', tempo);
        } else if (drag.eixo === 'y' && drag.alvo !== null) {
            snapColuna(drag.alvo);
            const card = getCard(E.origemLinha + Math.floor(E.VP_LINHAS / 2), drag.alvo);
            if (card) registrarInteracao(card.id, dy > 0 ? 'down' : 'up', tempo);
        }
    }

    vp._mousedown && vp.removeEventListener('mousedown', vp._mousedown);
    vp._mousedown = e => {
        if (e.target.closest('.card-menu-wrap')) return;
        iniciar(e.clientX, e.clientY); e.preventDefault();
    };
    vp.addEventListener('mousedown', vp._mousedown);
    window.addEventListener('mousemove', e => mover(e.clientX, e.clientY));
    window.addEventListener('mouseup',   e => finalizar(e.clientX, e.clientY));

    vp.addEventListener('touchstart', e => {
        if (e.target.closest('.card-menu-wrap')) return;
        const t = e.touches[0]; iniciar(t.clientX, t.clientY);
    }, { passive: true });
    vp.addEventListener('touchmove', e => {
        const t = e.touches[0]; mover(t.clientX, t.clientY);
    }, { passive: true });
    vp.addEventListener('touchend', e => {
        const t = e.changedTouches[0]; finalizar(t.clientX, t.clientY);
    });
}

function marcarArrastados(eixo, alvo) {
    const sel = eixo === 'x'
        ? `#campo-linha-${alvo} .campo-card`
        : `.campo-card[data-col-abs="${alvo}"]`;
    document.querySelectorAll(sel).forEach(el => {
        el.dataset.arrastou = 'true';
        setTimeout(() => { el.dataset.arrastou = 'false'; }, 80);
    });
}

// ── Interação ─────────────────────────────────────────────────────────────────

async function registrarInteracao(postId, direcao, tempoMs) {
    try {
        await fetch('/api/campo/interacao/', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
            body:    JSON.stringify({ post_id: postId, direcao, tempo_ms: tempoMs }),
        });
    } catch { /* silencioso */ }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function mostrarToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = [
        'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(15,10,30,0.92)', 'color:white', 'padding:10px 20px',
        'border-radius:999px', 'font-size:13px', 'font-family:Poppins,sans-serif',
        'backdrop-filter:blur(12px)', 'border:1px solid rgba(255,255,255,0.12)',
        'z-index:999999', 'opacity:0', 'transition:opacity 0.3s', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 2500);
}

// ── Modal detalhe ─────────────────────────────────────────────────────────────

const modalCarregado = new Set();

function abrirDetalhe(card) {
    const modal = document.getElementById('modal-detalhe-campo');
    if (!modal) return;
    document.getElementById('detalhe-campo-link').href = card.url_detalhe;
    const capaWrapper = document.getElementById('detalhe-capa-wrapper');
    if (card.imagem_capa) {
        document.getElementById('detalhe-capa-imgs').innerHTML =
            `<img src="${card.imagem_capa}" style="width:100%;height:224px;object-fit:cover;" alt="">`;
        document.getElementById('detalhe-titulo-capa').textContent = card.titulo_capa || card.titulo;
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
    document.getElementById('detalhe-data').textContent     = card.data;
    const autorBtn = document.getElementById('detalhe-autor-btn');
    autorBtn.textContent = card.autor;
    autorBtn.onclick     = () => window.abrirModalPerfil?.(card.username);
    document.getElementById('detalhe-total-curtida').textContent = card.curtidas;
    document.getElementById('detalhe-total-clip').textContent    = card.clips;
    document.getElementById('detalhe-btn-curtida').onclick = () => reagirDetalhe(card.id, 'curtida');
    document.getElementById('detalhe-btn-clip').onclick    = () => reagirDetalhe(card.id, 'clip');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    const thread = window._criarThreadCampo?.(card.id);
    if (thread) {
        const btnC = document.getElementById('detalhe-btn-comentar');
        if (btnC) btnC.onclick = () => thread.enviar(null);
        window._abrirSubthreadCampo = (pid, cid) => abrirSubthreadCampo(pid, cid, thread);
    }
    if (!modalCarregado.has(card.id)) { thread?.carregar(); modalCarregado.add(card.id); }
}

function fecharDetalhe() {
    const modal = document.getElementById('modal-detalhe-campo');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = 'hidden';
}

async function reagirDetalhe(postId, tipo) {
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

function abrirSubthreadCampo(postId, comentarioId, thread) {
    const modal    = document.getElementById('modal-subthread-campo');
    const conteudo = document.getElementById('conteudo-subthread-campo');
    if (!modal || !conteudo) return;
    conteudo.innerHTML = '';
    const pai = thread.buscar(comentarioId);
    pai?.respostas?.forEach(r => {
        if (r.respostas?.length) {
            const m = document.getElementById('modal-forum-campo');
            if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
            return;
        }
        conteudo.appendChild(thread._renderComentario(r, 0));
    });
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharSubthreadCampo(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('modal-subthread-campo');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// ── Meus Notes ────────────────────────────────────────────────────────────────

async function carregarMeusNotes() {
    const lista = document.getElementById('lista-meus-notes');
    if (!lista) return;
    lista.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;padding:16px;font-size:13px;">Carregando...</p>';
    try {
        const res  = await fetch('/api/campo/meus-notes/');
        const data = await res.json();
        if (!data.posts.length) {
            lista.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;padding:24px;font-size:13px;">Você ainda não publicou no Campo das Ideias.</p>';
            return;
        }
        lista.innerHTML = data.posts.map(p => `
            <a href="/post/${p.id}/"
               style="display:block;background:rgba(255,255,255,0.08);border-radius:12px;
                      border:1px solid rgba(255,255,255,0.08);padding:12px 16px;
                      text-decoration:none;transition:background 0.2s;"
               onmouseover="this.style.background='rgba(255,255,255,0.15)'"
               onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                    <div style="flex:1;min-width:0;">
                        <h4 style="color:white;font-size:13px;font-weight:600;
                                   white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                                   margin:0 0 2px;">${p.titulo}</h4>
                        <p style="color:rgba(255,255,255,0.45);font-size:11px;margin:0;">
                            ${p.conteudo}</p>
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                        <p style="color:rgba(255,255,255,0.35);font-size:11px;">${p.data}</p>
                        <p style="color:#fb923c;font-size:11px;font-weight:600;margin-top:2px;">
                            ❤️ ${p.curtidas} · 📌 ${p.clips}</p>
                    </div>
                </div>
            </a>`).join('');
    } catch {
        lista.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;font-size:13px;">Erro ao carregar.</p>';
    }
}

// ── Modo Imersivo ─────────────────────────────────────────────────────────────
//
// v5: separado em duas fases:
//   ativarModoImersivo() — só CSS/classes, sem medir DOM
//   ajustarLayout()      — mede alturas reais e posiciona o wrapper

function ativarModoImersivo() {
    document.body.classList.add('campo-mode');

    const nav    = document.getElementById('synapsoo-nav');
    const main   = document.getElementById('synapsoo-main');
    const footer = document.getElementById('synapsoo-footer');

    if (main) {
        main.style.setProperty('max-width', '100%',   'important');
        main.style.setProperty('padding',   '0',      'important');
        main.style.setProperty('margin',    '0 auto', 'important');
        main.style.setProperty('overflow',  'hidden', 'important');
    }

    // FIX #4: zera margin dos filhos diretos do main para eliminar faixa branca
    if (main) {
        Array.from(main.children).forEach(filho => {
            filho.style.setProperty('margin-top',    '0', 'important');
            filho.style.setProperty('margin-bottom', '0', 'important');
        });
    }

    if (nav) {
        nav.style.setProperty('padding-top',    '6px', 'important');
        nav.style.setProperty('padding-bottom', '6px', 'important');
    }

    if (footer) {
        footer.style.setProperty('display', 'none', 'important');
    }

    document.querySelectorAll('.nav-criar').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
    });
    const logo = document.querySelector('.nav-logo');
    if (logo) logo.style.fontSize = '1.25rem';

    document.querySelectorAll('.aba-label').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
    });
    document.querySelectorAll('.aba-nav').forEach(el => {
        el.style.setProperty('padding-top',    '6px', 'important');
        el.style.setProperty('padding-bottom', '6px', 'important');
        el.style.color = 'rgba(255,255,255,0.55)';
    });
    const abaC = document.querySelector('a[href="/?aba=campo"]');
    if (abaC) abaC.style.color = '#fb923c';

    document.body.style.setProperty('overflow', 'hidden', 'important');
}

// FIX #2: ajustarLayout() mede as alturas reais após o browser relayoutar
// e define height + posição do wrapper de forma explícita.
function ajustarLayout() {
    const nav     = document.getElementById('synapsoo-nav');
    const abas    = document.getElementById('barra-abas');
    const wrapper = document.getElementById('campo-grid-wrapper');
    if (!wrapper) return;

    const navH  = nav  ? nav.getBoundingClientRect().height  : 0;

    if (abas) {
        abas.style.setProperty('top', `${navH}px`, 'important');
    }

    const abasH   = abas ? abas.getBoundingClientRect().height : 0;
    const topoWrapper = navH + abasH;
    const altDisp     = window.innerHeight - topoWrapper;

    // Wrapper fixo abaixo das abas — elimina faixa branca e sobreposição
    wrapper.style.setProperty('position', 'fixed',           'important');
    wrapper.style.setProperty('top',      `${topoWrapper}px`,'important');
    wrapper.style.setProperty('left',     '0',               'important');
    wrapper.style.setProperty('right',    '0',               'important');
    wrapper.style.setProperty('height',   `${altDisp}px`,    'important');
    wrapper.style.setProperty('overflow', 'hidden',          'important');

    if (E._navObserver) E._navObserver.disconnect();
    E._navObserver = new ResizeObserver(() => ajustarLayout());
    if (nav)  E._navObserver.observe(nav);
    if (abas) E._navObserver.observe(abas);
}

function desativarModoImersivo() {
    document.body.classList.remove('campo-mode');

    if (E._navObserver) { E._navObserver.disconnect(); E._navObserver = null; }

    const nav     = document.getElementById('synapsoo-nav');
    const main    = document.getElementById('synapsoo-main');
    const abas    = document.getElementById('barra-abas');
    const footer  = document.getElementById('synapsoo-footer');
    const wrapper = document.getElementById('campo-grid-wrapper');  // adicionar

    [nav, main, abas, footer, wrapper].forEach(el => { if (el) el.removeAttribute('style'); });  // wrapper no array

    if (main) {
        Array.from(main.children).forEach(filho => filho.removeAttribute('style'));
    }

    document.querySelectorAll('.aba-label').forEach(el => el.removeAttribute('style'));
    document.querySelectorAll('.aba-nav').forEach(el => el.removeAttribute('style'));
    document.querySelectorAll('.nav-username,.nav-criar,.nav-sair').forEach(el => {
        el.removeAttribute('style');
    });
    const logo = document.querySelector('.nav-logo');
    if (logo) logo.style.fontSize = '';

    document.body.style.removeProperty('overflow');
    E.iniciado = false;
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function mostrarLoading(sim) {
    document.getElementById('campo-loading')?.classList.toggle('hidden', !sim);
}
function mostrarVazio(sim) {
    document.getElementById('campo-vazio')?.classList.toggle('hidden', !sim);
}

// ── Init ──────────────────────────────────────────────────────────────────────


async function init() {
    if (!document.getElementById('campo-grid-wrapper')) return;
    if (E.iniciado) return;
    E.iniciado = true;

    ativarModoImersivo();
    mostrarLoading(true);

    E.VP_COLUNAS   = getNumColunas();
    E.VP_LINHAS    = 2;
    E.origemLinha  = 0;
    E.origemColuna = 0;
    E.dragOffsetX  = {};
    E.dragOffsetY  = {};

    await carregarPool(true);

    if (!E.pool.length) {
        mostrarLoading(false);
        mostrarVazio(true);
        return;
    }

    preencherZona();
    mostrarLoading(false);

    requestAnimationFrame(() => requestAnimationFrame(() => {
        ajustarLayout();
        renderGrid();
        configurarDrag();
    }));

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            E.VP_COLUNAS  = getNumColunas();
            E.dragOffsetX = {};
            E.dragOffsetY = {};
            ajustarLayout();
            preencherZona();
            renderGrid();
            configurarDrag();
        }, 300);
    });
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function registrarCampoGlobal() {
    window.fecharDetalhe        = fecharDetalhe;
    window.fecharSubthreadCampo = fecharSubthreadCampo;
    window.carregarMeusNotes    = carregarMeusNotes;
}

export function iniciarCampo()  { init(); }
export function destruirCampo() { desativarModoImersivo(); }
