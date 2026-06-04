import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { colors, typography } from '../design/tokens'

interface Categoria { nome: string; cor: string }
interface Note {
  id: number; titulo: string; titulo_capa: string; conteudo: string
  cor: string; data: string; imagem_capa: string | null
  categorias: Categoria[]; curtidas: number; clips: number
  url_editar: string; url_detalhe: string
  canvas_x: number; canvas_y: number; canvas_ordem: number
}

const CARD_W = 260; const CARD_H = 220
const GRID_COL = 280; const GRID_ROW = 240
const ZOOM_MIN = 0.35; const ZOOM_MAX = 2.0; const ZOOM_STEP = 0.12
const ZOOM_DEFAULT = 1.0; const BUFFER_PX = 300; const CANVAS_GAP = 48

const PALETA_BASE = [
  { hex: '#F59E0B', nome: 'Ambar' }, { hex: '#EF4444', nome: 'Vermelho' },
  { hex: '#EC4899', nome: 'Rosa' },  { hex: '#8B5CF6', nome: 'Roxo' },
  { hex: '#3B82F6', nome: 'Azul' },  { hex: '#06B6D4', nome: 'Ciano' },
  { hex: '#10B981', nome: 'Verde' }, { hex: '#84CC16', nome: 'Lima' },
  { hex: '#F97316', nome: 'Laranja' }, { hex: '#14B8A6', nome: 'Turquesa' },
  { hex: '#6B7280', nome: 'Cinza' },
]

function snapToGrid(x: number, y: number) {
  return { x: Math.round(x / GRID_COL) * GRID_COL, y: Math.round(y / GRID_ROW) * GRID_ROW }
}
function celulaOcupada(notes: Note[], sx: number, sy: number, ignorarId: number) {
  return notes.some(n =>
    n.id !== ignorarId &&
    Math.round(n.canvas_x / GRID_COL) === Math.round(sx / GRID_COL) &&
    Math.round(n.canvas_y / GRID_ROW) === Math.round(sy / GRID_ROW)
  )
}
function proximaPosicaoLivre(notes: Note[]) {
  if (notes.length === 0) return { x: 0, y: 0, ordem: 0 }
  const ul = [...notes].sort((a, b) => b.canvas_ordem - a.canvas_ordem)[0]
  const s = snapToGrid(ul.canvas_x, ul.canvas_y)
  const col = Math.round(s.x / GRID_COL), lin = Math.round(s.y / GRID_ROW)
  const nc = col + 1 < 4 ? col + 1 : 0, nl = col + 1 < 4 ? lin : lin + 1
  return { x: nc * GRID_COL, y: nl * GRID_ROW, ordem: ul.canvas_ordem + 1 }
}
function ajustarLuminosidade(hex: string, lum: number): string {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255
  const max = Math.max(r,g,b), min = Math.min(r,g,b)
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min; s = max > 0.5 ? d/(2-max-min) : d/(max+min)
    if (max===r) h=((g-b)/d+(g<b?6:0))/6
    else if (max===g) h=((b-r)/d+2)/6
    else h=((r-g)/d+4)/6
  }
  const L = Math.max(0.15, Math.min(0.85, lum))
  const hue2rgb = (p:number, q:number, t:number) => {
    if(t<0)t+=1; if(t>1)t-=1
    if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p
  }
  let nr:number, ng:number, nb:number
  if (s===0) { nr=ng=nb=L } else {
    const q2=L<0.5?L*(1+s):L+s-L*s, p2=2*L-q2
    nr=hue2rgb(p2,q2,h+1/3); ng=hue2rgb(p2,q2,h); nb=hue2rgb(p2,q2,h-1/3)
  }
  const th=(x:number)=>Math.round(x*255).toString(16).padStart(2,'0')
  return `#${th(nr)}${th(ng)}${th(nb)}`
}
function getLuminosidadeBase(hex: string) {
  const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255
  return (Math.max(r,g,b)+Math.min(r,g,b))/2
}
function isEscuro(hex: string) {
  if(!hex||hex==='#ffffff')return false
  const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255
  return (0.299*r+0.587*g+0.114*b)<0.6
}
function getCsrf() {
  const c=document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken=')); return c?c.split('=')[1]:''
}

