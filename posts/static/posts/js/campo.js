// ── campo.js — Rolamento Cubo Mágico ─────────────────────────────────────────
// Matriz 2D crescente infinita. Linhas rolam horizontalmente de forma
// independente. Colunas rolam verticalmente de forma independente.
// Cada célula [row][col] compartilha o mesmo pool global de posts ordenados
// por score. Duplicatas são permitidas — o usuário pode penalizar um card
// repetitivo via dropdown ···, enviando-o para o fim do pool.
//
// Dependências: utils.js → getCsrf

import { getCsrf } from './utils.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const BATCH_SIZE     = 30;   // cards carregados por requisição ao pool
const PREFETCH_AHEAD = 5;    // cards restantes no pool antes de buscar mais
const GAP            = 8;    // px entre cards
const SNAP_DURATION  = '0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
const EVAPORATE_MS   = 1800; // duração do fade-out ao penalizar card

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

const _estado = {
    // Matriz esparsa: _estado.celula[row][col] = card
    celula:      {},

    // Pool global de cards já carregados do backend
    pool:        [],
    poolOffset:  0,   // próximo índice a consumir do pool local
    totalPool:   0,   // total de posts disponíveis no backend
    temMais:     true,
    carregandoPool: false,

    // Offsets de deslocamento (em número de cards, não pixels)
    offsetLinha:  [],   // offsetLinha[row]  = colunas deslocadas à esquerda
    offsetColuna: [],   // offsetColuna[col] = linhas deslocadas para cima

    // Dimensões
    numLinhas:  2,
    numColunas: 5,
    cardWidth:  280,
    cardHeight: 392,

    // Controle de drag
    drag: {
        ativo:      false,
        eixo:       null,      // 'x' | 'y'
        startX:     0,
        startY:     0,
        startOff:   0,
        alvo:       null,      // índice da linha ou coluna arrastada
        tempoInicio: 0,
        arrastou:   false,
    },

    // Cards penalizados pelo usuário nesta sessão
    penalizados: new Set(),

    iniciado: false,
};

// ── Pool — carregamento ───────────────────────────────────────────────────────

async function _carregarPool(forcar = false) {
    if (_estado.carregandoPool) return;
    if (!forcar && !_estado.temMais) return;

    _estado.carregandoPool = true;
    try {
        const offset = _estado.pool.length;
        const res    = await fetch(
            `/api/campo/pool/?offset=${offset}&limit=${BATCH_SIZE}`
        );
        const data   = await res.json();

        _estado.pool      = _estado.pool.concat(data.cards);
        _estado.totalPool = data.total;
        _estado.temMais   = data.tem_mais;
    } catch (e) {
        console.error('[CuboMagico] Erro ao carregar pool:', e);
    } finally {
        _estado.carregandoPool = false;
    }
}

// Retorna o próximo card do pool (consome o índice)
function _proximoCard() {
    if (_estado.poolOffset >= _estado.pool.length) return null;
    const card = _estado.pool[_estado.poolOffset];
    _estado.poolOffset++;

    // Pré-carrega mais quando estiver quase no fim
    const restantes = _estado.pool.length - _estado.poolOffset;
    if (restantes <= PREFETCH_AHEAD && _estado.temMais) {
        _carregarPool();
    }

    return card;
}

// ── Matriz — acesso e preenchimento ──────────────────────────────────────────

function _getCell(row, col) {
    return _estado.celula[row]?.[col] ?? null;
}

function _setCell(row, col, card) {
    if (!_estado.celula[row]) _estado.celula[row] = {};
    _estado.celula[row][col] = card;
}

// Garante que uma célula tem card; se não tiver, consome do pool
function _garantirCell(row, col) {
    if (!_getCell(row, col)) {
        const card = _proximoCard();
        if (card) _setCell(row, col, card);
    }
    return _getCell(row, col);
}

