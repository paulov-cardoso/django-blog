import { useEffect, useRef } from 'react'

export type AbaId = 'perfil' | 'notes_privados' | 'feed' | 'campo' | 'forumizacao'

interface TabBarProps {
  abaAtual: AbaId
}

const abas = [
  { id: 'perfil'         as AbaId, emoji: '👤', label: 'Perfil',           href: '/?aba=perfil' },
  { id: 'notes_privados' as AbaId, emoji: '📓', label: 'Notes Privados',   href: '/?aba=notes_privados' },
  { id: 'feed'           as AbaId, emoji: '👥', label: 'Feed de Ideias',   href: '/?aba=feed' },
  { id: 'campo'          as AbaId, emoji: '🌍', label: 'Campo das Ideias', href: '/?aba=campo' },
  { id: 'forumizacao'    as AbaId, emoji: '🏛',  label: 'Forumização',      href: '/?aba=forumizacao' },
]

const BG = 'linear-gradient(155deg, #1a1240 0%, #2a1460 40%, #3a1248 65%, #4a1810 100%)'

// ALTURA_COMPACTA deve ser mantida em sincronia com o paddingTop do <main> no AppLayout
export const TABBAR_HEIGHT = 36

const STYLE = `
  .synapsoo-tabbar {
    background: ${BG};
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex;
    justify-content: center;
    overflow: hidden;
    height: ${TABBAR_HEIGHT}px;
    transition: height 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    /* Flutuante — não empurra o conteúdo ao expandir */
    position: fixed;
    top: 56px;
    left: 0;
    right: 0;
    z-index: 35;
  }
  .synapsoo-tabbar:hover {
    height: 58px;
  }
  .synapsoo-tab {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Ícone sempre centralizado verticalmente na altura compacta (36px) */
    justify-content: flex-start;
    padding-top: 9px;
    gap: 3px;
    padding-left: 32px;
    padding-right: 32px;
    text-decoration: none;
    color: rgba(255,255,255,0.40);
    white-space: nowrap;
    transition: color 0.2s;
    cursor: pointer;
    min-height: ${TABBAR_HEIGHT}px;
  }
  .synapsoo-tab.ativa {
    color: rgba(255,255,255,0.95);
  }
  .synapsoo-tab:hover {
    color: rgba(255,255,255,0.85);
  }
  .synapsoo-tab-icon {
    font-size: 17px;
    line-height: 1;
    flex-shrink: 0;
    /* padding-top: 9px acima + 17px ícone = centro em 36px */
  }
  .synapsoo-tab-label {
    font-size: 9.5px;
    font-weight: 300;
    font-family: 'Poppins', sans-serif;
    letter-spacing: 0.4px;
    white-space: nowrap;
    opacity: 0;
    transform: translateY(3px);
    transition: opacity 0.22s 0.06s, transform 0.22s 0.06s;
  }
  .synapsoo-tabbar:hover .synapsoo-tab-label {
    opacity: 1;
    transform: translateY(0);
  }
  .synapsoo-tab-underline {
    position: absolute;
    bottom: 0;
    left: 16px;
    right: 16px;
    height: 2px;
    background: transparent;
    border-radius: 2px 2px 0 0;
    transition: background 0.2s;
  }
  .synapsoo-tab.ativa .synapsoo-tab-underline {
    background: rgba(255,255,255,0.75);
  }
`

export function TabBar({ abaAtual }: TabBarProps) {
  const styleInjected = useRef(false)

  useEffect(() => {
    if (styleInjected.current) return
    const el = document.createElement('style')
    el.textContent = STYLE
    document.head.appendChild(el)
    styleInjected.current = true
  }, [])

  return (
    <nav className="synapsoo-tabbar" aria-label="Navegação principal">
      {abas.map((aba) => {
        const ativa = aba.id === abaAtual
        return (
          <a
            key={aba.id}
            href={aba.href}
            className={`synapsoo-tab${ativa ? ' ativa' : ''}`}
            aria-current={ativa ? 'page' : undefined}
          >
            <span className="synapsoo-tab-icon" aria-hidden="true">{aba.emoji}</span>
            <span className="synapsoo-tab-label">{aba.label}</span>
            <span className="synapsoo-tab-underline" aria-hidden="true" />
          </a>
        )
      })}
    </nav>
  )
}