import { createContext, useState, useEffect, useCallback } from 'react'

export interface Usuario {
  id: number
  username: string
  nome_exibicao: string
  foto: string | null
}

interface AuthState {
  usuario: Usuario | null
  accessToken: string | null
  refreshToken: string | null
}

interface AuthContextValue extends AuthState {
  login: (access: string, refresh: string, usuario: Usuario) => void
  logout: () => Promise<void>
  atualizarTokens: (access: string, refresh: string) => void
  carregando: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY_ACCESS  = 'soo_access'
const STORAGE_KEY_REFRESH = 'soo_refresh'
const STORAGE_KEY_USUARIO = 'soo_usuario'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [estado, setEstado] = useState<AuthState>({
    usuario:      null,
    accessToken:  null,
    refreshToken: null,
  })

  useEffect(() => {
    const access  = localStorage.getItem(STORAGE_KEY_ACCESS)
    const refresh = localStorage.getItem(STORAGE_KEY_REFRESH)
    const raw     = localStorage.getItem(STORAGE_KEY_USUARIO)

    if (access && refresh && raw) {
      try {
        const usuario = JSON.parse(raw) as Usuario
        setEstado({ accessToken: access, refreshToken: refresh, usuario })
      } catch {
        localStorage.removeItem(STORAGE_KEY_ACCESS)
        localStorage.removeItem(STORAGE_KEY_REFRESH)
        localStorage.removeItem(STORAGE_KEY_USUARIO)
      }
    }
    setCarregando(false)
  }, [])

  const login = useCallback((access: string, refresh: string, usuario: Usuario) => {
    localStorage.setItem(STORAGE_KEY_ACCESS,  access)
    localStorage.setItem(STORAGE_KEY_REFRESH, refresh)
    localStorage.setItem(STORAGE_KEY_USUARIO, JSON.stringify(usuario))
    setEstado({ accessToken: access, refreshToken: refresh, usuario })
  }, [])

  const atualizarTokens = useCallback((access: string, refresh: string) => {
    localStorage.setItem(STORAGE_KEY_ACCESS,  access)
    localStorage.setItem(STORAGE_KEY_REFRESH, refresh)
    setEstado(prev => ({ ...prev, accessToken: access, refreshToken: refresh }))
  }, [])

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem(STORAGE_KEY_REFRESH)
    if (refresh) {
      try {
        await fetch('/api/auth/logout/', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refresh }),
        })
      } catch { /* descarta erros de rede — logout local sempre ocorre */ }
    }
    localStorage.removeItem(STORAGE_KEY_ACCESS)
    localStorage.removeItem(STORAGE_KEY_REFRESH)
    localStorage.removeItem(STORAGE_KEY_USUARIO)
    setEstado({ accessToken: null, refreshToken: null, usuario: null })
  }, [])

  return (
    <AuthContext.Provider value={{ ...estado, login, logout, atualizarTokens, carregando }}>
      {children}
    </AuthContext.Provider>
  )
}