// Preenche todas as células visíveis da matriz
function _preencherMatrizVisivel() {
    for (let r = 0; r < _estado.numLinhas; r++) {
        for (let c = 0; c < _estado.numColunas; c++) {
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

    const { width, height } = _getDimensoesCard(_estado.numColunas);
    _estado.cardWidth  = width;
    _estado.cardHeight = height;

    const alturaViewport = (height * _estado.numLinhas) + (GAP * (_estado.numLinhas - 1));
    viewport.style.height   = `${alturaViewport}px`;
    viewport.style.overflow = 'hidden';
    viewport.style.position = 'relative';

    grid.innerHTML      = '';
    grid.style.display  = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap      = `${GAP}px`;
    grid.style.willChange = 'transform';

    for (let r = 0; r < _estado.numLinhas; r++) {
        const linhaEl = _criarLinhaEl(r);
        grid.appendChild(linhaEl);
    }
}

function _criarLinhaEl(row) {
    const linhaEl = document.createElement('div');
    linhaEl.id              = `campo-linha-${row}`;
    linhaEl.className       = 'campo-linha';
    linhaEl.style.cssText   = `
        display: flex;
        flex-direction: row;
        gap: ${GAP}px;
        flex-shrink: 0;
        height: ${_estado.cardHeight}px;
        transform: translateX(0px);
        will-change: transform;
    `;

    for (let c = 0; c < _estado.numColunas; c++) {
        const card = _getCell(row, c);
        if (card) linhaEl.appendChild(_criarCardEl(card, row, c));
    }

    return linhaEl;
}

// Atualiza apenas o translateX de uma linha (sem recriar o DOM)
function _aplicarOffsetLinha(row, offsetPx, transicao = false) {
    const linhaEl = document.getElementById(`campo-linha-${row}`);
    if (!linhaEl) return;
    linhaEl.style.transition = transicao
        ? `transform ${SNAP_DURATION}`
        : 'none';
    linhaEl.style.transform = `translateX(${offsetPx}px)`;
}

// ── Card element ──────────────────────────────────────────────────────────────

function _criarCardEl(card, row, col) {
    const el = document.createElement('div');
    el.className      = 'campo-card';
    el.dataset.id     = card.id;
    el.dataset.row    = row;
    el.dataset.col    = col;
    el.dataset.username = card.username || '';
    el.dataset.arrastou = 'false';
    el.style.cssText  = `
        width: ${_estado.cardWidth}px;
        height: ${_estado.cardHeight}px;
        flex-shrink: 0;
        border-radius: 16px;
        overflow: hidden;
        position: relative;
        cursor: pointer;
        transition: opacity ${EVAPORATE_MS}ms ease;
    `;

    const bg = card.imagem_capa
        ? `<img src="${card.imagem_capa}"
               style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
               alt="" draggable="false">`
        : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${card.cor}cc,${card.cor}44);"></div>`;

    const cats = card.categorias.slice(0, 2).map(c =>
        `<span style="
            font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;
            background:${c.cor}40;color:${c.cor};border:1px solid ${c.cor}60;
            backdrop-filter:blur(4px);
        ">${c.nome}</span>`
    ).join('');

    const avatar = card.foto_autor
        ? `<img src="${card.foto_autor}"
               style="width:22px;height:22px;border-radius:50%;object-fit:cover;"
               alt="" draggable="false">`
        : `<div style="
               width:22px;height:22px;border-radius:50%;
               background:rgba(255,255,255,0.2);
               display:flex;align-items:center;justify-content:center;
               color:white;font-weight:700;font-size:11px;
           ">${(card.autor || '?').charAt(0).toUpperCase()}</div>`;

    // Dropdown ··· — só para cards de outros autores
    const ehProprioCard = _ehProprioAutor(card.username);
    const dropdown = ehProprioCard ? '' : _htmlDropdown(card);

    el.innerHTML = `
        ${bg}
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.28) 55%,transparent 100%);"></div>
        ${card.procura_mod
            ? `<div style="
                   position:absolute;top:8px;right:8px;
                   background:#f97316;color:white;
                   font-size:11px;padding:2px 8px;border-radius:999px;
                   font-weight:600;
               ">🤝 Procura Mod</div>`
            : ''}
        <div style="position:absolute;inset-inline:0;bottom:0;padding:12px;">
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">${cats}</div>
            <h3 style="
                color:white;font-weight:700;font-size:13px;
                line-height:1.35;margin:0 0 6px;
                display:-webkit-box;-webkit-line-clamp:2;
                -webkit-box-orient:vertical;overflow:hidden;
            ">${card.titulo_capa || card.titulo}</h3>
            <p style="
                color:rgba(255,255,255,0.65);font-size:11px;line-height:1.5;
                margin:0 0 8px;
                display:-webkit-box;-webkit-line-clamp:2;
                -webkit-box-orient:vertical;overflow:hidden;
            ">${card.conteudo}</p>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:6px;">
                    ${avatar}
                    <span style="color:rgba(255,255,255,0.65);font-size:11px;">${card.autor}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;color:rgba(255,255,255,0.55);font-size:11px;">
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
        const config = JSON.parse(
            document.getElementById('bn-config')?.textContent || '{}'
        );
        return config.meUsername && config.meUsername === username;
    } catch {
        return false;
    }
}

