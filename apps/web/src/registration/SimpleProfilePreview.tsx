import {useRef,useState} from "react";
import {MapPin,Heart,Images,ChevronLeft,ChevronRight} from "lucide-react";
import type {RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import "./SimpleProfilePreview.css";

/** Review is deliberately NOT the live Profile Morph V3. It is a calm,
 * static summary of the selected photos and information before publication. */
export function SimpleProfilePreview({draft,photos}:{draft:RegistrationDraft;photos:PhotoItem[]}){
 const strip=useRef<HTMLDivElement>(null);
 const [selected,setSelected]=useState(0);
 const main=photos[0];
 const now=new Date();
 const born=new Date(Number(draft.year),Number(draft.month)-1,Number(draft.day));
 const age=Number(draft.year)&&!Number.isNaN(born.getTime())?
  now.getFullYear()-born.getFullYear()-
  (now.getMonth()<born.getMonth()||(now.getMonth()===born.getMonth()&&now.getDate()<born.getDate())?1:0):null;
 const onGalleryScroll=()=>{
  const viewport=strip.current;if(!viewport)return;
  const center=viewport.getBoundingClientRect().left+viewport.clientWidth/2;
  let closest=0,distance=Infinity;
  Array.from(viewport.children).forEach((child,i)=>{
   const box=child.getBoundingClientRect(),diff=Math.abs(box.left+box.width/2-center);
   if(diff<distance){distance=diff;closest=i;}
  });
  setSelected(closest);
 };
 const shift=(direction:number)=>{
  const next=Math.min(Math.max(0,selected+direction),Math.max(0,photos.length-1));
  setSelected(next);
  strip.current?.children[next]?.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"});
 };
 return <article className="luemi-summary-preview" aria-label="Предпросмотр созданной анкеты">
  <header className="luemi-summary-head">
   {main?.src?<img src={main.src} alt="Главное фото" className="luemi-summary-avatar"/>:
    <span className="luemi-summary-avatar luemi-summary-placeholder" aria-label="Главное фото не загружено">♡</span>}
   <h2>{draft.name}{age!==null&&age>0&&age<110?<span>, {age}</span>:null}</h2>
   <p><MapPin size={15}/>{draft.city||"Город не выбран"}</p>
   <p><Heart size={15}/>{draft.goal||"Цель знакомства"}</p>
  </header>
  <section className="luemi-summary-gallery" aria-label="Твои фотографии">
   <div className="luemi-summary-title"><Images size={18}/><h3>Мои фотографии</h3>
    <span>{photos.length} из 6</span></div>
   <div className="luemi-summary-photos" ref={strip} role="group" aria-label="Галерея фото"
    onScroll={onGalleryScroll}>
    {photos.map((photo,i)=><button type="button" className={"luemi-summary-photo"+(i===selected?" is-active":"")}
      key={photo.id} onClick={()=>setSelected(i)} aria-label={i===0?"Главное фото":"Фото "+(i+1)}>
      <img src={photo.src} alt={i===0?"Главное фото":"Фотография "+(i+1)}/>
      {i===0&&<strong>Главное</strong>}
     </button>)}
   </div>
   <div className="luemi-summary-carousel-actions">
    <button type="button" disabled={selected===0} onClick={()=>shift(-1)} aria-label="Предыдущее фото"><ChevronLeft size={18}/></button>
    <span>{Math.min(selected+1,photos.length)} / {photos.length}</span>
    <button type="button" disabled={selected>=photos.length-1} onClick={()=>shift(1)} aria-label="Следующее фото"><ChevronRight size={18}/></button>
   </div>
  </section>
  {draft.interests.length>0&&<section className="luemi-summary-interests">
   <h3>Интересы</h3>
   <div>{draft.interests.map(value=><span key={value}>{value}</span>)}</div>
  </section>}
  {draft.about.trim()&&<section className="luemi-summary-about"><h3>О себе</h3><p>{draft.about}</p></section>}
 </article>;
}
