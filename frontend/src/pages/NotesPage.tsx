import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { colors, typography } from '../design/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Categoria {
  nome: string
  cor: string
}

interface Note {
  id: number
  titulo: string
  titulo_capa: string
  conteudo: string
  cor: string
  data: string
  imagem_capa: string | null
  categorias: Categoria[]
  curtidas: number
  clips: number
  url_editar: string
  url_detalhe: string
  canvas_x: number
  canvas_y: number
  canvas_ordem: number
}

interface Bloco {
  id: number
  nome: string
  card_ids: number[]
  cards: Note[]
  canvas_x: number
  canvas_y: number
  canvas_ordem: number
}

interface DropdownPos {
  top: number
  left: number
  openUp: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_W            = 260
const CARD_H            = 220
const GRID_COL          = 280
const GRID_ROW          = 260
const ZOOM_MIN          = 0.35
const ZOOM_MAX          = 2.0
const ZOOM_STEP         = 0.12
const ZOOM_DEFAULT      = 1.0
const BUFFER_PX         = 300
const CANVAS_GAP        = 48
const TOWER_MAX_VISIBLE = 7
const TOWER_OFFSET_X    = 2
const TOWER_OFFSET_Y    = 2.5
// Prendedor: o corpo fica sobre a borda superior do card frontal
const CLIP_OVERLAP      = 17
// Altura da parte que fica acima do card (arames + header)
const HEADER_H          = 36

const PALETA_BASE = [
  { hex: '#F59E0B', nome: 'Ambar' },
  { hex: '#EF4444', nome: 'Vermelho' },
  { hex: '#EC4899', nome: 'Rosa' },
  { hex: '#8B5CF6', nome: 'Roxo' },
  { hex: '#3B82F6', nome: 'Azul' },
  { hex: '#06B6D4', nome: 'Ciano' },
  { hex: '#10B981', nome: 'Verde' },
  { hex: '#84CC16', nome: 'Lima' },
  { hex: '#F97316', nome: 'Laranja' },
  { hex: '#14B8A6', nome: 'Turquesa' },
  { hex: '#6B7280', nome: 'Cinza' },
]

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function snapToGrid(x: number, y: number) {
  return { x: Math.round(x / GRID_COL) * GRID_COL, y: Math.round(y / GRID_ROW) * GRID_ROW }
}

function celulaOcupada(
  notes: Note[],
  blocos: Bloco[],
  sx: number,
  sy: number,
  ignorarNoteId: number | null,
  ignorarBlocoId: number | null,
) {
  const noteOcupa = notes.some(
    n =>
      n.id !== ignorarNoteId &&
      Math.round(n.canvas_x / GRID_COL) === Math.round(sx / GRID_COL) &&
      Math.round(n.canvas_y / GRID_ROW) === Math.round(sy / GRID_ROW),
  )
  const blocoOcupa = blocos.some(
    b =>
      b.id !== ignorarBlocoId &&
      Math.round(b.canvas_x / GRID_COL) === Math.round(sx / GRID_COL) &&
      Math.round(b.canvas_y / GRID_ROW) === Math.round(sy / GRID_ROW),
  )
  return noteOcupa || blocoOcupa
}

function proximaPosicaoLivre(notes: Note[], blocos: Bloco[]) {
  const COLS_POR_LINHA = 6

  const ocupadas = new Set<string>()
  for (const n of notes) {
    const col = Math.round(n.canvas_x / GRID_COL)
    const lin = Math.round(n.canvas_y / GRID_ROW)
    ocupadas.add(`${col},${lin}`)
  }
  for (const b of blocos) {
    const col = Math.round(b.canvas_x / GRID_COL)
    const lin = Math.round(b.canvas_y / GRID_ROW)
    ocupadas.add(`${col},${lin}`)
  }

  for (let lin = 0; lin < 9999; lin++) {
    for (let col = 0; col < COLS_POR_LINHA; col++) {
      if (!ocupadas.has(`${col},${lin}`)) {
        return { x: col * GRID_COL, y: lin * GRID_ROW }
      }
    }
  }
  return { x: 0, y: 0 }
}

function ajustarLuminosidade(hex: string, lum: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = max > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  const L = Math.max(0.15, Math.min(0.85, lum))
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let nr: number, ng: number, nb: number
  if (s === 0) {
    nr = ng = nb = L
  } else {
    const q2 = L < 0.5 ? L * (1 + s) : L + s - L * s
    const p2  = 2 * L - q2
    nr = hue2rgb(p2, q2, h + 1 / 3)
    ng = hue2rgb(p2, q2, h)
    nb = hue2rgb(p2, q2, h - 1 / 3)
  }
  const th = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${th(nr)}${th(ng)}${th(nb)}`
}

function getLuminosidadeBase(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

function isEscuro(hex: string) {
  if (!hex || hex === '#ffffff') return false
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b < 0.6
}

function getCsrf() {
  const c = document.cookie.split(';').find(c => c.trim().startsWith('csrftoken='))
  return c ? c.split('=')[1] : ''
}

function maxOrdemAtual(notes: Note[], blocos: Bloco[]) {
  const ordens = [
    ...notes.map(n => n.canvas_ordem),
    ...blocos.map(b => b.canvas_ordem),
  ]
  return ordens.length > 0 ? Math.max(...ordens) : 0
}

// ─── SVG Components ───────────────────────────────────────────────────────────

function PrendedorSVG({ width = 32 }: { width?: number }) {
  const h = width * 1.1
  return (
    <svg width={width} height={h} viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Corpo metálico (a parte que fica sobre o card) */}
      <rect x="8" y="55" width="84" height="44" rx="5" fill="#1a1a1a" />
      <rect x="8" y="55" width="84" height="10" rx="3" fill="#111111" />
      <rect x="12" y="91" width="28" height="8" rx="3" fill="#111111" />
      <rect x="60" y="91" width="28" height="8" rx="3" fill="#111111" />
      {/* Arames (ficam acima do card) */}
      <path
        d="M35 55 C35 35 28 15 50 5 C72 15 65 35 65 55"
        stroke="#c0c0c0"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M35 55 C35 35 28 15 50 5 C72 15 65 35 65 55"
        stroke="#e8e8e8"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
    </svg>
  )
}

function LapisSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

// ─── Dropdown do card (position: fixed, nunca cortado) ────────────────────────

interface CardDropdownProps {
  cardId: number
  pos: DropdownPos | null
  blocos: Bloco[]
  zoom: number
  onFormarBloco: () => void
  onCliparEmBloco: (blocoId: number) => void
  onEnviarFeed: () => void
  onEnviarCampo: () => void
  onEditar: () => void
  onExcluir: () => void
  onFechar: () => void
}

function CardDropdown({
  pos, blocos, zoom,
  onFormarBloco, onCliparEmBloco,
  onEnviarFeed, onEnviarCampo, onEditar, onExcluir, onFechar,
}: CardDropdownProps) {
  const [cliparPos, setCliparPos] = useState<{ top: number; left: number } | null>(null)
  const cliparBtnRef = useRef<HTMLButtonElement>(null)

  if (!pos) return null

  const itemStyle = (danger = false): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    textAlign: 'left',
    padding: '6px 12px',
    background: 'transparent',
    border: 'none',
    color: danger ? '#f87171' : '#e2e8f0',
    fontSize: 12,
    fontFamily: typography.fontFamily.primary,
    cursor: 'pointer',
    transition: 'transform 0.12s ease, background 0.12s ease',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  })

  function onItemEnter(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.transform = 'translateX(3px)'
    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
  }
  function onItemLeave(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.transform = 'translateX(0)'
    e.currentTarget.style.background = 'transparent'
  }

  function abrirClipar(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (cliparPos) { setCliparPos(null); return }
    const r = cliparBtnRef.current?.getBoundingClientRect()
    if (!r) return
    const sairaDireita = r.right + 4 + 180 > window.innerWidth
    setCliparPos({ top: r.top, left: sairaDireita ? r.left - 184 : r.right + 4 })
  }

  const top = pos.openUp ? undefined : pos.top
  const bot = pos.openUp ? window.innerHeight - pos.top : undefined

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onMouseDown={e => { e.stopPropagation(); onFechar(); setCliparPos(null) }}
      />

      <div
        style={{
          position: 'fixed',
          top,
          bottom: bot,
          left: pos.left,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          background: '#141420',
          borderRadius: 12,
          padding: '5px 4px',
          minWidth: 196,
          boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,255,255,0.08)',
          zIndex: 9999,
          animation: 'dropdownOpen 0.14s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {([
          { icon: '✏️', label: 'Editar', action: () => { onEditar(); onFechar() } },
          { icon: '💡', label: 'Enviar para o Feed', action: () => { onEnviarFeed(); onFechar() } },
          { icon: '🌐', label: 'Enviar para o Campo', action: () => { onEnviarCampo(); onFechar() } },
        ] as const).map((item, i) => (
          <button
            key={i}
            style={itemStyle()}
            onClick={e => { e.stopPropagation(); item.action() }}
            onMouseEnter={onItemEnter}
            onMouseLeave={onItemLeave}
          >
            <span style={{ fontSize: 12 }}>{item.icon}</span> {item.label}
          </button>
        ))}

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 8px' }} />

        <button
          style={itemStyle()}
          onClick={e => { e.stopPropagation(); onFormarBloco(); onFechar() }}
          onMouseEnter={onItemEnter}
          onMouseLeave={onItemLeave}
        >
          <span style={{ fontSize: 12 }}>🧱</span> Formar bloco
        </button>

        {blocos.length > 0 && (
          <button
            ref={cliparBtnRef}
            style={{ ...itemStyle(), justifyContent: 'space-between' }}
            onClick={abrirClipar}
            onMouseEnter={onItemEnter}
            onMouseLeave={onItemLeave}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12 }}>📎</span> Clipar em bloco
            </span>
            <span style={{ fontSize: 10, opacity: 0.45 }}>›</span>
          </button>
        )}

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 8px' }} />

        <button
          style={itemStyle(true)}
          onClick={e => { e.stopPropagation(); onExcluir(); onFechar() }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(3px)'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: 12 }}>🗑️</span> Excluir
        </button>
      </div>

      {cliparPos && (
        <div
          style={{
            position: 'fixed',
            top: cliparPos.top,
            left: cliparPos.left,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            background: '#141420',
            borderRadius: 12,
            padding: '5px 4px',
            minWidth: 172,
            boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
            border: '1px solid rgba(255,255,255,0.08)',
            zIndex: 10000,
            animation: 'dropdownOpen 0.12s cubic-bezier(0.34,1.56,0.64,1) forwards',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '3px 10px 5px', margin: 0 }}>
            Escolher bloco
          </p>
          {blocos.map(b => (
            <button
              key={b.id}
              style={itemStyle()}
              onClick={e => { e.stopPropagation(); onCliparEmBloco(b.id); onFechar(); setCliparPos(null) }}
              onMouseEnter={onItemEnter}
              onMouseLeave={onItemLeave}
            >
              <span style={{ fontSize: 11 }}>🗂</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{b.nome}</span>
            </button>
          ))}
        </div>
      )}
    </>,
    document.body
  )
}

// ─── Dropdown do bloco ────────────────────────────────────────────────────────

interface BlocoDropdownProps {
  pos: DropdownPos | null
  zoom: number
  onTrabalhar: () => void
  onDesfazer: () => void
  onDestruir: () => void
  onFechar: () => void
}


function BlocoDropdown({ pos, zoom, onTrabalhar, onDesfazer, onDestruir, onFechar }: BlocoDropdownProps) {
  if (!pos) return null

  const itemStyle = (danger = false): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    textAlign: 'left',
    padding: '6px 12px',
    background: 'transparent',
    border: 'none',
    color: danger ? '#f87171' : '#e2e8f0',
    fontSize: 12,
    fontFamily: typography.fontFamily.primary,
    cursor: 'pointer',
    transition: 'transform 0.12s ease, background 0.12s ease',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  })

  function onItemEnter(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.transform = 'translateX(3px)'
    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
  }
  function onItemLeave(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.transform = 'translateX(0)'
    e.currentTarget.style.background = 'transparent'
  }

  const top = pos.openUp ? undefined : pos.top
  const bot = pos.openUp ? window.innerHeight - pos.top : undefined

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onMouseDown={e => { e.stopPropagation(); onFechar() }}
      />
      <div
        style={{
          position: 'fixed',
          top, bottom: bot,
          left: pos.left,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          background: '#141420',
          borderRadius: 12,
          padding: '5px 4px',
          minWidth: 210,
          boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,255,255,0.08)',
          zIndex: 9999,
          animation: 'dropdownOpen 0.14s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <button
          style={itemStyle()}
          onClick={e => { e.stopPropagation(); onTrabalhar(); onFechar() }}
          onMouseEnter={onItemEnter}
          onMouseLeave={onItemLeave}
        >
          <span style={{ fontSize: 12 }}>🔧</span> Trabalhar no bloco
        </button>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 8px' }} />

        <button
          style={itemStyle(true)}
          onClick={e => { e.stopPropagation(); onDesfazer(); onFechar() }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(3px)'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: 12 }}>↩️</span> Desfazer bloco
        </button>

        <button
          style={itemStyle(true)}
          onClick={e => { e.stopPropagation(); onDestruir(); onFechar() }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(3px)'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: 12 }}>💥</span> Destruir bloco
        </button>
      </div>
    </>,
    document.body
  )
}


// ─── Modal de confirmação genérico ────────────────────────────────────────────

interface ModalConfirmProps {
  titulo: string
  descricao: string
  labelConfirmar: string
  onConfirmar: () => void
  onCancelar: () => void
}

function ModalConfirm({ titulo, descricao, labelConfirmar, onConfirmar, onCancelar }: ModalConfirmProps) {
  return (
    <>
      <div
        onClick={onCancelar}
        style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(10px)' }}
      />
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#0f0f1a', borderRadius: 16, padding: '28px 28px 24px', width: 360,
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 16px 60px rgba(0,0,0,0.6)',
            animation: 'modalEntrar 0.2s ease-out forwards',
            pointerEvents: 'auto',
          }}
        >
          <h3 style={{ fontFamily: typography.fontFamily.primary, fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: '0 0 10px' }}>{titulo}</h3>
          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 13, color: '#94a3b8', margin: '0 0 22px', lineHeight: 1.6 }}>{descricao}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onCancelar}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#94a3b8', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontFamily: typography.fontFamily.primary }}
            >Cancelar</button>
            <button
              onClick={onConfirmar}
              style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, color: '#f87171', padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: typography.fontFamily.primary }}
            >{labelConfirmar}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Torre de bloco no canvas ─────────────────────────────────────────────────

interface BlocoTorreProps {
  bloco: Bloco
  posX: number
  posY: number
  isDragging: boolean
  dragPos: { x: number; y: number } | null
  dropdownAberto: boolean
  zoom: number
  onAbrir: () => void
  onDragStart: (e: React.MouseEvent) => void
  onDropdownToggle: (e: React.MouseEvent) => void
  onDesfazer: () => void
  onDestruir: () => void
}

function ClipsBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        fontFamily: "'Work Sans', 'Helvetica Neue', Arial, sans-serif",
        fontSize: 8,
        fontWeight: 200,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        background: 'linear-gradient(90deg, #c4b5fd 0%, #93c5fd 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        flexShrink: 0,
        filter: 'brightness(1.3)',
        paddingLeft: 4,
      }}
    >
      {count} CLIPS
    </span>
  )
}

function BlocoTorre({
  bloco, posX, posY, isDragging, dragPos,
  dropdownAberto, zoom,
  onAbrir, onDragStart, onDropdownToggle, onDesfazer, onDestruir,
  }: BlocoTorreProps) {
  const dropdownBtnRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null)

  const x = isDragging && dragPos ? dragPos.x : posX
  const y = isDragging && dragPos ? dragPos.y : posY

  // cards[0] = frente (mais recente), cards[last] = fundo (mais antigo)
  const cardsOrdenados = bloco.cards
  const visivelCount   = Math.min(cardsOrdenados.length, TOWER_MAX_VISIBLE)

  // Para renderizar: o card de fundo primeiro (atrás), o card da frente por último (na frente)
  // fundo = cards[visivelCount-1], frente = cards[0]
  const cardsParaRender = cardsOrdenados.slice(0, visivelCount)

  // O card frontal (cards[0]) é o de referência para o prendedor
  const cardFrontal = cardsParaRender[0]

  // deslocamento de cada card: o fundo (índice visivelCount-1) tem maior deslocamento,
  function deslocamento(indexNaFila: number) {
  return { dx: indexNaFila * TOWER_OFFSET_X, dy: indexNaFila * TOWER_OFFSET_Y }
  }

  useEffect(() => {
  if (!dropdownAberto) { setDropdownPos(null); return }
  requestAnimationFrame(() => {
    const r = dropdownBtnRef.current?.getBoundingClientRect()
    if (!r) return
    const spaceBelow = window.innerHeight - r.bottom
    const openUp     = spaceBelow < 140
    setDropdownPos({ top: openUp ? r.top - 4 : r.bottom + 4, left: r.left - 160, openUp })
    })
  }, [dropdownAberto])

  if (!cardFrontal) return null

  const frontBg = cardFrontal.imagem_capa
    ? { backgroundImage: `url(${cardFrontal.imagem_capa})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: cardFrontal.cor || '#6366f1' }

