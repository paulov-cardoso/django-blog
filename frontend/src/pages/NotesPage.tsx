import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { colors, typography } from '../design/tokens'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Categoria { nome: string; cor: string }

interface Note {
  id: number; titulo: string; titulo_capa: string; conteudo: string
  cor: string; data: string; imagem_capa: string | null
  categorias: Categoria[]; curtidas: number; clips: number
  url_editar: string; url_detalhe: string
  canvas_x: number; canvas_y: number; canvas_ordem: number
}

// ─── Constantes do canvas ─────────────────────────────────────────────────────

const CARD_W       = 260   // largura do card em px (unidades de canvas)
const CARD_H       = 220   // altura do card
const GRID_COL     = 280   // espaçamento horizontal entre células do grid
const GRID_ROW     = 240   // espaçamento vertical entre células do grid
const ZOOM_MIN     = 0.35
const ZOOM_MAX     = 2.0
const ZOOM_STEP    = 0.12
const ZOOM_DEFAULT = 1.0
const BUFFER_PX    = 300   // buffer de pré-renderização fora da viewport

// ─── Paleta ───────────────────────────────────────────────────────────────────

const PALETA_BASE = [
  { hex: '#F59E0B', nome: 'Âmbar'    },
  { hex: '#EF4444', nome: 'Vermelho' },
  { hex: '#EC4899', nome: 'Rosa'     },
  { hex: '#8B5CF6', nome: 'Roxo'     },
  { hex: '#3B82F6', nome: 'Azul'     },
  { hex: '#06B6D4', nome: 'Ciano'    },
  { hex: '#10B981', nome: 'Verde'    },
  { hex: '#84CC16', nome: 'Lima'     },
  { hex: '#F97316', nome: 'Laranja'  },
  { hex: '#14B8A6', nome: 'Turquesa' },
  { hex: '#6B7280', nome: 'Cinza'    },
]

// ─── Utilitários ──────────────────────────────────────────────────────────────

function snapToGrid(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(x / GRID_COL) * GRID_COL,
    y: Math.round(y / GRID_ROW) * GRID_ROW,
  }
}

function proximaPosicaoLivre(notes: Note[]): { x: number; y: number; ordem: number } {
  if (notes.length === 0) return { x: 0, y: 0, ordem: 0 }
  // Ordena por canvas_ordem e pega o último
  const ordenados = [...notes].sort((a, b) => b.canvas_ordem - a.canvas_ordem)
  const ultimo = ordenados[0]
  const snapUltimo = snapToGrid(ultimo.canvas_x, ultimo.canvas_y)
  // Tenta colocar à direita; se ultrapassar 4 colunas, salta para próxima linha
  const colAtual = Math.round(snapUltimo.x / GRID_COL)
  const linAtual = Math.round(snapUltimo.y / GRID_ROW)
  const novaCol  = colAtual + 1 < 4 ? colAtual + 1 : 0
  const novaLin  = colAtual + 1 < 4 ? linAtual : linAtual + 1
  return {
    x: novaCol * GRID_COL,
    y: novaLin * GRID_ROW,
    ordem: ultimo.canvas_ordem + 1,
  }
}

