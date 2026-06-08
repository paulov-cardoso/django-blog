import { useState } from 'react'

// ── Ícones ────────────────────────────────────────────────────────────────────

export function IconeUsuario() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

export function IconeEmail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

export function IconeEdicao() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}

const SVG_OLHO_ABERTO  = 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
const SVG_OLHO_FECHADO = 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22'

// ── Estilos base ──────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%', height: '48px',
  background: 'rgba(255,255,255,0.13)',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: '12px', color: 'white',
  fontSize: '14px', fontWeight: 300,
  paddingLeft: '16px', paddingRight: '44px',
  outline: 'none', transition: 'background 0.2s, border-color 0.2s',
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.10)',
  fontFamily: "'Poppins', sans-serif",
}

const inputErro: React.CSSProperties = {
  ...inputBase,
  border: '1px solid rgba(248,113,113,0.70)',
}

const iconWrap: React.CSSProperties = {
  position: 'absolute', right: '12px', top: '50%',
  transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.50)',
  pointerEvents: 'none', display: 'flex', alignItems: 'center',
}

// ── CampoTexto ────────────────────────────────────────────────────────────────

interface CampoTextoProps {
  id: string
  name: string
  type?: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  erro?: string
  icone: React.ReactNode
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export function CampoTexto({ id, name, type = 'text', placeholder, value, onChange, autoComplete, erro, icone, onKeyDown }: CampoTextoProps) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ position: 'relative' }}>
        <label htmlFor={id} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          {placeholder}
        </label>
        <input
          id={id} name={name} type={type}
          placeholder={placeholder} value={value}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          style={erro ? inputErro : inputBase}
          onKeyDown={onKeyDown}
          onFocus={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.20)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.55)' }}
          onBlur={e  => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.borderColor = erro ? 'rgba(248,113,113,0.70)' : 'rgba(255,255,255,0.25)' }}
        />
        <span style={iconWrap}>{icone}</span>
      </div>
      {erro && (
        <p style={{ color: 'rgba(252,165,165,1)', fontSize: '12px', marginTop: '4px', paddingLeft: '4px', fontFamily: "'Poppins', sans-serif" }}>
          ⚠️ {erro}
        </p>
      )}
    </div>
  )
}

// ── CampoSenha ────────────────────────────────────────────────────────────────

interface CampoSenhaProps {
  id: string
  name: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  erro?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export function CampoSenha({ id, name, placeholder, value, onChange, autoComplete, erro, onKeyDown }: CampoSenhaProps) {
  const [visivel, setVisivel] = useState(false)

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ position: 'relative' }}>
        <label htmlFor={id} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          {placeholder}
        </label>
        <input
          id={id} name={name}
          type={visivel ? 'text' : 'password'}
          placeholder={placeholder} value={value}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          style={erro ? inputErro : inputBase}
          onKeyDown={onKeyDown}
          onFocus={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.20)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.55)' }}
          onBlur={e  => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.borderColor = erro ? 'rgba(248,113,113,0.70)' : 'rgba(255,255,255,0.25)' }}
        />
        <button
          type="button"
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
          tabIndex={-1}
          onClick={() => setVisivel(v => !v)}
          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.50)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {visivel
              ? <><path d={SVG_OLHO_FECHADO.split('M').filter(Boolean).map(s => 'M' + s).join(' ')}/></>
              : <path d={SVG_OLHO_ABERTO}/>
            }
          </svg>
        </button>
      </div>
      {erro && (
        <p style={{ color: 'rgba(252,165,165,1)', fontSize: '12px', marginTop: '4px', paddingLeft: '4px', fontFamily: "'Poppins', sans-serif" }}>
          ⚠️ {erro}
        </p>
      )}
    </div>
  )
}

// ── ValidatorSenha ────────────────────────────────────────────────────────────

interface ValidatorSenhaProps { senha: string; visivel: boolean }

const REGRAS = [
  { label: 'Letras maiúsculas e minúsculas', ok: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: 'Números',                        ok: (v: string) => /[0-9]/.test(v) },
  { label: 'Caracteres especiais (!@#$...)', ok: (v: string) => /[^a-zA-Z0-9]/.test(v) },
  { label: 'Mínimo de 8 dígitos',            ok: (v: string) => v.length >= 8 },
]

