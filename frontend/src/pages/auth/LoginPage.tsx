import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { AuthLayout } from './AuthLayout'
import { CampoTexto, CampoSenha, BotaoPrimario, ErroGeral, TituloAuth, LinkAuth, IconeUsuario } from './AuthComponents'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [lembrar,  setLembrar]  = useState(false)
  const [erro,     setErro]     = useState('')
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async () => {
    if (!username || !password) {
      setErro('Preencha usuário e senha.')
      return
    }
    setErro('')
    setCarregando(true)
    try {
      const res  = await fetch('/api/auth/login/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro || 'Usuário ou senha incorretos.')
        return
      }
      login(data.access, data.refresh, data.usuario)
      window.location.href = '/'
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <AuthLayout>
      <TituloAuth>Entrar</TituloAuth>

      {erro && <ErroGeral mensagem={erro} />}

      <CampoTexto
        id="id_username" name="username"
        placeholder="Usuário ou Email"
        value={username} onChange={setUsername}
        autoComplete="username"
        icone={<IconeUsuario />}
        onKeyDown={onEnter}
      />

      <CampoSenha
        id="id_password" name="password"
        placeholder="Senha"
        value={password} onChange={setPassword}
        autoComplete="current-password"
        onKeyDown={onEnter}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 16px', fontSize: '12px', fontWeight: 300, color: 'rgba(255,255,255,0.85)', fontFamily: "'Poppins', sans-serif" }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)}
            style={{ accentColor: '#a855f7', width: '15px', height: '15px' }}
          />
          Lembrar senha
        </label>
        <LinkAuth href="/senha/reset">Esqueceu a senha?</LinkAuth>
      </div>

      <BotaoPrimario carregando={carregando} onClick={handleSubmit}>
        Login
      </BotaoPrimario>

      <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.80)', marginTop: '16px', fontFamily: "'Poppins', sans-serif" }}>
        <LinkAuth href="/registrar">Criar uma conta</LinkAuth>
      </p>
    </AuthLayout>
  )
}