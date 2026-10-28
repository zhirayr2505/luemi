import {createRoot} from "react-dom/client";
import {useEffect,useRef,useState} from "react";
import {
 ArrowLeft,ArrowRight,Camera,Check,ChevronRight,Images,
 LockKeyhole,MapPin,ShieldCheck,Sparkles,UserRound,Users,X
} from "lucide-react";
import {
 registrationV2Stages,nextRegistrationV2Stage,canPublishRegistrationV2,
 type RegistrationV2StageId,type RegistrationV2Gate
} from "./flow";
import "./preview.css";

type LocalPhoto={id:string;src:string;name:string};
const sampleInterests=["Музыка","Путешествия","Кино","Спорт","Книги","Готовка","Прогулки","Искусство"];
const goalChoices=["Серьёзные отношения","Отношения","Свидания","Дружба","Общение"];
const notAllowed="Дизайн-макет: камеры, серверной проверки и публикации здесь нет.";

function RegistrationV2Preview(){
 const [stage,setStage]=useState<RegistrationV2StageId>("identity");
 const [name,setName]=useState("");
 const [birthday,setBirthday]=useState("");
 const [gender,setGender]=useState("");
 const [profileConsent,setProfileConsent]=useState(false);
 const [city,setCity]=useState("");
 const [goal,setGoal]=useState("");
 const [audience,setAudience]=useState("");
 const [ageMin,setAgeMin]=useState(18);
 const [ageMax,setAgeMax]=useState(35);
 const [radius,setRadius]=useState(100);
 const [languages,setLanguages]=useState<string[]>(["Русский"]);
 const [interests,setInterests]=useState<string[]>([]);
 const [about,setAbout]=useState("");
 const [photos,setPhotos]=useState<LocalPhoto[]>([]);
 const [biometricConsent,setBiometricConsent]=useState(false);
 const [message,setMessage]=useState("");
 const owned=useRef(new Set<string>());
 useEffect(()=>()=>{for(const url of owned.current)URL.revokeObjectURL(url);owned.current.clear();},[]);
 const index=registrationV2Stages.findIndex(s=>s.id===stage);
 const current=registrationV2Stages[index];
 const date=new Date(birthday+"T00:00:00Z");
 const cutoff=new Date();
 cutoff.setFullYear(cutoff.getFullYear()-18);
 const identityReady=name.trim().length>=2&&birthday.length===10&&
   Number.isFinite(date.getTime())&&date<=cutoff&&!!gender&&profileConsent;
 const gate:RegistrationV2Gate={
   hasIdentity:identityReady,hasLocation:city.trim().length>=2,
   hasIntent:!!audience&&!!goal&&ageMin<=ageMax,
   selectedPhotos:photos.length,biometricConsent,faceTrust:"awaiting_provider"
 };
 const move=(next:RegistrationV2StageId)=>{setStage(next);setMessage("");};
 const forward=()=>{
   const result=nextRegistrationV2Stage(stage,gate);
   if(result.allowed)move(result.stage);
   else{
    const reasons:Record<string,string>={
      identity_required:"Укажи имя, дату рождения (18+) и пол.",
      city_required:"Укажи город.",
      intent_required:"Выбери цель и кого хочешь встретить.",
      three_to_six_photos_required:"Добавь минимум 3 и максимум 6 фотографий.",
      separate_biometric_consent_required:"Для проверки нужно отдельное согласие.",
      trusted_liveness_verdict_required:"Проверка FaceTrust пока не подключена. Здесь нельзя обойти её.",
      complete:"Это последний экран."
    };
    setMessage(reasons[result.reason]??"Заверши этот этап.");
   }
 };
 const addPhotos=(files:FileList|null)=>{
   if(!files)return;
   let skipped=false;
   const added:LocalPhoto[]=[];
   for(const file of Array.from(files)){
    if(photos.length+added.length>=6){skipped=true;break;}
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||
       file.size===0||file.size>12*1024*1024){skipped=true;continue;}
    const src=URL.createObjectURL(file);owned.current.add(src);
    added.push({id:crypto.randomUUID(),src,name:file.name});
   }
   if(added.length)setPhotos(prev=>[...prev,...added]);
   setMessage(skipped?"Часть файлов не добавлена: до 6 JPEG/PNG/WebP по 12 МБ.":"Фотографии видны только в этом браузерном макете.");
 };
 const removePhoto=(id:string)=>{
   const p=photos.find(x=>x.id===id);
   if(p){URL.revokeObjectURL(p.src);owned.current.delete(p.src);}
   setPhotos(prev=>prev.filter(x=>x.id!==id));
 };
 const button=(label:string,active:boolean,onClick:()=>void)=>
  <button key={label} type="button" className={"v2-choice"+(active?" is-selected":"")}
    onClick={onClick} aria-pressed={active}>{active&&<Check size={14}/>} {label}</button>;
 const ageLabel=birthday&&Number.isFinite(date.getTime())?
  Math.max(0,new Date().getFullYear()-date.getFullYear()-
   (new Date().toISOString().slice(5,10)<birthday.slice(5,10)?1:0)):null;
 return <main className="v2-canvas">
   <div className="v2-device">
     <div className="v2-backdrop" aria-hidden="true"/>
     <header className="v2-header">
       <div className="v2-logo"><img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="LUEMI"/></div>
       <span className="v2-count">{index+1} из 8</span>
     </header>
     <div className="v2-progress" role="progressbar" aria-label="Прогресс регистрации"
       aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={8}>
       {registrationV2Stages.map((s,i)=><span key={s.id}
        className={i<=index?"v2-filled":""}/>)}
     </div>
     <section className="v2-body" aria-labelledby="v2-title" key={stage}>
       <div className="v2-eyebrow"><Sparkles size={14}/>{current.eyebrow}</div>
       <h1 id="v2-title">{current.title}</h1>
       <p className="v2-subtitle">{current.subtitle}</p>

       {stage==="identity"&&<div className="v2-fields">
         <label className="v2-label">Как тебя зовут?<input className="v2-input" autoComplete="given-name"
          value={name} maxLength={48} placeholder="Твоё имя" onChange={e=>setName(e.target.value)}/></label>
         <label className="v2-label">Когда ты родился?<input className="v2-input"
          type="date" autoComplete="bday" value={birthday} onChange={e=>setBirthday(e.target.value)}/></label>
         <div className="v2-label">Как ты себя определяешь?
          <div className="v2-choices">{["Мужчина","Женщина","Другое"].map(x=>button(x,gender===x,()=>setGender(x)))}</div>
         </div>
         <label className="v2-consent"><input type="checkbox" checked={profileConsent}
          onChange={e=>setProfileConsent(e.target.checked)}/>
          <span>Я согласен(-на) сохранить профиль для регистрации в закрытом тесте LUEMI. Условия доступны перед отправкой на сервер.</span>
         </label>
         <div className="v2-note"><ShieldCheck size={18}/> Только 18+. Дату рождения нельзя подтвердить лишь по лицу.</div>
       </div>}

       {stage==="location"&&<div className="v2-fields">
         <div className="v2-map"><MapPin size={33}/><span>Твоя точная геолокация другим людям не показывается</span></div>
         <label className="v2-label">Твой город<input className="v2-input" value={city}
          placeholder="Например, Краснодар" onChange={e=>setCity(e.target.value)}/></label>
         <button className="v2-secondary" type="button" onClick={()=>setMessage(
           "В рабочей регистрации откроется запрос GPS и серверный выбор реального города. В макете геолокация не запрашивается.")}>
           <MapPin size={17}/> Определить мой город
         </button>
         <p className="v2-footnote">GPS запрашиваем только по желанию. Можно выбрать город вручную.</p>
       </div>}

       {stage==="intent"&&<div className="v2-fields">
         <div className="v2-label">Кого хочешь встретить?
          <div className="v2-choices">{["Женщин","Мужчин","Всех"].map(x=>button(x,audience===x,()=>setAudience(x)))}</div>
         </div>
         <div className="v2-label">Зачем ты здесь?
          <div className="v2-choices">{goalChoices.map(x=>button(x,goal===x,()=>setGoal(x)))}</div>
         </div>
         <div className="v2-age"><span>Возраст людей</span><strong>{ageMin}–{ageMax}</strong>
          <input type="range" min={18} max={80} value={ageMin}
           aria-label="Минимальный возраст" onChange={e=>setAgeMin(Math.min(+e.target.value,ageMax))}/>
          <input type="range" min={18} max={80} value={ageMax}
           aria-label="Максимальный возраст" onChange={e=>setAgeMax(Math.max(+e.target.value,ageMin))}/>
         </div>
         <div className="v2-age"><span>Расстояние поиска</span><strong>{radius} км</strong>
          <input type="range" min={1} max={500} value={radius} aria-label="Радиус поиска"
           onChange={e=>setRadius(+e.target.value)}/></div>
       </div>}

       {stage==="personality"&&<div className="v2-fields">
         <p className="v2-section-title">Выбери то, что тебе близко</p>
         <div className="v2-choices">{sampleInterests.map(x=>button(x,interests.includes(x),()=>
           setInterests(prev=>prev.includes(x)?prev.filter(z=>z!==x):prev.length<8?[...prev,x]:prev)))}</div>
         <label className="v2-label">Пару слов о себе<textarea className="v2-input v2-about"
          maxLength={250} placeholder="Люблю ночные прогулки, красивые места и душевные разговоры..."
          value={about} onChange={e=>setAbout(e.target.value)}/></label>
         <span className="v2-remaining">{about.length} / 250</span>
         <div className="v2-label">Языки общения<div className="v2-choices">
           {["Русский","Армянский","Английский"].map(x=>button(x,languages.includes(x),()=>
            setLanguages(prev=>prev.includes(x)?prev.filter(z=>z!==x):[...prev,x])))}</div></div>
         <p className="v2-footnote">Можно пропустить. Позже всё можно изменить в профиле.</p>
       </div>}

       {stage==="photos"&&<div className="v2-fields">
         <div className="v2-photo-grid">
           {Array.from({length:6},(_,i)=>{
            const p=photos[i];
            return <div key={p?.id??i} className={"v2-photo"+(p?" has-photo":"")}>
             {p?<><img src={p.src} alt={"Локальное фото "+(i+1)}/><button type="button"
                 className="v2-photo-close" aria-label={"Удалить фото "+(i+1)}
                 onClick={()=>removePhoto(p.id)}><X size={13}/></button></>:
              <span><Images size={22}/>{i<3?"Обязательно":"По желанию"}</span>}
             {i===0&&<small>Главное фото</small>}
            </div>;
           })}
         </div>
         <label className="v2-upload"><Images size={19}/> Добавить фотографии
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple
           onChange={e=>{addPhotos(e.target.files);e.target.value="";}}/>
         </label>
         <div className="v2-note"><LockKeyhole size={18}/> Фото сохраняются только локально в этом макете. Ни одно не отправляется на сервер.</div>
       </div>}

       {stage==="face-consent"&&<div className="v2-fields">
         <div className="v2-trust-symbol"><ShieldCheck size={54} strokeWidth={1.6}/></div>
         <h2 className="v2-center-title">Твои фото. Твоё лицо. Настоящий ты.</h2>
         <div className="v2-trust-steps">
           <span><UserRound size={18}/> Проверим, что на каждом фото один человек</span>
           <span><Users size={18}/> Сравним лица на всех снимках</span>
           <span><Camera size={18}/> Попросим короткое живое селфи</span>
         </div>
         <label className="v2-consent">
          <input type="checkbox" checked={biometricConsent}
           onChange={e=>setBiometricConsent(e.target.checked)}/>
          <span>Я отдельно соглашаюсь на обработку лица для проверки фотографий. Мне понятны цель проверки и возможность отказаться.</span>
         </label>
         <p className="v2-footnote">В будущем здесь будет полное уведомление о хранении, сроках удаления и способе отзыва согласия. Без него биометрическую проверку не включаем.</p>
       </div>}

       {stage==="liveness"&&<div className="v2-fields">
         <div className="v2-camera"><div className="v2-face-outline"><UserRound size={92} strokeWidth={.9}/></div>
           <span className="v2-camera-caption">Камера не запущена — дизайн-макет</span></div>
         <div className="v2-challenge">
          {["Посмотри прямо","Поверни голову налево","Посмотри направо","Подними взгляд"].map((x,i)=>
          <span key={x}><b>{i+1}</b>{x}{i===0?<Check size={16} color="#9B91A7"/>:null}</span>)}
         </div>
         <div className="v2-note"><ShieldCheck size={18}/> Движений головы недостаточно для подтверждения личности. В рабочей версии потребуется серверная проверка живости и сравнение всех фотографий.</div>
       </div>}

       {stage==="review"&&<div className="v2-fields">
         <article className="v2-review-card">
          <div className="v2-review-hero">{photos[0]?<img src={photos[0].src} alt="Локальное главное фото"/>:
            <div className="v2-no-photo"><UserRound size={70}/><span>Главное фото</span></div>}
          </div>
          <div className="v2-review-content">
           <h2>{name||"Твоё имя"}{ageLabel!==null?", "+ageLabel:""}</h2>
           <span><MapPin size={15}/>{city||"Твой город"}</span>
           <p>{goal||"Цель знакомства"}{audience?" · "+audience:""}</p>
           {about&&<p>{about}</p>}
           <div className="v2-choices">{interests.map(x=><span className="v2-review-chip" key={x}>{x}</span>)}</div>
          </div>
         </article>
         <div className="v2-verification-pending"><LockKeyhole size={20}/>
          <div><strong>Пока не подтверждено</strong>
           <p>Реальная AI-проверка и живое селфи не подключены. Этот экран нельзя использовать для публикации.</p></div>
         </div>
         <button type="button" className="v2-publish" disabled={!canPublishRegistrationV2(gate)}
          onClick={()=>setMessage("Этот прототип никогда не публикует реальные анкеты.")}>
          <ShieldCheck size={18}/> Опубликовать анкету
         </button>
       </div>}
       {message&&<p className="v2-feedback" role="status">{message}</p>}
     </section>
     <footer className="v2-footer">
       <div className="v2-footer-nav">
         <button className="v2-back" type="button" disabled={index===0}
          onClick={()=>move(registrationV2Stages[index-1].id)} aria-label="Назад"><ArrowLeft size={22}/></button>
         <button className="v2-next" type="button" disabled={stage==="review"}
          onClick={forward}>{stage==="liveness"?"Открыть после проверки":stage==="face-consent"?"Перейти к селфи":"Продолжить"}
          <ChevronRight size={20}/></button>
       </div>
       <p className="v2-prototype-caption"><LockKeyhole size={12}/> {notAllowed}</p>
     </footer>
   </div>
   <aside className="v2-stage-rail">
    <div><strong>REGISTRATION V2</strong><p>Интерактивный дизайн-макет. Экраны можно просматривать независимо от проверок.</p></div>
    {registrationV2Stages.map((s,i)=><button type="button" key={s.id}
     className={stage===s.id?"v2-active":""} onClick={()=>move(s.id)}>
      <span>{String(i+1).padStart(2,"0")}</span>{s.eyebrow}<ArrowRight size={15}/>
    </button>)}
   </aside>
 </main>;
}
const el=document.getElementById("root");
if(el)createRoot(el).render(<RegistrationV2Preview/>);
