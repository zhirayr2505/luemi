import {useState} from "react";
import {MapPin,Heart,Images} from "lucide-react";
import type {RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import {goals} from "./model";
import "./simple-profile-preview.css";
export function SimpleProfilePreview({draft,photos}:{draft:RegistrationDraft;photos:PhotoItem[]}){
 const ready=photos.filter(x=>x.src&&x.status!=="error");
 const [selected,setSelected]=useState<string|null>(null);
 const main=ready[0],active=ready.find(x=>x.id===selected)??main;
 const now=new Date();
 const age=Number(draft.year)>1900?now.getFullYear()-Number(draft.year)-
  (now.getMonth()+1<Number(draft.month)||now.getMonth()+1===Number(draft.month)&&now.getDate()<Number(draft.day)?1:0):null;
 const goal=goals.find(x=>x.id===draft.goal)?.label??"Знакомства";
 return <section className="luemi-simple-preview" aria-label="Предпросмотр создаваемой анкеты">
  <header className="luemi-simple-preview-header">
   <div className="luemi-simple-preview-avatar">{main?<img src={main.src} alt="Твоя главная фотография"/>:<Images size={30}/>}</div>
   <h2>{draft.name}{age!==null?", "+age:""}</h2>
   <p><MapPin size={15}/>{draft.city}{draft.country?", "+draft.country:""}</p>
   <span><Heart size={15}/>{goal}</span>
  </header>
  {draft.about.trim()&&<p className="luemi-simple-preview-about">{draft.about}</p>}
  {draft.interests.length>0&&<div className="luemi-simple-preview-tags">
   {draft.interests.map(value=><span key={value}>{value}</span>)}
  </div>}
  <div className="luemi-simple-preview-gallery-head"><h3>Твои фотографии</h3><span>{ready.length} из 6</span></div>
  <div className="luemi-simple-preview-scroller" aria-label="Галерея выбранных фотографий">
   {ready.map((photo,i)=><button key={photo.id} type="button"
    className={"luemi-simple-preview-thumb"+(active?.id===photo.id?" is-active":"")}
    onClick={()=>setSelected(photo.id)}
    aria-label={i===0?"Главная фотография":"Фотография "+(i+1)}>
    <img src={photo.src} alt={"Фото "+(i+1)}/>
    {i===0&&<span>Главная</span>}
   </button>)}
  </div>
  {active&&<div className="luemi-simple-preview-selected"><img src={active.src} alt="Просмотр выбранной фотографии"/></div>}
  <p className="luemi-simple-preview-hint">Главная фотография — первая. Вернись к фотографиям, чтобы изменить порядок.</p>
 </section>;
}
