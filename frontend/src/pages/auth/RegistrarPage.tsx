import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { AuthLayout } from './AuthLayout'
import { CampoTexto, CampoSenha, ValidatorSenha, BotaoPrimario, ErroGeral, TituloAuth, LinkAuth, IconeUsuario, IconeEdicao } from './AuthComponents'

interface Erros {
  username?: string
  nome_exibicao?: string
  password1?: string
  password2?: string
}

export function RegistrarPage() {
  const { login } = useAuth()
  const [username,      setUsername]      = useState('')
  const [nomeExibicao,  setNomeExibicao]  = useState('')
  const [password1,     setPassword1]     = useState('')
  const [password2,     setPassword2]     = useState('')
  const [senhaFocada,   setSenhaFocada]   = useState(false)
  const [erros,         setErros]         = useState<Erros>({})
  const [erroGeral,     setErroGeral]     = useState('')
  const [carregando,    setCarregando]    = useState(false)

  const handleSubmit = async () => {
    setErros({})
    setErroGeral('')
    setCarregando(true)
    try {
      const res  = await fetch('/api/auth/registrar/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, nome_exibicao: nomeExibicao, password1, password2 }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.erros) { setErros(data.erros); return }
        setErroGeral(data.erro || 'Erro ao criar conta.')
        return
      }
      login(data.access, data.refresh, data.usuario)
      window.location.href = '/'
    } catch {
      setErroGeral('Erro de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <AuthLayout>
      <TituloAuth>Cadastro</TituloAuth>

      {erroGeral && <ErroGeral mensagem={erroGeral} />}

      <CampoTexto
        id="id_username" name="username"
        placeholder="Usuário"
        value={username} onChange={setUsername}
        autoComplete="username"
        erro={erros.username}
        icone={<IconeUsuario />}
      />

      <CampoTexto
        id="id_nome_exibicao" name="nome_exibicao"
        placeholder="Como quer ser chamado?"
        value={nomeExibicao} onChange={setNomeExibicao}
        erro={erros.nome_exibicao}
        icone={<IconeEdicao />}
      />

      <div>
        <CampoSenha
          id="campo-senha" name="password1"
          placeholder="Senha"
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

      <div style={{ marginBottom: '20px' }}>
        <CampoSenha
          id="campo-confirma" name="password2"
          placeholder="Confirme a senha"
          value={password2} onChange={setPassword2}
          autoComplete="new-password"
          erro={erros.password2}
        />
      </div>

      <BotaoPrimario carregando={carregando} onClick={handleSubmit}>
        Criar conta
      </BotaoPrimario>

      <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.80)', marginTop: '16px', fontFamily: "'Poppins', sans-serif" }}>
        Já possui uma conta? <LinkAuth href="/login">Entrar</LinkAuth>
      </p>
    </AuthLayout>
  )
}
