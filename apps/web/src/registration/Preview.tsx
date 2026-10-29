import type {RegistrationDraft} from "./model";
import {goals} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import {draftAge,readyRegistrationPhotos} from "../discovery/ProfileModel";
import {itemOf} from "../ui/InterestCatalog";

interface Props{data:RegistrationDraft;photos:PhotoItem[]}

/** Calm, read-only registration summary. The interactive Morph V3 is reserved
 * for the actual published profile; this summary only displays what was chosen.
 */
export function RegistrationPreview({data,photos}:Props){
 const prepared=readyRegistrationPhotos(photos);
 const age=draftAge(data),goal=goals.find(item=>item.id===data.goal)?.label;
 const location=[data.city,data.country].filter(Boolean).join(", ");
 return <article className="luemi-simple-preview" aria-label="Предпросмотр анкеты">
  <div className="luemi-preview-identity">
   <div className="luemi-preview-avatar">
    {prepared[0]?<img src={prepared[0].src} alt="Главная фотография" decoding="async"/>:
     <span>Главное фото</span>}
   </div>
   <div className="luemi-preview-name">{data.name.trim()||"Твоя анкета"}{age!==null?", "+age:""}</div>
   <div className="luemi-preview-city">{location||"Город пока не указан"}</div>
   <div className="luemi-preview-goal">{goal||"Цель знакомства"}</div>
  </div>
  <section className="luemi-preview-section" aria-label="Фотографии анкеты">
   <div className="luemi-preview-section-head"><h3>Твои фотографии</h3>
    <span>{prepared.length} из 6</span></div>
   <div className="luemi-preview-gallery" role="group" aria-label="Галерея выбранных фотографий" tabIndex={0}>
    {prepared.map((photo,index)=><div className="luemi-preview-photo" key={photo.id}>
     <img src={photo.src} alt={index===0?"Главное фото":`Фото ${index+1}`}
      loading={index<2?"eager":"lazy"} decoding="async"/>
     {index===0&&<span className="luemi-preview-main-label">Главное фото</span>}
    </div>)}
   </div>
   <p className="luemi-preview-swipe-hint">Листай фотографии горизонтально</p>
  </section>
  {data.about.trim()&&<section className="luemi-preview-section">
   <h3>О себе</h3><p>{data.about.trim()}</p>
  </section>}
  {!!data.interests.length&&<section className="luemi-preview-section">
   <h3>Интересы</h3><div className="luemi-preview-interests">
    {data.interests.map(id=><span key={id}>{itemOf(id)?.name??id}</span>)}
   </div>
  </section>}
  <p className="luemi-preview-note">Так будет выглядеть твоя информация. Анкета ещё не опубликована.</p>
 </article>;
}
