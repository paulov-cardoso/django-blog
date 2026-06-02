import { useState, useEffect, useRef, useCallback } from 'react'
import { colors, typography } from '../design/tokens'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Categoria { nome: string; cor: string }

interface Note {
  id: number; titulo: string; titulo_capa: string; conteudo: string
  cor: string; data: string; imagem_capa: string | null
  categorias: Categoria[]; curtidas: number; clips: number
  url_editar: string; url_detalhe: string
}

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

function ajustarLuminosidade(hex: string, luminosidade: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
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

function getCsrf() {
  const cookie = document.cookie.split(';').find(c => c.trim().startsWith('csrftoken='))
  return cookie ? cookie.split('=')[1] : ''
}

// ─── NotesPage ────────────────────────────────────────────────────────────────

export function NotesPage() {
  const [notes, setNotes]               = useState<Note[]>([])
  const [loading, setLoading]           = useState(true)
  const [erro, setErro]                 = useState('')
  const [composerAberto, setComposerAberto] = useState(false)
  const [noteLendo, setNoteLendo]       = useState<Note | null>(null)

  useEffect(() => { carregarNotes() }, [])

  function carregarNotes() {
    fetch('/api/notes/privados/')
      .then(res => res.json())
      .then(data => { setNotes(data.posts); setLoading(false) })
      .catch(() => { setErro('Erro ao carregar notes.'); setLoading(false) })
  }

  function onNoteCriado(note: Note) {
    setNotes(prev => [note, ...prev])
    setComposerAberto(false)
  }

  function onNoteExcluido(id: number) {
    setNotes(prev => prev.filter(n => n.id !== id))
    setNoteLendo(null)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', flexDirection: 'column', gap: '12px' }}>
      <span style={{ fontSize: '2.5rem' }}>📓</span>
      <p style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.primary, fontSize: '13px' }}>Carregando notes...</p>
    </div>
  )

  if (erro) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px' }}>
      <p style={{ color: '#ef4444', fontFamily: typography.fontFamily.primary, fontSize: '13px' }}>{erro}</p>
    </div>
  )

  return (
    <div style={{ position: 'relative', minHeight: '60vh' }}>

      {notes.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '12px' }}>
          <span style={{ fontSize: '3rem' }}>📓</span>
          <p style={{ color: 'white', fontFamily: typography.fontFamily.primary, fontSize: '18px', fontWeight: 600 }}>Nenhum note ainda</p>
          <p style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.primary, fontSize: '13px' }}>Use o botão abaixo para criar seu primeiro note!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px', padding: '8px 0 100px' }}>
          {notes.map(note => (
            <PostIt
              key={note.id}
              note={note}
              onAbrir={() => setNoteLendo(note)}
            />
          ))}
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setComposerAberto(true)}
        style={{
          position: 'fixed', bottom: '28px', right: '28px',
          height: '44px', borderRadius: '22px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '0 20px',
          boxShadow: '0 4px 16px rgba(59,130,246,0.45)',
          zIndex: 50, transition: 'transform 0.2s, box-shadow 0.2s',
          fontFamily: typography.fontFamily.primary,
          fontSize: '13px', fontWeight: 600, color: 'white',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(59,130,246,0.6)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.45)' }}
      >
        ✏️ Criar novo note
      </button>

      {/* Modal de leitura */}
      {noteLendo && (
        <ModalLeitura
          note={noteLendo}
          onFechar={() => setNoteLendo(null)}
          onExcluido={onNoteExcluido}
        />
      )}

      {/* Modal de criação */}
      {composerAberto && (
        <ComposerModal onFechar={() => setComposerAberto(false)} onCriado={onNoteCriado} />
      )}
    </div>
  )
}

// ─── PostIt — só preview, clique abre modal ───────────────────────────────────

