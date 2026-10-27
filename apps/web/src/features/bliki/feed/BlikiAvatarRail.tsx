import { useMemo, useState } from 'react';
import { buildBlikiFeed, type BlikiFeedCandidate } from './blikiFeed';
import '../bliki-showcase.css';
import './blikiRailMotion.css';

type Props = {
 candidates: BlikiFeedCandidate[];
 onOpenAuthor: (authorId: string) => void;
 onCreate: () => void;
 initiallyExpanded?: boolean;
 hasMore?: boolean;
 loadingMore?: boolean;
 onLoadMore?: () => void;
};
function safeAvatarUrl(raw?: string): string | null {
 if (!raw || !/^\/api\/(?:v\d+\/)?[a-z0-9/_-]+$/i.test(raw) ||
     raw.includes('..') || raw.includes('//')) return null;
 return raw;
}
function Avatar({url}:{url?:string}) {
 const source=safeAvatarUrl(url);
 return <span className="bliki-showcase-ring" aria-hidden="true">
  {source?<img src={source} alt="" loading="lazy" draggable={false}/>:
    <span style={{display:'grid',placeItems:'center',height:'100%',borderRadius:'50%',
      background:'#755482',color:'#fff'}}>✦</span>}
 </span>;
}
/** The same premium rail in real mode, but with ONLY RLS-authorized authors.
 * No demo profiles, cached mock stories or local phantom publications. */
export function BlikiAvatarRail({candidates,onOpenAuthor,onCreate,initiallyExpanded=false,
 hasMore=false,loadingMore=false,onLoadMore}:Props) {
 const [expanded,setExpanded]=useState(initiallyExpanded);
 const feed=useMemo(()=>buildBlikiFeed(candidates,{now:Date.now()}),[candidates]);
 return <section aria-label="Блики" className={'bliki-showcase'+(expanded?' is-expanded':'')}>
  <div className="bliki-showcase-row">
   <button type="button" className="bliki-showcase-create" onClick={onCreate}
     aria-label="Создать мой Блик">
    <span className="bliki-create-orbit" aria-hidden="true">＋</span>
    <span className="bliki-rail-caption">Мой Блик</span>
   </button>
   {feed.entries.map(author=><button key={author.id} type="button"
     className="bliki-showcase-author" aria-label={'Блики: '+author.name}
     onClick={()=>onOpenAuthor(author.id)}>
    <Avatar url={author.avatarUrl}/>
    <span className="bliki-rail-caption">{author.name}</span>
   </button>)}
   <button type="button" className="bliki-expand-button"
     onClick={()=>setExpanded(x=>!x)} aria-expanded={expanded}
     aria-label={expanded?'Свернуть Блики':'Раскрыть Блики'}>{expanded?'⌃':'⌄'}</button>
  </div>
  <div className="bliki-showcase-reveal" aria-hidden={!expanded}>
   <div className="bliki-showcase-inner">
    <span className="bliki-showcase-intro">Блики твоего мира</span>
    <span className="bliki-showcase-demo">ИСТОРИИ • 24 ЧАСА</span>
    {feed.entries.length?<div className="bliki-showcase-tiles">
     {feed.entries.slice(0,4).map(author=><button type="button" key={author.id}
       className="bliki-showcase-tile" onClick={()=>onOpenAuthor(author.id)}>
      {safeAvatarUrl(author.avatarUrl)?<img src={author.avatarUrl} alt="" loading="lazy"/>:
        <span aria-hidden="true">💜</span>}
      <span>{author.name}</span>
     </button>)}
    </div>:<p style={{fontSize:12}}>Пока нет Бликов. Создай первый 💜</p>}
    {hasMore&&onLoadMore&&<button type="button" disabled={loadingMore}
      onClick={onLoadMore} style={{borderRadius:12,padding:'8px 12px',
      border:'1px solid #a782be',background:'transparent',color:'inherit'}}>
      {loadingMore?'Загружаем…':'Показать ещё Блики'}
    </button>}
   </div>
  </div>
 </section>;
}