export function NotesPage() {
  const [notes,setNotes]                   = useState<Note[]>([])
  const [loading,setLoading]               = useState(true)
  const [erro,setErro]                     = useState('')
  const [composerAberto,setComposerAberto] = useState(false)
  const [noteLendo,setNoteLendo]           = useState<Note|null>(null)
  const [camX,setCamX] = useState(CANVAS_GAP)
  const [camY,setCamY] = useState(CANVAS_GAP)
  const [zoom,setZoom] = useState(ZOOM_DEFAULT)

  // Pan
  const panRef   = useRef(false)
  const panStart = useRef({x:0,y:0,camX:0,camY:0})

  // Drag de card
  const dragRef = useRef<{id:number;startMouseX:number;startMouseY:number;startCardX:number;startCardY:number}|null>(null)
  const [draggingId,setDraggingId] = useState<number|null>(null)
  const [dragPos,setDragPos]       = useState<{x:number;y:number}|null>(null)
  const dragOriginRef              = useRef<{x:number;y:number}>({x:0,y:0})
  const [snapBackId,setSnapBackId] = useState<number|null>(null)

  // Busca
  const [busca,setBusca]               = useState('')
  const [buscaAberta,setBuscaAberta]   = useState(false)
  const [buscaExpanded,setBuscaExpanded] = useState(false)
  const [destacado,setDestacado]       = useState<number|null>(null)
  const buscaInputRef                  = useRef<HTMLInputElement>(null)

  // Zoom
  const [zoomExpanded,setZoomExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{ carregarNotes() },[])

  function carregarNotes() {
    fetch('/api/notes/privados/').then(r=>r.json()).then(data=>{
      const posts:Note[]=data.posts
      const sem=posts.filter(n=>n.canvas_x===0&&n.canvas_y===0)
      if(sem.length>1) sem.forEach((n,i)=>{ n.canvas_x=(i%4)*GRID_COL; n.canvas_y=Math.floor(i/4)*GRID_ROW; n.canvas_ordem=i })
      setNotes(posts); setLoading(false)
    }).catch(()=>{ setErro('Erro ao carregar notes.'); setLoading(false) })
  }

  const salvarTimeout=useRef<ReturnType<typeof setTimeout>|null>(null)
  function salvarPosicao(id:number,x:number,y:number,ordem:number){
    if(salvarTimeout.current)clearTimeout(salvarTimeout.current)
    salvarTimeout.current=setTimeout(()=>{
      fetch(`/api/notes/${id}/posicao/`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':getCsrf()},body:JSON.stringify({x,y,ordem})})
    },600)
  }

  // 1. Pan: mousedown APENAS no fundo (nunca em card)
  const onMouseDown=useCallback((e:React.MouseEvent)=>{
    if((e.target as HTMLElement).closest('[data-card]'))return
    if(e.button!==0)return
    panRef.current=true
    panStart.current={x:e.clientX,y:e.clientY,camX,camY}
    e.preventDefault()
  },[camX,camY])

  useEffect(()=>{
    function onMove(e:MouseEvent){
      if(panRef.current){
        setCamX(panStart.current.camX+(e.clientX-panStart.current.x))
        setCamY(panStart.current.camY+(e.clientY-panStart.current.y))
      }
      if(dragRef.current){
        const dx=(e.clientX-dragRef.current.startMouseX)/zoom
        const dy=(e.clientY-dragRef.current.startMouseY)/zoom
        setDragPos({x:dragRef.current.startCardX+dx,y:dragRef.current.startCardY+dy})
      }
    }
    function onUp(){
      panRef.current=false
      if(dragRef.current&&dragPos){
        const {id}=dragRef.current
        const sn=snapToGrid(dragPos.x,dragPos.y)
        // 2+3. Colisao: snap-back magnetico se celula ocupada
        if(celulaOcupada(notes,sn.x,sn.y,id)){
          const o=dragOriginRef.current
          setSnapBackId(id)
          setNotes(prev=>prev.map(n=>n.id===id?{...n,canvas_x:o.x,canvas_y:o.y}:n))
          setTimeout(()=>setSnapBackId(null),380)
        } else {
          setNotes(prev=>prev.map(n=>{
            if(n.id!==id)return n
            salvarPosicao(id,sn.x,sn.y,n.canvas_ordem)
            return{...n,canvas_x:sn.x,canvas_y:sn.y}
          }))
        }
        dragRef.current=null; setDraggingId(null); setDragPos(null)
      }
    }
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp)
    return()=>{ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp) }
  },[zoom,dragPos,notes])

  const onWheel=useCallback((e:React.WheelEvent)=>{
    e.preventDefault()
    setZoom(z=>Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,z+(e.deltaY<0?ZOOM_STEP:-ZOOM_STEP))))
  },[])

  function zoomIn()    { setZoom(z=>Math.min(ZOOM_MAX,+(z+ZOOM_STEP).toFixed(2))) }
  function zoomOut()   { setZoom(z=>Math.max(ZOOM_MIN,+(z-ZOOM_STEP).toFixed(2))) }
  // 4. Reset zoom com gap nas bordas
  function zoomReset() { setZoom(ZOOM_DEFAULT); setCamX(CANVAS_GAP); setCamY(CANVAS_GAP) }

  function iniciarDragCard(e:React.MouseEvent,note:Note){
    e.stopPropagation()
    dragOriginRef.current={x:note.canvas_x,y:note.canvas_y}
    dragRef.current={id:note.id,startMouseX:e.clientX,startMouseY:e.clientY,startCardX:note.canvas_x,startCardY:note.canvas_y}
    setDraggingId(note.id); setDragPos({x:note.canvas_x,y:note.canvas_y})
  }

  function navegarAteNote(note:Note){
    const c=containerRef.current; if(!c)return
    const {width,height}=c.getBoundingClientRect()
    setCamX(width/2-(note.canvas_x+CARD_W/2)*zoom)
    setCamY(height/2-(note.canvas_y+CARD_H/2)*zoom)
    setDestacado(note.id); setBuscaAberta(false); setBuscaExpanded(false); setBusca('')
    setTimeout(()=>setDestacado(null),2000)
  }

  const notesVisiveis=useMemo(()=>{
    const c=containerRef.current; if(!c)return notes
    const {width,height}=c.getBoundingClientRect(); if(width===0)return notes
    const x0=(-camX-BUFFER_PX)/zoom, y0=(-camY-BUFFER_PX)/zoom
    const x1=(-camX+width+BUFFER_PX)/zoom, y1=(-camY+height+BUFFER_PX)/zoom
    return notes.filter(n=>{
      const cx=draggingId===n.id&&dragPos?dragPos.x:n.canvas_x
      const cy=draggingId===n.id&&dragPos?dragPos.y:n.canvas_y
      return cx+CARD_W>x0&&cx<x1&&cy+CARD_H>y0&&cy<y1
    })
  },[notes,camX,camY,zoom,draggingId,dragPos])

  const resultadosBusca=useMemo(()=>{
    if(!busca.trim())return[]
    const q=busca.toLowerCase()
    return notes.filter(n=>n.titulo.toLowerCase().includes(q)||n.titulo_capa.toLowerCase().includes(q)||n.conteudo.toLowerCase().includes(q)||n.categorias.some(c=>c.nome.toLowerCase().includes(q)))
  },[busca,notes])

  // 5. Toggle da barra de busca retratil
  function toggleBusca(){
    if(!buscaExpanded){ setBuscaExpanded(true); setTimeout(()=>{ buscaInputRef.current?.focus(); setBuscaAberta(true) },60) }
    else { setBuscaExpanded(false); setBuscaAberta(false); setBusca('') }
  }

  function onNoteCriado(note:Note){ setNotes(prev=>[note,...prev]); setComposerAberto(false); setTimeout(()=>navegarAteNote(note),100) }
  function onNoteExcluido(id:number){ setNotes(prev=>prev.filter(n=>n.id!==id)); setNoteLendo(null) }

  if(loading) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:'12px'}}>
      <span style={{fontSize:'2.5rem'}}>📓</span>
      <p style={{color:colors.text.secondary,fontFamily:typography.fontFamily.primary,fontSize:'13px'}}>Carregando notes...</p>
    </div>
  )
  if(erro) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
      <p style={{color:'#ef4444',fontFamily:typography.fontFamily.primary,fontSize:'13px'}}>{erro}</p>
    </div>
  )

  return(
    <>
      <style>{`
        @keyframes destacarCard{0%,100%{box-shadow:0 4px 12px rgba(0,0,0,.22)}30%,60%{box-shadow:0 0 0 3px #fb923c,0 8px 32px rgba(251,146,60,.5)}}
        @keyframes snapBack{0%{transform:scale(1.04)}40%{transform:scale(0.96)}70%{transform:scale(1.02)}100%{transform:scale(1)}}
        @keyframes modalEntrar{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes dropdownEntrar{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes zoomExpand{from{opacity:0;transform:scale(.85) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
      `}</style>

      <div ref={containerRef} onMouseDown={onMouseDown} onWheel={onWheel}
        style={{position:'fixed',top:'92px',left:0,right:0,bottom:0,overflow:'hidden',cursor:panRef.current?'grabbing':'grab',userSelect:'none'}}>

        {/* World */}
        <div style={{position:'absolute',top:0,left:0,transform:`translate(${camX}px,${camY}px) scale(${zoom})`,transformOrigin:'0 0',willChange:'transform'}}>
          {notes.length===0
            ? <div style={{position:'absolute',top:'40px',left:'40px',color:colors.text.secondary,fontFamily:typography.fontFamily.primary,fontSize:'14px',pointerEvents:'none'}}>Clique em "✏️ Criar novo note" para comecar</div>
            : notesVisiveis.map(note=>{
                const isDragging=draggingId===note.id
                const posX=isDragging&&dragPos?dragPos.x:note.canvas_x
                const posY=isDragging&&dragPos?dragPos.y:note.canvas_y
                return(
                  <PostIt key={note.id} note={note} posX={posX} posY={posY}
                    isDragging={isDragging} isSnapBack={snapBackId===note.id} destacado={destacado===note.id}
                    onAbrir={()=>setNoteLendo(note)} onDragStart={e=>iniciarDragCard(e,note)}/>
                )
              })
          }
        </div>

        {/* 5. Barra de busca retratil - pill vira input in-place */}
        <div style={{position:'absolute',top:'12px',left:'50%',transform:'translateX(-50%)',zIndex:60,display:'flex',flexDirection:'column',alignItems:'center'}}>
          <div style={{background:buscaExpanded?'rgba(10,6,28,0.92)':'rgba(10,6,28,0.55)',backdropFilter:'blur(16px)',borderRadius:buscaExpanded?'14px':'20px',border:`1px solid ${buscaExpanded?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.10)'}`,boxShadow:buscaExpanded?'0 8px 32px rgba(0,0,0,0.4)':'none',overflow:'hidden',transition:'border-radius 0.2s,background 0.2s,box-shadow 0.2s',minWidth:buscaExpanded?'360px':undefined}}>
            <div style={{display:'flex',alignItems:'center',padding:buscaExpanded?'0 14px':'5px 14px',gap:'8px',cursor:buscaExpanded?'default':'pointer'}} onClick={!buscaExpanded?toggleBusca:undefined}>
              <span style={{fontSize:'12px',opacity:0.5,flexShrink:0}}>🔍</span>
              {buscaExpanded
                ? <input ref={buscaInputRef} type="text" placeholder="Buscar notes ou conteudos..." value={busca}
                    onChange={e=>{setBusca(e.target.value);setBuscaAberta(true)}} onFocus={()=>setBuscaAberta(true)}
                    style={{flex:1,background:'none',border:'none',outline:'none',fontFamily:typography.fontFamily.primary,fontSize:'13px',color:'rgba(255,255,255,0.88)',padding:'11px 0',minWidth:'260px'}}/>
                : <span style={{fontFamily:typography.fontFamily.primary,fontSize:'12px',color:'rgba(255,255,255,0.45)',whiteSpace:'nowrap'}}>procurar notes ou conteudos</span>
              }
              {buscaExpanded&&<button onClick={toggleBusca} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.35)',fontSize:'14px',flexShrink:0,padding:'0 0 0 4px'}}>✕</button>}
            </div>
            {buscaExpanded&&buscaAberta&&busca&&(
              <div style={{borderTop:'1px solid rgba(255,255,255,0.07)'}}>
                {resultadosBusca.length===0
                  ? <p style={{fontFamily:typography.fontFamily.primary,fontSize:'12px',color:'rgba(255,255,255,0.35)',padding:'12px 14px',margin:0}}>Nenhum resultado para "{busca}"</p>
                  : <div style={{maxHeight:'260px',overflowY:'auto'}}>
                      <p style={{fontFamily:typography.fontFamily.primary,fontSize:'10px',color:'rgba(255,255,255,0.30)',padding:'8px 14px 4px',margin:0,letterSpacing:'0.06em',textTransform:'uppercase'}}>{resultadosBusca.length} resultado{resultadosBusca.length>1?'s':''}</p>
                      {resultadosBusca.map(n=>{
                        const idx=n.conteudo.toLowerCase().indexOf(busca.toLowerCase())
                        const trecho=idx>=0?'...'+n.conteudo.slice(Math.max(0,idx-20),idx+60)+'...':n.conteudo.slice(0,80)+'...'
                        return(
                          <button key={n.id} onMouseDown={()=>navegarAteNote(n)}
                            style={{display:'block',width:'100%',textAlign:'left',background:'none',border:'none',cursor:'pointer',padding:'8px 14px',borderTop:'1px solid rgba(255,255,255,0.04)',transition:'background 0.15s'}}
                            onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.05)'}}
                            onMouseLeave={e=>{e.currentTarget.style.background='none'}}>
                            <p style={{fontFamily:typography.fontFamily.primary,fontSize:'12px',fontWeight:600,color:'rgba(255,255,255,0.85)',margin:'0 0 2px'}}>{n.titulo_capa||n.titulo}</p>
                            <p style={{fontFamily:typography.fontFamily.primary,fontSize:'11px',color:'rgba(255,255,255,0.38)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{trecho}</p>
                          </button>
                        )
                      })}
                    </div>
                }
              </div>
            )}
          </div>
        </div>

        {/* 4. Controles de zoom - icone 🎮 */}
        <div style={{position:'absolute',bottom:'100px',right:'28px',zIndex:60,display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
          {zoomExpanded&&(
            <div style={{display:'flex',flexDirection:'column',gap:'6px',animation:'zoomExpand 0.18s ease-out'}}>
              <BotaoZoom label="+" title="Aproximar" onClick={zoomIn}/>
              <BotaoZoom label={`${Math.round(zoom*100)}%`} title="Resetar para 100%" onClick={zoomReset} small/>
              <BotaoZoom label="-" title="Afastar" onClick={zoomOut}/>
            </div>
          )}
          <button onClick={()=>setZoomExpanded(v=>!v)} title="Controles de zoom"
            style={{width:'42px',height:'42px',borderRadius:'50%',background:zoomExpanded?'rgba(251,146,60,0.85)':'rgba(15,10,35,0.85)',border:'1px solid rgba(255,255,255,0.15)',backdropFilter:'blur(12px)',boxShadow:'0 4px 16px rgba(0,0,0,0.4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',transition:'background 0.2s'}}>
            🎮
          </button>
        </div>

        {/* Botao criar */}
        <button onClick={()=>setComposerAberto(true)}
          style={{position:'absolute',bottom:'28px',right:'28px',height:'44px',borderRadius:'22px',background:'linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',padding:'0 20px',boxShadow:'0 4px 16px rgba(59,130,246,0.45)',zIndex:60,transition:'transform 0.2s,box-shadow 0.2s',fontFamily:typography.fontFamily.primary,fontSize:'13px',fontWeight:600,color:'white'}}
          onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.05)';e.currentTarget.style.boxShadow='0 6px 24px rgba(59,130,246,0.6)'}}
          onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='0 4px 16px rgba(59,130,246,0.45)'}}>
          Criar novo note
        </button>
      </div>

      {noteLendo&&<ModalLeitura note={noteLendo} onFechar={()=>setNoteLendo(null)} onExcluido={onNoteExcluido}/>}
      {composerAberto&&<ComposerModal notes={notes} onFechar={()=>setComposerAberto(false)} onCriado={onNoteCriado}/>}
    </>
  )
}

