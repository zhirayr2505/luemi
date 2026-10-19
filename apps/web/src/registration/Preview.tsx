import {MapPin,Pencil,Heart,ShieldCheck,Languages} from "lucide-react";
import type {RegistrationDraft} from "./model";
import {birthDateValid,goals} from "./model";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import {InterestChip} from "../ui/InterestCatalog";
import {Flag} from "../ui/Flag";
import {languages} from "../ui/Languages";
import type {PhotoItem} from "./PhotoSorter";
interface Props {data:RegistrationDraft;photos:PhotoItem[];editStep:(step:number)=>void;openDemo:()=>void}
function ageOf(d:RegistrationDraft):number|undefined{
 if(!birthDateValid(d.day,d.month,d.year))return undefined;
 const today=new Date(),year=Number(d.year),month=Number(d.month),day=Number(d.day);
 return today.getFullYear()-year-(today.getMonth()+1<month||today.getMonth()+1===month&&today.getDate()<day?1:0);
}
export function RegistrationPreview({data,photos,editStep,openDemo}:Props) {
 const goal=data.goal==="undecided"?undefined:goals.find(x=>x.id===data.goal);
 return <div className="preview-root">
   <p className="hint">Так другие увидят твою анкету после проверки. Пока это локальный предпросмотр.</p>
   <article className="preview-surface profile">
     <PhotoCarousel photos={photos} name={data.name} age={ageOf(data)}/>
     <div className="profile-facts">
       {data.countryCode&&<div className="location-chip"><Flag code={data.countryCode} title={"Флаг "+data.country}/><MapPin size={15}/><span>{data.city}, {data.country}</span></div>}
       {goal&&<div className="goal-badge"><Heart size={15}/>{goal.label}</div>}
       {data.about&&<section className="profile-section"><h3>О себе</h3><p className="preview-about">{data.about}</p></section>}
       {data.interests.length>0&&<section className="profile-section">
         <h3>Мои интересы</h3><div className="chips profile-interests">
           {data.interests.map(id=><InterestChip key={id} id={id}/>)}
         </div>
       </section>}
       {data.languages.length>0&&<section className="profile-section">
         <h3><Languages size={16}/> Языки общения</h3>
         <div className="chips">{data.languages.map(id=>{
           const l=languages.find(x=>x.id===id);return l?<span className="language-summary" key={id} title={l.name} aria-label={l.name}><Flag code={l.flag} size={24} title={l.name}/></span>:null;
         })}</div>
       </section>}
       <div className="preview-trust"><ShieldCheck size={18}/><span>Видимость анкеты откроется только после реальной регистрации и модерации.</span></div>
     </div>
   </article>
   <button className="glass-choice edit-profile-action" type="button" onClick={()=>editStep(7)}><Pencil size={18}/> Изменить анкету</button>
   {photos.length<3&&<p className="hint">Для будущей публикации нужно ещё {3-photos.length} фото.</p>}
   <button type="button" className="primary-action" onClick={openDemo}>Открыть демо-Ленту <span aria-hidden="true">→</span></button>
   <p className="hint">Демо-анкеты вымышлены. Действия ничего не публикуют и никому не отправляются.</p>
   <button type="button" className="disabled-submit" disabled>Публикация анкеты пока закрыта</button>
 </div>;
}
