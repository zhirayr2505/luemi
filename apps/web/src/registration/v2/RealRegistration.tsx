import {useEffect,useMemo,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,Check,ChevronRight,LockKeyhole,ShieldCheck,Sparkles,Moon,Sun} from "lucide-react";
import {RegistrationStep,RegistrationConsent,type PhotoItem} from "../Steps";
import {SimpleProfileReview} from "../SimpleProfileReview";
import {birthDateValid,nameValid,selectedCityValid,validateStep,type RegistrationDraft} from "../model";
import {registrationV2Stages,type RegistrationV2Gate} from "./flow";
import {FaceTrustCamera} from "./FaceTrustCamera";
import {findExactDuplicatePhotoIds} from "./duplicate-photos";
import "./preview.css";
import "./runtime.css";

interface Props{
 draft:RegistrationDraft;
 patch:(change:Partial<RegistrationDraft>)=>void;
 photos:PhotoItem[];
 addPhotos:(files:File[])=>void;
 removePhoto:(id:string)=>void;
 movePhoto:(from:number,to:number)=>void;
 resetDraft:()=>void;
 theme:"light"|"dark";
 onTheme:()=>void;
 onSave:()=>void;
 mediaEnabled:boolean;
 publicationEnabled:boolean;
 serverSaving:boolean;
 serverStatus:string;
 mediaStatus?:string;
 storageError:string|null;
 restored:boolean;
 resumeReview:boolean;
 onRetryStorage:()=>void;
 onExit:()=>void;
 registerBack:(fn:()=>void)=>void;
 /** Real profile and media publication use the independently authenticated server. */
}
const photoReady=(photos:PhotoItem[])=>photos.length>=3&&photos.length<=6&&
 photos.every(p=>p.status==="ready");
