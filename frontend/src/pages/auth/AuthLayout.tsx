import { useEffect, useRef } from 'react'

interface AuthLayoutProps {
  children: React.ReactNode
}

const SLOGAN = 'Onde suas ideias jamais caem no esquecimento'

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
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '1rem 1rem 4rem',
      background: 'linear-gradient(155deg, #d4b8d4 0%, #e2cde2 45%, #eddaed 100%)',
      overflowY: 'auto',
    }}>
      <div style={{ position: 'relative', zIndex: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', position: 'relative', zIndex: 20 }}>
          <img
            src="/static/posts/images/Oficial_Soo.png"
            alt="Synapsoo"
            width={260}
            style={{ height: 'auto', filter: 'drop-shadow(0 6px 18px rgba(60,10,100,0.22))', marginBottom: '-10px' }}
          />
        </div>

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
        position: 'relative', zIndex: 52,
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
        zIndex: 52,
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