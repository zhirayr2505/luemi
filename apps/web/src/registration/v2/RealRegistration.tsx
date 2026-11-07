import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {flushSync} from "react-dom";
import {ArrowRight,Check,Eye,LoaderCircle,Pencil} from "lucide-react";
import {RegistrationReview} from "./RegistrationReview";
import {RegistrationStep,RegistrationConsent,type PhotoItem} from "../Steps";
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
 {id:"about",title:"Расскажи о себе",subtitle:"Твоя история и интересы помогут найти близких по духу людей"},
 {id:"photos",title:"Твои фотографии",subtitle:"От 3 до 6 фото — первое станет главным"},
 {id:"review",title:"Так выглядит твоя анкета",subtitle:"Посмотри на себя глазами других — пока ничего не опубликовано"}
] as const;
type VisualStage={id:string;title:string;subtitle:string};
type IdentityError={field:"name"|"date"|"city"|"about";message:string};
function restoredStage(draft:RegistrationDraft,photos:PhotoItem[]):number{
 // Telegram's first-name prefill alone is not a completed registration step.
 if(!draft.day&&!draft.month&&!draft.year&&!draft.gender&&!draft.city&&
    !photos.length)return 0;
 const target=!nameValid(draft.name)?"identity":
  !birthDateValid(draft.day,draft.month,draft.year)||
    !(draft.gender==="man"||draft.gender==="woman")||!draft.trialConsent?"birthday":
  !selectedCityValid(draft)?"location":
  validateStep(draft,4,photos.length,new Date(),"live")!==null?"intent":
  photos.length>0?"photos":draft.about.trim()||draft.interests.length?"photos":"about";
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
 const [index,setIndex]=useState(()=>p.resumeReview&&photoReady(photos)?stages.length-1:p.restored?restoredStage(draft,photos):0);
 const recoveryApplied=useRef(p.restored);
 const [hint,setHint]=useState("");
 const [photoChecking,setPhotoChecking]=useState(false);
 const [focusedField,setFocusedField]=useState<"name"|"date"|"city"|"about"|"language"|null>(null);
 const [changingStep,setChangingStep]=useState(false);
 const [identityError,setIdentityError]=useState<IdentityError|null>(null);
 const viewportRoot=useRef<HTMLElement|null>(null);
 const device=useRef<HTMLDivElement|null>(null);
 const transitioning=useRef(false);
 const stepAnimation=useRef<Animation|null>(null);
 const isMounted=useRef(true);
 useEffect(()=>{
  isMounted.current=true;
  return()=>{isMounted.current=false;stepAnimation.current?.cancel();};
 },[]);
 useLayoutEffect(()=>{
  const root=viewportRoot.current;
  if(!root)return;
  const viewport=window.visualViewport;
  const shell=root.closest<HTMLElement>(".luemi-shell");
  let frame=0;
  let width=window.innerWidth;
  // A full-height dark shell must not shrink during the IME animation.
  // Only the footer follows the visual viewport; avoids a white gap on exit.
  let fullHeight=Math.max(window.innerHeight,viewport?.height??0,
   window.Telegram?.WebApp?.viewportStableHeight??0);
  shell?.setAttribute("data-registration-shell","true");
  const update=()=>{
   frame=0;
   const measuredBottom=(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight);
   if(Math.abs(window.innerWidth-width)>2){
    width=window.innerWidth;
    fullHeight=Math.max(window.innerHeight,measuredBottom);
   }else if(measuredBottom>=fullHeight-18){
    fullHeight=Math.max(fullHeight,window.innerHeight,measuredBottom);
   }
   const visibleBottom=Math.max(1,Math.min(fullHeight,measuredBottom));
   shell?.style.setProperty("--registration-layout-height",`${Math.round(fullHeight)}px`);
   root.style.setProperty("--registration-visible-bottom",`${Math.round(visibleBottom)}px`);
   root.style.setProperty("--registration-layout-height",`${Math.round(fullHeight)}px`);
  };
  const schedule=()=>{if(!frame)frame=window.requestAnimationFrame(update);};
  update();
  viewport?.addEventListener("resize",schedule);
  viewport?.addEventListener("scroll",schedule);
  window.addEventListener("resize",schedule);
  return()=>{
   if(frame)window.cancelAnimationFrame(frame);
   viewport?.removeEventListener("resize",schedule);
   viewport?.removeEventListener("scroll",schedule);
   window.removeEventListener("resize",schedule);
   if(shell){
    shell.removeAttribute("data-registration-shell");
    shell.style.removeProperty("--registration-layout-height");
   }
   root.style.removeProperty("--registration-visible-bottom");
   root.style.removeProperty("--registration-layout-height");
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
  if(p.resumeReview&&photoReady(photos)){setIndex(stages.length-1);return;}
  setIndex(restoredStage(draft,photos));
 },[p.restored,p.resumeReview,draft,photos,stages.length]);
 /* One sequential motion across all seven registration steps. Android
    WebView must not capture incoming content over an outgoing body. */
 const nav=(target:number)=>{
  const next=Math.min(stages.length-1,Math.max(0,target));
  if(next===index||transitioning.current)return;
  transitioning.current=true;
  const forward=next>index;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animateStep=!reduced&&document.visibilityState==="visible";
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  flushSync(()=>{setChangingStep(true);setFocusedField(null);});
  const leaving=body.current;
  const run=async()=>{
   let exit:Animation|null=null;
   try{
    if(animateStep&&leaving?.animate){
     await new Promise<void>(resolve=>window.setTimeout(resolve,85));
     if(!isMounted.current)return;
     exit=leaving.animate([
      {opacity:1,transform:"translate3d(0,0,0)"},
      {opacity:0,transform:`translate3d(${forward?"-22px":"22px"},0,0)`}
     ],{duration:175,easing:"cubic-bezier(.38,0,.72,.45)",fill:"forwards"});
     stepAnimation.current=exit;
     try{await exit.finished;}catch{return;}
    }
    if(!isMounted.current)return;
    flushSync(()=>{
     setHint("");setIdentityError(null);setFocusedField(null);
     setIndex(next);
    });
    exit?.cancel();
    if(stepAnimation.current===exit)stepAnimation.current=null;
    const entering=body.current;
    if(entering)entering.scrollTop=0;
    if(animateStep&&entering?.animate){
     const entrance=entering.animate([
      {opacity:0,transform:`translate3d(${forward?"22px":"-22px"},0,0)`},
      {opacity:1,transform:"translate3d(0,0,0)"}
     ],{duration:285,easing:"cubic-bezier(.16,.82,.22,1)",fill:"both"});
     stepAnimation.current=entrance;
     try{await entrance.finished;}catch{return;}
     entrance.cancel();
     if(stepAnimation.current===entrance)stepAnimation.current=null;
    }
   }finally{
    exit?.cancel();
    if(isMounted.current){
     transitioning.current=false;
     setChangingStep(false);
    }
   }
  };
  void run();
 };
 const back=()=>{
  if(transitioning.current||photoChecking)return;
  if(focusedField){
   if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
   return;
  }
  if(index===0)p.onExit();else nav(index-1);
 };
 useEffect(()=>{p.registerBack(back);return()=>p.registerBack(()=>{});});
 const advance=()=>{
  if(transitioning.current||photoChecking||changingStep)return;
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
   case "about":issue=validateStep(draft,5,photos.length,new Date(),"live")??validateStep(draft,6,photos.length,new Date(),"live");break;
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
   case "review":p.onSave();return;
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
  photoReady(photos)&&!p.serverSaving&&!changingStep;
 const continueReady=stage.id==="identity"?nameValid(draft.name):
   stage.id==="birthday"?dateValid&&genderReady&&draft.trialConsent:
   stage.id==="location"?locationReady:
   stage.id==="intent"?intentReady:
   stage.id==="about"?validateStep(draft,5,photos.length,new Date(),"live")===null&&validateStep(draft,6,photos.length,new Date(),"live")===null:
   stage.id==="photos"?photoReady(photos):true;
 const fieldConfirmActive=["identity","birthday","location","about"].includes(stage.id)&&focusedField!==null;

 return <main ref={viewportRoot} className="v2-canvas v2-runtime" data-theme={p.theme}
   data-fallback-entry={p.fallbackEntry?"true":undefined}
   data-telegram-ui={window.Telegram?.WebApp?"true":"false"} aria-label="Регистрация LUEMI V2">
   <div ref={device} className="v2-device" data-screen={stage.id} data-field-focus={focusedField!==null?"true":undefined}
      data-step-moving={changingStep?"true":undefined}>
     <div className="v2-backdrop" aria-hidden="true"/>
     <div className="v2-focus-scrim" aria-hidden="true" onPointerDown={()=>{
       if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
     }}/>
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
       className="v2-body" aria-labelledby="v2-title">
       <div className="v2-stage-heading">
         <h1 id="v2-title">{stage.title}</h1>
         <p className="v2-subtitle">{stage.subtitle}</p>
       </div>
       {stage.id==="identity"&&step(1)}
       {stage.id==="birthday"&&<div className="v2-real-groups">{step(2)}<RegistrationConsent data={draft} patch={p.patch}/></div>}
       {stage.id==="location"&&step(3)}
       {stage.id==="intent"&&step(4)}
       {stage.id==="about"&&<div className="v2-real-groups v2-about-groups">
        {step(6,"about")}
        <div className="v2-about-interest-heading"><strong>Что тебе нравится?</strong><span>{draft.interests.length} / 20</span></div>
        {step(5)}
        <p className="v2-about-footnote">Можно дополнить позже в разделе «Раскрой себя».</p>
       </div>}
       {stage.id==="photos"&&<div className="v2-real-groups">{step(7)}</div>}
       {stage.id==="review"&&<RegistrationReview data={draft} photos={photos}/>}
       {p.storageError&&<p role="alert" className="v2-feedback">
        Не удалось сохранить черновик на устройстве.<button type="button" onClick={p.onRetryStorage}>Повторить</button>
       </p>}
       {stage.id==="photos"&&p.mediaStatus&&<p role="status" className="v2-feedback">{p.mediaStatus}</p>}
       {hint&&<p role="alert" className="v2-feedback">{hint}</p>}
     </section>
     <footer className={"v2-footer"+(fieldConfirmActive?" is-focus-confirm":"")}>
       {stage.id==="photos"?<div className="v2-footer-review">
        <button type="button" className="v2-publish v2-draft-save"
          disabled={!savedDraftAllowed||photoChecking} aria-busy={photoChecking} onClick={advance}>
          {photoChecking?<LoaderCircle size={19} className="v2-next-spinner"/>:<Eye size={18}/>}
          {photoChecking?"Проверяем фото…":"Посмотреть анкету"}
        </button>
       </div>:stage.id==="review"?<div className="v2-footer-review v2-review-actions">
        <button type="button" className="v2-review-edit" disabled={p.serverSaving||changingStep}
          onClick={()=>nav(index-1)}><Pencil size={17}/> Редактировать</button>
        <button type="button" className="v2-publish v2-review-create" disabled={!savedDraftAllowed||p.serverSaving}
          aria-busy={p.serverSaving} onClick={advance}>
          {p.serverSaving?<LoaderCircle size={18} className="v2-next-spinner"/>:<Check size={18}/>}
          {p.serverSaving?"Создаём…":"Создать анкету"}
        </button>
       </div>:<>
       <div className={"v2-footer-nav"+(fieldConfirmActive?" is-focus-confirm":"")}>
       <button type="button" className={"v2-next"+(fieldConfirmActive?" v2-next-confirm":"")+(!continueReady?" is-incomplete":"")} disabled={photoChecking||changingStep}
          aria-label={fieldConfirmActive?"Подтвердить поле":"Продолжить"}
         aria-busy={photoChecking||changingStep}
         aria-disabled={photoChecking||changingStep||undefined}
          onPointerDown={e=>{if(fieldConfirmActive)e.preventDefault();}}
          onClick={()=>{
            if(fieldConfirmActive){
              if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
              return;
            }
            advance();
          }}>
          {fieldConfirmActive?<Check size={25} strokeWidth={2.3}/>:<>
            {photoChecking?"Проверяем фото…":"Продолжить"}
            {photoChecking||changingStep?<LoaderCircle size={18} className="v2-next-spinner"/>:<ArrowRight size={18}/>}
          </>}
        </button>
       </div></>}
       </footer>
   </div>
 </main>;
}