function BotaoZoom({label,title,onClick,small}:{label:string;title:string;onClick:()=>void;small?:boolean}) {
  return(
    <button onClick={onClick} title={title}
      style={{width:'42px',height:small?'32px':'42px',borderRadius:small?'8px':'50%',background:'rgba(15,10,35,0.85)',border:'1px solid rgba(255,255,255,0.15)',backdropFilter:'blur(12px)',boxShadow:'0 2px 8px rgba(0,0,0,0.3)',cursor:'pointer',color:'white',fontFamily:typography.fontFamily.primary,fontSize:small?'10px':'20px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s'}}
      onMouseEnter={e=>{e.currentTarget.style.background='rgba(251,146,60,0.7)'}}
      onMouseLeave={e=>{e.currentTarget.style.background='rgba(15,10,35,0.85)'}}>
      {label}
    </button>
  )
}

function PostIt({note,posX,posY,isDragging,isSnapBack,destacado,onAbrir,onDragStart}:{note:Note;posX:number;posY:number;isDragging:boolean;isSnapBack:boolean;destacado:boolean;onAbrir:()=>void;onDragStart:(e:React.MouseEvent)=>void}) {
  const temFoto=Boolean(note.imagem_capa)
  const clickCount=useRef(0)
  const clickTimer=useRef<ReturnType<typeof setTimeout>|null>(null)

  // 1. Duplo clique abre modal; 1 clique pressiona pan (handled no parent)
  function handleClick(e:React.MouseEvent){
    e.stopPropagation()
    clickCount.current+=1
    if(clickCount.current===1){
      clickTimer.current=setTimeout(()=>{ clickCount.current=0 },280)
    } else if(clickCount.current===2){
      if(clickTimer.current)clearTimeout(clickTimer.current)
      clickCount.current=0; onAbrir()
    }
  }

  const preview=(()=>{
    const f=note.conteudo.split(/(?<=[.!?])\s+/); let r=''
    for(const s of f){ if((r+s).length>180)break; r+=(r?' ':'')+s; if(r.split(/[.!?]/).length-1>=2)break }
    return r||note.conteudo.slice(0,180)
  })()

  const bgStyle=temFoto?{backgroundImage:`url(${note.imagem_capa})`,backgroundSize:'cover',backgroundPosition:'center'}:{background:note.cor}

  return(
    <div data-card="true"
      style={{position:'absolute',left:posX,top:posY,width:CARD_W,height:CARD_H,...bgStyle,borderRadius:'12px',
        boxShadow:isDragging?'0 20px 48px rgba(0,0,0,0.5)':destacado?'0 0 0 3px #fb923c,0 8px 32px rgba(251,146,60,0.5)':'0 4px 12px rgba(0,0,0,0.22)',
        cursor:isDragging?'grabbing':'grab',display:'flex',flexDirection:'column',overflow:'hidden',
        transition:isDragging?'none':isSnapBack?'left 0.35s cubic-bezier(0.34,1.56,0.64,1),top 0.35s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.2s':'box-shadow 0.2s',
        animation:destacado?'destacarCard 2s ease-in-out':isSnapBack?'snapBack 0.35s ease-out':undefined,
        zIndex:isDragging?100:1,userSelect:'none'}}
      onMouseDown={onDragStart} onClick={handleClick}>
      {temFoto&&<div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.18) 55%,transparent 100%)',borderRadius:'12px'}}/>}
      <div style={{position:'relative',zIndex:1,padding:'16px 16px 0',flex:1,overflow:'hidden'}}>
        {note.categorias.length>0&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'6px'}}>
            {note.categorias.slice(0,2).map(cat=>(
              <span key={cat.nome} style={{fontSize:'9px',fontWeight:600,padding:'2px 7px',borderRadius:'999px',background:'rgba(0,0,0,0.15)',color:temFoto?'white':'rgba(0,0,0,0.55)',fontFamily:typography.fontFamily.primary}}>{cat.nome}</span>
            ))}
          </div>
        )}
        <h3 style={{fontFamily:typography.fontFamily.primary,fontSize:'13px',fontWeight:700,color:temFoto?'white':'rgba(0,0,0,0.82)',margin:'0 0 6px',lineHeight:1.3,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{note.titulo_capa||note.titulo}</h3>
        <p style={{fontFamily:typography.fontFamily.primary,fontSize:'11px',lineHeight:1.6,color:temFoto?'rgba(255,255,255,0.75)':'rgba(0,0,0,0.55)',margin:0,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:4,WebkitBoxOrient:'vertical'}}>{preview}</p>
      </div>
      <div style={{position:'relative',zIndex:1,padding:'8px 16px 12px'}}>
        <span style={{fontFamily:typography.fontFamily.primary,fontSize:'9px',color:temFoto?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.35)',letterSpacing:'0.02em'}}>🕐 {note.data}</span>
      </div>
    </div>
  )
}

function ModalLeitura({note,onFechar,onExcluido}:{note:Note;onFechar:()=>void;onExcluido:(id:number)=>void}) {
  const [dropdownAberto,setDropdownAberto]=useState(false)
  const [publicando,setPublicando]=useState(false)
  const [erroAcao,setErroAcao]=useState('')
  const temFoto=Boolean(note.imagem_capa)
  const dropdownRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    function h(e:MouseEvent){if(dropdownRef.current&&!dropdownRef.current.contains(e.target as Node))setDropdownAberto(false)}
    document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h)
  },[])
  function excluir(){if(!confirm('Excluir este note permanentemente?'))return;fetch(`/api/notes/${note.id}/excluir/`,{method:'POST',headers:{'X-CSRFToken':getCsrf()}}).then(()=>onExcluido(note.id))}
  function publicar(destino:'feed'|'campo'){
    setPublicando(true);setErroAcao('')
    fetch(`/api/notes/${note.id}/publicar/`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':getCsrf()},body:JSON.stringify({destino})})
      .then(r=>r.json()).then(data=>{
        if(data.ok)window.location.href=`/?aba=${destino}`
        else if(data.erro==='sem_categoria')setErroAcao('Adicione uma categoria antes de publicar.')
        else if(data.erro==='sem_capa')setErroAcao('O Feed requer imagem de capa.')
        else setErroAcao('Erro ao publicar.')
        setPublicando(false);setDropdownAberto(false)
      }).catch(()=>{setErroAcao('Erro de conexao.');setPublicando(false)})
  }
  const bg=temFoto?'#0f0a1e':(note.cor||'#ffffff')
  const tx=temFoto||isEscuro(note.cor)?'rgba(255,255,255,0.92)':'rgba(0,0,0,0.82)'
  const sub=temFoto||isEscuro(note.cor)?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.42)'
  return(
    <>
      <div onClick={onFechar} style={{position:'fixed',inset:0,zIndex:99998,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(10px)'}}/>
      <div style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',pointerEvents:'none'}}>
        <div onClick={e=>e.stopPropagation()} style={{background:bg,borderRadius:'20px',width:'100%',maxWidth:'580px',maxHeight:'85vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 32px 80px rgba(0,0,0,0.6)',animation:'modalEntrar 0.22s ease-out forwards',pointerEvents:'auto'}}>
          {temFoto&&<div style={{position:'relative',height:'200px',flexShrink:0,background:`url(${note.imagem_capa}) center/cover`}}><div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(15,10,30,0.95) 100%)'}}/></div>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'20px 24px 0',flexShrink:0}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:'6px',flex:1}}>
              {note.categorias.length>0?note.categorias.map(cat=>(<span key={cat.nome} style={{fontSize:'11px',fontWeight:600,padding:'3px 10px',borderRadius:'999px',background:'rgba(255,255,255,0.12)',color:tx,fontFamily:typography.fontFamily.primary}}>{cat.nome}</span>)):<span style={{fontSize:'11px',color:sub,fontFamily:typography.fontFamily.primary,fontStyle:'italic'}}>sem categoria</span>}
            </div>
            <div ref={dropdownRef} style={{position:'relative',flexShrink:0,marginLeft:'12px'}}>
              <button onClick={()=>{setDropdownAberto(v=>!v);setErroAcao('')}} style={{background:'rgba(255,255,255,0.10)',border:'none',borderRadius:'10px',padding:'6px 12px',cursor:'pointer',fontFamily:typography.fontFamily.primary,fontSize:'12px',fontWeight:600,color:tx}} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.18)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.10)'}}>
                <span style={{letterSpacing:'2px'}}>•••</span>
              </button>
              {dropdownAberto&&(
                <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'rgba(10,6,25,0.97)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:'14px',padding:'8px',minWidth:'220px',backdropFilter:'blur(20px)',boxShadow:'0 12px 40px rgba(0,0,0,0.5)',zIndex:10,animation:'dropdownEntrar 0.18s ease-out forwards'}}>
                  <p style={{fontFamily:typography.fontFamily.primary,fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:'0.08em',textTransform:'uppercase',padding:'4px 10px 8px',margin:0,borderBottom:'1px solid rgba(255,255,255,0.07)',marginBottom:'6px'}}>O que fazer com essa ideia?</p>
                  {erroAcao&&<p style={{color:'#f87171',fontSize:'11px',padding:'4px 10px 6px',fontFamily:typography.fontFamily.primary,margin:0}}>{erroAcao}</p>}
                  <OpcaoDropdown emoji="👥" label="Enviar para o Feed" desc="Compartilhe com seus seguidores" onClick={()=>publicar('feed')} disabled={publicando}/>
                  <OpcaoDropdown emoji="🌍" label="Enviar para o Campo" desc="Torne publica no Campo das Ideias" onClick={()=>publicar('campo')} disabled={publicando}/>
                  <div style={{height:'1px',background:'rgba(255,255,255,0.07)',margin:'6px 0'}}/>
                  <OpcaoDropdown emoji="✏️" label="Editar note" desc="Alterar titulo, texto ou imagem" onClick={()=>{window.location.href=note.url_editar}}/>
                  <div style={{height:'1px',background:'rgba(255,255,255,0.07)',margin:'6px 0'}}/>
                  <OpcaoDropdown emoji="🗑️" label="Excluir note" desc="Remove permanentemente" onClick={excluir} danger/>
                </div>
              )}
            </div>
          </div>
          <div style={{padding:'16px 24px 0',flexShrink:0}}>
            <h2 style={{fontFamily:typography.fontFamily.primary,fontSize:'22px',fontWeight:800,color:tx,margin:0,lineHeight:1.3}}>{note.titulo_capa||note.titulo}</h2>
            <p style={{fontFamily:typography.fontFamily.primary,fontSize:'11px',color:sub,margin:'6px 0 0'}}>🕐 {note.data}</p>
          </div>
          <div style={{padding:'16px 24px 24px',overflowY:'auto',flex:1}}>
            <p style={{fontFamily:typography.fontFamily.primary,fontSize:'14px',lineHeight:1.8,color:tx,margin:0,whiteSpace:'pre-wrap'}}>{note.conteudo}</p>
          </div>
          <div style={{padding:'16px 24px 20px',flexShrink:0,borderTop:'1px solid rgba(255,255,255,0.07)'}}>
            <button onClick={onFechar} style={{width:'100%',padding:'10px',borderRadius:'10px',background:'rgba(255,255,255,0.07)',border:'none',cursor:'pointer',fontFamily:typography.fontFamily.primary,fontSize:'13px',fontWeight:600,color:tx,opacity:0.7}} onMouseEnter={e=>{e.currentTarget.style.opacity='1'}} onMouseLeave={e=>{e.currentTarget.style.opacity='0.7'}}>Fechar</button>
          </div>
        </div>
      </div>
    </>
  )
}

