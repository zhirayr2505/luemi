import {goals,type RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import {Image as ImageIcon,MapPin,Sparkles} from "lucide-react";
import {goalIcons} from "../ui/Goals";
import {InterestChip} from "../ui/InterestCatalog";
import {Flag} from "../ui/Flag";
import "./simple-profile-review.css";
export function SimpleProfileReview({draft,photos}:{draft:RegistrationDraft;photos:PhotoItem[]}){
 const valid=photos.filter(photo=>photo.status==="ready"&&photo.src),main=valid[0];
 const today=new Date(),year=Number(draft.year),month=Number(draft.month),day=Number(draft.day);
 const age=year&&month&&day?today.getFullYear()-year-
  (today.getMonth()+1<month||today.getMonth()+1===month&&today.getDate()<day?1:0):null;
 const goalLabel=goals.find(g=>g.id===draft.goal)?.label??"";
 const GoalIcon=draft.goal?goalIcons[draft.goal]:null;
 return <section className="luemi-simple-review" aria-label="Предпросмотр анкеты">
  <header className="luemi-simple-review-head">
   <span className="luemi-simple-review-kicker"><Sparkles size={14}/> Так тебя увидят в LUEMI</span>
   <div className="luemi-simple-review-avatar-ring">
    {main?<img className="luemi-simple-review-avatar" src={main.src} alt="Главное фото"/>:
     <span className="luemi-simple-review-avatar luemi-simple-review-fallback"><ImageIcon size={26}/></span>}
   </div>
   <h2>{draft.name}{age!==null?", "+age:""}</h2>
   <div className="luemi-simple-review-meta">
    {draft.city&&<span><MapPin size={13}/>{draft.city}{draft.country&&<><Flag code={draft.countryCode} title={draft.country}/><em>{draft.country}</em></>}</span>}
    {goalLabel&&<span className="goal-badge">{GoalIcon&&<GoalIcon size={13}/>}<em>{goalLabel}</em></span>}
   </div>
   {draft.about&&<p className="luemi-simple-review-about">{draft.about}</p>}
   {!!draft.interests.length&&<div className="luemi-simple-review-interests">
    {draft.interests.slice(0,6).map(item=><InterestChip key={item} id={item} selected/>)}
   </div>}
   {!!(draft.height||draft.occupation||draft.education||draft.languages.length||draft.lifestyle.length||draft.pets.length||draft.family.length)&&
    <div className="luemi-simple-review-details">
     {draft.height&&<span>Рост {draft.height} см</span>}{draft.occupation&&<span>{draft.occupation}</span>}
     {draft.education&&<span>{draft.education}</span>}{draft.languages.map(value=><span key={value}>{value}</span>)}
     {draft.lifestyle.map(value=><span key={value}>{value}</span>)}{draft.pets.map(value=><span key={value}>{value}</span>)}
     {draft.family.map(value=><span key={value}>{value}</span>)}
    </div>}
   {!!draft.facts.length&&<div className="luemi-simple-review-facts">
     {draft.facts.map((value,i)=><p key={i}>{value}</p>)}
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