// ── Dropdown ··· ──────────────────────────────────────────────────────────────

function _htmlDropdown(card) {
    return `
        <div class="card-menu-wrap" style="
            position:absolute;bottom:12px;right:12px;
            z-index:10;
        ">
            <!-- Botão ··· -->
            <button class="card-menu-btn" data-card-id="${card.id}"
                    aria-label="Opções do card"
                    style="
                        background:rgba(0,0,0,0.35);
                        border:1px solid rgba(255,255,255,0.15);
                        color:rgba(255,255,255,0.55);
                        border-radius:999px;
                        width:28px;height:28px;
                        display:flex;align-items:center;justify-content:center;
                        font-size:14px;font-weight:700;letter-spacing:1px;
                        cursor:pointer;
                        backdrop-filter:blur(6px);
                        transition:color 0.2s, transform 0.2s, background 0.2s;
                        padding:0;
                    ">···</button>

            <!-- Dropdown -->
            <div class="card-menu-dropdown" style="
                display:none;
                position:absolute;bottom:34px;right:0;
                background:rgba(15,10,30,0.92);
                border:1px solid rgba(255,255,255,0.10);
                border-radius:12px;
                padding:6px;
                min-width:190px;
                backdrop-filter:blur(16px);
                box-shadow:0 8px 32px rgba(0,0,0,0.4);
                overflow:hidden;
            ">
                <button class="card-menu-item" data-action="repetitivo" data-post-id="${card.id}"
                        style="${_estiloItemDropdown()}">
                    🔁 Post repetitivo
                </button>
                <button class="card-menu-item" data-action="ver" data-post-id="${card.id}"
                        style="${_estiloItemDropdown()}">
                    ⛶ Ver post completo
                </button>
                <button class="card-menu-item" data-action="seguir"
                        data-username="${card.username}"
                        data-post-id="${card.id}"
                        style="${_estiloItemDropdown()}">
                    ➕ Seguir autor
                </button>
                <div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>
                <button class="card-menu-item" data-action="reportar" data-post-id="${card.id}"
                        style="${_estiloItemDropdown('rgba(239,68,68,0.15)', '#ef4444')}">
                    🚩 Reportar
                </button>
            </div>
        </div>
    `;
}

function _estiloItemDropdown(bg = 'transparent', cor = 'rgba(255,255,255,0.80)') {
    return `
        display:block;width:100%;text-align:left;
        background:${bg};color:${cor};
        border:none;border-radius:8px;
        padding:8px 12px;font-size:12px;font-weight:500;
        cursor:pointer;transition:background 0.15s;
        font-family:'Poppins',sans-serif;
        white-space:nowrap;
    `;
}

// ── Eventos do card ───────────────────────────────────────────────────────────

