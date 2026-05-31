import { colors } from '../../design/tokens'

export type AbaId = 'perfil' | 'notes_privados' | 'feed' | 'campo' | 'forumizacao'

interface TabBarProps {
  abaAtual: AbaId
}

const abas = [
  { id: 'perfil' as AbaId, emoji: '👤', label: 'Perfil', href: '/?aba=perfil', cor: '#6366f1' },
  { id: 'notes_privados' as AbaId, emoji: '📓', label: 'Notes', href: '/?aba=notes_privados', cor: '#3b82f6' },
  { id: 'feed' as AbaId, emoji: '👥', label: 'Feed', href: '/?aba=feed', cor: '#a855f7' },
  { id: 'campo' as AbaId, emoji: '🌍', label: 'Campo', href: '/?aba=campo', cor: '#fb923c' },
  { id: 'forumizacao' as AbaId, emoji: '🏛', label: 'Forum', href: '/?aba=forumizacao', cor: '#ca8a04' },
]

export function TabBar(props: TabBarProps) {
  return (
    <div style={{ position: 'sticky', top: '56px', zIndex: 30, background: 'rgba(255,255,255,0.90)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
        {abas.map((aba) => {
          const ativa = aba.id === props.abaAtual
          const abaKey = aba.id
          return (
            <a key={abaKey} href={aba.href} style={{ position: 'relative', padding: '10px 20px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', color: ativa ? aba.cor : 'rgba(107,114,128,1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span>{aba.emoji}</span>
              <span>{aba.label}</span>
              <span style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '2px', background: ativa ? aba.cor : 'transparent' }} />
            </a>
          )
        })}
      </div>
    </div>
  )
}
