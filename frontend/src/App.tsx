import { AppLayout } from './components/layout/AppLayout'
import { NotesPage }  from './pages/NotesPage'
import { FeedPage }   from './pages/FeedPage'
import { CampoPage }  from './pages/CampoPage'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth }      from './hooks/useAuth'
import { LoginPage }               from './pages/auth/LoginPage'
import { RegistrarPage }           from './pages/auth/RegistrarPage'
import { SenhaResetPage }          from './pages/auth/SenhaResetPage'
import { SenhaResetConfirmarPage } from './pages/auth/SenhaResetConfirmarPage'
import type { AbaId } from './components/layout/TabBar'

// ── Roteamento ────────────────────────────────────────────────────────────────

const ABAS_VALIDAS: AbaId[] = ['perfil', 'notes_privados', 'feed', 'campo', 'forumizacao']

const ROTAS_AUTH = ['/login', '/registrar', '/senha/reset']

function eRotaAuth(rota: string): boolean {
  return ROTAS_AUTH.includes(rota) || rota.startsWith('/senha/confirmar/')
}

function getAbaAtual(): AbaId {
  const param = new URLSearchParams(window.location.search).get('aba')
  if (param && (ABAS_VALIDAS as string[]).includes(param)) return param as AbaId
  return 'notes_privados'
}

function getRotaAtual(): string {
  return window.location.pathname
}

function renderPagina(aba: AbaId) {
  switch (aba) {
    case 'notes_privados': return <NotesPage />
    case 'feed':           return <FeedPage />
    case 'campo':          return <CampoPage />
    default:               return <NotesPage />
  }
}

function AppAutenticado() {
  const { usuario, carregando } = useAuth()
  const rota = getRotaAtual()
  const aba  = getAbaAtual()
  const isAuth = eRotaAuth(rota)

  if (carregando) return null

  if (isAuth) {
    return (
      <>
        {rota === '/login'                    && <LoginPage />}
        {rota === '/registrar'                && <RegistrarPage />}
        {rota === '/senha/reset'              && <SenhaResetPage />}
        {rota.startsWith('/senha/confirmar/') && <SenhaResetConfirmarPage />}
      </>
    )
  }

  if (!usuario) {
    window.location.href = '/login'
    return null
  }

  return (
    <AppLayout
      abaAtual={aba}
      username={usuario.nome_exibicao}
      notifSino={0}
      notifCarta={0}
      notifPessoa={0}
    >
      {renderPagina(aba)}
    </AppLayout>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  return (
    <AuthProvider>
      <AppAutenticado />
    </AuthProvider>
  )
}

export default App