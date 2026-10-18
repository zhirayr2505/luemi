import {useRef,useState,type ReactNode,type PointerEvent as ReactPointerEvent} from 'react';
import {ageAt,type Profile} from '../../../packages/core/domain';
import {Icon,Portrait} from './ui';
import {useProfilePhotoMorph} from './motion/useProfilePhotoMorph';

/** X gestures only; strip offset is owned by one ref, not React style + imperative writes. */
function Gallery({profile,display,barsRef}:{profile:Profile;display:string;barsRef:React.RefObject<HTMLDivElement|null>}){
 const [index,setIndex]=useState(0),strip=useRef<HTMLDivElement>(null),selected=useRef(0);
 const gesture=useRef({id:-1,x:0,y:0,at:0,horizontal:false});
 const total=profile.photos.length;
 const paint=(offset:number,animate:boolean,base=selected.current)=>{
  const element=strip.current;if(!element)return;
  element.style.transition=animate?'transform 320ms cubic-bezier(.22,.8,.22,1)':'none';
  element.style.transform=`translate3d(calc(${-base*100}% + ${offset.toFixed(2)}px),0,0)`;
 };
 const choose=(next:number)=>{const value=Math.max(0,Math.min(total-1,next));selected.current=value;setIndex(value);paint(0,true,value);};
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const stage=e.currentTarget.closest('.profile-morph-frame');
  if(e.button!==0||total<2||stage?.getAttribute('data-gallery-active')!=='true')return;
  gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now(),horizontal:false};
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(g.id!==e.pointerId)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.horizontal){
   if(Math.abs(dy)>11&&Math.abs(dy)>Math.abs(dx)){g.id=-1;return;}
   if(Math.abs(dx)<9||Math.abs(dx)<Math.abs(dy)*1.25)return;
   g.horizontal=true;
   try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* released pointer */}
  }
  const edge=(selected.current===0&&dx>0)||(selected.current===total-1&&dx<0);
  paint(edge?dx*.25:dx,false);
 };
 const finish=(e:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=gesture.current;if(g.id!==e.pointerId)return;
  g.id=-1;
  if(!g.horizontal||cancel){paint(0,true);return;}
  const dx=e.clientX-g.x,seconds=Math.max(25,performance.now()-g.at);
  const width=strip.current?.clientWidth||360;
  const step=Math.abs(dx)>width*.22||Math.abs(dx/seconds)>.55?Math.sign(dx):0;
  choose(selected.current-step);
 };
 return <>
  <div className="profile-morph-gallery" onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={e=>finish(e,true)}>
   <div className="profile-morph-strip" ref={strip}>
    {total?profile.photos.map((p,i)=><div className="profile-morph-slide" key={p.id}><Portrait photo={p} alt={`Фото ${i+1}: ${display}`}/></div>):<div className="profile-morph-slide"><Portrait alt="Нет фото"/></div>}
   </div>
  </div>
  <div className="profile-morph-photo-bars" ref={barsRef} aria-label="Количество фотографий">
   {profile.photos.map((p,i)=><button key={p.id} aria-label={`Фото ${i+1} из ${total}`} aria-current={index===i?'true':undefined} className={index===i?'active':''} onClick={()=>choose(i)}><span/></button>)}
  </div>
 </>;
}

/** A stable photo overlay is sibling to (NOT nested in) the one scrolling document. */
export function ProfileMotion({profile,reducedMotion=false,children}:{profile:Profile;reducedMotion?:boolean;children?:ReactNode}){
 const scroller=useRef<HTMLElement>(null),frame=useRef<HTMLDivElement>(null);
 const photo=useRef<HTMLDivElement>(null),compact=useRef<HTMLDivElement>(null);
 const caption=useRef<HTMLDivElement>(null),bars=useRef<HTMLDivElement>(null);
 useProfilePhotoMorph(scroller,frame,photo,compact,caption,bars,profile.id,reducedMotion);
 const age=ageAt(profile.birthDate),display=`${profile.name||'Твоё имя'}${Number.isFinite(age)?', '+age:''}`;
 return <div className="profile-detail-root">
  <main ref={scroller} className="profile-detail-scroll" aria-label={`Профиль ${display}`}>
   <div className="profile-hero-spacer" aria-hidden="true"/>
   <div className="profile-motion-details">
    <section className="glass section"><h3>О себе</h3><p>{profile.about||'Здесь появится немного о тебе.'}</p></section>
    <section className="glass section"><h3>Интересы</h3><div className="chips colored">{profile.interests.length?profile.interests.map((x,i)=><span key={x} style={{'--chip-tone':i%7} as React.CSSProperties}>{x}</span>):<p>Пока не указаны</p>}</div></section>
    <section className="glass section"><h3>Языки общения</h3><p>{profile.languages.join(' · ')||'Не указаны'}</p></section>
   </div>
   {children}
  </main>
  <div className="profile-morph-overlay" aria-hidden={false}>
   <div className="profile-morph-frame" ref={frame} data-gallery-active="true" data-collapsed="false">
    <div className="profile-morph-photo" ref={photo} aria-label={`Фотографии профиля ${display}`}>
     <Gallery profile={profile} display={display} barsRef={bars}/>
     <div className="profile-morph-scrim" aria-hidden="true"/>
     <div className="profile-morph-caption" ref={caption}>
      <div className="profile-morph-name">{display}{profile.verified&&<span className="verified" aria-label="Проверенный профиль"><Icon name="check" size={13}/></span>}</div>
      <div className="profile-morph-city">{profile.city||'Город не указан'}{profile.goal&&profile.goal!=='Пока не определился'?` · ${profile.goal}`:''}</div>
     </div>
    </div>
    <div className="profile-morph-compact" ref={compact} aria-hidden="true"><strong>{display}</strong><span>{profile.city||'LUEMI'}{profile.verified?' · ✓':''}</span></div>
   </div>
  </div>
 </div>;
}