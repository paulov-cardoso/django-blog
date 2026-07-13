import { colors, typography } from '../../design/tokens'
import { Navbar } from './Navbar'

// Navbar fixa em 56px = offset total para o main (TabBar removida na Fase A)
const NAVBAR_HEIGHT = 56

interface AppLayoutProps {
  children: React.ReactNode
  notifSino?: number
  notifCarta?: number
  notifPessoa?: number
  username?: string
}

export function AppLayout({
  children,
  notifSino = 0,
  notifCarta = 0,
  notifPessoa = 0,
  username = '',
}: AppLayoutProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: colors.gradient.main,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Navbar
        notifSino={notifSino}
        notifCarta={notifCarta}
        notifPessoa={notifPessoa}
        username={username}
      />
      <main style={{
        maxWidth: '80rem',
        margin: '0 auto',
        width: '100%',
        /* Offset fixo: só a navbar (56px). TabBar removida na Fase A. */
        paddingTop: `${NAVBAR_HEIGHT}px`,
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: '32px',
        flexGrow: 1,
      }}>
        {children}
      </main>
      <footer style={{
        textAlign: 'center',
        padding: '10px',
        fontSize: '11px',
        fontWeight: 300,
        fontFamily: typography.fontFamily.primary,
        color: colors.text.faint,
      }}>
        © Copyright 2026 Synapsoo &nbsp;·&nbsp;
        <a href="#" style={{ color: colors.text.muted, textDecoration: 'none', margin: '0 4px' }}>
          Termos de uso
        </a>
        &nbsp;·&nbsp;
        <a href="#" style={{ color: colors.text.muted, textDecoration: 'none', margin: '0 4px' }}>
          Suporte
        </a>
      </footer>
    </div>
  )
}