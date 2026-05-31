import { colors } from '../../design/tokens'

interface NavbarProps {
  notifSino?: number
  notifCarta?: number
  notifPessoa?: number
  username?: string
}

function NotifIcon(props: {
  href: string
  emoji: string
  count: number
  countColor?: string
  textColor?: string
}) {
  const countColor = props.countColor || '#ef4444'
  const textColor = props.textColor || 'white'
  return (
    <a href={props.href} style={{ position: 'relative', lineHeight: '1' }}>
      <span style={{ fontSize: '20px' }}>{props.emoji}</span>
      {props.count > 0 && (
        <span style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          background: countColor,
          color: textColor,
          fontSize: '10px',
          fontWeight: 700,
          borderRadius: '50%',
          width: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {props.count}
        </span>
      )}
    </a>
  )
}

export function Navbar(props: NavbarProps) {
  const notifSino = props.notifSino || 0
  const notifCarta = props.notifCarta || 0
  const notifPessoa = props.notifPessoa || 0
  const username = props.username || ''

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
        maxWidth: '80rem',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '100%',
      }}>
        <a href="/?aba=notes_privados">
          <img
            src="/static/posts/images/nav_logo.png"
            alt="Synapsoo"
            style={{ height: '66px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <NotifIcon href="/notificacoes/sino/" emoji="🔔" count={notifSino} />
          <NotifIcon href="/notificacoes/carta/" emoji="✉️" count={notifCarta} countColor="#facc15" textColor="#1f2937" />
          <NotifIcon href="/notificacoes/pessoa/" emoji="👤" count={notifPessoa} countColor="#4ade80" />
          {username && (
            <span style={{ color: colors.text.secondary, fontSize: '13px' }}>
              Olá, {username}
            </span>
          )}
          <a href="/criar/" style={{
            background: 'white',
            color: '#1d4ed8',
            padding: '4px 16px',
            borderRadius: '999px',
            fontWeight: 600,
            fontSize: '13px',
            textDecoration: 'none',
          }}>
            ✏️ Criar
          </a>
        </div>
      </div>
    </nav>
  )
}