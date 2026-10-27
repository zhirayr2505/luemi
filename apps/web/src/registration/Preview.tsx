import type {RegistrationDraft} from "./model";
import {goals} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import {draftAge,readyRegistrationPhotos} from "../discovery/ProfileModel";
import {itemOf} from "../ui/InterestCatalog";

interface Props {data:RegistrationDraft;photos:PhotoItem[]}

/** A read-only projection of the local draft. */
export function RegistrationPreview({data,photos}:Props){
 const prepared=readyRegistrationPhotos(photos);
 const age=draftAge(data);
 const goal=goals.find(item=>item.id===data.goal)?.label;
 const location=[data.city,data.country].filter(Boolean).join(", ");
 const name=[data.name.trim(),age].filter(value=>value!==null&&value!=="").join(", ");
 return <article className="registration-static-profile" aria-label="Предпросмотр анкеты">
   <div className="registration-static-hero">
     <div className="registration-static-avatar">
       {prepared[0]?<img src={prepared[0].src} alt="Главное фото анкеты" decoding="async"/>:
        <span>Добавь фото</span>}
     </div>
     <h2>{name||"Твоя анкета"}</h2>
     <p>{location||"Город пока не указан"}</p>
   </div>
   <div className="registration-static-sections">
     <section className="registration-static-section">
       <h3>Цель знакомства</h3><p>{goal||"Пока не указана"}</p>
     </section>
     <section className="registration-static-section">
       <h3>О себе</h3><p>{data.about.trim()||"Расскажи немного о себе"}</p>
     </section>
     <section className="registration-static-section">
       <h3>Интересы</h3>
       {data.interests.length?<div className="registration-static-interests">
         {data.interests.map(id=><span key={id}>{itemOf(id)?.name??id}</span>)}
       </div>:<p>Интересы пока не выбраны</p>}
     </section>
     <section className="registration-static-section">
       <h3>Ещё фотографии</h3>
       {prepared.length>1?<div className="registration-static-gallery">
         {prepared.slice(1).map((photo,index)=><img key={photo.id} src={photo.src}
           alt={`Дополнительное фото ${index+1}`} loading="lazy" decoding="async"/>)}
       </div>:<p>Других фотографий пока нет</p>}
     </section>
   </div>
   <p className="registration-static-note">Это локальный черновик. Анкета не опубликована.</p>
 </article>;
}
