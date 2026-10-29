import type {RegistrationDraft} from "./model";
import {goals,birthDateValid} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import "./SimpleProfilePreview.css";

export function SimpleProfilePreview({draft,photos}:{
 draft:RegistrationDraft;photos:PhotoItem[];
}){
 const main=photos[0];
 const age=(()=>{
  if(!birthDateValid(draft.day,draft.month,draft.year))return null;
  const today=new Date(),birth=new Date(Number(draft.year),Number(draft.month)-1,Number(draft.day));
  let years=today.getFullYear()-birth.getFullYear();
  if(today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate()))years--;
  return years;
 })();
 return <section className="luemi-simple-preview" aria-label="Предпросмотр анкеты LUEMI">
   <div className="luemi-simple-preview-head">
    {main?.src?<img className="luemi-simple-preview-avatar" src={main.src} alt="Главное фото"/>:
     <span className="luemi-simple-preview-avatar" aria-label="Нет главного фото"/>}
    <h2>{draft.name}{age!==null?", "+age:""}</h2>
    <p>{draft.city}{draft.country?", "+draft.country:""}</p>
    <span className="luemi-simple-preview-goal">{goals.find(x=>x.id===draft.goal)?.label??"Знакомства"}</span>
   </div>
   {!!draft.about&&<p className="luemi-simple-preview-about">{draft.about}</p>}
   {!!draft.interests.length&&<div className="luemi-simple-preview-interests" aria-label="Интересы">
    {draft.interests.slice(0,6).map(interest=><span key={interest}>{interest}</span>)}
   </div>}
   <div className="luemi-simple-preview-gallery-head">
    <h3>Мои фотографии</h3><span>{photos.length} из 6</span>
   </div>
   <div className="luemi-simple-preview-gallery" aria-label="Галерея выбранных фотографий">
    {photos.map((photo,index)=><figure key={photo.id}>
     <img src={photo.src} alt={"Моё фото "+(index+1)} loading={index>1?"lazy":"eager"}/>
     {index===0&&<figcaption>Главное</figcaption>}
    </figure>)}
   </div>
   <p className="luemi-simple-preview-note">Проверь анкету. Первое фото будет главным, остальные можно листать.</p>
 </section>;
}