function OpcaoDropdown({emoji,label,desc,onClick,danger,disabled}:{emoji:string;label:string;desc:string;onClick:()=>void;danger?:boolean;disabled?:boolean}) {
  const [hover,setHover]=useState(false)
  return(
    <button onClick={onClick} disabled={disabled} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{display:'flex',flexDirection:'column',width:'100%',textAlign:'left',background:hover?'rgba(255,255,255,0.06)':'transparent',border:'none',borderRadius:'10px',padding:'8px 10px',cursor:disabled?'default':'pointer',opacity:disabled?0.45:1,transition:'background 0.15s',gap:'1px'}}>
      <span style={{fontFamily:typography.fontFamily.primary,fontSize:'13px',fontWeight:600,color:danger?'#f87171':'rgba(255,255,255,0.88)'}}>{emoji} {label}</span>
      <span style={{fontFamily:typography.fontFamily.primary,fontSize:'11px',color:danger?'rgba(248,113,113,0.6)':'rgba(255,255,255,0.35)',paddingLeft:'22px'}}>{desc}</span>
    </button>
  )
}

function ComposerModal({notes,onFechar,onCriado}:{notes:Note[];onFechar:()=>void;onCriado:(note:Note)=>void}) {
  const [titulo,setTitulo]=useState('')
  const [conteudo,setConteudo]=useState('')
  const [corBase,setCorBase]=useState<string|null>(null)
  const [luminosidade,setLuminosidade]=useState(0.45)
  const [fotoPreview,setFotoPreview]=useState<string|null>(null)
  const [fotoArquivo,setFotoArquivo]=useState<File|null>(null)
  const [erro,setErro]=useState('')
  const [salvando,setSalvando]=useState(false)
  const inputFotoRef=useRef<HTMLInputElement>(null)
  const corFinal=corBase?ajustarLuminosidade(corBase,luminosidade):'#ffffff'
  const fundoEscuro=luminosidade<0.55&&corBase!==null
  const textoEl=fundoEscuro?'rgba(255,255,255,0.92)':'rgba(0,0,0,0.80)'
  const inputBg=fundoEscuro?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.07)'
  const sliderRef=useRef<HTMLDivElement>(null)
  const arrastando=useRef(false)
  const calcLum=useCallback((cy:number)=>{
    const r=sliderRef.current?.getBoundingClientRect();if(!r)return
    setLuminosidade(Math.max(0.15,Math.min(0.85,1-(cy-r.top)/r.height)))
  },[])
  useEffect(()=>{
    const onM=(e:MouseEvent)=>{if(arrastando.current)calcLum(e.clientY)}
    const onU=()=>{arrastando.current=false}
    window.addEventListener('mousemove',onM);window.addEventListener('mouseup',onU)
    return()=>{window.removeEventListener('mousemove',onM);window.removeEventListener('mouseup',onU)}
  },[calcLum])
  function onEscolherCor(hex:string){if(corBase===hex){setCorBase(null);setLuminosidade(0.45)}else{setCorBase(hex);setLuminosidade(getLuminosidadeBase(hex))}}
  function onEscolherFoto(e:React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0];if(!f)return
    setFotoArquivo(f);const r=new FileReader();r.onload=ev=>setFotoPreview(ev.target?.result as string);r.readAsDataURL(f)
  }
  function removerFoto(){setFotoPreview(null);setFotoArquivo(null);if(inputFotoRef.current)inputFotoRef.current.value=''}
  async function salvar(){
    if(!titulo.trim()){setErro('Titulo obrigatorio.');return}
    if(!conteudo.trim()){setErro('Conteudo obrigatorio.');return}
    setSalvando(true);setErro('')
    const pos=proximaPosicaoLivre(notes)
    let res:Response
    if(fotoArquivo){
      const form=new FormData()
      form.append('titulo',titulo);form.append('conteudo',conteudo);form.append('cor',corFinal);form.append('imagem_capa',fotoArquivo)
      form.append('canvas_x',String(pos.x));form.append('canvas_y',String(pos.y));form.append('canvas_ordem',String(pos.ordem))
      res=await fetch('/api/notes/criar/',{method:'POST',headers:{'X-CSRFToken':getCsrf()},body:form})
    } else {
      res=await fetch('/api/notes/criar/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':getCsrf()},body:JSON.stringify({titulo,conteudo,cor:corFinal,canvas_x:pos.x,canvas_y:pos.y,canvas_ordem:pos.ordem})})
    }
    const data=await res.json()
    if(data.ok)onCriado(data.post)
    else{setErro(data.erro||'Erro ao salvar.');setSalvando(false)}
  }
  const indPct=(1-(luminosidade-0.15)/0.70)*100
  return(
    <div style={{position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}} onClick={onFechar}>
      <div style={{background:corFinal,borderRadius:'16px',width:'100%',maxWidth:'500px',boxShadow:'0 24px 64px rgba(0,0,0,0.55)',overflow:'hidden',transition:'background 0.25s'}} onClick={e=>e.stopPropagation()}>
        {fotoPreview&&(
          <div style={{position:'relative',height:'160px',background:`url(${fotoPreview}) center/cover`}}>
            <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.45) 100%)'}}/>
            <button onClick={removerFoto} style={{position:'absolute',top:'10px',right:'10px',background:'rgba(0,0,0,0.5)',border:'none',borderRadius:'50%',width:'28px',height:'28px',color:'white',cursor:'pointer',fontSize:'14px'}}>✕</button>
          </div>
        )}
        <div style={{padding:'24px'}}>
          <style>{`.note-input::placeholder{color:${fundoEscuro?'rgba(255,255,255,0.38)':'rgba(0,0,0,0.32)'}}`}</style>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <h3 style={{fontFamily:typography.fontFamily.primary,fontSize:'15px',fontWeight:700,color:textoEl,margin:0}}>Novo Note</h3>
            <button onClick={onFechar} style={{background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:textoEl,opacity:0.5}}>✕</button>
          </div>
          <input className="note-input" type="text" placeholder="Titulo..." value={titulo} onChange={e=>setTitulo(e.target.value)} style={{width:'100%',border:'none',background:inputBg,borderRadius:'8px',padding:'10px 12px',fontSize:'14px',fontFamily:typography.fontFamily.primary,fontWeight:600,color:textoEl,marginBottom:'10px',boxSizing:'border-box',outline:'none'}}/>
          <textarea className="note-input" placeholder="O que esta na sua cabeca?" value={conteudo} onChange={e=>setConteudo(e.target.value)} rows={4} style={{width:'100%',border:'none',background:inputBg,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',fontFamily:typography.fontFamily.primary,color:textoEl,resize:'none',marginBottom:'16px',boxSizing:'border-box',outline:'none'}}/>
          <p style={{fontFamily:typography.fontFamily.primary,fontSize:'11px',fontWeight:600,color:textoEl,opacity:0.55,marginBottom:'8px',letterSpacing:'0.05em',textTransform:'uppercase'}}>Cor do card</p>
          <div style={{display:'flex',gap:'12px',alignItems:'flex-start',marginBottom:'16px'}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:'7px',flex:1}}>
              <button onClick={()=>{setCorBase(null);setLuminosidade(0.45)}} title="Padrao" style={{width:'28px',height:'28px',borderRadius:'50%',background:'#ffffff',border:corBase===null?'3px solid #6b7280':'2px solid #d1d5db',cursor:'pointer',transform:corBase===null?'scale(1.2)':'scale(1)',transition:'transform 0.15s'}}/>
              {PALETA_BASE.map(({hex,nome})=>(<button key={hex} onClick={()=>onEscolherCor(hex)} title={nome} style={{width:'28px',height:'28px',borderRadius:'50%',background:hex,border:corBase===hex?'3px solid rgba(255,255,255,0.8)':'2px solid rgba(255,255,255,0.3)',cursor:'pointer',transform:corBase===hex?'scale(1.2)':'scale(1)',transition:'transform 0.15s',boxShadow:corBase===hex?'0 0 0 2px rgba(0,0,0,0.25)':'none'}}/>))}
            </div>
            {corBase&&(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                <span style={{fontFamily:typography.fontFamily.primary,fontSize:'9px',color:textoEl,opacity:0.5}}>clar</span>
                <div ref={sliderRef} onMouseDown={e=>{arrastando.current=true;calcLum(e.clientY)}} onClick={e=>calcLum(e.clientY)} style={{width:'20px',height:'100px',borderRadius:'10px',cursor:'ns-resize',position:'relative',background:`linear-gradient(to bottom,${ajustarLuminosidade(corBase,0.85)},${ajustarLuminosidade(corBase,0.45)},${ajustarLuminosidade(corBase,0.15)})`,boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}>
                  <div style={{position:'absolute',left:'50%',top:`${indPct}%`,transform:'translate(-50%,-50%)',width:'18px',height:'18px',borderRadius:'50%',background:corFinal,border:'2px solid white',boxShadow:'0 1px 4px rgba(0,0,0,0.4)',pointerEvents:'none'}}/>
                </div>
                <span style={{fontFamily:typography.fontFamily.primary,fontSize:'9px',color:textoEl,opacity:0.5}}>esc</span>
              </div>
            )}
          </div>
          <p style={{fontFamily:typography.fontFamily.primary,fontSize:'11px',fontWeight:600,color:textoEl,opacity:0.55,marginBottom:'8px',letterSpacing:'0.05em',textTransform:'uppercase'}}>Foto de capa</p>
          <input ref={inputFotoRef} type="file" accept="image/*" onChange={onEscolherFoto} style={{display:'none'}} id="upload-foto-note"/>
          {!fotoPreview
            ? <label htmlFor="upload-foto-note" style={{display:'flex',alignItems:'center',gap:'8px',background:inputBg,borderRadius:'8px',padding:'10px 14px',cursor:'pointer',marginBottom:'16px',border:`1.5px dashed ${textoEl}44`}}><span style={{fontSize:'18px'}}>🖼️</span><span style={{fontFamily:typography.fontFamily.primary,fontSize:'12px',color:textoEl,opacity:0.65}}>Clique para adicionar uma foto</span></label>
            : <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px'}}><img src={fotoPreview} alt="preview" style={{width:'48px',height:'36px',objectFit:'cover',borderRadius:'6px'}}/><span style={{fontFamily:typography.fontFamily.primary,fontSize:'12px',color:textoEl,opacity:0.8,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fotoArquivo?.name}</span><button onClick={removerFoto} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:'16px'}}>X</button></div>
          }
          {erro&&<p style={{color:'#ef4444',fontSize:'12px',fontFamily:typography.fontFamily.primary,marginBottom:'12px'}}>{erro}</p>}
          <div style={{display:'flex',gap:'10px'}}>
            <button onClick={onFechar} style={{flex:1,padding:'10px',borderRadius:'8px',background:inputBg,border:'none',cursor:'pointer',fontFamily:typography.fontFamily.primary,fontSize:'13px',fontWeight:600,color:textoEl,opacity:0.8}}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{flex:1,padding:'10px',borderRadius:'8px',background:fundoEscuro?'rgba(255,255,255,0.15)':'rgba(59,130,246,0.12)',border:`1.5px solid ${fundoEscuro?'rgba(255,255,255,0.3)':'#3b82f6'}`,cursor:'pointer',fontFamily:typography.fontFamily.primary,fontSize:'13px',fontWeight:700,color:fundoEscuro?'white':'#3b82f6',opacity:salvando?0.6:1}}>{salvando?'Salvando...':'Salvar Note'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}