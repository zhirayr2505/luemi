import type {RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import {CheckCircle2,Image as ImageIcon} from "lucide-react";
import "./simple-profile-review.css";
export function SimpleProfileReview({draft,photos,uploaded,uploading,error}:{
 draft:RegistrationDraft;photos:PhotoItem[];uploaded:number;uploading:boolean;error:string;
}){
 const valid=photos.filter(photo=>photo.status==="ready"&&photo.src),main=valid[0];
 return <section className="luemi-simple-review" aria-label="Предпросмотр анкеты">
  <header className="luemi-simple-review-head">
   {main?<img className="luemi-simple-review-avatar" src={main.src} alt="Главное фото"/>:
    <span className="luemi-simple-review-avatar luemi-simple-review-fallback"><ImageIcon size={26}/></span>}
   <h2>{draft.name}</h2><p>{[draft.city,draft.goal].filter(Boolean).join(" · ")}</p>
   {draft.about&&<p className="luemi-simple-review-about">{draft.about}</p>}
   {!!draft.interests.length&&<div className="luemi-simple-review-interests">
    {draft.interests.slice(0,6).map(item=><span key={item}>{item}</span>)}
   </div>}
  </header>
  <div className="luemi-simple-review-gallery-head"><h3>Мои фотографии</h3><span>{valid.length} из 6</span></div>
  <div className="luemi-simple-review-gallery" role="group" aria-label="Фотографии. Листай горизонтально">
   {valid.map((photo,i)=><div className="luemi-simple-review-tile" key={photo.id}>
    <img src={photo.src} alt={"Фото "+(i+1)} loading={i===0?"eager":"lazy"}/>
    {i===0&&<span className="luemi-simple-review-main">Главное фото</span>}
   </div>)}
  </div>
  <div className="luemi-simple-review-sync" role="status" aria-live="polite">
   {error?<span className="luemi-simple-review-sync-error">{error}</span>:
    <><CheckCircle2 size={17}/><span>{uploading?"Сохраняем фотографии на сервере…":
      "Сохранено на сервере: "+uploaded+" из "+photos.length}</span></>}
  </div>
 </section>;
}