function _registrarEventosCard(el, card) {
    // Hover no botão ···
    const btn = el.querySelector('.card-menu-btn');
    const dd  = el.querySelector('.card-menu-dropdown');

    if (btn && dd) {
        // Hover acende e escala levemente
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

        // Toggle dropdown ao clicar
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const aberto = dd.style.display === 'block';
            _fecharTodosDropdowns();
            if (!aberto) dd.style.display = 'block';
        });

        // Hover nos itens do dropdown
        dd.querySelectorAll('.card-menu-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = item.dataset.action === 'reportar'
                    ? 'rgba(239,68,68,0.25)'
                    : 'rgba(255,255,255,0.08)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = item.dataset.action === 'reportar'
                    ? 'rgba(239,68,68,0.15)'
                    : 'transparent';
            });

            // Ações do dropdown
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                _fecharTodosDropdowns();
                _executarAcaoDropdown(item.dataset.action, card, el);
            });
        });
    }

    // Click no card (abre detalhe)
    let cliques = 0, timerClique = null;
    el.addEventListener('click', (e) => {
        if (e.target.closest('.card-menu-wrap')) return;
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

function _fecharTodosDropdowns() {
    document.querySelectorAll('.card-menu-dropdown').forEach(d => {
        d.style.display = 'none';
    });
}

// Fecha dropdowns ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-menu-wrap')) {
        _fecharTodosDropdowns();
    }
});

// ── Ações do dropdown ─────────────────────────────────────────────────────────

async function _executarAcaoDropdown(acao, card, cardEl) {
    switch (acao) {

        case 'repetitivo':
            await _penalizarCard(card, cardEl);
            break;

        case 'ver':
            abrirDetalhe(card);
            break;

        case 'seguir':
            await _seguirAutor(card, cardEl);
            break;

        case 'reportar':
            _mostrarToast('🚩 Obrigado pelo feedback!');
            break;
    }
}

// ── Penalizar card (repetitivo) ───────────────────────────────────────────────

async function _penalizarCard(card, cardEl) {
    try {
        await fetch('/api/campo/penalizar-card/', {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken':  getCsrf(),
            },
            body: JSON.stringify({ post_id: card.id }),
        });
    } catch (e) {
        console.error('[CuboMagico] Erro ao penalizar card:', e);
    }

    _estado.penalizados.add(card.id);

    // Evaporar o card
    cardEl.style.opacity  = '0';
    cardEl.style.transition = `opacity ${EVAPORATE_MS}ms ease`;

    setTimeout(() => {
        const row  = parseInt(cardEl.dataset.row);
        const col  = parseInt(cardEl.dataset.col);
        const prox = _proximoCard();
        if (prox) {
            _setCell(row, col, prox);
            const novoEl = _criarCardEl(prox, row, col);
            cardEl.replaceWith(novoEl);
        } else {
            cardEl.remove();
        }
    }, EVAPORATE_MS);
}

// ── Seguir autor ──────────────────────────────────────────────────────────────

async function _seguirAutor(card, cardEl) {
    try {
        await fetch(`/perfil/${card.username}/seguir/`, {
            method:  'POST',
            headers: { 'X-CSRFToken': getCsrf() },
        });

        // Atualiza o item do dropdown para "Seguindo ✓"
        const btnSeguir = cardEl.querySelector('[data-action="seguir"]');
        if (btnSeguir) {
            btnSeguir.textContent = '✓ Seguindo';
            btnSeguir.disabled    = true;
            btnSeguir.style.opacity = '0.5';
            btnSeguir.style.cursor  = 'default';
        }
    } catch (e) {
        console.error('[CuboMagico] Erro ao seguir autor:', e);
    }
}

// ── Drag — detecção de eixo, linha e coluna ───────────────────────────────────

