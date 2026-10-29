import {useRef} from "react";
import type {RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import "./simple-preview.css";

export function SimpleRegistrationPreview({draft,photos,movePhoto}:{
 draft:RegistrationDraft;photos:PhotoItem[];movePhoto:(from:number,to:number)=>void
}){
 const list=useRef<HTMLDivElement>(null);
 const main=photos.find(x=>x.status==="ready"&&x.src)??photos[0];
 return <section className="luemi-simple-preview" aria-label="Предпросмотр твоей анкеты">
  <div className="luemi-simple-preview-identity">
   <div className="luemi-simple-preview-avatar">
    {main?.src?<img src={main.src} alt="Главное фото анкеты"/>:<span>♡</span>}
   </div>
   <h2>{draft.name||"Твоё имя"}</h2>
   <p>{[draft.city,draft.countryCode].filter(Boolean).join(" · ")}</p>
   {draft.goal&&<span className="luemi-simple-preview-goal">{draft.goal}</span>}
  </div>
  {draft.about&&<p className="luemi-simple-preview-about">{draft.about}</p>}
  {!!draft.interests.length&&<div className="luemi-simple-preview-interests">
   {draft.interests.slice(0,6).map(id=><span key={id}>{id}</span>)}
  </div>}
  <div className="luemi-simple-preview-header">
   <h3>Твои фотографии</h3><span>{photos.length} из 6</span>
  </div>
  <div ref={list} className="luemi-simple-preview-carousel" role="region" aria-label="Фотографии анкеты, листай горизонтально">
   {photos.map((photo,i)=><figure key={photo.id} className="luemi-simple-preview-photo">
    {photo.src?<img src={photo.src} alt={"Фото "+(i+1)} loading={i<2?"eager":"lazy"}/>:<div className="luemi-simple-preview-unavailable">Обрабатываем фото…</div>}
    <figcaption>{i===0?"Главное фото":"Фото "+(i+1)}</figcaption>
    {i>0&&<button type="button" onClick={()=>{movePhoto(i,0);list.current?.scrollTo({left:0,behavior:"smooth"});}}>
     Сделать главным
    </button>}
   </figure>)}
  </div>
  <p className="luemi-simple-preview-help">Главное фото — первое. Проверь фотографии перед созданием анкеты.</p>
 </section>;
}
