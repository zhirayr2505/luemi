import type {RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import "./simple-preview.css";

/** Only the final registration review. This is NOT the live Profile Morph V3. */
export function RegistrationSimplePreview({draft,photos}:{
 draft:RegistrationDraft;photos:PhotoItem[]
}){
 const ready=photos.filter(p=>p.status==="ready"&&p.src);
 const main=ready[0];
 const info=[
  draft.city,
  draft.goal,
  draft.about
 ].filter(Boolean);
 return <section className="luemi-simple-preview" aria-label="Предпросмотр анкеты">
  <div className="luemi-simple-preview-header">
   {main?<img className="luemi-simple-main-avatar" src={main.src} alt="Главное фото"/>:
    <div className="luemi-simple-main-avatar is-placeholder" aria-hidden="true">♡</div>}
   <h2>{draft.name}</h2>
   <div className="luemi-simple-info">
    {info.map((value,index)=><p key={index}>{value}</p>)}
   </div>
   {!!draft.interests.length&&<div className="luemi-simple-interests">
    {draft.interests.map(value=><span key={value}>{value}</span>)}
   </div>}
  </div>
  <div className="luemi-simple-gallery-head">
   <h3>Твои фотографии</h3><span>{ready.length} из 6</span>
  </div>
  <div className="luemi-simple-gallery" role="region" aria-label="Горизонтальная галерея фотографий" tabIndex={0}>
   {ready.map((photo,index)=><figure key={photo.id} className="luemi-simple-gallery-item">
    <img src={photo.src} alt={index===0?"Главная фотография":`Фотография ${index+1}`} loading={index>2?"lazy":"eager"}/>
    {index===0&&<figcaption>Главное фото</figcaption>}
   </figure>)}
  </div>
  <p className="luemi-simple-gallery-hint">Листай фотографии в сторону. Главное — первое фото.</p>
 </section>;
}
