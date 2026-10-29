import {useRef,useState} from "react";
import type {RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import "./simple-registration-preview.css";

/** A lightweight static review, NOT the interactive owner/visitor profile. */
export function SimpleRegistrationPreview({draft,photos,synced,consented}:{
 draft:RegistrationDraft;photos:PhotoItem[];synced:number;consented:boolean
}){
 const ready=photos.filter(p=>p.src&&p.status==="ready");
 const slider=useRef<HTMLDivElement>(null);
 const [index,setIndex]=useState(0);
 const birth=new Date(Date.UTC(Number(draft.year),Number(draft.month)-1,Number(draft.day)));
 const now=new Date(),age=now.getUTCFullYear()-birth.getUTCFullYear()-
  (now.getUTCMonth()<birth.getUTCMonth()||
    now.getUTCMonth()===birth.getUTCMonth()&&now.getUTCDate()<birth.getUTCDate()?1:0);
 const goalLabel:Record<string,string>={
  serious:"Серьёзные отношения",relationship:"Отношения",dates:"Свидания",
  friendship:"Дружба",communication:"Общение",undecided:"Пока не определился"
 };
 return <article className="luemi-simple-preview" aria-label="Проверь свою анкету">
  <div className="luemi-simple-preview-head">
   <div className="luemi-simple-preview-avatar">
    {ready[0]?<img alt="Главное фото" src={ready[0].src}/>:<span aria-label="Нет главного фото">♡</span>}
   </div>
   <h2>{draft.name}{age>=18&&age<130?", "+age:""}</h2>
   <p>{draft.city}{draft.country?", "+draft.country:""}</p>
   {draft.goal&&<span className="luemi-simple-preview-goal">{goalLabel[draft.goal]??draft.goal}</span>}
  </div>
  {draft.about.trim()&&<section className="luemi-simple-preview-about">
   <h3>О себе</h3><p>{draft.about.trim()}</p>
  </section>}
  {draft.interests.length>0&&<section className="luemi-simple-preview-interests">
   <h3>Интересы</h3><div>{draft.interests.map(x=><span key={x}>{x}</span>)}</div>
  </section>}
  <section className="luemi-simple-preview-photos" aria-label="Фотографии анкеты">
   <header><h3>Мои фотографии</h3><small>{ready.length} из {photos.length} готово</small></header>
   <div className="luemi-simple-preview-rail" ref={slider} onScroll={()=>{
     const node=slider.current;if(!node)return;
     setIndex(Math.max(0,Math.round(node.scrollLeft/Math.max(1,node.clientWidth*.76))));
   }}>
    {photos.map((p,i)=><figure key={p.id} className="luemi-simple-preview-slide">
     {p.src?<img src={p.src} alt={"Фотография "+(i+1)} />:
       <div className="luemi-simple-preview-pending">Подготавливаем фото…</div>}
     {i===0&&<figcaption>Главное фото</figcaption>}
    </figure>)}
   </div>
   <div className="luemi-simple-preview-dots" aria-hidden="true">{photos.map((p,i)=>
    <span key={p.id} className={index===i?"is-active":""}/>)}</div>
  </section>
  <p className="luemi-simple-preview-sync" role="status">{
   !consented?"Для загрузки фотографий нужно согласие на предыдущем шаге.":
   synced===photos.length&&synced>=3?"Фотографии сохранены на сервере 💜":
   "Фотографии сохраняются в защищённое хранилище…"
  }</p>
 </article>;
}