  return (
    <div
      data-card="true"
      style={{
        position: 'absolute',
        left: x,
        // O bloco ocupa a célula exata. O header flutua acima via margin negativo.
        top: y,
        width: CARD_W + (visivelCount - 1) * TOWER_OFFSET_X,
        zIndex: isDragging ? 100 : 2,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        // overflow visible para o header flutuar acima sem empurrar o grid
        overflow: 'visible',
      }}
      onMouseDown={onDragStart}
      onDoubleClick={e => { e.stopPropagation(); onAbrir() }}
    >
      {/* Header flutuante acima do card frontal: título em coluna centralizada */}
        <div
          style={{
            position: 'absolute',
            top: -(HEADER_H) + 20,
            left: 0,
            width: CARD_W,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'Work Sans', 'Helvetica Neue', Arial, sans-serif",
              fontSize: 9.4,
              fontWeight: 200,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: 'linear-gradient(90deg, #c4b5fd 0%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'brightness(1.3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 200,
              textShadow: 'none',
              lineHeight: 0.8,
            }}
          >
            {bloco.nome}
          </span>
          <span
            style={{
              fontFamily: "'Work Sans', 'Helvetica Neue', Arial, sans-serif",
              fontSize: 8,
              fontWeight: 200,
              letterSpacing: '0.1em',
              background: 'linear-gradient(90deg, #c4b5fd 0%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'brightness(1.1)',
              opacity: 0.6,
              lineHeight: 0.8,
            }}
          >
            {bloco.cards.length} notes clipados neste bloco
          </span>
        </div>

      {/* Torre de cards — renderizados de trás para frente */}
      <div style={{ position: 'relative', height: CARD_H }}>
        {[...cardsParaRender].reverse().map((card, revIdx) => {
          // revIdx 0 = o card de fundo (maior deslocamento)
          // revIdx visivelCount-1 = o card frontal (deslocamento 0)
          const indexNaFila = visivelCount - 1 - revIdx
          const { dx, dy } = deslocamento(indexNaFila)
          const ehFrontal   = indexNaFila === 0
          const temFoto     = Boolean(card.imagem_capa)

          const bgStyle = temFoto
            ? { backgroundImage: `url(${card.imagem_capa})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: card.cor || '#6366f1' }

          return (
            <div
              key={card.id}
              style={{
                position: 'absolute',
                top: dy,
                left: dx,
                width: CARD_W,
                height: CARD_H,
                borderRadius: 12,
                ...bgStyle,
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: ehFrontal
                  ? '0 4px 16px rgba(0,0,0,0.38)'
                  : '0 2px 6px rgba(0,0,0,0.22)',
                overflow: 'hidden',
                zIndex: visivelCount - indexNaFila,
              }}
            >
              {temFoto && (
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 60%)' }} />
              )}

              {/* Conteúdo visível apenas no card frontal */}
              {ehFrontal && (
                <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '14px 14px 0', flex: 1, overflow: 'hidden' }}>
                    <h3 style={{
                      fontFamily: typography.fontFamily.primary,
                      fontSize: 12, fontWeight: 700,
                      color: temFoto ? '#fff' : isEscuro(card.cor) ? '#fff' : 'rgba(0,0,0,0.82)',
                      margin: '0 0 5px',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {card.titulo_capa || card.titulo}
                    </h3>
                    <p style={{
                      fontFamily: typography.fontFamily.primary,
                      fontSize: 10, lineHeight: 1.55,
                      color: temFoto ? 'rgba(255,255,255,0.7)' : isEscuro(card.cor) ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.52)',
                      margin: 0,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {card.conteudo}
                    </p>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px 10px 14px',
                  }}>
                    <span style={{
                      fontFamily: typography.fontFamily.primary,
                      fontSize: 9,
                      color: temFoto ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.35)',
                    }}>
                      🕐 {card.data}
                    </span>
                    <button
                      ref={dropdownBtnRef}
                      onClick={e => { e.stopPropagation(); onDropdownToggle(e) }}
                      onMouseDown={e => e.stopPropagation()}
                      style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.28)', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 15,
                        flexShrink: 0,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.28)' }}
                    >⋯</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Prendedor — corpo sobrepõe a borda superior do card frontal */}
        <div
          style={{
            position: 'absolute',
            top: -(HEADER_H - CLIP_OVERLAP),
            left: 12,
            zIndex: visivelCount + 5,
            pointerEvents: 'none',
          }}
        >
          <PrendedorSVG width={32} />
        </div>
      </div>

      {dropdownAberto && dropdownPos && (
          <BlocoDropdown
            pos={dropdownPos}
            zoom={zoom}
            onTrabalhar={() => { /* placeholder Fase futura */ }}
            onDesfazer={onDesfazer}
            onDestruir={onDestruir}
            onFechar={() => setDropdownPos(null)}   // ← era onDropdownToggle({} as React.MouseEvent)
          />
        )}
    </div>
  )
}

// ─── Modal do bloco — slider horizontal ──────────────────────────────────────

interface ModalBlocoProps {
  bloco: Bloco
  onFechar: () => void
  onRemoverCard: (cardId: number) => void
}


function ModalBloco({ bloco, onFechar, onRemoverCard }: ModalBlocoProps) {
  const cards                     = bloco.cards
  const [idx, setIdx]             = useState(0)
  const [animando, setAnimando]   = useState(false)
  const [girando, setGirando]     = useState<'avancar' | 'voltar' | null>(null)

  useEffect(() => {
    if (idx >= cards.length && cards.length > 0) setIdx(cards.length - 1)
  }, [cards.length, idx])

  if (cards.length === 0) return null

  const podAvancar = idx < cards.length - 1
  const podVoltar  = idx > 0

  function avancar() {
    if (animando || !podAvancar) return
    setGirando('avancar')
    setAnimando(true)
    setTimeout(() => {
      setIdx(prev => prev + 1)
      setGirando(null)
      setTimeout(() => setAnimando(false), 350)
    }, 380)
  }

  function voltar() {
    if (animando || !podVoltar) return
    setGirando('voltar')
    setAnimando(true)
    setTimeout(() => {
      setIdx(prev => prev - 1)
      setGirando(null)
      setTimeout(() => setAnimando(false), 350)
    }, 380)
  }

  const card        = cards[idx]
  const temFoto     = Boolean(card.imagem_capa)
  const bg          = temFoto ? '#0f0a1e' : (card.cor || '#6366f1')
  const tx          = temFoto || isEscuro(card.cor) ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.82)'
  const sub         = temFoto || isEscuro(card.cor) ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.42)'

  const pilhaEsquerda = cards.slice(0, idx)
  const lequeDireito  = cards.slice(idx + 1)

  return (
    <>
      <style>{`
        @keyframes livroVirar {
          0%   { transform: perspective(1200px) rotateY(0deg); }
          100% { transform: perspective(1200px) rotateY(-180deg); }
        }
        @keyframes livroVoltarFrente {
          0%   { transform: perspective(1200px) rotateY(-180deg); }
          100% { transform: perspective(1200px) rotateY(0deg); }
        }
        @keyframes livroEntrarDireita {
          0%   { transform: perspective(1200px) rotateY(25deg) translateX(30px); opacity: 0.4; }
          100% { transform: perspective(1200px) rotateY(0deg)  translateX(0);    opacity: 1; }
        }
        @keyframes livroEntrarEsquerda {
          0%   { transform: perspective(1200px) rotateY(-25deg) translateX(-30px); opacity: 0.4; }
          100% { transform: perspective(1200px) rotateY(0deg)   translateX(0);     opacity: 1; }
        }
      `}</style>

      <div
        onClick={onFechar}
        style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(10px)' }}
      />

      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', gap: 20,
      }}>

        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'relative', width: 580, height: 520, pointerEvents: 'auto' }}
        >
          {/* ── Pilha esquerda — cards já lidos, de costas ── */}
          {pilhaEsquerda.map((c, i) => {
            const distancia = pilhaEsquerda.length - 1 - i
            const lBg = c.imagem_capa
              ? { backgroundImage: `url(${c.imagem_capa})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: c.cor || '#6366f1' }
            return (
              <div
                key={c.id}
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 20,
                  ...lBg,
                  border: '1px solid rgba(255,255,255,0.10)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  transform: `perspective(1200px) rotateY(-180deg) translateX(${-distancia * 6}px) translateY(${distancia * 3}px)`,
                  transformOrigin: 'left center',
                  zIndex: i + 1,
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', borderRadius: 20 }} />
              </div>
            )
          })}

          {/* ── Leque direito — cards ainda não lidos ── */}
          {lequeDireito.map((c, i) => {
            const lBg = c.imagem_capa
              ? { backgroundImage: `url(${c.imagem_capa})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: c.cor || '#6366f1' }
            return (
              <div
                key={c.id}
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 20,
                  ...lBg,
                  border: '1px solid rgba(255,255,255,0.10)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                  transform: `translateX(${(i + 1) * 21}px) translateY(${(i + 1) * 4}px) scale(${1 - (i + 1) * 0.025})`,
                  transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                  zIndex: 3 - Math.min(i, 2),
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.3 + i * 0.08})`, borderRadius: 20 }} />
              </div>
            )
          })}