function _configurarDrag() {
    const viewport = document.getElementById('campo-viewport');
    if (!viewport) return;

    const drag = _estado.drag;

    function _getLinhaIndex(clientY) {
        const rect = viewport.getBoundingClientRect();
        const relY = clientY - rect.top;
        const step = _estado.cardHeight + GAP;
        return Math.max(0, Math.min(
            Math.floor(relY / step),
            _estado.numLinhas - 1
        ));
    }

    function _getColunaIndex(clientX) {
        const rect = viewport.getBoundingClientRect();
        const relX = clientX - rect.left;
        const step = _estado.cardWidth + GAP;
        return Math.max(0, Math.min(
            Math.floor(relX / step),
            _estado.numColunas - 1
        ));
    }

    function _iniciarDrag(x, y) {
        drag.ativo       = true;
        drag.arrastou    = false;
        drag.startX      = x;
        drag.startY      = y;
        drag.eixo        = null;
        drag.tempoInicio = Date.now();

        // Detecta linha E coluna no ponto de início
        drag.linhaIndex  = _getLinhaIndex(y);
        drag.colunaIndex = _getColunaIndex(x);
        drag.startOff    = 0; // será definido quando o eixo for detectado

        viewport.style.cursor = 'grabbing';
    }

    function _moverDrag(x, y) {
        if (!drag.ativo) return;

        const dx = x - drag.startX;
        const dy = y - drag.startY;

        // Detecta eixo dominante
        if (!drag.eixo && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            drag.eixo = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';

            if (drag.eixo === 'x') {
                drag.alvo     = drag.linhaIndex;
                drag.startOff = _offsetPixelLinha(drag.alvo);
            } else {
                drag.alvo     = drag.colunaIndex;
                drag.startOff = _offsetPixelColuna(drag.alvo);
            }
        }

        if (!drag.eixo) return;
        drag.arrastou = true;

        if (drag.eixo === 'x') {
            // Move a linha horizontalmente
            const novoOff = drag.startOff + dx;
            _aplicarOffsetLinhaPx(drag.alvo, novoOff, false);
        } else {
            // Move a coluna verticalmente — desloca cada linha no ponto da coluna
            const novoOff = drag.startOff + dy;
            _aplicarOffsetColunaPx(drag.alvo, novoOff, false);
        }
    }

    function _finalizarDrag(x, y) {
        if (!drag.ativo) return;
        drag.ativo    = false;
        viewport.style.cursor = 'grab';

        const dx    = x - drag.startX;
        const dy    = y - drag.startY;
        const tempo = Date.now() - drag.tempoInicio;

        if (drag.arrastou) {
            // Marca cards da linha/coluna como arrastados para suprimir click
            _marcarArrastados(drag.eixo, drag.alvo);
        }

        if (drag.eixo === 'x' && drag.alvo !== null) {
            _snapLinha(drag.alvo);
            // Registra interação de direção
            const card = _cardNoCentro(drag.alvo, 'linha');
            if (card) _registrarInteracao(card.id, dx > 0 ? 'right' : 'left', tempo);
        }

        if (drag.eixo === 'y' && drag.alvo !== null) {
            _snapColuna(drag.alvo);
            const card = _cardNoCentro(drag.alvo, 'coluna');
            if (card) _registrarInteracao(card.id, dy > 0 ? 'down' : 'up', tempo);
        }
    }

    // Mouse
    viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.card-menu-wrap')) return;
        _iniciarDrag(e.clientX, e.clientY);
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => _moverDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup',   (e) => _finalizarDrag(e.clientX, e.clientY));

    // Touch
    viewport.addEventListener('touchstart', (e) => {
        if (e.target.closest('.card-menu-wrap')) return;
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

function _marcarArrastados(eixo, alvo) {
    let seletor;
    if (eixo === 'x') {
        seletor = `#campo-linha-${alvo} .campo-card`;
    } else {
        // Para coluna: marca todos os cards naquela posição col em cada linha
        seletor = `.campo-card[data-col="${alvo}"]`;
    }
    document.querySelectorAll(seletor).forEach(el => {
        el.dataset.arrastou = 'true';
        setTimeout(() => { el.dataset.arrastou = 'false'; }, 60);
    });
}

function _cardNoCentro(alvo, eixo) {
    if (eixo === 'linha') {
        const colCenter = Math.floor(_estado.numColunas / 2);
        return _getCell(alvo, colCenter);
    } else {
        const rowCenter = Math.floor(_estado.numLinhas / 2);
        return _getCell(rowCenter, alvo);
    }
}

// ── Offset em pixels ──────────────────────────────────────────────────────────

function _stepLinha() { return _estado.cardWidth  + GAP; }
function _stepColuna() { return _estado.cardHeight + GAP; }

function _offsetPixelLinha(row) {
    return -(_estado.offsetLinha[row] ?? 0) * _stepLinha();
}

function _offsetPixelColuna(col) {
    return -(_estado.offsetColuna[col] ?? 0) * _stepColuna();
}

function _aplicarOffsetLinhaPx(row, px, transicao) {
    _aplicarOffsetLinha(row, px, transicao);
}

function _aplicarOffsetColunaPx(col, py, transicao) {
    // Movimento vertical de coluna: desloca cada linha na posição visual da coluna
    // O efeito é obtido ajustando a posição translateY dos cards daquela coluna
    // em cada linha. Como as linhas têm translateX independente, aplicamos
    // um atributo de offset vertical por coluna via CSS custom property.
    for (let r = 0; r < _estado.numLinhas; r++) {
        const cardEl = document.querySelector(
            `#campo-linha-${r} .campo-card[data-col="${col}"]`
        );
        if (cardEl) {
            cardEl.style.transition = transicao ? `transform ${SNAP_DURATION}` : 'none';
            cardEl.style.transform  = `translateY(${py}px)`;
        }
    }
}

// ── Snap por linha (eixo X) ───────────────────────────────────────────────────

function _snapLinha(row) {
    const step      = _stepLinha();
    const offsetPx  = _offsetPixelLinha(row);
    const linhaEl   = document.getElementById(`campo-linha-${row}`);
    if (!linhaEl) return;

    // Detecta o offset atual a partir do transform inline do drag
    const match = linhaEl.style.transform.match(/translateX\((-?[\d.]+)px\)/);
    const atual = match ? parseFloat(match[1]) : offsetPx;

    const maxOffsetCards = Math.max(0, _totalCardsLinha(row) - _estado.numColunas);
    const minPx = -(maxOffsetCards * step);
    const maxPx = 0;

    let snapPx = Math.round(atual / step) * step;
    snapPx     = Math.max(minPx, Math.min(maxPx, snapPx));

    const novoOffsetCards = Math.round(-snapPx / step);
    _estado.offsetLinha[row] = novoOffsetCards;

    _aplicarOffsetLinha(row, snapPx, true);

    // Expande a matriz se chegou perto do fim
    if (snapPx <= minPx + step) {
        _expandirMatrizHorizontal(row);
    }
}

// ── Snap por coluna (eixo Y) ──────────────────────────────────────────────────

function _snapColuna(col) {
    const step = _stepColuna();

    // Detecta o deslocamento atual do primeiro card da coluna
    const primeiroCard = document.querySelector(
        `#campo-linha-0 .campo-card[data-col="${col}"]`
    );
    if (!primeiroCard) return;

    const match = primeiroCard.style.transform.match(/translateY\((-?[\d.]+)px\)/);
    const atual = match ? parseFloat(match[1]) : 0;

    const maxOffsetCards = Math.max(0, _totalCardsColuna(col) - _estado.numLinhas);
    const minPy = -(maxOffsetCards * step);
    const maxPy = 0;

    let snapPy = Math.round(atual / step) * step;
    snapPy     = Math.max(minPy, Math.min(maxPy, snapPy));

    const novoOffsetCards = Math.round(-snapPy / step);
    _estado.offsetColuna[col] = novoOffsetCards;

    _aplicarOffsetColunaPx(col, snapPy, true);

    // Expande a matriz se chegou perto do fim vertical
    if (snapPy <= minPy + step) {
        _expandirMatrizVertical(col);
    }
}

// ── Expansão da matriz ────────────────────────────────────────────────────────

// Adiciona uma nova coluna à direita quando a linha chega no fim
function _expandirMatrizHorizontal(row) {
    const novaCol = _totalCardsLinha(row);

    // Preenche a nova coluna em todas as linhas
    for (let r = 0; r < _estado.numLinhas; r++) {
        _garantirCell(r, novaCol);
    }

    // Adiciona o card da nova coluna ao DOM de cada linha
    for (let r = 0; r < _estado.numLinhas; r++) {
        const card    = _getCell(r, novaCol);
        const linhaEl = document.getElementById(`campo-linha-${r}`);
        if (card && linhaEl) {
            linhaEl.appendChild(_criarCardEl(card, r, novaCol));
        }
    }
}

// Adiciona uma nova linha abaixo quando a coluna chega no fim
function _expandirMatrizVertical(col) {
    const novaRow = _totalCardsColuna(col);

    // Preenche a nova linha em todas as colunas
    for (let c = 0; c < _estado.numColunas; c++) {
        _garantirCell(novaRow, c);
    }

    // Cria o elemento da nova linha e adiciona ao grid
    const grid    = document.getElementById('campo-grid');
    const novaLinhaEl = _criarLinhaEl(novaRow);
    if (grid) grid.appendChild(novaLinhaEl);

    // Atualiza o número de linhas
    _estado.numLinhas = novaRow + 1;
    _estado.offsetLinha.push(0);
}

// ── Contagem de cards por linha/coluna ────────────────────────────────────────

function _totalCardsLinha(row) {
    return Object.keys(_estado.celula[row] ?? {}).length;
}

function _totalCardsColuna(col) {
    let total = 0;
    for (const row in _estado.celula) {
        if (_estado.celula[row][col] !== undefined) total++;
    }
    return total;
}

// ── Navegação por botões ──────────────────────────────────────────────────────

function moverLinha(rowIndex, direcao) {
    const linha = _estado.offsetLinha;
    if (!linha) return;
    _estado.offsetLinha[rowIndex] = (_estado.offsetLinha[rowIndex] ?? 0) +
        (direcao === 'esquerda' ? 1 : -1);
    _estado.offsetLinha[rowIndex] = Math.max(0, _estado.offsetLinha[rowIndex]);
    const px = -(_estado.offsetLinha[rowIndex] * _stepLinha());
    _aplicarOffsetLinha(rowIndex, px, true);
    if (direcao === 'esquerda') _expandirMatrizHorizontal(rowIndex);
}

// ── Interação ─────────────────────────────────────────────────────────────────

async function _registrarInteracao(postId, direcao, tempoMs) {
    try {
        await fetch('/api/campo/interacao/', {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken':  getCsrf(),
            },
            body: JSON.stringify({ post_id: postId, direcao, tempo_ms: tempoMs }),
        });
    } catch { /* silencioso */ }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function _mostrarToast(mensagem) {
    const toast = document.createElement('div');
    toast.textContent = mensagem;
    toast.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:rgba(15,10,30,0.92);color:white;
        padding:10px 20px;border-radius:999px;
        font-size:13px;font-family:'Poppins',sans-serif;
        backdrop-filter:blur(12px);
        border:1px solid rgba(255,255,255,0.12);
        z-index:999999;
        opacity:0;transition:opacity 0.3s;
        pointer-events:none;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
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
            `<img src="${card.imagem_capa}" style="width:100%;height:224px;object-fit:cover;" alt="">`;
        document.getElementById('detalhe-titulo-capa').textContent = card.titulo_capa || card.titulo;
        capaWrapper.classList.remove('hidden');
    } else {
        capaWrapper.classList.add('hidden');
    }

    document.getElementById('detalhe-cats').innerHTML = card.categorias.map(c =>
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
               class="block bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4
                      hover:border-orange-200 transition">
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

async function _init() {
    if (!document.getElementById('campo-grid-wrapper')) return;
    if (_estado.iniciado) return;
    _estado.iniciado = true;

    _mostrarLoading(true);

    // Inicializa offsets
    const numColunas     = _getNumColunas();
    _estado.numColunas   = numColunas;
    _estado.numLinhas    = 2;
    _estado.offsetLinha  = Array(_estado.numLinhas).fill(0);
    _estado.offsetColuna = Array(numColunas).fill(0);

    // Carrega pool inicial
    await _carregarPool(true);

    if (!_estado.pool.length) {
        _mostrarLoading(false);
        _mostrarVazio(true);
        return;
    }

    // Preenche matriz inicial
    _preencherMatrizVisivel();

    _mostrarLoading(false);
    _renderizarGrid();
    _configurarDrag();

    // Resize: recalcula dimensões sem recarregar pool
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            _estado.numColunas   = _getNumColunas();
            _estado.offsetColuna = Array(_estado.numColunas).fill(0);
            _preencherMatrizVisivel();
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
