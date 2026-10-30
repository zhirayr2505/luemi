import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,Check,ChevronRight,LockKeyhole,ShieldCheck} from "lucide-react";
import {RegistrationStep,RegistrationConsent,type PhotoItem} from "../Steps";
import {SimpleProfileReview} from "../SimpleProfileReview";
import {OptionalProfileDetails} from "../OptionalProfileDetails";
import {birthDateValid,nameValid,selectedCityValid,validateStep,type RegistrationDraft} from "../model";
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
const visualStages=[
 {id:"identity",title:"Как тебя зовут?",subtitle:"Это будет видно другим пользователям"},
 {id:"birthday",title:"Дата рождения",subtitle:"Твой возраст будет виден другим пользователям"},
 {id:"location",title:"Где ты сейчас?",subtitle:"Твоё местоположение помогает находить людей рядом"},
 {id:"intent",title:"Кого ты хочешь встретить?",subtitle:"Настрой знакомства так, как тебе нравится"},
 {id:"languages",title:"Какие языки ты знаешь?",subtitle:"Это поможет находить людей со схожими интересами"},
 {id:"personality",title:"Расскажи о себе",subtitle:"Несколько слов о себе и о том, что тебе интересно"},
 {id:"photos",title:"Добавь свои фото",subtitle:"Загрузи от 3 до 6 фотографий"},
 {id:"main-photo",title:"Выбери главное фото",subtitle:"Оно будет показываться в твоей анкете первым"},
 {id:"review",title:"Проверь свою анкету",subtitle:"Убедись, что всё правильно"}
] as const;
type VisualStage={id:string;title:string;subtitle:string};
type IdentityError={field:"name"|"date"|"city"|"about";message:string};
function dateIssue(draft:RegistrationDraft,today=new Date()):string|null{
 if(!draft.day||!draft.month||!draft.year)return "Введи дату рождения";
 const y=Number(draft.year),m=Number(draft.month),d=Number(draft.day);
 const date=new Date(Date.UTC(y,m-1,d));
 if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||
   y<1900||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)
   return "Проверь дату рождения";
 const todayDate=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
 if(date>todayDate)return "Проверь дату рождения";
 const cutoff=new Date(Date.UTC(today.getUTCFullYear()-18,today.getUTCMonth(),today.getUTCDate()));
 return date>cutoff?"LUEMI доступен с 18 лет":null;
}
export function RealRegistrationV2(p:Props){
 const {draft,photos}=p;
 const instantPublication=p.publicationEnabled&&import.meta.env.VITE_LUEMI_INSTANT_PUBLICATION_UI==="1";
 // Private registration never requests a non-operational biometric selfie.
 // Keep the full FaceTrust workflow available only to separately approved publication.
 const stages=useMemo<VisualStage[]>(()=>p.publicationEnabled&&!instantPublication?
  [...visualStages.slice(0,-1),
   {id:"face-consent",title:"Знакомства с доверием",subtitle:"Расскажем, как проходит проверка лица"},
   {id:"liveness",title:"Это действительно ты?",subtitle:"Короткая проверка через камеру"},
   visualStages[visualStages.length-1]]:[...visualStages],
  [p.publicationEnabled,instantPublication]);
 const [index,setIndex]=useState(()=>p.resumeReview?stages.length-1:0);
 const recoveryApplied=useRef(false);
 const [biometricNotice,setBiometricNotice]=useState(false);
 const [engine,setEngine]=useState<"checking"|"unavailable"|"error">("checking");
 const [hint,setHint]=useState("");
 const [photoChecking,setPhotoChecking]=useState(false);
 const [focusedField,setFocusedField]=useState<"name"|"date"|"city"|"about"|"language"|null>(null);
 const [identityError,setIdentityError]=useState<IdentityError|null>(null);
 const viewportRoot=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const root=viewportRoot.current;
  const viewport=window.visualViewport;
  if(!root||!viewport)return;
  let frame=0;
  const update=()=>{
   frame=0;
   // Use the visual viewport as the single source of truth. Android WebView
   // can keep the layout viewport at its pre-keyboard height while the visible
   // area changes; neither the footer nor an editor's height feeds this value.
   root.style.setProperty("--registration-visible-height",`${viewport.height}px`);
   root.style.setProperty("--registration-visible-bottom",`${viewport.offsetTop+viewport.height}px`);
   root.style.setProperty("--registration-layout-height",`${window.innerHeight}px`);
  };
  const schedule=()=>{if(!frame)frame=window.requestAnimationFrame(update);};
  update();
  viewport.addEventListener("resize",schedule);
  viewport.addEventListener("scroll",schedule);
  window.addEventListener("resize",schedule);
  return()=>{
   if(frame)window.cancelAnimationFrame(frame);
   viewport.removeEventListener("resize",schedule);
   viewport.removeEventListener("scroll",schedule);
   window.removeEventListener("resize",schedule);
  };
 },[]);
 useEffect(()=>{
  // Android WebView can restore the last focused input when a Mini App is
  // reopened. Registration must start as a clean screen, without reopening
  // the keyboard and hiding the first fields behind the footer.
  const active=document.activeElement;
  if(active instanceof HTMLElement)active.blur();
  setFocusedField(null);
 },[]);
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
 const handleFieldFocus=useCallback((field:"name"|"date"|"city"|"about"|"language"|null)=>{
  setFocusedField(field);
 },[]);
 const dateValid=birthDateValid(draft.day,draft.month,draft.year);
 const identityReady=nameValid(draft.name)&&dateValid&&!!draft.gender&&draft.trialConsent;
 const locationReady=selectedCityValid(draft);
 const intentReady=validateStep(draft,4,photos.length,new Date(),"live")===null;
 // Restore the next incomplete real-data stage once local persistence has
 // finished loading; never blindly restart from the first question.
 useEffect(()=>{
  if(!p.restored||recoveryApplied.current)return;
  recoveryApplied.current=true;
  if(p.resumeReview)return;
  const firstIncomplete=!nameValid(draft.name)?"identity":
   !dateValid||!draft.gender||!draft.trialConsent?"birthday":
   !locationReady?"location":!intentReady?"intent":
   !draft.about.trim()?"personality":!photoReady(photos)?"photos":"review";
  setIndex(Math.max(0,stages.findIndex(item=>item.id===firstIncomplete)));
 },[p.restored,p.resumeReview,draft,photos,dateValid,locationReady,intentReady,stages]);
 const nav=(target:number)=>{setHint("");setIdentityError(null);setFocusedField(null);setIndex(Math.min(stages.length-1,Math.max(0,target)));body.current?.scrollTo({top:0,behavior:"instant"});};
 const back=()=>{if(index===0)p.onExit();else nav(index-1);};
 useEffect(()=>{p.registerBack(back);return()=>p.registerBack(()=>{});});
 const advance=()=>{
  let issue:string|null=null;
  switch(stage.id){
   case "identity":
    if(!nameValid(draft.name)){
      setIdentityError({field:"name",message:draft.name.trim()?"Имя: 2–48 букв, разрешены пробелы, дефис и апостроф.":"Введи имя"});
      setHint("");return;
    }
    break;
   case "birthday":
    {const birthdayIssue=dateIssue(draft);
     if(birthdayIssue){setIdentityError({field:"date",message:birthdayIssue});setHint("");return;}}
    if(!draft.gender){issue="Выбери вариант пола.";break;}
    if(!draft.trialConsent){issue="Подтверди условия регистрации.";break;}
    break;
   case "location":{
    issue=validateStep(draft,3,photos.length,new Date(),"live");
    if(issue){setIdentityError({field:"city",message:selectedCityValid(draft)?issue:"Выбери город из списка"});setHint("");return;}
    break;
   }
   case "intent":issue=validateStep(draft,4,photos.length,new Date(),"live");break;
   case "languages":break;
   case "personality":
    issue=validateStep(draft,6,photos.length,new Date(),"live");
    if(issue){setIdentityError({field:"about",message:issue});setHint("");return;}
    break;
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
   case "main-photo":break;
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
  movePhoto:p.movePhoto,resetDraft:p.resetDraft,deferConsent:true,step:1,
  fieldError:identityError,clearFieldError:(field:"name"|"date"|"city"|"about")=>{
    setIdentityError(previous=>previous?.field===field?null:previous);
  },onFieldFocus:handleFieldFocus
  }),[draft,p.patch,photos,p.addPhotos,p.removePhoto,p.movePhoto,p.resetDraft,identityError,handleFieldFocus]);
 const step=(n:number,personalityPart?:"about"|"languages")=><RegistrationStep {...stepProps} step={n} personalityPart={personalityPart}/>;
 const savedDraftAllowed=identityReady&&locationReady&&intentReady&&
  photoReady(photos)&&!p.serverSaving;
 const continueReady=stage.id==="identity"?nameValid(draft.name):
   stage.id==="birthday"?dateValid&&!!draft.gender&&draft.trialConsent:
   stage.id==="location"?locationReady:
   stage.id==="intent"?intentReady:
   stage.id==="personality"?validateStep(draft,6,photos.length,new Date(),"live")===null:
   stage.id==="photos"||stage.id==="main-photo"?photoReady(photos):true;
 const fieldConfirmActive=["identity","birthday","location","languages","personality"].includes(stage.id)&&focusedField!==null;

 return <main ref={viewportRoot} className="v2-canvas v2-runtime" data-theme={p.theme}
   data-telegram-ui={window.Telegram?.WebApp?"true":"false"} aria-label="Регистрация LUEMI V2">
   <div className="v2-device" data-screen={stage.id} data-field-focus={focusedField!==null?"true":undefined}>
     <div className="v2-backdrop" aria-hidden="true"/>
     <header className="v2-header">
       <button type="button" className="v2-header-back" onClick={back}
         aria-label={index===0?"Вернуться на приветствие":"Назад"}><ArrowLeft size={22}/></button>
       <div className="v2-progress" role="progressbar" aria-label="Прогресс регистрации"
         aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={stages.length}>
         {stages.map((s,i)=><span key={s.id} className={i<=index?"v2-filled":""}/>)}
       </div>
       <span className="v2-count" aria-label={`Шаг ${index+1} из ${stages.length}`}>{index+1}/{stages.length}</span>
     </header>
     <section key={stage.id} ref={body} className="v2-body v2-stage-transition" aria-labelledby="v2-title">
       <div className="v2-focus-scrim" aria-hidden="true" onPointerDown={()=>{
         if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
         handleFieldFocus(null);
       }}/>
       <h1 id="v2-title">{stage.title}</h1>
       <p className="v2-subtitle">{stage.subtitle}</p>
       {stage.id==="identity"&&step(1)}
       {stage.id==="birthday"&&<div className="v2-real-groups">{step(2)}<RegistrationConsent data={draft} patch={p.patch}/></div>}
       {stage.id==="location"&&step(3)}
       {stage.id==="intent"&&step(4)}
       {stage.id==="languages"&&step(6,"languages")}
       {stage.id==="personality"&&<div className="v2-real-groups">{step(6,"about")}{step(5)}</div>}
       {stage.id==="photos"&&<div className="v2-real-groups">
        {step(7)}
        <div className="v2-note"><ShieldCheck size={18}/>
         Добавь свои чёткие фотографии. Удерживай снимок пальцем, чтобы поменять порядок — первый станет главным.
        </div>
       </div>}
       {stage.id==="main-photo"&&<div className="v2-main-photo-picker">
         {photos.filter(photo=>photo.status==="ready").map((photo,i)=><button type="button" key={photo.id}
           className={"v2-main-photo-option"+(i===0?" is-main":"")}
           onClick={()=>p.movePhoto(i,0)} aria-label={`Выбрать фото ${i+1} главным`}>
           <img src={photo.src} alt={`Фотография ${i+1}`}/>
           {i===0&&<span>Главное фото <Check size={14}/></span>}
         </button>)}
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
        <OptionalProfileDetails data={draft} patch={p.patch}/>
        
        {p.serverStatus&&<p role="status" className="v2-feedback">{p.serverStatus}</p>}
       </div>}
       {p.storageError&&<p role="alert" className="v2-feedback">
        Не удалось сохранить черновик на устройстве.<button type="button" onClick={p.onRetryStorage}>Повторить</button>
       </p>}
       {(["photos","main-photo","review"].includes(stage.id))&&p.mediaStatus&&<p role="status" className="v2-feedback">{p.mediaStatus}</p>}
       {hint&&<p role="alert" className="v2-feedback">{hint}</p>}
     </section>
     <footer className={"v2-footer"+(fieldConfirmActive?" is-focus-confirm":"")}>
       {stage.id==="review"?<div className="v2-footer-review">
        <button type="button" className="v2-publish v2-draft-save"
          disabled={!savedDraftAllowed} onClick={p.onSave}>
          <Check size={18}/>{p.serverSaving?"Создаём…":"Создать анкету 💜"}
        </button>
       </div>:<div className={"v2-footer-nav"+(fieldConfirmActive?" is-focus-confirm":"")}>
       <button type="button" className={"v2-next"+(fieldConfirmActive?" v2-next-confirm":"")+(!continueReady?" is-incomplete":"")} disabled={photoChecking}
          aria-label={fieldConfirmActive?"Подтвердить поле":"Продолжить"}
         aria-disabled={!continueReady||undefined}
          onPointerDown={e=>{if(fieldConfirmActive)e.preventDefault();}}
          onClick={()=>{
            if(fieldConfirmActive){
              if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
              handleFieldFocus(null);
              return;
            }
            advance();
          }}>
          {fieldConfirmActive?<Check size={25} strokeWidth={2.3}/>:<>{photoChecking?"Проверяем фото…":stage.id==="liveness"?"К черновику":stage.id==="face-consent"?
           (biometricNotice?"Посмотреть камеру":"К черновику"):"Продолжить"}<ArrowRight size={18}/></>}
        </button>
       </div>}
       </footer>
   </div>
 </main>;
}
