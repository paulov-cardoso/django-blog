import { useAuth } from '../../hooks/useAuth'
import { colors }  from '../../design/tokens'

function NotifIcon(props: {
  href: string
  emoji: string
  count: number
  countColor?: string
  textColor?: string
}) {
  const countColor = props.countColor || '#ef4444'
  const textColor  = props.textColor  || 'white'
  return (
    <a href={props.href} style={{ position: 'relative', lineHeight: '1' }}>
      <span style={{ fontSize: '20px' }}>{props.emoji}</span>
      {props.count > 0 && (
        <span style={{
          position: 'absolute', top: '-6px', right: '-6px',
          background: countColor, color: textColor,
          fontSize: '10px', fontWeight: 700, borderRadius: '50%',
          width: '16px', height: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {props.count}
        </span>
      )}
    </a>
  )
}

interface NavbarProps {
  notifSino?: number
  notifCarta?: number
  notifPessoa?: number
}

export function Navbar({ notifSino = 0, notifCarta = 0, notifPessoa = 0 }: NavbarProps) {
  const { usuario, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  return (
    <nav style={{
      background: colors.gradient.nav,
      height: '56px',
      overflow: 'visible',
      position: 'sticky',
      top: '0',
      zIndex: 40,
      padding: '0 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <div style={{
        maxWidth: '80rem', margin: '0 auto',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', height: '100%',
      }}>
        <a href="/?aba=notes_privados">
          <img
            src="/static/posts/images/nav_logo.png"
            alt="Synapsoo"
            style={{ height: '66px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <NotifIcon href="/notificacoes/sino/"   emoji="🔔" count={notifSino} />
          <NotifIcon href="/notificacoes/carta/"  emoji="✉️" count={notifCarta}  countColor="#facc15" textColor="#1f2937" />
          <NotifIcon href="/notificacoes/pessoa/" emoji="👤" count={notifPessoa} countColor="#4ade80" />

          {usuario && (
            <span style={{ color: colors.text.secondary, fontSize: '13px' }}>
              Olá, {usuario.nome_exibicao}
            </span>
          )}

          <a href="/criar/" style={{
            background: 'white', color: '#1d4ed8',
            padding: '4px 16px', borderRadius: '999px',
            fontWeight: 600, fontSize: '13px', textDecoration: 'none',
          }}>
            ✏️ Criar
          </a>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.30)',
              color: 'white', padding: '4px 14px',
              borderRadius: '999px', fontWeight: 500,
              fontSize: '13px', cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)' }}
            onMouseOut={e  => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}