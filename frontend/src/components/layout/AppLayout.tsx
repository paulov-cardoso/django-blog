import { colors, typography } from '../../design/tokens'
import { Navbar } from './Navbar'
import { TabBar, TABBAR_HEIGHT } from './TabBar'
import type { AbaId } from './TabBar'

// Navbar fixa em 56px + TabBar fixa em 36px = 92px de offset total para o main
const NAVBAR_HEIGHT = 56

interface AppLayoutProps {
  abaAtual: AbaId
  children: React.ReactNode
  notifSino?: number
  notifCarta?: number
  notifPessoa?: number
  username?: string
}

export function AppLayout({
  abaAtual,
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
      <TabBar abaAtual={abaAtual} />
      <main style={{
        maxWidth: '80rem',
        margin: '0 auto',
        width: '100%',
        /* Offset fixo: navbar (56px) + tabbar compacta (36px) = 92px */
        paddingTop: `${NAVBAR_HEIGHT + TABBAR_HEIGHT}px`,
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