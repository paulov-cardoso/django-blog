import { colors } from '../../design/tokens'
import { Navbar } from './Navbar'
import { TabBar } from './TabBar'
import type { AbaId } from './TabBar'

interface AppLayoutProps {
  abaAtual: AbaId
  children: React.ReactNode
  notifSino?: number
  notifCarta?: number
  notifPessoa?: number
  username?: string
}

export function AppLayout(props: AppLayoutProps) {
  const notifSino = props.notifSino || 0
  const notifCarta = props.notifCarta || 0
  const notifPessoa = props.notifPessoa || 0
  const username = props.username || ''

  return (
    <div style={{ minHeight: '100vh', background: colors.gradient.main, display: 'flex', flexDirection: 'column' }}>
      <Navbar
        notifSino={notifSino}
        notifCarta={notifCarta}
        notifPessoa={notifPessoa}
        username={username}
      />
      <TabBar abaAtual={props.abaAtual} />
      <main style={{ maxWidth: '80rem', margin: '0 auto', width: '100%', padding: '32px 16px', flexGrow: 1 }}>
        {props.children}
      </main>
      <footer style={{ background: colors.gradient.nav, color: colors.text.muted, textAlign: 'center', padding: '8px', fontSize: '12px', fontFamily: "'Poppins', sans-serif" }}>
        2026 Synapsoo
      </footer>
    </div>
  )
}
