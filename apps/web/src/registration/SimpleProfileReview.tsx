import {goals,type RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import {Image as ImageIcon,MapPin,Sparkles,Target} from "lucide-react";
import "./simple-profile-review.css";
export function SimpleProfileReview({draft,photos}:{draft:RegistrationDraft;photos:PhotoItem[]}){
 const valid=photos.filter(photo=>photo.status==="ready"&&photo.src),main=valid[0];
 const today=new Date(),year=Number(draft.year),month=Number(draft.month),day=Number(draft.day);
 const age=year&&month&&day?today.getFullYear()-year-
  (today.getMonth()+1<month||today.getMonth()+1===month&&today.getDate()<day?1:0):null;
 const goalLabel=goals.find(g=>g.id===draft.goal)?.label??"";
 return <section className="luemi-simple-review" aria-label="Предпросмотр анкеты">
  <header className="luemi-simple-review-head">
   <span className="luemi-simple-review-kicker"><Sparkles size={14}/> Так тебя увидят в LUEMI</span>
   <div className="luemi-simple-review-avatar-ring">
    {main?<img className="luemi-simple-review-avatar" src={main.src} alt="Главное фото"/>:
     <span className="luemi-simple-review-avatar luemi-simple-review-fallback"><ImageIcon size={26}/></span>}
   </div>
   <h2>{draft.name}{age!==null?", "+age:""}</h2>
   <div className="luemi-simple-review-meta">
    {draft.city&&<span><MapPin size={13}/>{draft.city}</span>}
    {goalLabel&&<span><Target size={13}/>{goalLabel}</span>}
   </div>
   {draft.about&&<p className="luemi-simple-review-about">{draft.about}</p>}
   {!!draft.interests.length&&<div className="luemi-simple-review-interests">
    {draft.interests.slice(0,6).map(item=><span key={item}>{item}</span>)}
   </div>}
  </header>
  <div className="luemi-simple-review-gallery-head"><h3>Мои фотографии</h3><span>{valid.length} из 6</span></div>
  <div className="luemi-simple-review-gallery" role="group" aria-label="Фотографии. Листай горизонтально">
   {valid.map((photo,i)=><div className="luemi-simple-review-tile" key={photo.id}>
    <img src={photo.src} alt={"Фото "+(i+1)} loading={i===0?"eager":"lazy"}/>
    {i===0&&<span className="luemi-simple-review-main">Главное фото</span>}
    <span className="luemi-simple-review-number">{i+1} / {valid.length}</span>
   </div>)}
  </div>
 </section>;
}
