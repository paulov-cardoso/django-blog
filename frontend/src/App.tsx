import { AppLayout } from './components/layout/AppLayout'

function App() {
  return (
    <AppLayout
      abaAtual="notes_privados"
      username="paulo"
      notifSino={3}
      notifCarta={1}
      notifPessoa={0}
    >
      <p style={{ color: 'white', fontFamily: "'Poppins', sans-serif" }}>
        Conteudo da pagina aqui
      </p>
    </AppLayout>
  )
}

export default App