const messageFor=(raw:string)=>raw||"Заполни обязательные поля.";
export function RealRegistrationV2(p:Props){
 const {draft,photos}=p;
 const instantPublication=p.publicationEnabled&&import.meta.env.VITE_LUEMI_INSTANT_PUBLICATION_UI==="1";
 // Private registration never requests a non-operational biometric selfie.
 // Keep the full FaceTrust workflow available only to separately approved publication.
 const stages=useMemo(()=>p.publicationEnabled&&!instantPublication?registrationV2Stages:
  registrationV2Stages.filter(stage=>stage.id!=="face-consent"&&stage.id!=="liveness"),
  [p.publicationEnabled,instantPublication]);
 const [index,setIndex]=useState(()=>p.resumeReview?stages.length-1:0);
 const recoveryApplied=useRef(false);
 const [biometricNotice,setBiometricNotice]=useState(false);
 const [engine,setEngine]=useState<"checking"|"unavailable"|"error">("checking");
 const [hint,setHint]=useState("");
 const [photoChecking,setPhotoChecking]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch("/api/v2/facetrust/status",{method:"GET",credentials:"same-origin",
   cache:"no-store",signal:controller.signal}).then(async res=>{
    if(!res.ok)throw new Error("facetrust_status_unavailable");
    const data:unknown=await res.json();
    if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("invalid_status");
    const state=data as Record<string,unknown>;
    // Client never interprets the network response as a trusted liveness verdict.
    setEngine(state.state==="provider_not_connected"&&state.verified===false?
      "unavailable":"error");
  }).catch(()=>{if(!controller.signal.aborted)setEngine("error");});
  return()=>controller.abort();
 },[]);
 const stage=stages[index];
 const body=useRef<HTMLElement|null>(null);
 const dateValid=birthDateValid(draft.day,draft.month,draft.year);
 const identityReady=nameValid(draft.name)&&dateValid&&!!draft.gender&&draft.trialConsent;
 const gate:RegistrationV2Gate={
  hasIdentity:identityReady,hasLocation:selectedCityValid(draft),
  hasIntent:validateStep(draft,4,photos.length,new Date(),"live")===null,
  selectedPhotos:photos.length,biometricConsent:biometricNotice,
  faceTrust:"awaiting_provider"
 };
 // Restore the next incomplete real-data stage once local persistence has
 // finished loading; never blindly restart from the first question.
 useEffect(()=>{
  if(!p.restored||recoveryApplied.current)return;
  recoveryApplied.current=true;
  if(p.resumeReview)return;
  setIndex(!identityReady?0:!gate.hasLocation?1:!gate.hasIntent?2:
    !photoReady(photos)?4:p.publicationEnabled&&!instantPublication?5:stages.length-1);
 },[p.restored,p.resumeReview,p.publicationEnabled,instantPublication,identityReady,gate.hasLocation,gate.hasIntent,photos,stages.length]);
 const nav=(target:number)=>{setHint("");setIndex(Math.min(stages.length-1,Math.max(0,target)));body.current?.scrollTo({top:0,behavior:"instant"});};
 const back=()=>{if(index===0)p.onExit();else nav(index-1);};
 useEffect(()=>{p.registerBack(back);return()=>p.registerBack(()=>{});});
 const advance=()=>{
  let issue:string|null=null;
  switch(stage.id){
   case "identity":issue=validateStep(draft,1,photos.length,new Date(),"live")||
     validateStep(draft,2,photos.length,new Date(),"live");break;
   case "location":issue=validateStep(draft,3,photos.length,new Date(),"live");break;
   case "intent":issue=validateStep(draft,4,photos.length,new Date(),"live");break;
   case "personality":issue=validateStep(draft,5,photos.length,new Date(),"live")||
     validateStep(draft,6,photos.length,new Date(),"live");break;
   case "photos":
    if(!photoReady(photos)){issue="Выбери от 3 до 6 готовых фотографий.";break;}
    if(photoChecking)return;
    setPhotoChecking(true);
    void findExactDuplicatePhotoIds(photos).then(ids=>{
      if(ids.length)setHint("Обнаружены одинаковые фотографии. Замени повторяющиеся снимки.");
      else nav(index+1);
    }).catch(()=>setHint("Не удалось проверить повтор фотографий. Попробуй снова."))
      .finally(()=>setPhotoChecking(false));
    return;
   case "face-consent":
    // Consent is only necessary for biometric processing. A user may
    // still save a private draft without granting biometric consent.
    if(!biometricNotice){nav(stages.length-1);return;}
    break;
   case "liveness":
    // No server/provider result exists. Never claim verification or publish.
    nav(stages.length-1);return;
   case "review":return;
  }
  if(issue){setHint(messageFor(issue));return;}
  nav(index+1);
 };
 const stepProps=useMemo(()=>({
  data:draft,patch:p.patch,photos,addPhotos:p.addPhotos,removePhoto:p.removePhoto,
  movePhoto:p.movePhoto,resetDraft:p.resetDraft,deferConsent:true,step:1
 }),[draft,p.patch,photos,p.addPhotos,p.removePhoto,p.movePhoto,p.resetDraft]);
 const step=(n:number)=><RegistrationStep {...stepProps} step={n}/>;
 const savedDraftAllowed=identityReady&&gate.hasLocation&&gate.hasIntent&&
  photoReady(photos)&&!p.serverSaving;

 return <main className="v2-canvas v2-runtime" data-theme={p.theme}
   data-telegram-ui={window.Telegram?.WebApp?"true":"false"} aria-label="Регистрация LUEMI V2">
   <div className="v2-device" data-screen={stage.id}>
     <div className="v2-backdrop" aria-hidden="true"/>
     <header className="v2-header">
       <div className="v2-logo"><img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="LUEMI"/></div>
       <div className="v2-head-actions"><span className="v2-count">{index+1} из {stages.length}</span>
        <button type="button" className="v2-theme" onClick={p.onTheme}
          aria-label={p.theme==="light"?"Включить тёмную тему":"Включить светлую тему"}>
          {p.theme==="light"?<Moon size={17}/>:<Sun size={17}/>}</button></div>
     </header>
     <div className="v2-progress" role="progressbar" aria-label="Прогресс регистрации"
       aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={stages.length}>
       {stages.map((s,i)=><span key={s.id} className={i<=index?"v2-filled":""}/>)}
     </div>
     <section key={stage.id} ref={body} className="v2-body" aria-labelledby="v2-title">
       <div className="v2-eyebrow"><Sparkles size={15}/>{stage.eyebrow}</div>
       <h1 id="v2-title">{stage.title}</h1>
       <p className="v2-subtitle">{stage.subtitle}</p>
       {stage.id==="identity"&&<div className="v2-real-groups">{step(1)}{step(2)}<RegistrationConsent data={draft} patch={p.patch}/></div>}
       {stage.id==="location"&&step(3)}
       {stage.id==="intent"&&step(4)}
       {stage.id==="personality"&&<div className="v2-real-groups">{step(5)}{step(6)}</div>}
       {stage.id==="photos"&&<div className="v2-real-groups">
        {step(7)}
        <div className="v2-note"><ShieldCheck size={18}/>
         Добавь свои чёткие фотографии. Удерживай снимок пальцем, чтобы поменять порядок — первый станет главным.
        </div>
       </div>}
       {stage.id==="face-consent"&&<div className="v2-fields">
        <div className="v2-trust-symbol"><ShieldCheck size={54} strokeWidth={1.6}/></div>
        <h2 className="v2-center-title">Твои фотографии. Твоё лицо.</h2>
        <div className="v2-trust-steps">
          <span><Check size={17}/> Отдельно проверим безопасность фото</span>
          <span><Check size={17}/> Сравним лица на всех снимках</span>
          <span><Check size={17}/> Попросим живое селфи</span>
        </div>
        <p className="v2-footnote" role="status">{engine==="checking"?"Проверяем доступность FaceTrust…":engine==="unavailable"?"Сервер подтвердил: AI FaceTrust ещё не включён. Можно сохранить анкету приватно.":"Состояние проверки неизвестно. Лицо не подтверждено; доступно только приватное сохранение."}</p>
        <label className="v2-consent">
          <input type="checkbox" checked={biometricNotice}
           onChange={e=>setBiometricNotice(e.target.checked)}/>
          <span>Я хочу посмотреть экран селфи-камеры. Понимаю, что сейчас это только предпросмотр без распознавания, записи и передачи биометрии.</span>
        </label>
        <p className="v2-footnote">Это НЕ согласие на будущую обработку лица. Перед настоящей проверкой мы отдельно покажем назначение, получателей данных, сроки хранения и возможность отзыва.</p>
        <button type="button" className="v2-secondary" onClick={()=>nav(stages.length-1)}>
          <LockKeyhole size={17}/> Сохранить анкету без FaceTrust
        </button>
       </div>}
       {stage.id==="liveness"&&<div className="v2-fields">
        <FaceTrustCamera/>
        <button type="button" className="v2-secondary" onClick={()=>nav(stages.length-1)}>
         Продолжить с приватным черновиком <ChevronRight size={17}/>
        </button>
       </div>}
       {stage.id==="review"&&<div className="v2-fields">
        <SimpleProfileReview draft={draft} photos={photos}/>
        
        {p.serverStatus&&<p role="status" className="v2-feedback">{p.serverStatus}</p>}
       </div>}
       {p.storageError&&<p role="alert" className="v2-feedback">
        Не удалось сохранить черновик на устройстве.<button type="button" onClick={p.onRetryStorage}>Повторить</button>
       </p>}
       {p.mediaStatus&&<p role="status" className="v2-feedback">{p.mediaStatus}</p>}
       {hint&&<p role="alert" className="v2-feedback">{hint}</p>}
     </section>
     <footer className="v2-footer">
       {stage.id==="review"?<div className="v2-footer-review">
        <button type="button" className="v2-review-edit" disabled={p.serverSaving}
          onClick={()=>nav(4)}><ArrowLeft size={17}/> Изменить</button>
        <button type="button" className="v2-publish v2-draft-save"
          disabled={!savedDraftAllowed} onClick={p.onSave}>
          <Check size={18}/>{p.serverSaving?"Создаём…":"Создать анкету 💜"}
        </button>
       </div>:<div className="v2-footer-nav">
        <button type="button" className="v2-back" onClick={back}
          aria-label={index===0?"Вернуться на приветствие":"Назад"}><ArrowLeft size={22}/></button>
        <button type="button" className="v2-next" disabled={photoChecking}
          onClick={advance}>
          {photoChecking?"Проверяем фото…":stage.id==="liveness"?"К черновику":stage.id==="face-consent"?
           (biometricNotice?"Посмотреть камеру":"К черновику"):"Продолжить"}<ArrowRight size={18}/>
        </button>
       </div>}
       </footer>
   </div>
 </main>;
}
