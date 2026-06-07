const STORAGE_KEY_ACCESS  = 'soo_access'
const STORAGE_KEY_REFRESH = 'soo_refresh'
const STORAGE_KEY_USUARIO = 'soo_usuario'

async function tentarRefresh(): Promise<string | null> {
  const refresh = localStorage.getItem(STORAGE_KEY_REFRESH)
  if (!refresh) return null

  const res = await fetch('/api/auth/refresh/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refresh }),
  })

  if (!res.ok) {
    localStorage.removeItem(STORAGE_KEY_ACCESS)
    localStorage.removeItem(STORAGE_KEY_REFRESH)
    localStorage.removeItem(STORAGE_KEY_USUARIO)
    window.location.href = '/login'
    return null
  }

  const dados = await res.json()
  localStorage.setItem(STORAGE_KEY_ACCESS,  dados.access)
  localStorage.setItem(STORAGE_KEY_REFRESH, dados.refresh)
  return dados.access
}

export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const access = localStorage.getItem(STORAGE_KEY_ACCESS)

  const headers = new Headers(options.headers)
  if (access) headers.set('Authorization', `Bearer ${access}`)
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    const novoAccess = await tentarRefresh()
    if (novoAccess) {
      headers.set('Authorization', `Bearer ${novoAccess}`)
      res = await fetch(url, { ...options, headers })
    }
  }

  return res
}