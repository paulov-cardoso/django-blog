import { useEffect, useRef } from 'react'

interface AuthLayoutProps {
  children: React.ReactNode
}

const SLOGAN = 'Onde suas ideias jamais caem no esquecimento'

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
        zIndex: 2, pointerEvents: 'none',
      }}
    />
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function AuthLayout({ children }: AuthLayoutProps) {
  const textureRef = useRef<HTMLCanvasElement>(null)
  const sloganRef  = useRef<HTMLSpanElement>(null)
  const cursorRef  = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const canvas = textureRef.current
    if (!canvas) return
    const parent = canvas.parentElement!
    const box    = parent.getBoundingClientRect()
    const w      = Math.ceil(box.width)  || 400
    const h      = Math.ceil(box.height) || 500
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(w, h)
    const px  = img.data
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx    = (y * w + x) * 4
        const grain  = Math.random()
        const stripe = (Math.sin(y * 0.4 + Math.random() * 0.6) + 1) / 2
        const diag   = (Math.sin((x + y) * 0.08) + 1) / 2
        const val    = Math.floor((grain * 0.55 + stripe * 0.30 + diag * 0.15) * 255)
        px[idx] = px[idx + 1] = px[idx + 2] = val
        px[idx + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [])

  useEffect(() => {
    const sloganEl = sloganRef.current
    const cursorEl = cursorRef.current
    if (!sloganEl || !cursorEl) return

    let pos = 0, typing = true, rafId = 0, cursorId = 0

    sloganEl.textContent = ''

    const typeWriter = () => {
      if (typing) {
        if (pos < SLOGAN.length) {
          sloganEl.textContent += SLOGAN.charAt(pos++)
          rafId = window.setTimeout(typeWriter, 60)
        } else {
          rafId = window.setTimeout(() => { typing = false; typeWriter() }, 2000)
        }
      } else {
        if (pos > 0) {
          sloganEl.textContent = SLOGAN.substring(0, --pos)
          rafId = window.setTimeout(typeWriter, 30)
        } else {
          rafId = window.setTimeout(() => { typing = true; typeWriter() }, 500)
        }
      }
    }
    typeWriter()

    cursorId = window.setInterval(() => {
      cursorEl.style.opacity = cursorEl.style.opacity === '0' ? '1' : '0'
    }, 500)

    return () => { clearTimeout(rafId); clearInterval(cursorId) }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1,
      background: 'linear-gradient(155deg, #d4b8d4 0%, #e2cde2 45%, #eddaed 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '1rem 1rem 4rem',
      overflowY: 'auto',
    }}>

      <CanvasPostits />

      <img
        src="/static/posts/images/Oficial_Soo.png"
        alt="Synapsoo"
        width={260}
        style={{
          position: 'relative', zIndex: 999,
          height: 'auto',
          filter: 'drop-shadow(0 6px 18px rgba(60,10,100,0.22))',
          marginBottom: '-10px',
          flexShrink: 0,
        }}
      />

      <div style={{
        position: 'relative', zIndex: 900,
        width: '100%', maxWidth: '400px',
      }}>
        <article style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(155deg, #3a2d9e 0%, #6832b5 40%, #9a3aaa 65%, #c85838 100%)',
          width: '100%', borderRadius: '16px',
          padding: '32px 32px 28px',
          border: '1px solid rgba(255,255,255,0.20)',
          boxShadow: '0 28px 64px rgba(50,15,100,0.30), 0 4px 16px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.16)',
        }}>
          <canvas
            ref={textureRef}
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              borderRadius: 'inherit', opacity: 0.18,
              mixBlendMode: 'soft-light', pointerEvents: 'none', zIndex: 0,
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </div>
        </article>
      </div>

      <p style={{
        position: 'relative', zIndex: 900,
        fontSize: '18px', fontWeight: 300, marginTop: '24px',
        textAlign: 'center', letterSpacing: '-0.03em',
        fontFamily: "'Poppins', sans-serif",
        color: 'rgba(90,50,120,0.70)',
      }}>
        <span ref={sloganRef} />
        <span ref={cursorRef} aria-hidden="true" style={{ opacity: 0.9 }}>|</span>
      </p>

      <footer style={{
        position: 'fixed', bottom: 0, width: '100%',
        textAlign: 'center', padding: '12px 0',
        fontSize: '14px', fontWeight: 300,
        fontFamily: "'Poppins', sans-serif",
        color: 'rgba(88,28,135,0.60)',
        zIndex: 900,
      }}>
        © Copyright 2026 Synapsoo &nbsp;·&nbsp;
        <a href="#" style={{ color: 'inherit', margin: '0 4px' }}>Termos de uso</a> &nbsp;·&nbsp;
        <a href="#" style={{ color: 'inherit', margin: '0 4px' }}>Suporte</a>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}