const NIVEIS = [
  { cor: '#ef4444', texto: 'Fraca' },
  { cor: '#f97316', texto: 'Razoável' },
  { cor: '#eab308', texto: 'Boa' },
  { cor: '#22c55e', texto: 'Forte' },
]

export function ValidatorSenha({ senha, visivel }: ValidatorSenhaProps) {
  if (!visivel) return null
  const aprovados = REGRAS.filter(r => r.ok(senha)).length
  const nivel     = aprovados === 0 ? 0 : aprovados - 1

  return (
    <div style={{
      marginTop: '4px', borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.20)',
      padding: '16px 20px',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(16px)',
    }}>
      <p style={{ color: 'rgba(0,0,0,0.70)', fontSize: '11px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Poppins', sans-serif" }}>
        Força da senha
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {REGRAS.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px', filter: r.ok(senha) ? 'drop-shadow(0 0 6px #fcd34d)' : 'none' }}>
              {r.ok(senha) ? '💡' : '❌'}
            </span>
            <span style={{ color: 'rgba(0,0,0,0.70)', fontSize: '12px', fontFamily: "'Poppins', sans-serif" }}>
              {r.label}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '16px', height: '6px', borderRadius: '999px', background: 'rgba(0,0,0,0.10)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '999px', transition: 'all 0.5s', width: `${aprovados * 25}%`, background: NIVEIS[nivel].cor }} />
      </div>
      {senha.length > 0 && (
        <p style={{ fontSize: '12px', marginTop: '4px', textAlign: 'right', color: 'rgba(0,0,0,0.50)', fontFamily: "'Poppins', sans-serif" }}>
          {NIVEIS[nivel].texto}
        </p>
      )}
    </div>
  )
}

// ── BotaoPrimario ─────────────────────────────────────────────────────────────

interface BotaoPrimarioProps {
  children: React.ReactNode
  carregando?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}

export function BotaoPrimario({ children, carregando, type = 'submit', onClick }: BotaoPrimarioProps) {
  return (
    <button
      type={type}
      disabled={carregando}
      onClick={onClick}
      style={{
        width: '100%', height: '48px',
        background: carregando ? 'rgba(255,255,255,0.70)' : 'white',
        color: '#374151', fontWeight: 500, fontSize: '16px',
        borderRadius: '999px', border: 'none', cursor: carregando ? 'not-allowed' : 'pointer',
        boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
        transition: 'background 0.2s, transform 0.1s',
        fontFamily: "'Poppins', sans-serif",
      }}
      onMouseOver={e => { if (!carregando) e.currentTarget.style.background = '#f3f4f6' }}
      onMouseOut={e  => { if (!carregando) e.currentTarget.style.background = 'white' }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
      onMouseUp={e   => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {carregando ? 'Aguarde...' : children}
    </button>
  )
}

// ── ErroGeral ─────────────────────────────────────────────────────────────────

export function ErroGeral({ mensagem }: { mensagem: string }) {
  return (
    <p role="alert" style={{
      background: 'rgba(239,68,68,0.20)',
      border: '1px solid rgba(252,165,165,0.50)',
      color: 'white', fontSize: '12px', fontWeight: 300,
      borderRadius: '12px', padding: '12px 16px',
      textAlign: 'center', marginBottom: '16px',
      fontFamily: "'Poppins', sans-serif",
    }}>
      {mensagem}
    </p>
  )
}

// ── TituloAuth ────────────────────────────────────────────────────────────────

export function TituloAuth({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{
      textAlign: 'center', color: 'white', fontWeight: 700,
      fontSize: '30px', letterSpacing: '0.025em', marginBottom: '24px',
      fontFamily: "'Poppins', sans-serif",
      textShadow: '0 2px 8px rgba(0,0,0,0.18)',
    }}>
      {children}
    </h1>
  )
}

// ── LinkAuth ──────────────────────────────────────────────────────────────────

interface LinkAuthProps { href: string; children: React.ReactNode }

export function LinkAuth({ href, children }: LinkAuthProps) {
  return (
    <a
      href={href}
      style={{ color: 'rgba(255,255,255,0.90)', fontWeight: 500, textDecoration: 'none', fontFamily: "'Poppins', sans-serif" }}
      onMouseOver={e => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = 'white' }}
      onMouseOut={e  => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.90)' }}
    >
      {children}
    </a>
  )
}