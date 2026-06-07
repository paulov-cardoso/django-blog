import { useEffect, useRef } from 'react'
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

// ── Post-its ──────────────────────────────────────────────────────────────────

const POSTIT_COLORS = ['#FFFF99', '#FFFF99', '#FF65A3', '#FF9933', '#D2DE40', '#A6CCF5', '#FFB3C5']
const POSTIT_TOTAL  = 32

interface Postit {
  x: number; y: number; size: number; color: string
  speed: number; drift: number; angle: number; spin: number; opacity: number
}

function criarPostit(w: number, h: number): Postit {
  return {
    x:       Math.random() * w,
    y:       Math.random() * -h,
    size:    Math.random() * 14 + 10,
    color:   POSTIT_COLORS[Math.floor(Math.random() * POSTIT_COLORS.length)],
    speed:   Math.random() * 0.6 + 0.3,
    drift:   (Math.random() - 0.5) * 0.4,
    angle:   Math.random() * Math.PI * 2,
    spin:    (Math.random() - 0.5) * 0.012,
    opacity: Math.random() * 0.35 + 0.25,
  }
}

function desenharPostit(ctx: CanvasRenderingContext2D, p: Postit) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.angle)
  ctx.globalAlpha   = p.opacity
  ctx.shadowColor   = 'rgba(0,0,0,0.12)'
  ctx.shadowBlur    = 3
  ctx.shadowOffsetX = 1
  ctx.shadowOffsetY = 2
  ctx.fillStyle     = p.color
  ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
  const fold = p.size * 0.28
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  ctx.beginPath()
  ctx.moveTo( p.size / 2 - fold, -p.size / 2)
  ctx.lineTo( p.size / 2,        -p.size / 2 + fold)
  ctx.lineTo( p.size / 2 - fold, -p.size / 2 + fold)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// Array em escopo de módulo — sobrevive à remontagem de qualquer componente
let _postitsCached: Postit[] | null = null

function CanvasPostits() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const redimensionar = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    redimensionar()
    window.addEventListener('resize', redimensionar)

    if (!_postitsCached) {
      _postitsCached = Array.from({ length: POSTIT_TOTAL }, () =>
        criarPostit(window.innerWidth, window.innerHeight)
      )
    }
    const postits = _postitsCached

    const animar = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of postits) {
        p.y += p.speed; p.x += p.drift; p.angle += p.spin
        if (p.y > canvas.height + p.size) {
          p.y = -p.size * 2
          p.x = Math.random() * canvas.width
        }
        desenharPostit(ctx, p)
      }
      rafRef.current = requestAnimationFrame(animar)
    }
    animar()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', redimensionar)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: 51, pointerEvents: 'none',
      }}
    />
  )
}

// ── Roteamento ────────────────────────────────────────────────────────────────

const ABAS_VALIDAS: AbaId[] = ['perfil', 'notes_privados', 'feed', 'campo', 'forumizacao']

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

  if (carregando) return null

  if (rota === '/login')                     return <LoginPage />
  if (rota === '/registrar')                 return <RegistrarPage />
  if (rota === '/senha/reset')               return <SenhaResetPage />
  if (rota.startsWith('/senha/confirmar/'))  return <SenhaResetConfirmarPage />

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
      <CanvasPostits />
      <AppAutenticado />
    </AuthProvider>
  )
}

export default App