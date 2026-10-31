import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {flushSync} from "react-dom";
import {ArrowRight,Check,ShieldCheck} from "lucide-react";
import {RegistrationStep,RegistrationConsent,type PhotoItem} from "../Steps";
import {SimpleProfileReview} from "../SimpleProfileReview";
import {OptionalProfileDetails} from "../OptionalProfileDetails";
import {birthDateValid,nameValid,selectedCityValid,validateStep,type RegistrationDraft} from "../model";
import {findExactDuplicatePhotoIds} from "./duplicate-photos";
import "./preview.css";
import "./runtime.css";

interface Props{
 fallbackEntry:boolean;
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
 {id:"review",title:"Проверь свою анкету",subtitle:"Убедись, что всё правильно"}
] as const;
type VisualStage={id:string;title:string;subtitle:string};
type RegistrationViewTransition={finished:Promise<void>};
type ViewTransitionDocument=Document&{startViewTransition?:(update:()=>void)=>RegistrationViewTransition};
type IdentityError={field:"name"|"date"|"city"|"about";message:string};
function restoredStage(draft:RegistrationDraft,photos:PhotoItem[]):number{
 // Telegram's first-name prefill alone is not a completed registration step.
 if(!draft.day&&!draft.month&&!draft.year&&!draft.gender&&!draft.city&&
    !draft.about.trim()&&!photos.length)return 0;
 const target=!nameValid(draft.name)?"identity":
  !birthDateValid(draft.day,draft.month,draft.year)||
    !(draft.gender==="man"||draft.gender==="woman")||!draft.trialConsent?"birthday":
  !selectedCityValid(draft)?"location":
  validateStep(draft,4,photos.length,new Date(),"live")!==null?"intent":
  !draft.about.trim()?"personality":!photoReady(photos)?"photos":"review";
 return visualStages.findIndex(item=>item.id===target);
}
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
 const stages:readonly VisualStage[]=visualStages;
 const [index,setIndex]=useState(()=>p.resumeReview?stages.length-1:p.restored?restoredStage(draft,photos):0);
 const recoveryApplied=useRef(p.restored);
 const [hint,setHint]=useState("");
 const [photoChecking,setPhotoChecking]=useState(false);
 const [detailsOpen,setDetailsOpen]=useState(false);
 const [focusedField,setFocusedField]=useState<"name"|"date"|"city"|"about"|"language"|null>(null);
 const [fallbackMotion,setFallbackMotion]=useState<"forward"|"back"|null>(null);
 const [identityError,setIdentityError]=useState<IdentityError|null>(null);
 const viewportRoot=useRef<HTMLElement|null>(null);
 const device=useRef<HTMLDivElement|null>(null);
 const transitioning=useRef(false);
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
 const stage=stages[index];
 const body=useRef<HTMLElement|null>(null);
 const handleFieldFocus=useCallback((field:"name"|"date"|"city"|"about"|"language"|null)=>{
  setFocusedField(field);
 },[]);
 const dateValid=birthDateValid(draft.day,draft.month,draft.year);
 const genderReady=draft.gender==="man"||draft.gender==="woman";
 const identityReady=nameValid(draft.name)&&dateValid&&genderReady&&draft.trialConsent;
 const locationReady=selectedCityValid(draft);
 const intentReady=validateStep(draft,4,photos.length,new Date(),"live")===null;
 // Restore the next incomplete real-data stage once local persistence has
 // finished loading; never blindly restart from the first question.
 useEffect(()=>{
  if(!p.restored||recoveryApplied.current)return;
  recoveryApplied.current=true;
  if(p.resumeReview)return;
  setIndex(restoredStage(draft,photos));
 },[p.restored,p.resumeReview,draft,photos]);
 const nav=(target:number)=>{
  const next=Math.min(stages.length-1,Math.max(0,target));
  if(next===index||transitioning.current)return;
  const viewDocument=document as ViewTransitionDocument;
  const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canTransition=!focusedField&&document.visibilityState==="visible"&&!reducedMotion;
  const nativeTransition=canTransition&&viewDocument.startViewTransition;
  const update=()=>flushSync(()=>{
   setHint("");setIdentityError(null);setFocusedField(null);setDetailsOpen(false);
   setFallbackMotion(canTransition&&!nativeTransition?(next>index?"forward":"back"):null);
   setIndex(next);
  });
  if(!nativeTransition){
   update();return;
  }
  const root=document.documentElement;
  root.style.setProperty("--luemi-step-enter",next>index?"28px":"-28px");
  root.style.setProperty("--luemi-step-exit",next>index?"-28px":"28px");
  root.dataset.luemiTransition="true";
  transitioning.current=true;
  const settle=()=>{
   transitioning.current=false;
   root.style.removeProperty("--luemi-step-enter");
   root.style.removeProperty("--luemi-step-exit");
   delete root.dataset.luemiTransition;
  };
  try{
   const transition=nativeTransition.call(viewDocument,update);
   void transition.finished.then(settle,settle);
  }catch{settle();update();}
 };
 const back=()=>{
  if(detailsOpen){setDetailsOpen(false);return;}
  if(index===0)p.onExit();else nav(index-1);
 };
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
    if(!genderReady){issue="Выбери пол.";break;}
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
   stage.id==="birthday"?dateValid&&genderReady&&draft.trialConsent:
   stage.id==="location"?locationReady:
   stage.id==="intent"?intentReady:
   stage.id==="personality"?validateStep(draft,6,photos.length,new Date(),"live")===null:
   stage.id==="photos"?photoReady(photos):true;
 const fieldConfirmActive=["identity","birthday","location","languages","personality"].includes(stage.id)&&focusedField!==null;

 return <main ref={viewportRoot} className="v2-canvas v2-runtime" data-theme={p.theme}
   data-fallback-entry={p.fallbackEntry?"true":undefined}
   data-telegram-ui={window.Telegram?.WebApp?"true":"false"} aria-label="Регистрация LUEMI V2">
   <div ref={device} className="v2-device" data-screen={stage.id} data-field-focus={focusedField!==null?"true":undefined}>
     <div className="v2-backdrop" aria-hidden="true"/>
     <header className="v2-header">
       <img src="/assets/brand/wordmark_original_raster_alpha_W06.webp"
         className="v2-header-logo" alt="LUEMI" draggable={false}/>
       <div className="v2-progress" role="progressbar" aria-label="Прогресс регистрации"
         aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={stages.length}
         aria-valuetext={`Шаг ${index+1} из ${stages.length}`}>
         <span className="v2-progress-fill" style={{transform:`scaleX(${(index+1)/stages.length})`}}/>
       </div>
     </header>
     <section key={stage.id} ref={body}
       className={"v2-body"+(fallbackMotion?` v2-fallback-${fallbackMotion}`:"")} aria-labelledby="v2-title">
       <div className="v2-focus-scrim" aria-hidden="true" onPointerDown={()=>{
         if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
         handleFieldFocus(null);
       }}/>
       <div className="v2-stage-heading">
         <h1 id="v2-title">{stage.title}</h1>
         <p className="v2-subtitle">{stage.subtitle}</p>
       </div>
       {stage.id==="identity"&&step(1)}
       {stage.id==="birthday"&&<div className="v2-real-groups">{step(2)}<RegistrationConsent data={draft} patch={p.patch}/></div>}
       {stage.id==="location"&&step(3)}
       {stage.id==="intent"&&step(4)}
       {stage.id==="languages"&&step(6,"languages")}
       {stage.id==="personality"&&<div className="v2-real-groups">
        {step(6,"about")}{step(5)}
        <OptionalProfileDetails data={draft} patch={p.patch} open={detailsOpen}
          onOpenChange={setDetailsOpen} overlayHost={device.current}/>
       </div>}
       {stage.id==="photos"&&<div className="v2-real-groups">
        {step(7)}
        <div className="v2-note"><ShieldCheck size={18}/>
         Добавь свои чёткие фотографии. Потяни за значок на снимке или нажми корону, чтобы выбрать главное фото.
        </div>
       </div>}
       {stage.id==="review"&&<div className="v2-fields">
        <SimpleProfileReview draft={draft} photos={photos}/>
        {p.serverStatus&&<p role="status" className="v2-feedback">{p.serverStatus}</p>}
       </div>}
       {p.storageError&&<p role="alert" className="v2-feedback">
        Не удалось сохранить черновик на устройстве.<button type="button" onClick={p.onRetryStorage}>Повторить</button>
       </p>}
       {(["photos","review"].includes(stage.id))&&p.mediaStatus&&<p role="status" className="v2-feedback">{p.mediaStatus}</p>}
       {hint&&<p role="alert" className="v2-feedback">{hint}</p>}
     </section>
     <footer className={"v2-footer"+(fieldConfirmActive?" is-focus-confirm":"")}>
       {stage.id==="review"?<div className="v2-footer-review">
        <button type="button" className="v2-publish v2-draft-save"
          disabled={!savedDraftAllowed} onClick={p.onSave}>
          <Check size={18}/>{p.serverSaving?"Создаём…":"Создать анкету 💜"}
        </button>
       </div>:<>
       <div className={"v2-footer-nav"+(fieldConfirmActive?" is-focus-confirm":"")}>
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
          {fieldConfirmActive?<Check size={25} strokeWidth={2.3}/>:<>{photoChecking?"Проверяем фото…":"Продолжить"}<ArrowRight size={18}/></>}
        </button>
       </div></>}
       </footer>
   </div>
 </main>;
}
