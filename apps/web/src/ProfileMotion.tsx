import { useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { ageAt, type Profile } from '../../../packages/core/domain';
import { Icon, Portrait } from './ui';
import { useProfilePhotoMorph } from './motion/useProfilePhotoMorph';

/** Independent X-only gesture controller, never competes with Y scroll/morph. */
function PhotoGallery({profile,display,barsRef}:{profile:Profile;display:string;barsRef:RefObject<HTMLDivElement|null>}){
 const [index,setIndex]=useState(0);
 const strip=useRef<HTMLDivElement>(null),origin=useRef({x:0,y:0,time:0,id:-1,tracking:false});
 const total=profile.photos.length;
 const move=(position:number,transition:boolean)=>{
  const el=strip.current;if(!el)return;
  el.style.transition=transition?'transform 340ms cubic-bezier(.22,.8,.22,1)':'none';
  el.style.transform=`translate3d(calc(${-index*100}% + ${position.toFixed(2)}px),0,0)`;
 };
 const onDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.button!==0||total<2||e.currentTarget.closest('.profile-morph-stage')?.getAttribute('data-gallery-active')!=='true')return;
  origin.current={x:e.clientX,y:e.clientY,time:performance.now(),id:e.pointerId,tracking:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const onMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=origin.current;if(g.id!==e.pointerId||total<2)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.tracking){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){origin.current.id=-1;return;}if(Math.abs(dx)<8||Math.abs(dx)<=Math.abs(dy)*1.12)return;g.tracking=true;}
  const edge=(index===0&&dx>0)||(index===total-1&&dx<0);
  move(edge?dx*.28:dx,false);
 };
 const finish=(e:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=origin.current;if(g.id!==e.pointerId)return;
  origin.current.id=-1;
  if(!g.tracking||cancel){move(0,true);return;}
  const dx=e.clientX-g.x,elapsed=Math.max(16,performance.now()-g.time);
  const limit=strip.current?.clientWidth??340;
  const delta=Math.abs(dx)>limit*.22||Math.abs(dx/elapsed)>.48?Math.sign(dx):0;
  const next=Math.max(0,Math.min(total-1,index-delta));
  setIndex(next);
  if(strip.current){strip.current.style.transition='transform 340ms cubic-bezier(.22,.8,.22,1)';strip.current.style.transform=`translate3d(${-next*100}%,0,0)`;}
 };
 const choose=(next:number)=>{
  setIndex(next);
  if(strip.current){strip.current.style.transition='transform 340ms cubic-bezier(.22,.8,.22,1)';strip.current.style.transform=`translate3d(${-next*100}%,0,0)`;}
 };
 return <>
  <div className="profile-morph-gallery" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)}>
   <div ref={strip} className="profile-morph-strip" style={{transform:`translate3d(${-index*100}%,0,0)`}}>
    {profile.photos.length?profile.photos.map((p,i)=><div key={p.id} className="profile-morph-slide"><Portrait photo={p} alt={`Фото ${i+1} профиля ${display}`}/></div>):<div className="profile-morph-slide"><Portrait alt="Нет фотографий"/></div>}
   </div>
  </div>
  <div ref={barsRef} className="profile-morph-photo-bars" role="group" aria-label="Фотографии профиля">
   {profile.photos.map((p,i)=><button key={p.id} className={i===index?'active':''} aria-label={`Показать фото ${i+1} из ${total}`} aria-current={i===index?'true':undefined} onClick={()=>choose(i)}><span/></button>)}
  </div>
 </>;
}

/** Original onboarding preview stays static; expanded public profile owns this controller. */
export function ProfileMotion({profile,reducedMotion=false}:{profile:Profile;reducedMotion?:boolean}){
 const stage=useRef<HTMLDivElement>(null),photo=useRef<HTMLDivElement>(null);
 const compact=useRef<HTMLDivElement>(null),caption=useRef<HTMLDivElement>(null),gallery=useRef<HTMLDivElement>(null);
 useProfilePhotoMorph(stage,photo,compact,caption,gallery,profile.id,reducedMotion);
 const age=ageAt(profile.birthDate);
 const display=`${profile.name||'Твоё имя'}${Number.isFinite(age)?', '+age:''}`;
 return <div className="public-profile public-profile--motion">
  <div ref={stage} className="profile-morph-stage" data-collapsed="false" data-gallery-active="true">
   <div ref={photo} className="profile-morph-photo" aria-label={`Фотогалерея: ${display}`}>
    <PhotoGallery profile={profile} display={display} barsRef={gallery}/>
    <div className="profile-morph-scrim" aria-hidden="true"/>
    <div ref={caption} className="profile-morph-caption">
     <div className="profile-morph-name">{display}{profile.verified&&<span className="verified" aria-label="Проверенный профиль"><Icon name="check" size={13}/></span>}</div>
     <div className="profile-morph-city">{profile.city||'Город не указан'}{profile.goal&&profile.goal!=='Пока не определился'?` · ${profile.goal}`:''}</div>
    </div>
   </div>
   <div ref={compact} className="profile-morph-compact" aria-hidden="true"><strong>{display}</strong><span>{profile.city||'LUEMI'}{profile.verified?' · ✓':''}</span></div>
  </div>
  <div className="profile-motion-details">
   <section className="glass section"><h3>О себе</h3><p>{profile.about||'Здесь появится немного о тебе.'}</p></section>
   <section className="glass section"><h3>Интересы</h3><div className="chips colored">{profile.interests.length?profile.interests.map((x,i)=><span key={x} style={{'--chip-tone':i%7} as React.CSSProperties}>{x}</span>):<p>Пока не указаны</p>}</div></section>
   <section className="glass section"><h3>Языки общения</h3><p>{profile.languages.join(' · ')||'Не указаны'}</p></section>
  </div>
 </div>;
}