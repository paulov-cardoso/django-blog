import { AppLayout } from './components/layout/AppLayout'
import { NotesPage }  from './pages/NotesPage'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth }      from './hooks/useAuth'
import { LoginPage }               from './pages/auth/LoginPage'
import { RegistrarPage }           from './pages/auth/RegistrarPage'
import { SenhaResetPage }          from './pages/auth/SenhaResetPage'
import { SenhaResetConfirmarPage } from './pages/auth/SenhaResetConfirmarPage'

// ── Roteamento ────────────────────────────────────────────────────────────────

const ROTAS_AUTH = ['/login', '/registrar', '/senha/reset']

function eRotaAuth(rota: string): boolean {
  return ROTAS_AUTH.includes(rota) || rota.startsWith('/senha/confirmar/')
}

function getRotaAtual(): string {
  return window.location.pathname
}

function AppAutenticado() {
  const { usuario, carregando } = useAuth()
  const rota = getRotaAtual()
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
      username={usuario.nome_exibicao}
      notifSino={0}
      notifCarta={0}
      notifPessoa={0}
    >
      <NotesPage />
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