function ajustarLuminosidade(hex: string, luminosidade: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = max > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  const novoL = Math.max(0.15, Math.min(0.85, luminosidade))
  function hue2rgb(p: number, q: number, t: number) {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  let nr: number, ng: number, nb: number
  if (s === 0) { nr = ng = nb = novoL }
  else {
    const q2 = novoL < 0.5 ? novoL * (1 + s) : novoL + s - novoL * s
    const p2 = 2 * novoL - q2
    nr = hue2rgb(p2, q2, h + 1/3)
    ng = hue2rgb(p2, q2, h)
    nb = hue2rgb(p2, q2, h - 1/3)
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`
}

function getLuminosidadeBase(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

function isEscuro(hex: string): boolean {
  if (!hex || hex === '#ffffff') return false
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return (0.299 * r + 0.587 * g + 0.114 * b) < 0.6
}

function getCsrf() {
  const cookie = document.cookie.split(';').find(c => c.trim().startsWith('csrftoken='))
  return cookie ? cookie.split('=')[1] : ''
}

// ─── NotesPage ────────────────────────────────────────────────────────────────

export function NotesPage() {
  const [notes, setNotes]           = useState<Note[]>([])
  const [loading, setLoading]       = useState(true)
  const [erro, setErro]             = useState('')
  const [composerAberto, setComposerAberto] = useState(false)
  const [noteLendo, setNoteLendo]   = useState<Note | null>(null)

  // ── Câmera ────────────────────────────────────────────────────────────────
  const [camX, setCamX]   = useState(0)      // offset X da câmera (px de tela)
  const [camY, setCamY]   = useState(0)      // offset Y da câmera
  const [zoom, setZoom]   = useState(ZOOM_DEFAULT)

  // ── Pan ───────────────────────────────────────────────────────────────────
  const panRef       = useRef(false)
  const panStart     = useRef({ x: 0, y: 0, camX: 0, camY: 0 })

  // ── Drag de card ──────────────────────────────────────────────────────────
  const dragRef      = useRef<{ id: number; startMouseX: number; startMouseY: number; startCardX: number; startCardY: number } | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragPos, setDragPos]       = useState<{ x: number; y: number } | null>(null)

  // ── Busca ─────────────────────────────────────────────────────────────────
  const [busca, setBusca]           = useState('')
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [resultadoDestacado, setResultadoDestacado] = useState<number | null>(null)

  // ── Zoom controls expandidos ──────────────────────────────────────────────
  const [zoomExpanded, setZoomExpanded] = useState(false)

  // ── Container ref ─────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { carregarNotes() }, [])

  function carregarNotes() {
    fetch('/api/notes/privados/')
      .then(res => res.json())
      .then(data => {
        const posts: Note[] = data.posts
        // Se notes sem posição definida (canvas_x e canvas_y ambos 0 e não é o único),
        // distribuir em grid automaticamente
        const semPosicao = posts.filter(n => n.canvas_x === 0 && n.canvas_y === 0)
        if (semPosicao.length > 1) {
          semPosicao.forEach((note, i) => {
            note.canvas_x = (i % 4) * GRID_COL
            note.canvas_y = Math.floor(i / 4) * GRID_ROW
            note.canvas_ordem = i
          })
        }
        setNotes(posts)
        setLoading(false)
      })
      .catch(() => { setErro('Erro ao carregar notes.'); setLoading(false) })
  }

  // ── Salva posição no backend (debounced via timeout) ──────────────────────
  const salvarPosicaoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  function salvarPosicao(id: number, x: number, y: number, ordem: number) {
    if (salvarPosicaoTimeout.current) clearTimeout(salvarPosicaoTimeout.current)
    salvarPosicaoTimeout.current = setTimeout(() => {
      fetch(`/api/notes/${id}/posicao/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
        body: JSON.stringify({ x, y, ordem }),
      })
    }, 600)
  }

  // ── Eventos de mouse no container ─────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Só pan se clicar no fundo (não em card)
    if ((e.target as HTMLElement).closest('[data-card]')) return
    if (e.button !== 0) return
    panRef.current = true
    panStart.current = { x: e.clientX, y: e.clientY, camX, camY }
    e.preventDefault()
  }, [camX, camY])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      // Pan
      if (panRef.current) {
        setCamX(panStart.current.camX + (e.clientX - panStart.current.x))
        setCamY(panStart.current.camY + (e.clientY - panStart.current.y))
      }
      // Drag de card
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startMouseX) / zoom
        const dy = (e.clientY - dragRef.current.startMouseY) / zoom
        setDragPos({
          x: dragRef.current.startCardX + dx,
          y: dragRef.current.startCardY + dy,
        })
      }
    }
    function onMouseUp(e: MouseEvent) {
      panRef.current = false
      // Finaliza drag com snap-to-grid
      if (dragRef.current && dragPos) {
        const { id } = dragRef.current
        const snapped = snapToGrid(dragPos.x, dragPos.y)
        setNotes(prev => prev.map(n => {
          if (n.id !== id) return n
          salvarPosicao(id, snapped.x, snapped.y, n.canvas_ordem)
          return { ...n, canvas_x: snapped.x, canvas_y: snapped.y }
        }))
        dragRef.current = null
        setDraggingId(null)
        setDragPos(null)
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [zoom, dragPos])

  // ── Zoom via scroll ───────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
    setZoom(z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta)))
  }, [])

  function zoomIn()    { setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))) }
  function zoomOut()   { setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))) }
  function zoomReset() { setZoom(ZOOM_DEFAULT); setCamX(0); setCamY(0) }

  // ── Início do drag de card ────────────────────────────────────────────────
  function iniciarDragCard(e: React.MouseEvent, note: Note) {
    e.stopPropagation()
    dragRef.current = {
      id: note.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startCardX: note.canvas_x,
      startCardY: note.canvas_y,
    }
    setDraggingId(note.id)
    setDragPos({ x: note.canvas_x, y: note.canvas_y })
  }

  // ── Navegar câmera até um note (busca) ────────────────────────────────────
  function navegarAteNote(note: Note) {
    const container = containerRef.current
    if (!container) return
    const { width, height } = container.getBoundingClientRect()
    // Centraliza o card na viewport
    setCamX(width  / 2 - (note.canvas_x + CARD_W / 2) * zoom)
    setCamY(height / 2 - (note.canvas_y + CARD_H / 2) * zoom)
    setResultadoDestacado(note.id)
    setBuscaAberta(false)
    setBusca('')
    setTimeout(() => setResultadoDestacado(null), 2000)
  }

  // ── Virtualização: só renderiza cards visíveis + buffer ───────────────────
  const notesVisiveis = useMemo(() => {
    const container = containerRef.current
    if (!container) return notes
    const { width, height } = container.getBoundingClientRect()
    // Bounds da viewport em coordenadas de canvas
    const x0 = (-camX - BUFFER_PX) / zoom
    const y0 = (-camY - BUFFER_PX) / zoom
    const x1 = (-camX + width  + BUFFER_PX) / zoom
    const y1 = (-camY + height + BUFFER_PX) / zoom
    return notes.filter(n => {
      const cx = draggingId === n.id && dragPos ? dragPos.x : n.canvas_x
      const cy = draggingId === n.id && dragPos ? dragPos.y : n.canvas_y
      return cx + CARD_W > x0 && cx < x1 && cy + CARD_H > y0 && cy < y1
    })
  }, [notes, camX, camY, zoom, draggingId, dragPos])

  // ── Resultados de busca ───────────────────────────────────────────────────
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

  function onNoteCriado(note: Note) {
    setNotes(prev => [note, ...prev])
    setComposerAberto(false)
    // Navega câmera até o novo note
    setTimeout(() => navegarAteNote(note), 100)
  }

  function onNoteExcluido(id: number) {
    setNotes(prev => prev.filter(n => n.id !== id))
    setNoteLendo(null)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '12px' }}>
      <span style={{ fontSize: '2.5rem' }}>📓</span>
      <p style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.primary, fontSize: '13px' }}>Carregando notes...</p>
    </div>
  )

  if (erro) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ color: '#ef4444', fontFamily: typography.fontFamily.primary, fontSize: '13px' }}>{erro}</p>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes destacarCard {
          0%,100% { box-shadow: 0 4px 12px rgba(0,0,0,0.22); }
          30%      { box-shadow: 0 0 0 3px #fb923c, 0 8px 32px rgba(251,146,60,0.5); }
          60%      { box-shadow: 0 0 0 3px #fb923c, 0 8px 32px rgba(251,146,60,0.5); }
        }
        @keyframes modalEntrar {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes dropdownEntrar {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes buscaEntrar {
          from { opacity: 0; transform: translateY(-8px) scaleY(0.95); }
          to   { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes zoomExpand {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* ── Wrapper fixo — ocupa o viewport abaixo da navbar+tabbar ─────── */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        style={{
          position: 'fixed',
          top: '92px',     // navbar 56px + tabbar 36px
          left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          cursor: panRef.current ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        {/* ── World: transform de câmera ─────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0,
            transform: `translate(${camX}px, ${camY}px) scale(${zoom})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          {notes.length === 0 ? (
            <div style={{ position: 'absolute', top: '40px', left: '40px', color: colors.text.secondary, fontFamily: typography.fontFamily.primary, fontSize: '14px', pointerEvents: 'none' }}>
              Clique em "✏️ Criar novo note" para começar
            </div>
          ) : (
            notesVisiveis.map(note => {
              const isDragging = draggingId === note.id
              const posX = isDragging && dragPos ? dragPos.x : note.canvas_x
              const posY = isDragging && dragPos ? dragPos.y : note.canvas_y
              const destacado = resultadoDestacado === note.id
              return (
                <PostIt
                  key={note.id}
                  note={note}
                  posX={posX}
                  posY={posY}
                  isDragging={isDragging}
                  destacado={destacado}
                  onAbrir={() => { if (!isDragging) setNoteLendo(note) }}
                  onDragStart={e => iniciarDragCard(e, note)}
                />
              )
            })
          )}
        </div>

        {/* ── Barra de busca flutuante ───────────────────────────────────── */}
        <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 60, width: '100%', maxWidth: '440px', padding: '0 16px' }}>
          <div style={{
            background: 'rgba(10,6,28,0.88)',
            backdropFilter: 'blur(16px)',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', gap: '8px' }}>
              <span style={{ fontSize: '14px', opacity: 0.5 }}>🔍</span>
              <input
                type="text"
                placeholder="Buscar notes..."
                value={busca}
                onChange={e => { setBusca(e.target.value); setBuscaAberta(true) }}
                onFocus={() => setBuscaAberta(true)}
                onBlur={() => setTimeout(() => setBuscaAberta(false), 150)}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontFamily: typography.fontFamily.primary, fontSize: '13px',
                  color: 'rgba(255,255,255,0.88)', padding: '11px 0',
                }}
              />
              {busca && (
                <button onClick={() => { setBusca(''); setBuscaAberta(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>✕</button>
              )}
            </div>

            {/* Resultados */}
            {buscaAberta && busca && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', animation: 'buscaEntrar 0.15s ease-out' }}>
                {resultadosBusca.length === 0 ? (
                  <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '12px', color: 'rgba(255,255,255,0.35)', padding: '12px 14px', margin: 0 }}>
                    Nenhum resultado para "{busca}"
                  </p>
                ) : (
                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '10px', color: 'rgba(255,255,255,0.30)', padding: '8px 14px 4px', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {resultadosBusca.length} resultado{resultadosBusca.length > 1 ? 's' : ''}
                    </p>
                    {resultadosBusca.map(note => {
                      const idx = note.conteudo.toLowerCase().indexOf(busca.toLowerCase())
                      const trecho = idx >= 0
                        ? '...' + note.conteudo.slice(Math.max(0, idx - 20), idx + 60) + '...'
                        : note.conteudo.slice(0, 80) + '...'
                      return (
                        <button
                          key={note.id}
                          onMouseDown={() => navegarAteNote(note)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '8px 14px', borderRadius: 0,
                            borderTop: '1px solid rgba(255,255,255,0.04)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                        >
                          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: '0 0 2px' }}>
                            {note.titulo_capa || note.titulo}
                          </p>
                          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '11px', color: 'rgba(255,255,255,0.38)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {trecho}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Controles de zoom (colapsável) ────────────────────────────── */}
        <div style={{ position: 'absolute', bottom: '100px', right: '28px', zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {zoomExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', animation: 'zoomExpand 0.18s ease-out' }}>
              <BotaoZoom label="+" title="Aproximar" onClick={zoomIn} />
              <BotaoZoom label={`${Math.round(zoom * 100)}%`} title="Resetar zoom" onClick={zoomReset} small />
              <BotaoZoom label="−" title="Afastar" onClick={zoomOut} />
            </div>
          )}
          <button
            onClick={() => setZoomExpanded(v => !v)}
            title="Controles de zoom"
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: zoomExpanded ? 'rgba(251,146,60,0.9)' : 'rgba(15,10,35,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', transition: 'background 0.2s, transform 0.2s',
              transform: zoomExpanded ? 'rotate(45deg)' : 'none',
            }}
          >
            🔎
          </button>
        </div>

        {/* ── Botão flutuante Criar ──────────────────────────────────────── */}
        <button
          onClick={() => setComposerAberto(true)}
          style={{
            position: 'absolute', bottom: '28px', right: '28px',
            height: '44px', borderRadius: '22px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px',
            boxShadow: '0 4px 16px rgba(59,130,246,0.45)',
            zIndex: 60, transition: 'transform 0.2s, box-shadow 0.2s',
            fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 600, color: 'white',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(59,130,246,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.45)' }}
        >
          ✏️ Criar novo note
        </button>
      </div>

      {/* ── Modais (fora do canvas, z-index alto) ─────────────────────── */}
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
          onFechar={() => setComposerAberto(false)}
          onCriado={onNoteCriado}
        />
      )}
    </>
  )
}

// ─── BotaoZoom ────────────────────────────────────────────────────────────────

function BotaoZoom(props: { label: string; title: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      style={{
        width: '40px', height: props.small ? '32px' : '40px',
        borderRadius: props.small ? '8px' : '50%',
        background: 'rgba(15,10,35,0.85)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        cursor: 'pointer', color: 'white',
        fontFamily: typography.fontFamily.primary,
        fontSize: props.small ? '10px' : '20px',
        fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,146,60,0.7)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,10,35,0.85)' }}
    >
      {props.label}
    </button>
  )
}

// ─── PostIt ───────────────────────────────────────────────────────────────────

function PostIt(props: {
  note: Note; posX: number; posY: number
  isDragging: boolean; destacado: boolean
  onAbrir: () => void; onDragStart: (e: React.MouseEvent) => void
}) {
  const { note, posX, posY, isDragging, destacado } = props
  const temFoto = Boolean(note.imagem_capa)

  const preview = (() => {
    const frases = note.conteudo.split(/(?<=[.!?])\s+/)
    let resultado = ''
    for (const f of frases) {
      if ((resultado + f).length > 180) break
      resultado += (resultado ? ' ' : '') + f
      if (resultado.split(/[.!?]/).length - 1 >= 2) break
    }
    return resultado || note.conteudo.slice(0, 180)
  })()

  const bgStyle = temFoto
    ? { backgroundImage: `url(${note.imagem_capa})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: note.cor }

  return (
    <div
      data-card="true"
      style={{
        position: 'absolute',
        left: posX, top: posY,
        width: CARD_W, height: CARD_H,
        ...bgStyle,
        borderRadius: '12px',
        boxShadow: isDragging
          ? '0 20px 48px rgba(0,0,0,0.5)'
          : destacado
            ? '0 0 0 3px #fb923c, 0 8px 32px rgba(251,146,60,0.5)'
            : '0 4px 12px rgba(0,0,0,0.22)',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
        animation: destacado ? 'destacarCard 2s ease-in-out' : undefined,
        zIndex: isDragging ? 100 : 1,
        userSelect: 'none',
      }}
      onMouseDown={props.onDragStart}
      onClick={props.onAbrir}
    >
      {temFoto && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)', borderRadius: '12px' }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: temFoto ? '16px 16px 0' : '16px 16px 0', flex: 1, overflow: 'hidden' }}>
        {note.categorias.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
            {note.categorias.slice(0, 2).map(cat => (
              <span key={cat.nome} style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', background: 'rgba(0,0,0,0.15)', color: temFoto ? 'white' : 'rgba(0,0,0,0.55)', fontFamily: typography.fontFamily.primary }}>
                {cat.nome}
              </span>
            ))}
          </div>
        )}
        <h3 style={{ fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 700, color: temFoto ? 'white' : 'rgba(0,0,0,0.82)', margin: '0 0 6px', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {note.titulo_capa || note.titulo}
        </h3>
        <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '11px', lineHeight: 1.6, color: temFoto ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.55)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
          {preview}
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '8px 16px 12px' }}>
        <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '9px', color: temFoto ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)', letterSpacing: '0.02em' }}>
          🕐 {note.data}
        </span>
      </div>
    </div>
  )
}

// ─── ModalLeitura ─────────────────────────────────────────────────────────────

function ModalLeitura(props: { note: Note; onFechar: () => void; onExcluido: (id: number) => void }) {
  const { note } = props
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [publicando, setPublicando]         = useState(false)
  const [erroAcao, setErroAcao]             = useState('')
  const temFoto = Boolean(note.imagem_capa)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function excluir() {
    if (!confirm('Excluir este note permanentemente?')) return
    fetch(`/api/notes/${note.id}/excluir/`, { method: 'POST', headers: { 'X-CSRFToken': getCsrf() } })
      .then(() => props.onExcluido(note.id))
  }

  function publicar(destino: 'feed' | 'campo') {
    setPublicando(true); setErroAcao('')
    fetch(`/api/notes/${note.id}/publicar/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ destino }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) window.location.href = `/?aba=${destino}`
        else if (data.erro === 'sem_categoria') setErroAcao('Adicione uma categoria antes de publicar.')
        else if (data.erro === 'sem_capa')      setErroAcao('O Feed requer imagem de capa.')
        else setErroAcao('Erro ao publicar.')
        setPublicando(false); setDropdownAberto(false)
      })
      .catch(() => { setErroAcao('Erro de conexão.'); setPublicando(false) })
  }

  const bgModal     = temFoto ? '#0f0a1e' : (note.cor || '#ffffff')
  const textoModal  = temFoto || isEscuro(note.cor) ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.82)'
  const subtexto    = temFoto || isEscuro(note.cor) ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.42)'

  return (
    <>
      <div onClick={props.onFechar} style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', pointerEvents: 'none' }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: bgModal, borderRadius: '20px', width: '100%', maxWidth: '580px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', animation: 'modalEntrar 0.22s ease-out forwards', pointerEvents: 'auto' }}
        >
          {temFoto && (
            <div style={{ position: 'relative', height: '200px', flexShrink: 0, background: `url(${note.imagem_capa}) center/cover` }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(15,10,30,0.95) 100%)' }} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
              {note.categorias.length > 0
                ? note.categorias.map(cat => (
                    <span key={cat.nome} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', color: textoModal, fontFamily: typography.fontFamily.primary }}>{cat.nome}</span>
                  ))
                : <span style={{ fontSize: '11px', color: subtexto, fontFamily: typography.fontFamily.primary, fontStyle: 'italic' }}>sem categoria</span>
              }
            </div>
            <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0, marginLeft: '12px' }}>
              <button
                onClick={() => { setDropdownAberto(v => !v); setErroAcao('') }}
                style={{ background: 'rgba(255,255,255,0.10)', border: 'none', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: typography.fontFamily.primary, fontSize: '12px', fontWeight: 600, color: textoModal }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
              >
                <span style={{ letterSpacing: '2px' }}>•••</span>
              </button>
              {dropdownAberto && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'rgba(10,6,25,0.97)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '14px', padding: '8px', minWidth: '220px', backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 10, animation: 'dropdownEntrar 0.18s ease-out forwards' }}>
                  <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px 8px', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '6px' }}>
                    O que fazer com essa ideia?
                  </p>
                  {erroAcao && <p style={{ color: '#f87171', fontSize: '11px', padding: '4px 10px 6px', fontFamily: typography.fontFamily.primary, margin: 0 }}>{erroAcao}</p>}
                  <OpcaoDropdown emoji="👥" label="Enviar para o Feed"  desc="Compartilhe com seus seguidores"       onClick={() => publicar('feed')}  disabled={publicando} />
                  <OpcaoDropdown emoji="🌍" label="Enviar para o Campo" desc="Torne pública no Campo das Ideias"     onClick={() => publicar('campo')} disabled={publicando} />
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
                  <OpcaoDropdown emoji="✏️" label="Editar note"         desc="Alterar título, texto ou imagem"       onClick={() => { window.location.href = note.url_editar }} />
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
                  <OpcaoDropdown emoji="🗑️" label="Excluir note"        desc="Remove permanentemente"                onClick={excluir} danger />
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
            <h2 style={{ fontFamily: typography.fontFamily.primary, fontSize: '22px', fontWeight: 800, color: textoModal, margin: 0, lineHeight: 1.3 }}>
              {note.titulo_capa || note.titulo}
            </h2>
            <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '11px', color: subtexto, margin: '6px 0 0' }}>🕐 {note.data}</p>
          </div>

          <div style={{ padding: '16px 24px 24px', overflowY: 'auto', flex: 1 }}>
            <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '14px', lineHeight: 1.8, color: textoModal, margin: 0, whiteSpace: 'pre-wrap' }}>
              {note.conteudo}
            </p>
          </div>

          <div style={{ padding: '16px 24px 20px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={props.onFechar}
              style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 600, color: textoModal, opacity: 0.7 }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.7' }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── OpcaoDropdown ────────────────────────────────────────────────────────────

function OpcaoDropdown(props: { emoji: string; label: string; desc: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={props.onClick} disabled={props.disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left', background: hover ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', borderRadius: '10px', padding: '8px 10px', cursor: props.disabled ? 'default' : 'pointer', opacity: props.disabled ? 0.45 : 1, transition: 'background 0.15s', gap: '1px' }}
    >
      <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 600, color: props.danger ? '#f87171' : 'rgba(255,255,255,0.88)' }}>{props.emoji} {props.label}</span>
      <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '11px', color: props.danger ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.35)', paddingLeft: '22px' }}>{props.desc}</span>
    </button>
  )
}

// ─── ComposerModal ────────────────────────────────────────────────────────────

function ComposerModal(props: { notes: Note[]; onFechar: () => void; onCriado: (note: Note) => void }) {
  const [titulo, setTitulo]             = useState('')
  const [conteudo, setConteudo]         = useState('')
  const [corBase, setCorBase]           = useState<string | null>(null)
  const [luminosidade, setLuminosidade] = useState(0.45)
  const [fotoPreview, setFotoPreview]   = useState<string | null>(null)
  const [fotoArquivo, setFotoArquivo]   = useState<File | null>(null)
  const [erro, setErro]                 = useState('')
  const [salvando, setSalvando]         = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  const corFinal    = corBase ? ajustarLuminosidade(corBase, luminosidade) : '#ffffff'
  const fundoEscuro = luminosidade < 0.55 && corBase !== null
  const textoEl     = fundoEscuro ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.80)'
  const inputBg     = fundoEscuro ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)'

  const sliderRef  = useRef<HTMLDivElement>(null)
  const arrastando = useRef(false)

  const calcLuminosidade = useCallback((clientY: number) => {
    const rect = sliderRef.current?.getBoundingClientRect()
    if (!rect) return
    setLuminosidade(Math.max(0.15, Math.min(0.85, 1 - (clientY - rect.top) / rect.height)))
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (arrastando.current) calcLuminosidade(e.clientY) }
    const onUp   = () => { arrastando.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [calcLuminosidade])

  function onEscolherCor(hex: string) {
    if (corBase === hex) { setCorBase(null); setLuminosidade(0.45) }
    else { setCorBase(hex); setLuminosidade(getLuminosidadeBase(hex)) }
  }

  function onEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setFotoArquivo(file)
    const reader = new FileReader()
    reader.onload = ev => setFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function removerFoto() {
    setFotoPreview(null); setFotoArquivo(null)
    if (inputFotoRef.current) inputFotoRef.current.value = ''
  }

  async function salvar() {
    if (!titulo.trim())   { setErro('Título obrigatório.'); return }
    if (!conteudo.trim()) { setErro('Conteúdo obrigatório.'); return }
    setSalvando(true); setErro('')

    // Calcula próxima posição livre no canvas
    const pos = proximaPosicaoLivre(props.notes)

    let res: Response
    if (fotoArquivo) {
      const form = new FormData()
      form.append('titulo', titulo); form.append('conteudo', conteudo)
      form.append('cor', corFinal); form.append('imagem_capa', fotoArquivo)
      form.append('canvas_x', String(pos.x)); form.append('canvas_y', String(pos.y))
      form.append('canvas_ordem', String(pos.ordem))
      res = await fetch('/api/notes/criar/', { method: 'POST', headers: { 'X-CSRFToken': getCsrf() }, body: form })
    } else {
      res = await fetch('/api/notes/criar/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
        body: JSON.stringify({ titulo, conteudo, cor: corFinal, canvas_x: pos.x, canvas_y: pos.y, canvas_ordem: pos.ordem }),
      })
    }
    const data = await res.json()
    if (data.ok) props.onCriado(data.post)
    else { setErro(data.erro || 'Erro ao salvar.'); setSalvando(false) }
  }

  const indicadorPct = (1 - (luminosidade - 0.15) / 0.70) * 100

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={props.onFechar}>
      <div style={{ background: corFinal, borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'hidden', transition: 'background 0.25s' }} onClick={e => e.stopPropagation()}>

        {fotoPreview && (
          <div style={{ position: 'relative', height: '160px', background: `url(${fotoPreview}) center/cover` }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.45) 100%)' }} />
            <button onClick={removerFoto} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', fontSize: '14px' }}>✕</button>
          </div>
        )}

        <div style={{ padding: '24px' }}>
          <style>{`.note-input::placeholder { color: ${fundoEscuro ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.32)'}; }`}</style>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: typography.fontFamily.primary, fontSize: '15px', fontWeight: 700, color: textoEl, margin: 0 }}>Novo Note</h3>
            <button onClick={props.onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: textoEl, opacity: 0.5 }}>✕</button>
          </div>

          <input className="note-input" type="text" placeholder="Título..." value={titulo} onChange={e => setTitulo(e.target.value)}
            style={{ width: '100%', border: 'none', background: inputBg, borderRadius: '8px', padding: '10px 12px', fontSize: '14px', fontFamily: typography.fontFamily.primary, fontWeight: 600, color: textoEl, marginBottom: '10px', boxSizing: 'border-box', outline: 'none' }} />

          <textarea className="note-input" placeholder="O que está na sua cabeça?" value={conteudo} onChange={e => setConteudo(e.target.value)} rows={4}
            style={{ width: '100%', border: 'none', background: inputBg, borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: typography.fontFamily.primary, color: textoEl, resize: 'none', marginBottom: '16px', boxSizing: 'border-box', outline: 'none' }} />

          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '11px', fontWeight: 600, color: textoEl, opacity: 0.55, marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cor do card</p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', flex: 1 }}>
              <button onClick={() => { setCorBase(null); setLuminosidade(0.45) }} title="Padrão"
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ffffff', border: corBase === null ? '3px solid #6b7280' : '2px solid #d1d5db', cursor: 'pointer', transform: corBase === null ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s' }} />
              {PALETA_BASE.map(({ hex, nome }) => (
                <button key={hex} onClick={() => onEscolherCor(hex)} title={nome}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', background: hex, border: corBase === hex ? '3px solid rgba(255,255,255,0.8)' : '2px solid rgba(255,255,255,0.3)', cursor: 'pointer', transform: corBase === hex ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s', boxShadow: corBase === hex ? '0 0 0 2px rgba(0,0,0,0.25)' : 'none' }} />
              ))}
            </div>
            {corBase && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '9px', color: textoEl, opacity: 0.5 }}>☀️</span>
                <div ref={sliderRef} onMouseDown={e => { arrastando.current = true; calcLuminosidade(e.clientY) }} onClick={e => calcLuminosidade(e.clientY)}
                  style={{ width: '20px', height: '100px', borderRadius: '10px', cursor: 'ns-resize', position: 'relative', background: `linear-gradient(to bottom, ${ajustarLuminosidade(corBase, 0.85)}, ${ajustarLuminosidade(corBase, 0.45)}, ${ajustarLuminosidade(corBase, 0.15)})`, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                  <div style={{ position: 'absolute', left: '50%', top: `${indicadorPct}%`, transform: 'translate(-50%, -50%)', width: '18px', height: '18px', borderRadius: '50%', background: corFinal, border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
                </div>
                <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '9px', color: textoEl, opacity: 0.5 }}>🌑</span>
              </div>
            )}
          </div>

          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '11px', fontWeight: 600, color: textoEl, opacity: 0.55, marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Foto de capa</p>
          <input ref={inputFotoRef} type="file" accept="image/*" onChange={onEscolherFoto} style={{ display: 'none' }} id="upload-foto-note" />
          {!fotoPreview ? (
            <label htmlFor="upload-foto-note" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: inputBg, borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', marginBottom: '16px', border: `1.5px dashed ${textoEl}44` }}>
              <span style={{ fontSize: '18px' }}>🖼️</span>
              <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '12px', color: textoEl, opacity: 0.65 }}>Clique para adicionar uma foto</span>
            </label>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <img src={fotoPreview} alt="preview" style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '6px' }} />
              <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '12px', color: textoEl, opacity: 0.8, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fotoArquivo?.name}</span>
              <button onClick={removerFoto} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px' }}>✕</button>
            </div>
          )}

          {erro && <p style={{ color: '#ef4444', fontSize: '12px', fontFamily: typography.fontFamily.primary, marginBottom: '12px' }}>{erro}</p>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={props.onFechar} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: inputBg, border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 600, color: textoEl, opacity: 0.8 }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: fundoEscuro ? 'rgba(255,255,255,0.15)' : 'rgba(59,130,246,0.12)', border: `1.5px solid ${fundoEscuro ? 'rgba(255,255,255,0.3)' : '#3b82f6'}`, cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 700, color: fundoEscuro ? 'white' : '#3b82f6', opacity: salvando ? 0.6 : 1 }}>
              {salvando ? 'Salvando...' : 'Salvar Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}