function PostIt(props: { note: Note; onAbrir: () => void }) {
  const { note } = props
  const temFoto = Boolean(note.imagem_capa)

  // Preview: até 2 frases ou ~180 chars
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
      onClick={props.onAbrir}
      style={{
        ...bgStyle,
        borderRadius: '12px',
        padding: temFoto ? '0' : '20px',
        minHeight: '200px',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.22)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.2s, box-shadow 0.2s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.32)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.22)' }}
    >
      {/* Gradiente sobre foto */}
      {temFoto && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)', borderRadius: '12px' }} />
      )}

      {/* Conteúdo */}
      <div style={{ position: 'relative', zIndex: 1, padding: temFoto ? '16px 16px 0' : '0', flex: 1 }}>
        {/* Categorias */}
        {note.categorias.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {note.categorias.map(cat => (
              <span key={cat.nome} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,0,0,0.15)', color: temFoto ? 'white' : 'rgba(0,0,0,0.55)', fontFamily: typography.fontFamily.primary }}>
                {cat.nome}
              </span>
            ))}
          </div>
        )}

        {/* Título */}
        <h3 style={{ fontFamily: typography.fontFamily.primary, fontSize: '14px', fontWeight: 700, color: temFoto ? 'white' : 'rgba(0,0,0,0.82)', margin: '0 0 8px', lineHeight: 1.35 }}>
          {note.titulo_capa || note.titulo}
        </h3>

        {/* Preview do conteúdo */}
        <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '12px', lineHeight: 1.65, color: temFoto ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.58)', margin: 0 }}>
          {preview}{note.conteudo.length > preview.length ? '…' : ''}
        </p>
      </div>

      {/* Rodapé: data */}
      <div style={{ position: 'relative', zIndex: 1, padding: temFoto ? '12px 16px 16px' : '12px 0 0' }}>
        <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '10px', color: temFoto ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.38)', letterSpacing: '0.02em' }}>
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

  // Fecha dropdown ao clicar fora
  const dropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function excluir() {
    if (!confirm('Excluir este note permanentemente?')) return
    fetch(`/api/notes/${note.id}/excluir/`, {
      method: 'POST', headers: { 'X-CSRFToken': getCsrf() },
    }).then(() => props.onExcluido(note.id))
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
        else if (data.erro === 'sem_categoria') setErroAcao('Adicione uma categoria antes de publicar. Use "Editar".')
        else if (data.erro === 'sem_capa')      setErroAcao('O Feed requer imagem de capa. Use "Editar".')
        else setErroAcao('Erro ao publicar.')
        setPublicando(false); setDropdownAberto(false)
      })
      .catch(() => { setErroAcao('Erro de conexão.'); setPublicando(false) })
  }

  // Cor de fundo do modal: foto → escuro, cor → a cor do note, sem cor → branco
  const bgModal = temFoto ? '#0f0a1e' : (note.cor || '#ffffff')
  const textoModal = temFoto || isEscuro(note.cor) ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.82)'
  const subtextoModal = temFoto || isEscuro(note.cor) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.42)'

  return (
    <>
      {/* Injeção de keyframes para animação */}
      <style>{`
        @keyframes modalEntrar {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes dropdownEntrar {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={props.onFechar}
        style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: bgModal,
            borderRadius: '20px',
            width: '100%', maxWidth: '580px',
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            animation: 'modalEntrar 0.22s ease-out forwards',
            pointerEvents: 'auto',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Imagem de capa (banner no topo) */}
          {temFoto && (
            <div style={{ position: 'relative', height: '200px', flexShrink: 0, background: `url(${note.imagem_capa}) center/cover` }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(15,10,30,0.95) 100%)' }} />
            </div>
          )}

          {/* Barra superior: categorias + botão ••• */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0', flexShrink: 0 }}>
            {/* Categorias */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
              {note.categorias.length > 0
                ? note.categorias.map(cat => (
                    <span key={cat.nome} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', color: textoModal, fontFamily: typography.fontFamily.primary }}>
                      {cat.nome}
                    </span>
                  ))
                : <span style={{ fontSize: '11px', color: subtextoModal, fontFamily: typography.fontFamily.primary, fontStyle: 'italic' }}>sem categoria</span>
              }
            </div>

            {/* Botão ••• com dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0, marginLeft: '12px' }}>
              <button
                onClick={() => { setDropdownAberto(v => !v); setErroAcao('') }}
                style={{
                  background: 'rgba(255,255,255,0.10)', border: 'none', borderRadius: '10px',
                  padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: '6px', fontFamily: typography.fontFamily.primary, fontSize: '12px',
                  fontWeight: 600, color: textoModal, transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
              >
                <span style={{ letterSpacing: '2px' }}>•••</span>
              </button>

              {/* Dropdown animado */}
              {dropdownAberto && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'rgba(10,6,25,0.97)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '14px', padding: '8px', minWidth: '220px',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  zIndex: 10,
                  animation: 'dropdownEntrar 0.18s ease-out forwards',
                }}>
                  {/* Cabeçalho do dropdown */}
                  <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px 8px', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '6px' }}>
                    O que fazer com essa ideia?
                  </p>

                  {erroAcao && (
                    <p style={{ color: '#f87171', fontSize: '11px', padding: '4px 10px 6px', fontFamily: typography.fontFamily.primary, margin: 0 }}>{erroAcao}</p>
                  )}

                  <OpcaoDropdown emoji="👥" label="Enviar para o Feed"   desc="Compartilhe com seus seguidores" onClick={() => publicar('feed')}  disabled={publicando} />
                  <OpcaoDropdown emoji="🌍" label="Enviar para o Campo"  desc="Torne pública no Campo das Ideias" onClick={() => publicar('campo')} disabled={publicando} />

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />

                  <OpcaoDropdown emoji="✏️" label="Editar note" desc="Alterar título, texto ou imagem" onClick={() => { window.location.href = note.url_editar }} />

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />

                  <OpcaoDropdown emoji="🗑️" label="Excluir note" desc="Remove permanentemente" onClick={excluir} danger />
                </div>
              )}
            </div>
          </div>

          {/* Título */}
          <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
            <h2 style={{ fontFamily: typography.fontFamily.primary, fontSize: '22px', fontWeight: 800, color: textoModal, margin: 0, lineHeight: 1.3 }}>
              {note.titulo_capa || note.titulo}
            </h2>
            <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '11px', color: subtextoModal, margin: '6px 0 0' }}>
              🕐 {note.data}
            </p>
          </div>

          {/* Conteúdo completo — scrollável */}
          <div style={{ padding: '16px 24px 24px', overflowY: 'auto', flex: 1 }}>
            <p style={{
              fontFamily: typography.fontFamily.primary,
              fontSize: '14px', lineHeight: 1.8,
              color: textoModal,
              margin: 0,
              whiteSpace: 'pre-wrap', // preserva quebras de linha do texto
            }}>
              {note.conteudo}
            </p>
          </div>

          {/* Rodapé: botão fechar */}
          <div style={{ padding: '0 24px 20px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '16px' }}>
            <button
              onClick={props.onFechar}
              style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 600, color: textoModal, opacity: 0.7, transition: 'opacity 0.15s' }}
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

// Checa se a cor hex é escura o suficiente para usar texto branco
function isEscuro(hex: string): boolean {
  if (!hex || hex === '#ffffff') return false
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return (0.299 * r + 0.587 * g + 0.114 * b) < 0.6
}

// ─── OpcaoDropdown ────────────────────────────────────────────────────────────

function OpcaoDropdown(props: { emoji: string; label: string; desc: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left',
        background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: 'none', borderRadius: '10px',
        padding: '8px 10px', cursor: props.disabled ? 'default' : 'pointer',
        opacity: props.disabled ? 0.45 : 1,
        transition: 'background 0.15s',
        gap: '1px',
      }}
    >
      <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 600, color: props.danger ? '#f87171' : 'rgba(255,255,255,0.88)' }}>
        {props.emoji} {props.label}
      </span>
      <span style={{ fontFamily: typography.fontFamily.primary, fontSize: '11px', color: props.danger ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.35)', paddingLeft: '22px' }}>
        {props.desc}
      </span>
    </button>
  )
}

// ─── ComposerModal ────────────────────────────────────────────────────────────

function ComposerModal(props: { onFechar: () => void; onCriado: (note: Note) => void }) {
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

  const sliderRef   = useRef<HTMLDivElement>(null)
  const arrastando  = useRef(false)

  const calcLuminosidade = useCallback((clientY: number) => {
    const rect = sliderRef.current?.getBoundingClientRect()
    if (!rect) return
    const relativo = 1 - (clientY - rect.top) / rect.height
    setLuminosidade(Math.max(0.15, Math.min(0.85, relativo)))
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
    const file = e.target.files?.[0]
    if (!file) return
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
    if (!titulo.trim()) { setErro('Título obrigatório.'); return }
    if (!conteudo.trim()) { setErro('Conteúdo obrigatório.'); return }
    setSalvando(true); setErro('')
    let res: Response
    if (fotoArquivo) {
      const form = new FormData()
      form.append('titulo', titulo); form.append('conteudo', conteudo)
      form.append('cor', corFinal); form.append('imagem_capa', fotoArquivo)
      res = await fetch('/api/notes/criar/', { method: 'POST', headers: { 'X-CSRFToken': getCsrf() }, body: form })
    } else {
      res = await fetch('/api/notes/criar/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
        body: JSON.stringify({ titulo, conteudo, cor: corFinal }),
      })
    }
    const data = await res.json()
    if (data.ok) { props.onCriado(data.post) }
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
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ffffff', border: corBase === null ? '3px solid #6b7280' : '2px solid #d1d5db', cursor: 'pointer', transform: corBase === null ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s, border 0.15s' }} />
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

          <p style={{ fontFamily: typography.fontFamily.primary, fontSize: '11px', fontWeight: 600, color: textoEl, opacity: 0.55, marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Foto de capa do card</p>
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