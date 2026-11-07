import {useRef,useState} from "react";
import {Heart,MapPin,ShieldCheck,Sparkles} from "lucide-react";
import {fromLocalDraft,projectProfile,readyRegistrationPhotos} from "../../discovery/ProfileModel";
import type {RegistrationDraft} from "../model";
import {goalLabel} from "../../ui/PersonalizedCopy";
import type {PhotoItem} from "../PhotoSorter";
import {itemOf} from "../../ui/InterestCatalog";
interface Props {data:RegistrationDraft;photos:PhotoItem[]}
/** Local-only projection; never converts drafts into published media. */
export function RegistrationReview({data,photos}:Props){
 const source=fromLocalDraft(data,readyRegistrationPhotos(photos));
 const view=projectProfile(source,"local-self-preview");
 const [active,setActive]=useState(0);
 const track=useRef<HTMLDivElement|null>(null);
 const person=view.profile;
 const age=person.age===null?"":", "+person.age;
 const place=[person.city,person.country].filter(Boolean).join(", ");
 const goal=goalLabel(person.goal??"",data.gender);
 const choose=(index:number)=>{
  setActive(index);
  const node=track.current;
  if(node)node.scrollTo({left:node.clientWidth*index,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
 };
 return <article className="v2-showcase" aria-label="Предпросмотр анкеты">
  <div className="v2-showcase-photo">
   <div className="v2-showcase-track" ref={track} onScroll={e=>{
    const node=e.currentTarget;
    const next=Math.round(node.scrollLeft/Math.max(1,node.clientWidth));
    if(next!==active&&next>=0&&next<view.photos.length)setActive(next);
   }}>
    {view.photos.map((photo,index)=><img key={photo.id} src={photo.src}
      alt={index===0?"Главное фото анкеты":"Фотография "+(index+1)}
      draggable={false} decoding="async" loading={index===0?"eager":"lazy"}/>)}
   </div>
   <span className="v2-showcase-preview-pill"><Sparkles size={13}/> ПРЕДПРОСМОТР</span>
   <span className="v2-showcase-photo-count">{Math.min(active+1,view.photos.length)} / {view.photos.length}</span>
   <div className="v2-showcase-overlay" aria-hidden="true"/>
   <div className="v2-showcase-person">
    <h2>{person.name}{age}</h2>
    <p><MapPin size={15}/>{place}</p>
    {goal&&<span className="v2-showcase-goal"><Heart size={13}/>{goal}</span>}
   </div>
  </div>
  {view.photos.length>1&&<div className="v2-showcase-dots" aria-label="Фотографии анкеты">
   {view.photos.map((photo,index)=><button type="button" key={photo.id}
     className={active===index?"selected":""} aria-label={"Посмотреть фотографию "+(index+1)}
     aria-current={active===index?"true":undefined}
     onClick={()=>choose(index)}/>)}
  </div>}
  <div className="v2-showcase-content">
   <section className="v2-showcase-panel">
    <h3>О себе</h3>
    <p>{person.about||"Описание можно добавить в любое время."}</p>
   </section>
   {person.interests.length>0&&<section className="v2-showcase-panel">
    <h3>Мои интересы</h3>
    <div className="v2-showcase-interests">
     {person.interests.map(id=><span key={id}>{itemOf(id)?.name??id}</span>)}
    </div>
   </section>}
   <p className="v2-showcase-private"><ShieldCheck size={17}/>
    Это предпросмотр твоей анкеты. Она ещё не опубликована. Изменить данные можно кнопкой «Редактировать».
   </p>
  </div>
 </article>;
}
