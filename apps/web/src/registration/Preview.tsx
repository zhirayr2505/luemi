import {useState} from "react";
import {Pencil,Info,Images,MapPin,Heart,FileText,CheckCircle2} from "lucide-react";
import type {RegistrationDraft} from "./model";
import {goals,validateStep} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import {fromLocalDraft,readyRegistrationPhotos} from "../discovery/ProfileModel";
import {ProfileMaster} from "../discovery/ProfileMaster";

interface Props {
 data:RegistrationDraft;photos:PhotoItem[];
 editStep:(step:number)=>void;openDemo:()=>void;
}
/** Step 8: two local, explicit perspectives on the SAME draft projection.
 * No visitor/public endpoint or mock server publication is invoked. */
export function RegistrationPreview({data,photos,editStep,openDemo}:Props){
 const [view,setView]=useState<"profile"|"card">("profile");
 const prepared=readyRegistrationPhotos(photos);
 const profile=fromLocalDraft(data,prepared);
 const missing=Math.max(0,3-prepared.length);
 const pending=photos.filter(p=>p.status==="reading").length;
 const failed=photos.filter(p=>p.status==="error").length;
 const goal=goals.find(g=>g.id===data.goal)?.label??"Цель пока не указана";
 const checks=[1,2,3,4,5,6,7].filter(step=>validateStep(data,step,photos.length)===null).length;
 const label=[profile.name,profile.age].filter(value=>value!==null&&value!=="").join(", ");
 return <div className="preview-root">
   <p className="hint">Проверь, как будет выглядеть анкета. Это сохранённый локальный черновик — он не виден другим пользователям.</p>
   <div className="registration-preview-switch" role="tablist" aria-label="Режим предпросмотра анкеты">
     <button type="button" role="tab" aria-selected={view==="profile"} className={view==="profile"?"active":""}
       onClick={()=>setView("profile")}>Полный профиль</button>
     <button type="button" role="tab" aria-selected={view==="card"} className={view==="card"?"active":""}
       onClick={()=>setView("card")}>Карточка в ленте</button>
   </div>
   {view==="profile"?<section className="registration-profile-simulator" aria-label="Локальный предпросмотр профиля">
     <ProfileMaster data={profile} mode="local-self-preview"/>
   </section>:<section className="registration-preview-card" aria-label="Локальный предпросмотр карточки знакомства">
     <div className="registration-preview-card-photo">
       {prepared[0]?<img src={prepared[0].src} alt={"Главное фото анкеты "+profile.name} decoding="async"/>:
        <div className="registration-preview-empty"><Images size={32}/><span>Добавь главное фото</span></div>}
       <span className="registration-preview-watermark">Предпросмотр · не опубликовано</span>
       <div className="registration-preview-card-details">
         <strong>{label||"Твоя анкета"}</strong>
         <span><MapPin size={15}/>{[profile.city,profile.country].filter(Boolean).join(", ")||"Место пока не указано"}</span>
         <span><Heart size={15}/>{goal}</span>
       </div>
     </div>
     <p>{profile.about||"Здесь появится твоё описание. Его можно заполнить на шестом шаге."}</p>
     <div className="registration-preview-interests">
       {profile.interests.slice(0,3).map(interest=><span key={interest}>{interest}</span>)}
       {profile.interests.length>3&&<span>+{profile.interests.length-3}</span>}
     </div>
   </section>}
   <div className="registration-preview-review" aria-label="Проверка заполнения анкеты">
     <div><CheckCircle2 size={18}/><strong>Проверено шагов: {checks} из 7</strong></div>
     <p>{missing===0?"Есть минимум три готовых фотографии.":"Для будущей публикации потребуется ещё "+missing+" готовых фото."}</p>
     {(pending>0||failed>0)&&<p role="status"><Info size={14}/> Фото в обработке: {pending}; с ошибками: {failed}. Открой шаг фотографий, чтобы исправить.</p>}
   </div>
   <div className="registration-preview-edit-grid" aria-label="Быстрое редактирование перед публикацией">
     <button type="button" onClick={()=>editStep(3)}><MapPin size={17}/> Город</button>
     <button type="button" onClick={()=>editStep(4)}><Heart size={17}/> Цель</button>
     <button type="button" onClick={()=>editStep(6)}><FileText size={17}/> О себе</button>
     <button type="button" onClick={()=>editStep(7)}><Images size={17}/> Фото</button>
   </div>
   <button className="glass-choice edit-profile-action" type="button" onClick={()=>editStep(7)}>
     <Pencil size={18}/> Изменить анкету
   </button>
   <button type="button" className="primary-action" onClick={openDemo}>
     Открыть демо-Ленту <span aria-hidden="true">→</span>
   </button>
   <p className="hint">Демо-анкеты вымышлены. Никакие действия здесь не публикуют анкету и никому не отправляют данные.</p>
   <button type="button" className="disabled-submit" disabled>Публикация анкеты пока закрыта</button>
 </div>;
}