          {/* ── Card ativo ── */}
          <div
            style={{
              position: 'absolute', inset: 0,
              borderRadius: 20,
              background: bg,
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              zIndex: 50,
              transformOrigin: 'left center',
              animation: girando === 'avancar'
                ? 'livroVirar 0.38s cubic-bezier(0.4,0,0.6,1) forwards'
                : girando === 'voltar'
                  ? 'livroVoltarFrente 0.38s cubic-bezier(0.4,0,0.6,1) forwards'
                  : idx === 0
                    ? 'modalEntrar 0.22s ease-out forwards'
                    : podVoltar && !animando
                      ? 'livroEntrarDireita 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards'
                      : 'livroEntrarEsquerda 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {temFoto && (
              <div style={{ height: 200, flexShrink: 0, background: `url(${card.imagem_capa}) center/cover`, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(15,10,30,0.95) 100%)' }} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                {card.categorias.length > 0
                  ? card.categorias.map(cat => (
                    <span key={cat.nome} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', color: tx, fontFamily: typography.fontFamily.primary }}>{cat.nome}</span>
                  ))
                  : <span style={{ fontSize: 11, color: sub, fontFamily: typography.fontFamily.primary, fontStyle: 'italic' }}>sem categoria</span>
                }
              </div>
              <button
                onClick={onFechar}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: tx, opacity: 0.4, fontSize: 18, flexShrink: 0, marginLeft: 12 }}
              >✕</button>
            </div>

