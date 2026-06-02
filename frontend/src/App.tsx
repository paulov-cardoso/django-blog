import { AppLayout } from './components/layout/AppLayout'
import { NotesPage } from './pages/NotesPage'
import { FeedPage } from './pages/FeedPage'
import { CampoPage } from './pages/CampoPage'
import type { AbaId } from './components/layout/TabBar'

// Abas válidas — se a URL tiver algo inválido, cai para 'notes_privados'
const ABAS_VALIDAS: AbaId[] = ['perfil', 'notes_privados', 'feed', 'campo', 'forumizacao']

function getAbaAtual(): AbaId {
  const param = new URLSearchParams(window.location.search).get('aba')
  if (param && (ABAS_VALIDAS as string[]).includes(param)) {
    return param as AbaId
  }
  return 'notes_privados'
}

function renderPagina(aba: AbaId) {
  switch (aba) {
    case 'notes_privados': return <NotesPage />
    case 'feed':           return <FeedPage />
    case 'campo':          return <CampoPage />
    default:               return <NotesPage />
  }
}

function App() {
  const abaAtual = getAbaAtual()

  return (
    <AppLayout
      abaAtual={abaAtual}
      username="paulo"
      notifSino={3}
      notifCarta={1}
      notifPessoa={0}
    >
      {renderPagina(abaAtual)}
    </AppLayout>
  )
}

export default App
