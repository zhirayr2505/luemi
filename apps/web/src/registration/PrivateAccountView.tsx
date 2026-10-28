import {useState} from "react";
import {ArrowUpRight,Camera,Heart,Images,LockKeyhole,MapPin,ShieldAlert,Sparkles} from "lucide-react";
import type {RegistrationDraft} from "./model";
import {goals} from "./model";
import {draftAge} from "../discovery/ProfileModel";
import {itemOf} from "../ui/InterestCatalog";
import {safeOwnerAbout} from "./private-account-copy";

interface Photo {id:string;src:string}
interface Props {draft:RegistrationDraft;photos:ReadonlyArray<Photo>;serverPhotoCount?:number}

/**
 * A real, PRIVATE account; do not confuse it with an approved/public profile.
 * Local photo URLs never leave the owner device and should never be rendered
 * in Discovery. This component displays exactly what is available locally.
 */
export function PrivateAccountView({draft,photos,serverPhotoCount=0}:Props){
 const [selectedPhotoId,setSelectedPhotoId]=useState<string|null>(null);
 const selected=photos.find(p=>p.id===selectedPhotoId)??photos[0];
 const age=draftAge(draft);
 const goal=goals.find(g=>g.id===draft.goal)?.label??draft.goal;
 const about=safeOwnerAbout(draft.about.trim());
 const location=[draft.city,draft.country||draft.countryCode].filter(Boolean).join(" · ");
 return <section className="luemi-private-profile" aria-label="Моя закрытая анкета">
   <div className="luemi-private-heading">
     <span className="luemi-private-eyebrow"><Sparkles size={15} aria-hidden="true"/> ТВОЁ ПРОСТРАНСТВО</span>
     <h1>Моя анкета <Heart size={27} fill="currentColor" strokeWidth={1.3} aria-hidden="true"/></h1>
     <p>Твоя история в LUEMI начинается здесь.</p>
   </div>

   <div className="luemi-private-status" role="status">
     <span className="luemi-private-status-icon"><LockKeyhole size={21} aria-hidden="true"/></span>
     <div>
       <strong>{serverPhotoCount>=3?"Анкета и фотографии на сервере":"Анкета сохранена"}</strong>
       <p>{serverPhotoCount>=3
        ?"Твои данные и "+serverPhotoCount+" фотографий сохранены приватно. Публикация только после проверки."
        :"Поля анкеты восстановятся с сервера при следующем входе. Сейчас эту анкету видишь только ты."}</p>
     </div>
   </div>

   <article className="luemi-private-card" aria-label="Предпросмотр моей анкеты">
     <div className="luemi-private-gallery">
       {selected?
         <div className="luemi-private-hero">
           <img src={selected.src} alt="Выбранное фото моей анкеты" decoding="async"/>
           <span className="luemi-private-photo-count"><Images size={15} aria-hidden="true"/> {Math.max(0,photos.findIndex(x=>x.id===selected.id))+1} / {photos.length}</span>
           <span className="luemi-private-photo-label">{serverPhotoCount>=3?"Фото сохранены приватно":"Фото только на устройстве"}</span>
         </div>:
         <div className="luemi-private-hero luemi-private-empty"><Camera size={36} aria-hidden="true"/><span>{serverPhotoCount>=3?serverPhotoCount+" фотографий сохранены на сервере. Просмотр после проверки.":"Добавь свои фотографии в редакторе"}</span></div>}
       {photos.length>1&&<div className="luemi-private-thumbnails" role="group" aria-label="Мои фотографии">
         {photos.map((p,i)=><button type="button" key={p.id}
           className={"luemi-private-thumb"+(p.id===selected?.id?" is-active":"")}
           onClick={()=>setSelectedPhotoId(p.id)} aria-pressed={p.id===selected?.id}
           aria-label={"Открыть фотографию "+(i+1)}>
           <img src={p.src} loading={i<3?"eager":"lazy"} alt=""/>
           </button>)}
       </div>}
     </div>
     <div className="luemi-private-details">
       <div className="luemi-private-name-row">
         <h2>{draft.name.trim()||"Твоё имя"}{age!==null?", "+age:""}</h2>
         <span title="Видна только тебе" className="luemi-private-lock"><LockKeyhole size={17}/></span>
       </div>
       {location&&<p className="luemi-private-location"><MapPin size={16} aria-hidden="true"/>{location}</p>}
       {goal&&<div className="luemi-private-goal"><Heart size={15} aria-hidden="true"/>{goal}</div>}
       {about.text&&<section className="luemi-private-about" aria-label="О себе">
         <h3>О себе</h3>
         <p>{about.text}</p>
         {about.containsCredential&&<div className="luemi-private-secret-warning" role="alert">
           <ShieldAlert size={17} aria-hidden="true"/>
           Похоже, в описании есть секретный ключ. Удали его через «Редактировать анкету» и перевыпусти ключ, если он настоящий.
         </div>}
       </section>}
       {draft.interests.length>0&&<section className="luemi-private-interests" aria-label="Интересы">
         <h3>Интересы</h3>
         <div className="luemi-private-chips">{draft.interests.map(id=>
           <span key={id}>{itemOf(id)?.name??id}</span>)}</div>
       </section>}
     </div>
   </article>

   <div className="luemi-private-notice">
     <LockKeyhole size={19} aria-hidden="true"/>
     <p>{serverPhotoCount>=3
       ?"Фотографии сохранены в приватном хранилище. Лента и чаты доступны после разрешённой публикации."
       :"Закрытый тест. Фотографии пока только на этом устройстве; лента, симпатии и чаты ещё не включены."}</p>
   </div>
   <p className="luemi-private-support">Помощь и удаление данных: <a href="https://t.me/zhiiirro" target="_blank" rel="noopener noreferrer">@zhiiirro <ArrowUpRight size={13} aria-hidden="true"/></a></p>
 </section>;
}