            <div style={{ padding: '14px 24px 0', flexShrink: 0 }}>
              <h2 style={{ fontFamily: typography.fontFamily.primary, fontSize: 22, fontWeight: 800, color: tx, margin: 0, lineHeight: 1.3 }}>
                {card.titulo_capa || card.titulo}
              </h2>
              <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 11, color: sub, margin: '6px 0 0' }}>🕐 {card.data}</p>
            </div>

            <div style={{ padding: '14px 24px', overflowY: 'auto', flex: 1 }}>
              <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 14, lineHeight: 1.8, color: tx, margin: 0, whiteSpace: 'pre-wrap' }}>
                {card.conteudo}
              </p>
            </div>

            <div style={{ padding: '0 24px 20px', paddingTop: 14, flexShrink: 0, display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => { window.location.href = card.url_editar }}
                style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: 12, fontWeight: 600, color: tx, opacity: 0.75 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.75' }}
              >✏️ Editar note</button>
              <button
                onClick={() => onRemoverCard(card.id)}
                style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: 12, fontWeight: 600, color: '#f87171' }}
              >Remover do bloco</button>
            </div>
          </div>
        </div>

        {/* Navegação externa */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: 20, pointerEvents: 'auto' }}
        >
          <button
            onClick={voltar}
            disabled={!podVoltar || animando}
            style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', cursor: !podVoltar ? 'default' : 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !podVoltar ? 0.2 : 1, transition: 'background 0.15s' }}
            onMouseEnter={e => { if (podVoltar) e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
          >‹</button>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {cards.map((_, i) => (
              <div
                key={i}
                style={{ width: i === idx ? 16 : 5, height: 5, borderRadius: 3, background: i === idx ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)', transition: 'width 0.2s, background 0.2s' }}
              />
            ))}
          </div>

          <button
            onClick={avancar}
            disabled={!podAvancar || animando}
            style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', cursor: !podAvancar ? 'default' : 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !podAvancar ? 0.2 : 1, transition: 'background 0.15s' }}
            onMouseEnter={e => { if (podAvancar) e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
          >›</button>
        </div>

      </div>
    </>
  )
}


// ─── Modal formar bloco ───────────────────────────────────────────────────────

interface ModalFormarBlocoProps {
  onConfirmar: (nome: string) => void
  onCancelar: () => void
}

function ModalFormarBloco({ onConfirmar, onCancelar }: ModalFormarBlocoProps) {
  const [nome, setNome]           = useState('')
  const [mostrarAviso, setMostrarAviso] = useState(false)
  const inputRef                  = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  function onChangeNome(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value.length > 30) {
      setMostrarAviso(true)
      setTimeout(() => setMostrarAviso(false), 6000)
    } else {
      setNome(e.target.value)
    }
  }

  return (
    <>
      <div onClick={onCancelar} style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(10px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#0f0f1a', borderRadius: 16, padding: '28px 28px 24px', width: 340,
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 16px 60px rgba(0,0,0,0.6)',
            animation: 'modalEntrar 0.2s ease-out forwards',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <PrendedorSVG width={26} />
            <div>
              <h3 style={{ fontFamily: typography.fontFamily.primary, fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Formar bloco</h3>
              <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 12, color: '#64748b', margin: 0 }}>Agrupe cards relacionados</p>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            value={nome}
            onChange={onChangeNome}
            onKeyDown={e => { if (e.key === 'Enter' && nome.trim()) onConfirmar(nome.trim()) }}
            placeholder='Monte sua sequência de idéias'
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${mostrarAviso ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 10, padding: '10px 14px', color: '#f1f5f9', fontSize: 13,
              fontFamily: typography.fontFamily.primary, outline: 'none',
              transition: 'border 0.2s',
            }}
          />
          {mostrarAviso && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#1e1030',
              border: '1px solid rgba(248,113,113,0.35)',
              borderRadius: 10,
              padding: '8px 12px',
              minWidth: 220,
              maxWidth: 280,
              boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
              zIndex: 10,
              pointerEvents: 'none',
              animation: 'modalEntrar 0.20s ease-out forwards',
            }}>
              <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 12, fontWeight: 600, color: '#f87171', margin: '0 0 4px' }}>
                Limite de 30 caracteres
              </p>
              <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>
                Títulos curtos funcionam melhor — tente duas ou três palavras que capturem a essência do bloco.
              </p>
              {/* Seta do balão */}
              <div style={{
                position: 'absolute',
                bottom: -5,
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: 8, height: 8,
                background: '#1e1030',
                borderRight: '1px solid rgba(248,113,113,0.35)',
                borderBottom: '1px solid rgba(248,113,113,0.35)',
              }} />
            </div>
            )}
        </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
            <button onClick={onCancelar} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#94a3b8', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontFamily: typography.fontFamily.primary }}>Cancelar</button>
            <button
              onClick={() => nome.trim() && onConfirmar(nome.trim())}
              disabled={!nome.trim()}
              style={{ background: nome.trim() ? '#6366f1' : 'rgba(99,102,241,0.25)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 20px', cursor: nome.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, fontFamily: typography.fontFamily.primary, transition: 'background 0.15s' }}
            >Criar bloco</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── PostIt ───────────────────────────────────────────────────────────────────

interface PostItProps {
  note: Note
  posX: number
  posY: number
  isDragging: boolean
  isSnapBack: boolean
  destacado: boolean
  isNew: boolean
  dropdownAberto: boolean
  blocos: Bloco[]
  zoom: number
  onAbrir: () => void
  onDragStart: (e: React.MouseEvent) => void
  onDropdownToggle: (e: React.MouseEvent) => void
  onFormarBloco: () => void
  onCliparEmBloco: (blocoId: number) => void
  onEnviarFeed: () => void
  onEnviarCampo: () => void
  onEditar: () => void
  onExcluir: () => void
  onDropdownFechar: () => void
}

function PostIt({
  note, posX, posY, isDragging, isSnapBack, destacado, isNew,
  dropdownAberto, blocos, zoom,
  onAbrir, onDragStart, onDropdownToggle,
  onFormarBloco, onCliparEmBloco,
  onEnviarFeed, onEnviarCampo, onEditar, onExcluir,
  onDropdownFechar,
}: PostItProps) {
  const temFoto      = Boolean(note.imagem_capa)
  const clickCount   = useRef(0)
  const clickTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropBtnRef   = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null)

  useEffect(() => {
  if (!dropdownAberto) { setDropdownPos(null); return }
  requestAnimationFrame(() => {
    const r = dropBtnRef.current?.getBoundingClientRect()
    if (!r) return
    const spaceBelow = window.innerHeight - r.bottom
    const openUp     = spaceBelow < 260
    setDropdownPos({ top: openUp ? r.top - 4 : r.bottom + 4, left: r.right - 196, openUp })
    })
  }, [dropdownAberto])

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    clickCount.current += 1
    if (clickCount.current === 1) {
      clickTimer.current = setTimeout(() => { clickCount.current = 0 }, 280)
    } else if (clickCount.current === 2) {
      if (clickTimer.current) clearTimeout(clickTimer.current)
      clickCount.current = 0
      onAbrir()
    }
  }

  const preview = (() => {
    const f = note.conteudo.split(/(?<=[.!?])\s+/)
    let r = ''
    for (const s of f) {
      if ((r + s).length > 180) break
      r += (r ? ' ' : '') + s
      if (r.split(/[.!?]/).length - 1 >= 2) break
    }
    return r || note.conteudo.slice(0, 180)
  })()

  const bgStyle = temFoto
    ? { backgroundImage: `url(${note.imagem_capa})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: note.cor }

  const animation = isNew
    ? 'cardEntrar 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards'
    : destacado
      ? 'destacarCard 2s ease-in-out'
      : undefined

  return (
    <div
      data-card="true"
      style={{
        position: 'absolute', left: posX, top: posY,
        width: CARD_W, height: CARD_H, ...bgStyle,
        borderRadius: 12,
        boxShadow: isDragging
          ? '0 20px 48px rgba(0,0,0,0.5)'
          : destacado
            ? '0 0 0 3px #fb923c, 0 8px 32px rgba(251,146,60,0.5)'
            : '0 4px 12px rgba(0,0,0,0.22)',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: isDragging
          ? 'none'
          : isSnapBack
            ? 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), top 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s'
            : 'box-shadow 0.2s',
        animation,
        zIndex: isDragging || isSnapBack ? 100 : 1,
        userSelect: 'none',
      }}
      onMouseDown={onDragStart}
      onClick={handleClick}
    >
      {temFoto && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.18) 55%,transparent 100%)', borderRadius: 12 }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: '16px 16px 0', flex: 1, overflow: 'hidden' }}>
        {note.categorias.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {note.categorias.slice(0, 2).map(cat => (
              <span key={cat.nome} style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'rgba(0,0,0,0.15)', color: temFoto ? 'white' : 'rgba(0,0,0,0.55)', fontFamily: typography.fontFamily.primary }}>{cat.nome}</span>
            ))}
          </div>
        )}
        <h3 style={{ fontFamily: typography.fontFamily.primary, fontSize: 13, fontWeight: 700, color: temFoto ? 'white' : isEscuro(note.cor) ? '#fff' : 'rgba(0,0,0,0.82)', margin: '0 0 6px', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {note.titulo_capa || note.titulo}
        </h3>
        <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 11, lineHeight: 1.6, color: temFoto ? 'rgba(255,255,255,0.75)' : isEscuro(note.cor) ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
          {preview}
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '8px 16px 12px' }}>
        <span style={{ fontFamily: typography.fontFamily.primary, fontSize: 9, color: temFoto ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)', letterSpacing: '0.02em' }}>🕐 {note.data}</span>
      </div>

      {/* Botão ⋯ */}
      <button
        ref={dropBtnRef}
        onClick={e => { e.stopPropagation(); onDropdownToggle(e) }}
        onMouseDown={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 10, right: 10,
          width: 26, height: 26, borderRadius: '50%',
          background: 'rgba(0,0,0,0.22)', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 15, zIndex: 10,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.22)' }}
      >⋯</button>

      {dropdownAberto && dropdownPos && (
        <CardDropdown
          cardId={note.id}
          pos={dropdownPos}
          blocos={blocos}
          zoom={zoom}
          onFormarBloco={onFormarBloco}
          onCliparEmBloco={onCliparEmBloco}
          onEnviarFeed={onEnviarFeed}
          onEnviarCampo={onEnviarCampo}
          onEditar={onEditar}
          onExcluir={onExcluir}
          onFechar={onDropdownFechar}
        />
      )}
    </div>
  )
}

// ─── BotaoZoom ────────────────────────────────────────────────────────────────

function BotaoZoom({ label, title, onClick, small }: { label: string; title: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 42, height: small ? 32 : 42,
        borderRadius: small ? 8 : '50%',
        background: 'rgba(15,10,35,0.85)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        cursor: 'pointer', color: 'white',
        fontFamily: typography.fontFamily.primary,
        fontSize: small ? 10 : 20, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,146,60,0.7)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,10,35,0.85)' }}
    >{label}</button>
  )
}

// ─── OpcaoDropdown ────────────────────────────────────────────────────────────

function OpcaoDropdown({ emoji, label, desc, onClick, danger, disabled }: { emoji: string; label: string; desc: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left', background: hover ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', borderRadius: 10, padding: '8px 10px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, transition: 'background 0.15s', gap: 1 }}
    >
      <span style={{ fontFamily: typography.fontFamily.primary, fontSize: 13, fontWeight: 600, color: danger ? '#f87171' : 'rgba(255,255,255,0.88)' }}>{emoji} {label}</span>
      <span style={{ fontFamily: typography.fontFamily.primary, fontSize: 11, color: danger ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.35)', paddingLeft: 22 }}>{desc}</span>
    </button>
  )
}

// ─── ModalLeitura ─────────────────────────────────────────────────────────────

function ModalLeitura({ note, onFechar, onExcluido }: { note: Note; onFechar: () => void; onExcluido: (id: number) => void }) {
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [publicando, setPublicando]         = useState(false)
  const [erroAcao, setErroAcao]             = useState('')
  const temFoto    = Boolean(note.imagem_capa)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownAberto(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function excluir() {
    if (!confirm('Excluir este note permanentemente?')) return
    fetch(`/api/notes/${note.id}/excluir/`, { method: 'POST', headers: { 'X-CSRFToken': getCsrf() } })
      .then(() => onExcluido(note.id))
  }

  function publicar(destino: 'feed' | 'campo') {
    setPublicando(true); setErroAcao('')
    fetch(`/api/notes/${note.id}/publicar/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ destino }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) window.location.href = `/?aba=${destino}`
        else if (data.erro === 'sem_categoria') setErroAcao('Adicione uma categoria antes de publicar.')
        else if (data.erro === 'sem_capa') setErroAcao('O Feed requer imagem de capa.')
        else setErroAcao('Erro ao publicar.')
        setPublicando(false); setDropdownAberto(false)
      })
      .catch(() => { setErroAcao('Erro de conexão.'); setPublicando(false) })
  }

  const bg  = temFoto ? '#0f0a1e' : (note.cor || '#ffffff')
  const tx  = temFoto || isEscuro(note.cor) ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.82)'
  const sub = temFoto || isEscuro(note.cor) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.42)'

  return (
    <>
      <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(10px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none' }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: bg, borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', animation: 'modalEntrar 0.22s ease-out forwards', pointerEvents: 'auto' }}
        >
          {temFoto && (
            <div style={{ position: 'relative', height: 200, flexShrink: 0, background: `url(${note.imagem_capa}) center/cover` }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(15,10,30,0.95) 100%)' }} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
              {note.categorias.length > 0
                ? note.categorias.map(cat => (
                  <span key={cat.nome} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', color: tx, fontFamily: typography.fontFamily.primary }}>{cat.nome}</span>
                ))
                : <span style={{ fontSize: 11, color: sub, fontFamily: typography.fontFamily.primary, fontStyle: 'italic' }}>sem categoria</span>
              }
            </div>
            <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0, marginLeft: 12 }}>
              <button
                onClick={() => { setDropdownAberto(v => !v); setErroAcao('') }}
                style={{ background: 'rgba(255,255,255,0.10)', border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: 12, fontWeight: 600, color: tx }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
              >
                <span style={{ letterSpacing: 2 }}>•••</span>
              </button>
              {dropdownAberto && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'rgba(10,6,25,0.97)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 8, minWidth: 220, backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 10, animation: 'dropdownEntrar 0.18s ease-out forwards' }}>
                  <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px 8px', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 6 }}>O que fazer com essa ideia?</p>
                  {erroAcao && <p style={{ color: '#f87171', fontSize: 11, padding: '4px 10px 6px', fontFamily: typography.fontFamily.primary, margin: 0 }}>{erroAcao}</p>}
                  <OpcaoDropdown emoji="👥" label="Enviar para o Feed" desc="Compartilhe com seus seguidores" onClick={() => publicar('feed')} disabled={publicando} />
                  <OpcaoDropdown emoji="🌍" label="Enviar para o Campo" desc="Torne pública no Campo das Ideias" onClick={() => publicar('campo')} disabled={publicando} />
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
                  <OpcaoDropdown emoji="✏️" label="Editar note" desc="Alterar título, texto ou imagem" onClick={() => { window.location.href = note.url_editar }} />
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
                  <OpcaoDropdown emoji="🗑️" label="Excluir note" desc="Remove permanentemente" onClick={excluir} danger />
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
            <h2 style={{ fontFamily: typography.fontFamily.primary, fontSize: 22, fontWeight: 800, color: tx, margin: 0, lineHeight: 1.3 }}>{note.titulo_capa || note.titulo}</h2>
            <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 11, color: sub, margin: '6px 0 0' }}>🕐 {note.data}</p>
          </div>

          <div style={{ padding: '16px 24px 24px', overflowY: 'auto', flex: 1 }}>
            <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 14, lineHeight: 1.8, color: tx, margin: 0, whiteSpace: 'pre-wrap' }}>{note.conteudo}</p>
          </div>

          <div style={{ padding: '16px 24px 20px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={onFechar} style={{ width: '100%', padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: 13, fontWeight: 600, color: tx, opacity: 0.7 }} onMouseEnter={e => { e.currentTarget.style.opacity = '1' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0.7' }}>Fechar</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── ComposerModal ────────────────────────────────────────────────────────────

