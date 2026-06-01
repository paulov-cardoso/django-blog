import { useState, useEffect } from 'react'
import { colors, typography } from '../design/tokens'

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
}

const CORES_POSTIT = [
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#EF4444',
  '#06B6D4',
  '#6B7280',
]

function getCsrf() {
  const cookie = document.cookie.split(';').find(function(c) { return c.trim().startsWith('csrftoken=') })
  return cookie ? cookie.split('=')[1] : ''
}

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [composerAberto, setComposerAberto] = useState(false)

  useEffect(function() {
    carregarNotes()
  }, [])

  function carregarNotes() {
    fetch('/api/notes/privados/')
      .then(function(res) { return res.json() })
      .then(function(data) {
        setNotes(data.posts)
        setLoading(false)
      })
      .catch(function() {
        setErro('Erro ao carregar notes.')
        setLoading(false)
      })
  }

  function onNoteCriado(note: Note) {
    setNotes(function(prev) { return [note, ...prev] })
    setComposerAberto(false)
  }

  function onNoteExcluido(id: number) {
    setNotes(function(prev) { return prev.filter(function(n) { return n.id !== id }) })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', flexDirection: 'column', gap: '12px' }}>
        <span style={{ fontSize: '2.5rem' }}>📓</span>
        <p style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.primary, fontSize: '13px' }}>Carregando notes...</p>
      </div>
    )
  }

  if (erro) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px' }}>
        <p style={{ color: '#ef4444', fontFamily: typography.fontFamily.primary, fontSize: '13px' }}>{erro}</p>
      </div>
    )
  }

  return (
    <div>
      <ComposerBar onAbrir={function() { setComposerAberto(true) }} />
      {composerAberto && (
        <ComposerModal
          onFechar={function() { setComposerAberto(false) }}
          onCriado={onNoteCriado}
        />
      )}
      {notes.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '12px' }}>
          <span style={{ fontSize: '3rem' }}>📓</span>
          <p style={{ color: 'white', fontFamily: typography.fontFamily.primary, fontSize: '18px', fontWeight: 600 }}>Nenhum note ainda</p>
          <p style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.primary, fontSize: '13px' }}>Clique acima para escrever seu primeiro note!</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '20px',
          padding: '8px 0',
        }}>
          {notes.map(function(note) {
            return (
              <PostIt
                key={note.id}
                note={note}
                onExcluido={onNoteExcluido}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ComposerBar(props: { onAbrir: () => void }) {
  return (
    <div style={{
      background: colors.bg.surface,
      border: '1px solid ' + colors.border.subtle,
      borderRadius: '16px',
      padding: '12px 16px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <span style={{ fontSize: '20px' }}>📓</span>
      <button
        onClick={props.onAbrir}
        style={{
          flex: 1,
          textAlign: 'left',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid ' + colors.border.subtle,
          borderRadius: '12px',
          padding: '10px 16px',
          color: colors.text.muted,
          fontSize: '13px',
          fontFamily: typography.fontFamily.primary,
          cursor: 'text',
        }}
      >
        Escreva um note privado...
      </button>
    </div>
  )
}

function ComposerModal(props: { onFechar: () => void, onCriado: (note: Note) => void }) {
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [cor, setCor] = useState('#F59E0B')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  function salvar() {
    if (!titulo.trim()) { setErro('Titulo obrigatorio.'); return }
    if (!conteudo.trim()) { setErro('Conteudo obrigatorio.'); return }
    setSalvando(true)
    fetch('/api/notes/criar/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ titulo: titulo, conteudo: conteudo, cor: cor }),
    })
      .then(function(res) { return res.json() })
      .then(function(data) {
        if (data.ok) {
          props.onCriado(data.post)
        } else {
          setErro(data.erro || 'Erro ao salvar.')
        }
        setSalvando(false)
      })
      .catch(function() {
        setErro('Erro de conexao.')
        setSalvando(false)
      })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}
      onClick={props.onFechar}
    >
      <div style={{
        background: cor,
        borderRadius: '12px',
        padding: '24px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
        onClick={function(e) { e.stopPropagation() }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: typography.fontFamily.primary, fontSize: '15px', fontWeight: 700, color: 'rgba(0,0,0,0.75)' }}>
            Novo Note
          </h3>
          <button onClick={props.onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'rgba(0,0,0,0.5)' }}>x</button>
        </div>

        <input
          type="text"
          placeholder="Titulo..."
          value={titulo}
          onChange={function(e) { setTitulo(e.target.value) }}
          style={{
            width: '100%', border: 'none', background: 'rgba(0,0,0,0.08)',
            borderRadius: '8px', padding: '10px 12px', fontSize: '14px',
            fontFamily: typography.fontFamily.primary, fontWeight: 600,
            color: 'rgba(0,0,0,0.8)', marginBottom: '10px', boxSizing: 'border-box',
            outline: 'none',
          }}
        />

        <textarea
          placeholder="O que esta na sua cabeca?"
          value={conteudo}
          onChange={function(e) { setConteudo(e.target.value) }}
          rows={5}
          style={{
            width: '100%', border: 'none', background: 'rgba(0,0,0,0.08)',
            borderRadius: '8px', padding: '10px 12px', fontSize: '13px',
            fontFamily: typography.fontFamily.primary, color: 'rgba(0,0,0,0.7)',
            resize: 'none', marginBottom: '16px', boxSizing: 'border-box',
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {CORES_POSTIT.map(function(c) {
            const selecionada = c === cor
            return (
              <button
                key={c}
                onClick={function() { setCor(c) }}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: c, border: selecionada ? '3px solid rgba(0,0,0,0.5)' : '2px solid white',
                  cursor: 'pointer', transition: 'transform 0.15s',
                  transform: selecionada ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            )
          })}
        </div>

        {erro && (
          <p style={{ color: '#ef4444', fontSize: '12px', fontFamily: typography.fontFamily.primary, marginBottom: '12px' }}>{erro}</p>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={props.onFechar} style={{
            flex: 1, padding: '10px', borderRadius: '8px',
            background: 'rgba(0,0,0,0.12)', border: 'none', cursor: 'pointer',
            fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 600,
            color: 'rgba(0,0,0,0.6)',
          }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} style={{
            flex: 1, padding: '10px', borderRadius: '8px',
            background: 'rgba(0,0,0,0.25)', border: 'none', cursor: 'pointer',
            fontFamily: typography.fontFamily.primary, fontSize: '13px', fontWeight: 700,
            color: 'rgba(0,0,0,0.75)',
          }}>
            {salvando ? 'Salvando...' : 'Salvar Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PostIt(props: { note: Note, onExcluido: (id: number) => void }) {
  const note = props.note
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [erroPublicar, setErroPublicar] = useState('')

  const bgStyle = note.imagem_capa
    ? { backgroundImage: 'url(' + note.imagem_capa + ')', backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: note.cor }

  function excluir() {
    if (!confirm('Excluir este note?')) return
    fetch('/api/notes/' + note.id + '/excluir/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrf() },
    }).then(function() {
      props.onExcluido(note.id)
    })
  }

  function publicar(destino: 'feed' | 'campo') {
    setPublicando(true)
    setErroPublicar('')
    fetch('/api/notes/' + note.id + '/publicar/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ destino: destino }),
    })
      .then(function(res) { return res.json() })
      .then(function(data) {
        if (data.ok) {
          window.location.href = '/?aba=' + destino
        } else if (data.erro === 'sem_categoria') {
          setErroPublicar('Adicione uma categoria antes de publicar.')
        } else if (data.erro === 'sem_capa') {
          setErroPublicar('Feed requer imagem de capa. Edite o note.')
        } else {
          setErroPublicar('Erro ao publicar.')
        }
        setPublicando(false)
        setDropdownAberto(false)
      })
      .catch(function() {
        setErroPublicar('Erro de conexao.')
        setPublicando(false)
      })
  }

  return (
    <div style={{
      ...bgStyle,
      borderRadius: '4px',
      padding: note.imagem_capa ? '0' : '20px',
      minHeight: '220px',
      position: 'relative',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transform: 'rotate(' + (note.id % 2 === 0 ? '-0.8' : '0.5') + 'deg)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={function(e) {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'rotate(0deg) scale(1.02)'
        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'
      }}
      onMouseLeave={function(e) {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'rotate(' + (note.id % 2 === 0 ? '-0.8' : '0.5') + 'deg)'
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)'
      }}
    >
      {note.imagem_capa && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)', borderRadius: '4px' }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: note.imagem_capa ? '16px' : '0', flex: 1 }}>
        {note.categorias.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {note.categorias.map(function(cat) {
              return (
                <span key={cat.nome} style={{
                  fontSize: '10px', fontWeight: 600,
                  padding: '2px 8px', borderRadius: '999px',
                  background: 'rgba(0,0,0,0.15)',
                  color: note.imagem_capa ? 'white' : 'rgba(0,0,0,0.6)',
                  fontFamily: typography.fontFamily.primary,
                }}>
                  {cat.nome}
                </span>
              )
            })}
          </div>
        )}

        <h3 style={{
          fontFamily: typography.fontFamily.primary,
          fontSize: '14px', fontWeight: 700,
          color: note.imagem_capa ? 'white' : 'rgba(0,0,0,0.8)',
          margin: '0 0 8px', lineHeight: 1.35,
        }}>
          {note.titulo_capa || note.titulo}
        </h3>

        <p style={{
          fontFamily: typography.fontFamily.primary,
          fontSize: '12px', lineHeight: 1.6,
          color: note.imagem_capa ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)',
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {note.conteudo}
        </p>
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        padding: note.imagem_capa ? '0 16px 16px' : '12px 0 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontFamily: typography.fontFamily.primary, fontSize: '10px',
          color: note.imagem_capa ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)',
        }}>
          {note.data}
        </span>

        <div style={{ position: 'relative' }}>
          <button
            onClick={function(e) { e.stopPropagation(); setDropdownAberto(function(v) { return !v }) }}
            style={{
              background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: '999px',
              width: '28px', height: '28px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700, letterSpacing: '1px',
              color: note.imagem_capa ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
            }}
          >
            ...
          </button>

          {dropdownAberto && (
            <div style={{
              position: 'absolute', bottom: '34px', right: 0,
              background: 'rgba(15,10,30,0.95)', border: '1px solid ' + colors.border.subtle,
              borderRadius: '12px', padding: '6px', minWidth: '180px',
              backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 100,
            }}
              onClick={function(e) { e.stopPropagation() }}
            >
              {erroPublicar && (
                <p style={{ color: '#ef4444', fontSize: '11px', padding: '4px 8px', fontFamily: typography.fontFamily.primary }}>{erroPublicar}</p>
              )}
              <DropdownItem emoji="👥" label="Enviar para Feed" onClick={function() { publicar('feed') }} disabled={publicando} />
              <DropdownItem emoji="🌍" label="Enviar para Campo" onClick={function() { publicar('campo') }} disabled={publicando} />
              <a href={note.url_editar} style={{ display: 'block', padding: '8px 12px', color: colors.text.secondary, fontSize: '12px', fontFamily: typography.fontFamily.primary, textDecoration: 'none', borderRadius: '8px' }}>
                ✏️ Editar
              </a>
              <div style={{ height: '1px', background: colors.border.subtle, margin: '4px 0' }} />
              <DropdownItem emoji="🗑️" label="Excluir" onClick={excluir} danger />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DropdownItem(props: { emoji: string, label: string, onClick: () => void, danger?: boolean, disabled?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'transparent', border: 'none', borderRadius: '8px',
        padding: '8px 12px', fontSize: '12px', fontWeight: 500,
        fontFamily: typography.fontFamily.primary, cursor: 'pointer',
        color: props.danger ? '#ef4444' : colors.text.secondary,
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      {props.emoji} {props.label}
    </button>
  )
}
