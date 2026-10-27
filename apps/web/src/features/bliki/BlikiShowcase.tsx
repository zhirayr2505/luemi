import { useCallback, useEffect, useMemo, useState } from 'react';
import { demoPeople } from '../../discovery/demo-people';
import { BlikViewer } from './viewer/BlikViewer';
import type { BlikAuthor } from './viewer/blikNavigation';
import './bliki-showcase.css';

const scenes = [
  { title:'Тёплый вечер', caption:'В самых простых моментах — целая история ✨', colorA:'#f9b5a5', colorB:'#70468b', colorC:'#261936', symbol:'✦' },
  { title:'Давай к морю', caption:'Море ближе, чем кажется 🌊', colorA:'#7fe2eb', colorB:'#596fd2', colorC:'#1e315e', symbol:'≈' },
  { title:'Город уснул', caption:'Где-то начинается новая история 🌙', colorA:'#d9b4ee', colorB:'#694c9c', colorC:'#201b39', symbol:'☽' },
  { title:'Наш момент', caption:'Там, где по-настоящему спокойно 💜', colorA:'#fedbc8', colorB:'#ae70a8', colorC:'#41264e', symbol:'♡' },
  { title:'Музыка внутри', caption:'Сохраняю то, что чувствую 🎧', colorA:'#b5e0c8', colorB:'#7295ba', colorC:'#283453', symbol:'♪' },
] as const;
function artwork(index: number, alt = false): string {
  const v = scenes[index % scenes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs><linearGradient id="sky" x2=".9" y2="1"><stop stop-color="${v.colorA}"/><stop offset=".51" stop-color="${v.colorB}"/><stop offset="1" stop-color="${v.colorC}"/></linearGradient>
  <radialGradient id="light"><stop stop-color="#fff" stop-opacity=".52"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="720" height="1280" fill="url(#sky)"/>
  <circle cx="${alt ? 170 : 510}" cy="${alt ? 300 : 340}" r="275" fill="url(#light)"/>
  <circle cx="${alt ? 160 : 525}" cy="${alt ? 255 : 305}" r="86" fill="#ffe7db" fill-opacity=".7"/>
  <path d="M0 930Q130 820 310 920T720 860V1280H0" fill="#1c213e" fill-opacity=".23"/>
  <path d="M0 1070Q180 975 355 1050T720 1005V1280H0" fill="#13152b" fill-opacity=".27"/>
  <path d="M0 1170Q160 1130 360 1160T720 1110V1280H0" fill="#f8deeb" fill-opacity=".15"/>
  <g fill="#fff" fill-opacity=".58"><circle cx="90" cy="185" r="3"/><circle cx="280" cy="220" r="2"/><circle cx="610" cy="175" r="3"/><circle cx="440" cy="490" r="2"/></g>
  <text x="360" y="710" font-size="150" text-anchor="middle" fill="#fff" fill-opacity=".38" font-family="serif">${v.symbol}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
/** Fictional product preview. Never sent to a database or counted as real views. */
export const demoBlikAuthors: BlikAuthor[] = demoPeople.slice(0, 5).map((person, index) => ({
  id: 'demo-' + person.id,
  name: person.name + ' · Демо',
  avatarUrl: person.photos[0].fallback,
  stories: [0, 1].map(part => ({
    id: 'demo-' + person.id + '-' + part,
    authorId: 'demo-' + person.id,
    mediaKind: 'image' as const,
    mediaUrl: artwork(index, part === 1),
    durationMs: 5100,
    publishedAt: Date.now() - (index * 73000 + part * 16000),
    caption: part ? 'Пусть у каждого будет свой красивый момент ✨' : scenes[index].caption,
    editor: { fit:'cover' as const, scale:1, translateX:0, translateY:0,
      muted:true, layers:[{
        id:'demo-layer-' + index + '-' + part,
        type:'text' as const, value: part ? 'Только здесь и сейчас' : scenes[index].title,
        x:0.5, y:0.66, scale:1.25, rotation:0, style:'light' as const,
      }] },
  })),
}));
type Props = {
  registerBack?: (handler:(()=>boolean)|null)=>void;
  compact?: boolean;
};
export function BlikiShowcase({registerBack,compact=false}: Props) {
  const [expanded,setExpanded] = useState(false);
  const [open,setOpen] = useState<number|null>(null);
  const authors = useMemo(()=>demoBlikAuthors,[]);
  const back = useCallback(() => {
    if(open!==null){setOpen(null);return true;}
    if(expanded){setExpanded(false);return true;}
    return false;
  },[open,expanded]);
  useEffect(()=>{registerBack?.(back);return ()=>registerBack?.(null);},[back,registerBack]);
  return <section className={'bliki-showcase'+(expanded?' is-expanded':'')+(compact?' is-compact':'')}
    aria-label="Блики · демонстрация">
    <div className="bliki-showcase-row">
      <button type="button" className="bliki-showcase-create" onClick={()=>setExpanded(x=>!x)}
        aria-label={expanded?'Свернуть Блики':'Раскрыть Блики'} aria-expanded={expanded}>
        <span className="bliki-create-orbit" aria-hidden="true">✦</span>
        <span className="bliki-rail-caption">{expanded?'Свернуть':'Блики'}</span>
      </button>
      {authors.map((author,i)=><button type="button" key={author.id}
        aria-label={'Смотреть Блики: '+author.name} className="bliki-showcase-author"
        onClick={()=>{setExpanded(true);setOpen(i);}}>
        <span className="bliki-showcase-ring"><img src={author.avatarUrl} alt="" loading="lazy" draggable={false}/></span>
        <span className="bliki-rail-caption">{author.name.split(' · ')[0]}</span>
      </button>)}
      <button type="button" className="bliki-expand-button" aria-label="Развернуть список Бликов"
        onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>{expanded?'⌃':'⌄'}</button>
    </div>
    <div className="bliki-showcase-reveal" aria-hidden={!expanded}>
      <div className="bliki-showcase-inner">
        <span className="bliki-showcase-intro">Моменты, которые хочется сохранить</span>
        <span className="bliki-showcase-demo">ДЕМО • придуманные истории</span>
        <div className="bliki-showcase-tiles">
          {authors.slice(0,4).map((author,i)=><button type="button" key={author.id}
             className="bliki-showcase-tile" onClick={()=>setOpen(i)}>
            <img src={artwork(i)} alt="" loading="lazy" />
            <span>{author.name.split(' · ')[0]}</span>
          </button>)}
        </div>
      </div>
    </div>
    {open!==null&&<BlikViewer key={open} authors={authors} initial={{author:open,story:0}}
      onClose={()=>setOpen(null)}/>}
  </section>;
}