function ComposerModal({ notes, blocos, onFechar, onCriado }: { notes: Note[]; blocos: Bloco[]; onFechar: () => void; onCriado: (note: Note) => void }) {
  const [titulo, setTitulo]           = useState('')
  const [conteudo, setConteudo]       = useState('')
  const [corBase, setCorBase]         = useState<string | null>(null)
  const [luminosidade, setLuminosidade] = useState(0.45)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null)
  const [erro, setErro]               = useState('')
  const [salvando, setSalvando]       = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const sliderRef    = useRef<HTMLDivElement>(null)
  const arrastando   = useRef(false)

  const corFinal   = corBase ? ajustarLuminosidade(corBase, luminosidade) : '#ffffff'
  const fundoEscuro = luminosidade < 0.55 && corBase !== null
  const textoEl    = fundoEscuro ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.80)'
  const inputBg    = fundoEscuro ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)'

  const calcLum = useCallback((cy: number) => {
    const r = sliderRef.current?.getBoundingClientRect()
    if (!r) return
    setLuminosidade(Math.max(0.15, Math.min(0.85, 1 - (cy - r.top) / r.height)))
  }, [])

  useEffect(() => {
    const onM = (e: MouseEvent) => { if (arrastando.current) calcLum(e.clientY) }
    const onU = () => { arrastando.current = false }
    window.addEventListener('mousemove', onM)
    window.addEventListener('mouseup', onU)
    return () => { window.removeEventListener('mousemove', onM); window.removeEventListener('mouseup', onU) }
  }, [calcLum])

  function onEscolherCor(hex: string) {
    if (corBase === hex) { setCorBase(null); setLuminosidade(0.45) }
    else { setCorBase(hex); setLuminosidade(getLuminosidadeBase(hex)) }
  }

  function onEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFotoArquivo(f)
    const r = new FileReader()
    r.onload = ev => setFotoPreview(ev.target?.result as string)
    r.readAsDataURL(f)
  }

  function removerFoto() {
    setFotoPreview(null); setFotoArquivo(null)
    if (inputFotoRef.current) inputFotoRef.current.value = ''
  }

  async function salvar() {
    if (!titulo.trim()) { setErro('Título obrigatório.'); return }
    if (!conteudo.trim()) { setErro('Conteúdo obrigatório.'); return }
    setSalvando(true); setErro('')

    const novaOrdem = maxOrdemAtual(notes, blocos) + 1
    const pos       = proximaPosicaoLivre(notes, blocos)

    let res: Response
    if (fotoArquivo) {
      const form = new FormData()
      form.append('titulo', titulo); form.append('conteudo', conteudo)
      form.append('cor', corFinal); form.append('imagem_capa', fotoArquivo)
      form.append('canvas_x', String(pos.x)); form.append('canvas_y', String(pos.y))
      form.append('canvas_ordem', String(novaOrdem))
      res = await fetch('/api/notes/criar/', { method: 'POST', headers: { 'X-CSRFToken': getCsrf() }, body: form })
    } else {
      res = await fetch('/api/notes/criar/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
        body: JSON.stringify({ titulo, conteudo, cor: corFinal, canvas_x: pos.x, canvas_y: pos.y, canvas_ordem: novaOrdem }),
      })
    }

    const data = await res.json()
    if (data.ok) {
      // Garante que o note retornado tem a posição correta
      const noteComPosicao: Note = {
      ...data.post,
      canvas_x: pos.x,
      canvas_y: pos.y,
      canvas_ordem: data.post.canvas_ordem ?? (maxOrdemAtual(notes, blocos) + 1),
      }
      onCriado(noteComPosicao)
    } else {
      setErro(data.erro || 'Erro ao salvar.'); setSalvando(false)
    }
  }

  const indPct = (1 - (luminosidade - 0.15) / 0.70) * 100

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onFechar}
    >
      <div style={{ background: corFinal, borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'hidden', transition: 'background 0.25s' }} onClick={e => e.stopPropagation()}>
        {fotoPreview && (
          <div style={{ position: 'relative', height: 160, background: `url(${fotoPreview}) center/cover` }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.45) 100%)' }} />
            <button onClick={removerFoto} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: 'white', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        )}
        <div style={{ padding: 24 }}>
          <style>{`.note-input::placeholder{color:${fundoEscuro ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.32)'}}`}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: typography.fontFamily.primary, fontSize: 15, fontWeight: 700, color: textoEl, margin: 0 }}>Novo Note</h3>
            <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: textoEl, opacity: 0.5 }}>✕</button>
          </div>
          <input className="note-input" type="text" placeholder="Título..." value={titulo} onChange={e => setTitulo(e.target.value)}
            style={{ width: '100%', border: 'none', background: inputBg, borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: typography.fontFamily.primary, fontWeight: 600, color: textoEl, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />
          <textarea className="note-input" placeholder="O que está na sua cabeça?" value={conteudo} onChange={e => setConteudo(e.target.value)} rows={4}
            style={{ width: '100%', border: 'none', background: inputBg, borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: typography.fontFamily.primary, color: textoEl, resize: 'none', marginBottom: 16, boxSizing: 'border-box', outline: 'none' }} />
          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 11, fontWeight: 600, color: textoEl, opacity: 0.55, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cor do card</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, flex: 1 }}>
              <button onClick={() => { setCorBase(null); setLuminosidade(0.45) }} title="Padrão" style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffffff', border: corBase === null ? '3px solid #6b7280' : '2px solid #d1d5db', cursor: 'pointer', transform: corBase === null ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s' }} />
              {PALETA_BASE.map(({ hex, nome }) => (
                <button key={hex} onClick={() => onEscolherCor(hex)} title={nome} style={{ width: 28, height: 28, borderRadius: '50%', background: hex, border: corBase === hex ? '3px solid rgba(255,255,255,0.8)' : '2px solid rgba(255,255,255,0.3)', cursor: 'pointer', transform: corBase === hex ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s', boxShadow: corBase === hex ? '0 0 0 2px rgba(0,0,0,0.25)' : 'none' }} />
              ))}
            </div>
            {corBase && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: typography.fontFamily.primary, fontSize: 9, color: textoEl, opacity: 0.5 }}>clar</span>
                <div ref={sliderRef} onMouseDown={e => { arrastando.current = true; calcLum(e.clientY) }} onClick={e => calcLum(e.clientY)}
                  style={{ width: 20, height: 100, borderRadius: 10, cursor: 'ns-resize', position: 'relative', background: `linear-gradient(to bottom,${ajustarLuminosidade(corBase, 0.85)},${ajustarLuminosidade(corBase, 0.45)},${ajustarLuminosidade(corBase, 0.15)})`, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                  <div style={{ position: 'absolute', left: '50%', top: `${indPct}%`, transform: 'translate(-50%,-50%)', width: 18, height: 18, borderRadius: '50%', background: corFinal, border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
                </div>
                <span style={{ fontFamily: typography.fontFamily.primary, fontSize: 9, color: textoEl, opacity: 0.5 }}>esc</span>
              </div>
            )}
          </div>
          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 11, fontWeight: 600, color: textoEl, opacity: 0.55, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Foto de capa</p>
          <input ref={inputFotoRef} type="file" accept="image/*" onChange={onEscolherFoto} style={{ display: 'none' }} id="upload-foto-note" />
          {!fotoPreview
            ? <label htmlFor="upload-foto-note" style={{ display: 'flex', alignItems: 'center', gap: 8, background: inputBg, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', marginBottom: 16, border: `1.5px dashed ${textoEl}44` }}>
              <span style={{ fontSize: 18 }}>🖼️</span>
              <span style={{ fontFamily: typography.fontFamily.primary, fontSize: 12, color: textoEl, opacity: 0.65 }}>Clique para adicionar uma foto</span>
            </label>
            : <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <img src={fotoPreview} alt="preview" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} />
              <span style={{ fontFamily: typography.fontFamily.primary, fontSize: 12, color: textoEl, opacity: 0.8, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fotoArquivo?.name}</span>
              <button onClick={removerFoto} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }}>✕</button>
            </div>
          }
          {erro && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: typography.fontFamily.primary, marginBottom: 12 }}>{erro}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onFechar} style={{ flex: 1, padding: 10, borderRadius: 8, background: inputBg, border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: 13, fontWeight: 600, color: textoEl, opacity: 0.8 }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: 10, borderRadius: 8, background: fundoEscuro ? 'rgba(255,255,255,0.15)' : 'rgba(59,130,246,0.12)', border: `1.5px solid ${fundoEscuro ? 'rgba(255,255,255,0.3)' : '#3b82f6'}`, cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: 13, fontWeight: 700, color: fundoEscuro ? 'white' : '#3b82f6', opacity: salvando ? 0.6 : 1 }}>
              {salvando ? 'Salvando...' : 'Salvar Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── NotesPage ────────────────────────────────────────────────────────────────

export function NotesPage() {
  const [notes, setNotes]           = useState<Note[]>([])
  const [blocos, setBlocos]         = useState<Bloco[]>([])
  const [loading, setLoading]       = useState(true)
  const [erro, setErro]             = useState('')
  const [composerAberto, setComposerAberto] = useState(false)
  const [noteLendo, setNoteLendo]   = useState<Note | null>(null)
  const [modalBlocoAberto, setModalBlocoAberto] = useState<Bloco | null>(null)
  const [formarBlocoCardId, setFormarBlocoCardId] = useState<number | null>(null)
  const [dropdownCardId, setDropdownCardId]       = useState<number | null>(null)
  const [dropdownBlocoId, setDropdownBlocoId]     = useState<number | null>(null)
  const [newNoteId, setNewNoteId]   = useState<number | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ tipo: 'desfazer' | 'destruir'; blocoId: number } | null>(null)

  const [camX, setCamX]     = useState(CANVAS_GAP)
  const [camY, setCamY]     = useState(CANVAS_GAP)
  const [zoom, setZoom]     = useState(ZOOM_DEFAULT)
  const [zoomExpanded, setZoomExpanded] = useState(false)

  const panRef   = useRef(false)
  const panStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 })

  const dragNoteRef  = useRef<{ id: number; startMouseX: number; startMouseY: number; startCardX: number; startCardY: number } | null>(null)
  const dragBlocoRef = useRef<{ id: number; startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null)
  const [draggingNoteId, setDraggingNoteId]   = useState<number | null>(null)
  const [draggingBlocoId, setDraggingBlocoId] = useState<number | null>(null)
  const [dragPos, setDragPos]                 = useState<{ x: number; y: number } | null>(null)
  const dragOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [snapBackId, setSnapBackId]           = useState<number | null>(null)

  const [busca, setBusca]               = useState('')
  const [buscaExpanded, setBuscaExpanded] = useState(false)
  const [buscaAberta, setBuscaAberta]   = useState(false)
  const [destacado, setDestacado]       = useState<number | null>(null)
  const buscaInputRef = useRef<HTMLInputElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)

  useEffect(() => { carregarTudo() }, [])

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    if (dropdownCardId === null && dropdownBlocoId === null) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-dropdown-trigger]')) {
        setDropdownCardId(null)
        setDropdownBlocoId(null)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [dropdownCardId, dropdownBlocoId])

  function carregarTudo() {
    Promise.all([
      fetch('/api/notes/privados/').then(r => r.json()),
      fetch('/api/blocos/').then(r => r.json()),
    ]).then(([notesData, blocosData]) => {
      const posts: Note[] = notesData.posts
      setNotes(posts)
      setBlocos(blocosData.blocos ?? [])
      setLoading(false)
    }).catch(() => { setErro('Erro ao carregar.'); setLoading(false) })
  }

  const salvarPosTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  function salvarPosicaoNote(id: number, x: number, y: number, ordem: number) {
    if (salvarPosTimeout.current) clearTimeout(salvarPosTimeout.current)
    salvarPosTimeout.current = setTimeout(() => {
      fetch(`/api/notes/${id}/posicao/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
        body: JSON.stringify({ x, y, ordem }),
      })
    }, 600)
  }

  function salvarPosicaoBloco(id: number, x: number, y: number, ordem: number) {
    fetch(`/api/blocos/${id}/posicao/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ x, y, ordem }),
    })
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-card]')) return
    if (e.button !== 0) return
    panRef.current = true
    panStart.current = { x: e.clientX, y: e.clientY, camX, camY }
    e.preventDefault()
  }, [camX, camY])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (panRef.current) {
        setCamX(panStart.current.camX + (e.clientX - panStart.current.x))
        setCamY(panStart.current.camY + (e.clientY - panStart.current.y))
      }
      if (dragNoteRef.current) {
        const dx = (e.clientX - dragNoteRef.current.startMouseX) / zoom
        const dy = (e.clientY - dragNoteRef.current.startMouseY) / zoom
        setDragPos({ x: dragNoteRef.current.startCardX + dx, y: dragNoteRef.current.startCardY + dy })
      }
      if (dragBlocoRef.current) {
        const dx = (e.clientX - dragBlocoRef.current.startMouseX) / zoom
        const dy = (e.clientY - dragBlocoRef.current.startMouseY) / zoom
        setDragPos({ x: dragBlocoRef.current.startX + dx, y: dragBlocoRef.current.startY + dy })
      }
    }

    function onUp() {
      panRef.current = false

      if (dragNoteRef.current && dragPos) {
        const { id } = dragNoteRef.current
        const sn     = snapToGrid(dragPos.x, dragPos.y)
        if (celulaOcupada(notes, blocos, sn.x, sn.y, id, null)) {
          const o = dragOriginRef.current
          setSnapBackId(id)
          setNotes(prev => prev.map(n => n.id === id ? { ...n, canvas_x: o.x, canvas_y: o.y } : n))
          setTimeout(() => setSnapBackId(null), 380)
        } else {
          setNotes(prev => prev.map(n => {
            if (n.id !== id) return n
            salvarPosicaoNote(id, sn.x, sn.y, n.canvas_ordem)
            return { ...n, canvas_x: sn.x, canvas_y: sn.y }
          }))
        }
        dragNoteRef.current = null; setDraggingNoteId(null); setDragPos(null)
      }

      if (dragBlocoRef.current && dragPos) {
        const { id } = dragBlocoRef.current
        const sn     = snapToGrid(dragPos.x, dragPos.y)
        if (celulaOcupada(notes, blocos, sn.x, sn.y, null, id)) {
        const o = dragOriginRef.current
        setSnapBackId(id)
        setBlocos(prev => prev.map(b => b.id === id ? { ...b, canvas_x: o.x, canvas_y: o.y } : b))
        setTimeout(() => setSnapBackId(null), 380)
        } else {
          setBlocos(prev => prev.map(b => {
            if (b.id !== id) return b
            salvarPosicaoBloco(id, sn.x, sn.y, b.canvas_ordem)
            return { ...b, canvas_x: sn.x, canvas_y: sn.y }
          }))
        }
        dragBlocoRef.current = null; setDraggingBlocoId(null); setDragPos(null)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [zoom, dragPos, notes, blocos])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))))
  }, [])

  function zoomIn()    { setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))) }
  function zoomOut()   { setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))) }
  function zoomReset() { setZoom(ZOOM_DEFAULT); setCamX(CANVAS_GAP); setCamY(CANVAS_GAP) }

  function iniciarDragNote(e: React.MouseEvent, note: Note) {
    e.stopPropagation()
    dragOriginRef.current = { x: note.canvas_x, y: note.canvas_y }
    dragNoteRef.current   = { id: note.id, startMouseX: e.clientX, startMouseY: e.clientY, startCardX: note.canvas_x, startCardY: note.canvas_y }
    setDraggingNoteId(note.id); setDragPos({ x: note.canvas_x, y: note.canvas_y })
  }

  function iniciarDragBloco(e: React.MouseEvent, bloco: Bloco) {
    e.stopPropagation()
    dragOriginRef.current = { x: bloco.canvas_x, y: bloco.canvas_y }
    dragBlocoRef.current  = { id: bloco.id, startMouseX: e.clientX, startMouseY: e.clientY, startX: bloco.canvas_x, startY: bloco.canvas_y }
    setDraggingBlocoId(bloco.id); setDragPos({ x: bloco.canvas_x, y: bloco.canvas_y })
  }

  function navegarAteNote(note: Note) {
    const c = containerRef.current; if (!c) return
    const { width, height } = c.getBoundingClientRect()
    setCamX(width / 2 - (note.canvas_x + CARD_W / 2) * zoom)
    setCamY(height / 2 - (note.canvas_y + CARD_H / 2) * zoom)
    setDestacado(note.id); setBuscaExpanded(false); setBuscaAberta(false); setBusca('')
    setTimeout(() => setDestacado(null), 2000)
  }

  // ── Criar bloco ──────────────────────────────────────────────────────────────

  function formarBloco(cardId: number, nome: string) {
    const card = notes.find(n => n.id === cardId)
    if (!card) return

    fetch('/api/blocos/criar/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({
        nome,
        card_id: cardId,
        canvas_x: card.canvas_x,
        canvas_y: card.canvas_y,
        canvas_ordem: card.canvas_ordem,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setBlocos(prev => [...prev, data.bloco])
          // Remove o card do canvas principal
          setNotes(prev => prev.filter(n => n.id !== cardId))
        }
      })
    setFormarBlocoCardId(null)
  }

  function cliparEmBloco(cardId: number, blocoId: number) {
      fetch(`/api/blocos/${blocoId}/clipar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
        body: JSON.stringify({ card_id: cardId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            setNotes(prev => prev.filter(n => n.id !== cardId))
            fetch('/api/blocos/')
              .then(r => r.json())
              .then(d => setBlocos(d.blocos ?? []))
          }
        })
      setDropdownCardId(null)
    }

  function removerCardDoBloco(blocoId: number, cardId: number) {
    fetch(`/api/blocos/${blocoId}/remover-card/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ card_id: cardId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.bloco_destruido) {
          setBlocos(prev => prev.filter(b => b.id !== blocoId))
          setModalBlocoAberto(null)
        } else if (data.ok) {
          setBlocos(prev => prev.map(b => b.id === blocoId ? data.bloco : b))
          setModalBlocoAberto(data.bloco)
        }
        // Recarrega notes para ter o card de volta no canvas
        fetch('/api/notes/privados/').then(r => r.json()).then(d => setNotes(d.posts))
      })
  }

  function desfazerBloco(blocoId: number) {
    fetch(`/api/blocos/${blocoId}/desfazer/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrf() },
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setBlocos(prev => prev.filter(b => b.id !== blocoId))
          setNotes(prev => [...prev, ...data.cards_restaurados])
        }
      })
    setConfirmModal(null)
  }

  function destruirBloco(blocoId: number) {
    fetch(`/api/blocos/${blocoId}/destruir/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrf() },
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setBlocos(prev => prev.filter(b => b.id !== blocoId))
          setNotes(prev => prev.filter(n => !data.cards_destruidos.includes(n.id)))
        }
      })
    setConfirmModal(null)
  }

  function excluirNote(id: number) {
    if (!confirm('Excluir este note permanentemente?')) return
    fetch(`/api/notes/${id}/excluir/`, { method: 'POST', headers: { 'X-CSRFToken': getCsrf() } })
      .then(() => {
        setNotes(prev => prev.filter(n => n.id !== id))
        setBlocos(prev =>
          prev.map(b => ({ ...b, cards: b.cards.filter(c => c.id !== id), card_ids: b.card_ids.filter(cid => cid !== id) }))
            .filter(b => b.card_ids.length > 0)
        )
        setDropdownCardId(null)
      })
  }

  function onNoteCriado(note: Note) {
    setNotes(prev => [...prev, note])
    setComposerAberto(false)
    setNewNoteId(note.id)
    setTimeout(() => {
      navegarAteNote(note)
      setTimeout(() => setNewNoteId(null), 600)
    }, 80)
  }

  function onNoteExcluido(id: number) {
    setNotes(prev => prev.filter(n => n.id !== id))
    setNoteLendo(null)
  }

  // ── Virtualização ────────────────────────────────────────────────────────────

  const notesEmBlocos = useMemo(
    () => new Set(blocos.flatMap(b => b.card_ids)),
    [blocos],
  )

  const notesVisiveis = useMemo(() => {
    const c = containerRef.current; if (!c) return notes
    const { width, height } = c.getBoundingClientRect(); if (width === 0) return notes
    const x0 = (-camX - BUFFER_PX) / zoom, y0 = (-camY - BUFFER_PX) / zoom
    const x1 = (-camX + width + BUFFER_PX) / zoom, y1 = (-camY + height + BUFFER_PX) / zoom
    return notes.filter(n => {
      if (notesEmBlocos.has(n.id)) return false
      const cx = draggingNoteId === n.id && dragPos ? dragPos.x : n.canvas_x
      const cy = draggingNoteId === n.id && dragPos ? dragPos.y : n.canvas_y
      return cx + CARD_W > x0 && cx < x1 && cy + CARD_H > y0 && cy < y1
    })
  }, [notes, blocos, camX, camY, zoom, draggingNoteId, dragPos, notesEmBlocos])

  const blocosVisiveis = useMemo(() => {
    const c = containerRef.current; if (!c) return blocos
    const { width, height } = c.getBoundingClientRect(); if (width === 0) return blocos
    const x0 = (-camX - BUFFER_PX) / zoom, y0 = (-camY - BUFFER_PX) / zoom
    const x1 = (-camX + width + BUFFER_PX) / zoom, y1 = (-camY + height + BUFFER_PX) / zoom
    return blocos.filter(b => {
      const cx = draggingBlocoId === b.id && dragPos ? dragPos.x : b.canvas_x
      const cy = draggingBlocoId === b.id && dragPos ? dragPos.y : b.canvas_y
      return cx + CARD_W > x0 && cx < x1 && cy + CARD_H > y0 && cy < y1
    })
  }, [blocos, camX, camY, zoom, draggingBlocoId, dragPos])

  const resultadosBusca = useMemo(() => {
    if (!busca.trim()) return []
    const q = busca.toLowerCase()
    return notes.filter(n =>
      n.titulo.toLowerCase().includes(q) ||
      n.titulo_capa.toLowerCase().includes(q) ||
      n.conteudo.toLowerCase().includes(q) ||
      n.categorias.some(c => c.nome.toLowerCase().includes(q))
    )
  }, [busca, notes])

  function toggleBusca() {
    if (!buscaExpanded) {
      setBuscaExpanded(true)
      setTimeout(() => { buscaInputRef.current?.focus(); setBuscaAberta(true) }, 60)
    } else {
      setBuscaExpanded(false); setBuscaAberta(false); setBusca('')
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: '2.5rem' }}>📓</span>
      <p style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.primary, fontSize: 13 }}>Carregando notes...</p>
    </div>
  )

  if (erro) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ color: '#ef4444', fontFamily: typography.fontFamily.primary, fontSize: 13 }}>{erro}</p>
    </div>
  )

  const blocoEmConfirm = confirmModal ? blocos.find(b => b.id === confirmModal.blocoId) : null

  return (
    <>
      <style>{`
        @keyframes destacarCard {
          0%,100%{box-shadow:0 4px 12px rgba(0,0,0,.22)}
          30%,60%{box-shadow:0 0 0 3px #fb923c,0 8px 32px rgba(251,146,60,.5)}
        }
        @keyframes snapBack {
          0%{transform:scale(1.04)} 40%{transform:scale(0.96)} 70%{transform:scale(1.02)} 100%{transform:scale(1)}
        }
        @keyframes modalEntrar {
          from{opacity:0;transform:scale(.96) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)}
        }
        @keyframes dropdownEntrar {
          from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)}
        }
        @keyframes dropdownOpen {
          from{opacity:0;transform:scale(0.92) translateY(4px)} to{opacity:1;transform:scale(1) translateY(0)}
        }
        @keyframes zoomExpand {
          from{opacity:0;transform:scale(.85) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)}
        }
        @keyframes cardEntrar {
          from{opacity:0;transform:scale(0.55) translateY(-40px)}
          to{opacity:1;transform:scale(1) translateY(0)}
        }
        @keyframes cardSair {
        from { opacity:1; transform: rotateY(0deg) translateX(0); }
        to   { opacity:0; transform: rotateY(-45deg) translateX(-60px) scale(0.85); }
        }
        @keyframes cardEntrarModal {
          from { opacity:0; transform: rotateY(30deg) translateX(40px) scale(0.9); }
          to   { opacity:1; transform: rotateY(0deg) translateX(0) scale(1); }
        }
      `}</style>

      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        style={{
          position: 'fixed', top: 92, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0,
          transform: `translate(${camX}px,${camY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          willChange: 'transform',
          // overflow visible para os headers dos blocos aparecerem acima das células
          overflow: 'visible',
        }}>
          {notes.length === 0 && blocos.length === 0 && (
            <div style={{ position: 'absolute', top: 40, left: 40, color: colors.text.secondary, fontFamily: typography.fontFamily.primary, fontSize: 14, pointerEvents: 'none' }}>
              Clique em "Criar novo note" para começar
            </div>
          )}

          {notesVisiveis.map(note => {
            const isDragging = draggingNoteId === note.id
            const posX       = isDragging && dragPos ? dragPos.x : note.canvas_x
            const posY       = isDragging && dragPos ? dragPos.y : note.canvas_y
            const blocosSemEsteCard = blocos.filter(b => !b.card_ids.includes(note.id))
            return (
              <PostIt
                key={note.id}
                note={note}
                posX={posX} posY={posY}
                isDragging={isDragging}
                isSnapBack={snapBackId === note.id}
                destacado={destacado === note.id}
                isNew={newNoteId === note.id}
                dropdownAberto={dropdownCardId === note.id}
                blocos={blocosSemEsteCard}
                zoom={zoom}
                onAbrir={() => setNoteLendo(note)}
                onDragStart={e => iniciarDragNote(e, note)}
                onDropdownToggle={e => {
                  e.stopPropagation()
                  setDropdownCardId(prev => prev === note.id ? null : note.id)
                  setDropdownBlocoId(null)
                }}
                onFormarBloco={() => { setFormarBlocoCardId(note.id); setDropdownCardId(null) }}
                onCliparEmBloco={blocoId => cliparEmBloco(note.id, blocoId)}
                onEnviarFeed={() => { setNoteLendo(note); setDropdownCardId(null) }}
                onEnviarCampo={() => { setNoteLendo(note); setDropdownCardId(null) }}
                onEditar={() => { window.location.href = note.url_editar }}
                onExcluir={() => excluirNote(note.id)}
                onDropdownFechar={() => setDropdownCardId(null)}
              />
            )
          })}

          {blocosVisiveis.map(bloco => {
            const isDragging = draggingBlocoId === bloco.id
            return (
              <BlocoTorre
                key={bloco.id}
                bloco={bloco}
                posX={bloco.canvas_x}
                posY={bloco.canvas_y}
                isDragging={isDragging}
                dragPos={isDragging ? dragPos : null}
                dropdownAberto={dropdownBlocoId === bloco.id}
                zoom={zoom}
                onAbrir={() => setModalBlocoAberto(bloco)}
                onDragStart={e => iniciarDragBloco(e, bloco)}
                onDropdownToggle={e => {
                  e.stopPropagation()
                  setDropdownBlocoId(prev => prev === bloco.id ? null : bloco.id)
                  setDropdownCardId(null)
                }}
                onDesfazer={() => setConfirmModal({ tipo: 'desfazer', blocoId: bloco.id })}
                onDestruir={() => setConfirmModal({ tipo: 'destruir', blocoId: bloco.id })}
              />
            )
          })}
        </div>

        {/* Barra de busca */}
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            background: buscaExpanded ? 'rgba(10,6,28,0.92)' : 'rgba(10,6,28,0.55)',
            backdropFilter: 'blur(16px)',
            borderRadius: buscaExpanded ? 14 : 20,
            border: `1px solid ${buscaExpanded ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.10)'}`,
            boxShadow: buscaExpanded ? '0 8px 32px rgba(0,0,0,0.4)' : 'none',
            overflow: 'hidden',
            transition: 'border-radius 0.2s, background 0.2s, box-shadow 0.2s',
            minWidth: buscaExpanded ? 360 : undefined,
          }}>
            <div
              style={{ display: 'flex', alignItems: 'center', padding: buscaExpanded ? '0 14px' : '5px 14px', gap: 8, cursor: buscaExpanded ? 'default' : 'pointer' }}
              onClick={!buscaExpanded ? toggleBusca : undefined}
            >
              <span style={{ fontSize: 12, opacity: 0.5, flexShrink: 0 }}>🔍</span>
              {buscaExpanded
                ? <input
                  ref={buscaInputRef}
                  type="text"
                  placeholder="Buscar notes..."
                  value={busca}
                  onChange={e => { setBusca(e.target.value); setBuscaAberta(true) }}
                  onFocus={() => setBuscaAberta(true)}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: typography.fontFamily.primary, fontSize: 13, color: 'rgba(255,255,255,0.88)', padding: '11px 0', minWidth: 260 }}
                />
                : <span style={{ fontFamily: typography.fontFamily.primary, fontSize: 12, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>procurar notes</span>
              }
              {buscaExpanded && (
                <button onClick={toggleBusca} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 14, flexShrink: 0, padding: '0 0 0 4px' }}>✕</button>
              )}
            </div>
            {buscaExpanded && buscaAberta && busca && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                {resultadosBusca.length === 0
                  ? <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 12, color: 'rgba(255,255,255,0.35)', padding: '12px 14px', margin: 0 }}>Nenhum resultado para "{busca}"</p>
                  : <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 10, color: 'rgba(255,255,255,0.30)', padding: '8px 14px 4px', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {resultadosBusca.length} resultado{resultadosBusca.length > 1 ? 's' : ''}
                    </p>
                    {resultadosBusca.map(n => {
                      const qi  = n.conteudo.toLowerCase().indexOf(busca.toLowerCase())
                      const trecho = qi >= 0 ? '...' + n.conteudo.slice(Math.max(0, qi - 20), qi + 60) + '...' : n.conteudo.slice(0, 80) + '...'
                      return (
                        <button
                          key={n.id}
                          onMouseDown={() => navegarAteNote(n)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                        >
                          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: '0 0 2px' }}>{n.titulo_capa || n.titulo}</p>
                          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trecho}</p>
                        </button>
                      )
                    })}
                  </div>
                }
              </div>
            )}
          </div>
        </div>

        {/* Controles de zoom */}
        <div style={{ position: 'absolute', bottom: 100, right: 28, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {zoomExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, animation: 'zoomExpand 0.18s ease-out' }}>
              <BotaoZoom label="+" title="Aproximar" onClick={zoomIn} />
              <BotaoZoom label={`${Math.round(zoom * 100)}%`} title="Resetar para 100%" onClick={zoomReset} small />
              <BotaoZoom label="−" title="Afastar" onClick={zoomOut} />
            </div>
          )}
          <button
            onClick={() => setZoomExpanded(v => !v)}
            title="Controles de zoom"
            style={{
              width: 42, height: 42, borderRadius: '50%',
              background: zoomExpanded ? 'rgba(251,146,60,0.85)' : 'rgba(15,10,35,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, transition: 'background 0.2s',
            }}
          >🎮</button>
        </div>

        {/* FAB */}
        <button
          onClick={() => setComposerAberto(true)}
          style={{
            position: 'absolute', bottom: 28, right: 28,
            height: 44, borderRadius: 22,
            background: 'linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px',
            boxShadow: '0 4px 16px rgba(59,130,246,0.45)',
            zIndex: 60, transition: 'transform 0.2s, box-shadow 0.2s',
            fontFamily: typography.fontFamily.primary, fontSize: 13, fontWeight: 600, color: 'white',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(59,130,246,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.45)' }}
        >
          <LapisSVG />
          Criar novo note
        </button>
      </div>

      {/* Modais */}
      {formarBlocoCardId !== null && (
        <ModalFormarBloco
          onConfirmar={nome => formarBloco(formarBlocoCardId, nome)}
          onCancelar={() => setFormarBlocoCardId(null)}
        />
      )}

      {modalBlocoAberto && (
        <ModalBloco
          bloco={modalBlocoAberto}
          onFechar={() => setModalBlocoAberto(null)}
          onRemoverCard={cardId => removerCardDoBloco(modalBlocoAberto.id, cardId)}
        />
      )}

      {noteLendo && (
        <ModalLeitura
          note={noteLendo}
          onFechar={() => setNoteLendo(null)}
          onExcluido={onNoteExcluido}
        />
      )}

      {composerAberto && (
        <ComposerModal
          notes={notes}
          blocos={blocos}
          onFechar={() => setComposerAberto(false)}
          onCriado={onNoteCriado}
        />
      )}

      {confirmModal && blocoEmConfirm && (
        <ModalConfirm
          titulo={confirmModal.tipo === 'desfazer' ? 'Desfazer bloco?' : 'Destruir bloco?'}
          descricao={
            confirmModal.tipo === 'desfazer'
              ? `O bloco "${blocoEmConfirm.nome}" será dissolvido e todos os ${blocoEmConfirm.cards.length} cards voltarão ao canvas principal. Esta ação não pode ser desfeita.`
              : `O bloco "${blocoEmConfirm.nome}" e todos os seus ${blocoEmConfirm.cards.length} cards serão excluídos permanentemente. Esta ação não pode ser desfeita.`
          }
          labelConfirmar={confirmModal.tipo === 'desfazer' ? 'Desfazer bloco' : 'Destruir tudo'}
          onConfirmar={() =>
            confirmModal.tipo === 'desfazer'
              ? desfazerBloco(confirmModal.blocoId)
              : destruirBloco(confirmModal.blocoId)
          }
          onCancelar={() => setConfirmModal(null)}
        />
      )}
    </>
  )
}