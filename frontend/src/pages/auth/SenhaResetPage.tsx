import { useState } from 'react'
import { AuthLayout } from './AuthLayout'
import { CampoTexto, BotaoPrimario, ErroGeral, TituloAuth, LinkAuth, IconeEmail } from './AuthComponents'

export function SenhaResetPage() {
  const [email,      setEmail]      = useState('')
  const [enviado,    setEnviado]    = useState(false)
  const [erro,       setErro]       = useState('')
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async () => {
    if (!email) { setErro('Email obrigatório.'); return }
    setErro('')
    setCarregando(true)
    try {
      await fetch('/api/auth/senha/reset/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      setEnviado(true)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit()
  }

  if (enviado) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', fontSize: '60px', marginBottom: '20px' }} aria-hidden="true">📧</div>
        <h1 style={{ textAlign: 'center', color: 'white', fontWeight: 700, fontSize: '30px', marginBottom: '12px', fontFamily: "'Poppins', sans-serif", textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
          Email enviado
        </h1>
        <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.70)', marginBottom: '28px', lineHeight: 1.6, fontFamily: "'Poppins', sans-serif" }}>
          Verifique sua caixa de entrada e clique no link enviado para redefinir sua senha.
        </p>
        <BotaoPrimario type="button" onClick={() => { window.location.href = '/login' }}>
          Voltar ao login
        </BotaoPrimario>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <TituloAuth>Esqueci a senha</TituloAuth>
      <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.65)', marginBottom: '24px', fontFamily: "'Poppins', sans-serif" }}>
        Digite seu email e enviaremos um link para redefinir sua senha.
      </p>

      {erro && <ErroGeral mensagem={erro} />}

      <div style={{ marginBottom: '24px' }}>
        <CampoTexto
          id="id_email" name="email" type="email"
          placeholder="Seu email"
          value={email} onChange={setEmail}
          autoComplete="email"
          icone={<IconeEmail />}
          onKeyDown={onEnter}
        />
      </div>

      <BotaoPrimario carregando={carregando} onClick={handleSubmit}>
        Enviar link
      </BotaoPrimario>

      <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.80)', marginTop: '16px', fontFamily: "'Poppins', sans-serif" }}>
        Lembrou a senha? <LinkAuth href="/login">Entrar</LinkAuth>
      </p>
    </AuthLayout>
  )
}
