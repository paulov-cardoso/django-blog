import { useState } from 'react'
import { AuthLayout } from './AuthLayout'
import { CampoSenha, ValidatorSenha, BotaoPrimario, ErroGeral, TituloAuth } from './AuthComponents'

function extrairParams(): { uid: string; token: string } {
  // URL esperada: /senha/confirmar/:uid/:token
  const partes = window.location.pathname.split('/').filter(Boolean)
  const idxConfirmar = partes.indexOf('confirmar')
  if (idxConfirmar !== -1 && partes.length >= idxConfirmar + 3) {
    return { uid: partes[idxConfirmar + 1], token: partes[idxConfirmar + 2] }
  }
  return { uid: '', token: '' }
}

export function SenhaResetConfirmarPage() {
  const { uid, token } = extrairParams()
  const [password1,   setPassword1]   = useState('')
  const [password2,   setPassword2]   = useState('')
  const [senhaFocada, setSenhaFocada] = useState(false)
  const [erros,       setErros]       = useState<{ password1?: string; password2?: string }>({})
  const [erroGeral,   setErroGeral]   = useState('')
  const [concluido,   setConcluido]   = useState(false)
  const [carregando,  setCarregando]  = useState(false)

  if (!uid || !token) {
    return (
      <AuthLayout>
        <ErroGeral mensagem="Link de redefinição inválido. Solicite um novo." />
        <BotaoPrimario type="button" onClick={() => { window.location.href = '/senha/reset' }}>
          Solicitar novo link
        </BotaoPrimario>
      </AuthLayout>
    )
  }

  if (concluido) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', fontSize: '60px', marginBottom: '20px' }} aria-hidden="true">✅</div>
        <h1 style={{ textAlign: 'center', color: 'white', fontWeight: 700, fontSize: '30px', marginBottom: '12px', fontFamily: "'Poppins', sans-serif", textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
          Senha redefinida
        </h1>
        <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.70)', marginBottom: '28px', lineHeight: 1.6, fontFamily: "'Poppins', sans-serif" }}>
          Sua senha foi alterada com sucesso. Agora você já pode acessar sua conta novamente.
        </p>
        <BotaoPrimario type="button" onClick={() => { window.location.href = '/login' }}>
          Ir para o login
        </BotaoPrimario>
      </AuthLayout>
    )
  }

  const handleSubmit = async () => {
    setErros({})
    setErroGeral('')
    setCarregando(true)
    try {
      const res  = await fetch('/api/auth/senha/confirmar/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid, token, password1, password2 }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.erros) { setErros(data.erros); return }
        setErroGeral(data.erro || 'Link expirado ou inválido. Solicite um novo.')
        return
      }
      setConcluido(true)
    } catch {
      setErroGeral('Erro de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <AuthLayout>
      <TituloAuth>Nova senha</TituloAuth>
      <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.65)', marginBottom: '24px', fontFamily: "'Poppins', sans-serif" }}>
        Escolha uma nova senha para continuar protegendo suas ideias.
      </p>

      {erroGeral && <ErroGeral mensagem={erroGeral} />}

      <div>
        <CampoSenha
          id="id_new_password1" name="new_password1"
          placeholder="Nova senha"
          value={password1} onChange={setPassword1}
          autoComplete="new-password"
          erro={erros.password1}
        />
        <div
          onFocus={() => setSenhaFocada(true)}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSenhaFocada(false) }}
        >
          <ValidatorSenha senha={password1} visivel={senhaFocada && password1.length > 0} />
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <CampoSenha
          id="id_new_password2" name="new_password2"
          placeholder="Confirmar nova senha"
          value={password2} onChange={setPassword2}
          autoComplete="new-password"
          erro={erros.password2}
        />
      </div>

      <BotaoPrimario carregando={carregando} onClick={handleSubmit}>
        Redefinir senha
      </BotaoPrimario>
    </AuthLayout>
  )
}