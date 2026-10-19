import {useState} from "react";
import {MapPin,Pencil,Heart,UserRound,Images,ShieldCheck} from "lucide-react";
import type {RegistrationDraft} from "./model";
import {birthDateValid} from "./model";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import {InterestChip} from "../ui/InterestCatalog";
import {countryFlag} from "./GeoPicker";
import type {PhotoItem} from "./PhotoSorter";
interface Props {data:RegistrationDraft;photos:PhotoItem[];editStep:(step:number)=>void}
function ageOf(d:RegistrationDraft):number|undefined{
 if(!birthDateValid(d.day,d.month,d.year))return undefined;
 const today=new Date();
 return today.getFullYear()-Number(d.year)-(today.getMonth()+1<Number(d.month)||today.getMonth()+1===Number(d.month)&&today.getDate()<Number(d.day)?1:0);
}
const goalNames={relationship:"Отношения",dates:"Свидания",friends:"Общение"} as const;
function ProfileFacts({data,compact=false}:{data:RegistrationDraft;compact?:boolean}){
 return <div className="profile-facts">
   {data.countryCode&&<div className="location-chip">{countryFlag(data.countryCode)} <MapPin size={15}/> {data.city}</div>}
   {data.goal&&<div className="goal-badge"><Heart size={15}/>{goalNames[data.goal]}</div>}
   {!!data.interests.length&&<div className="chips profile-interests">
     {data.interests.slice(0,compact?3:15).map(x=><InterestChip key={x} name={x}/>)}
     {compact&&data.interests.length>3&&<span className="chip">+{data.interests.length-3}</span>}
   </div>}
   {data.about&&<p className={compact?"preview-about clamp":"preview-about"}>{data.about}</p>}
 </div>;
}
export function RegistrationPreview({data,photos,editStep}:Props){
 const [view,setView]=useState<"card"|"profile">("card");
 return <div className="preview-root">
   <p className="hint">Два вида одной анкеты. Это локальный предпросмотр, публикация и модерация пока не включены.</p>
   <div className="preview-tabs" role="tablist" aria-label="Режим предпросмотра">
     <button type="button" role="tab" aria-selected={view==="card"} className={view==="card"?"active":""}
       onClick={()=>setView("card")}><Images size={17}/> Карточка</button>
     <button type="button" role="tab" aria-selected={view==="profile"} className={view==="profile"?"active":""}
       onClick={()=>setView("profile")}><UserRound size={17}/> Профиль</button>
   </div>
   <div className={"preview-surface "+view} role="tabpanel">
     <PhotoCarousel photos={photos} name={data.name} age={ageOf(data)}/>
     <ProfileFacts data={data} compact={view==="card"}/>
     {view==="profile"&&<div className="profile-more">
       <h3>Немного обо мне</h3><p>{data.about||"Пока без описания"}</p>
       {!!data.languages.length&&<p><strong>Языки:</strong> {data.languages.join(", ")}</p>}
       <p className="hint"><ShieldCheck size={15}/> Реальная анкета появится только после проверки фотографий и модерации.</p>
     </div>}
   </div>
   <div className="review-actions">
     <button className="glass-choice" type="button" onClick={()=>editStep(1)}><Pencil size={16}/> Изменить имя</button>
     <button className="glass-choice" type="button" onClick={()=>editStep(7)}><Images size={16}/> Изменить фото</button>
   </div>
   {photos.length<3&&<p className="hint">Для будущей публикации потребуется ещё {3-photos.length} фото.</p>}
   <button type="button" className="disabled-submit" disabled>Начать знакомства · скоро</button>
 </div>;
}
