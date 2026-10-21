import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {ArrowRight,Moon,Sun} from "lucide-react";
import {GlassArrow} from "./ui/Glass";
import type { BootstrapResponse, HealthResponse } from "@luemi/contracts";
import { newDraft, steps, validateStep, type RegistrationDraft } from "./registration/model";
import { RegistrationStep, SelectedInterests, type PhotoItem } from "./registration/Steps";
import {localScope,loadDraftSnapshot,saveDraftSnapshot,clearDraftSnapshot,type StorageCode} from "./registration/local-draft";
import {preparePhotoPreview} from "./registration/photo-preview";
import {DiscoveryApp} from "./discovery/DiscoveryApp";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        onEvent?: (event:string,handler:()=>void) => void;
        offEvent?: (event:string,handler:()=>void) => void;
        viewportStableHeight?: number;
        version?: string;
        isVersionAtLeast?: (version: string) => boolean;
        requestFullscreen?: () => void;
        disableVerticalSwipes?: () => void;
        HapticFeedback?: {selectionChanged?:()=>void};
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        colorScheme?: "dark" | "light";
        ready?: () => void;
        expand?: () => void;
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (handler: () => void) => void;
          offClick: (handler: () => void) => void;
        };
      };
    };
  }
}

type AuthState = "connecting" | "outside-telegram" | "authorized" | "needs-bot" | "error";
type ThemeChoice = "light" | "dark";
const logoSrc = "/assets/brand/wordmark_original_raster_alpha_W06.webp";

/** Decode the exact brand raster before showing a screen that depends on it. */
function prepareBrandImage(signal: AbortSignal): Promise<void> {
  return new Promise((resolve,reject) => {
    const image = new Image();
    let finished = false;
    const finish = (error?: Error) => {
      if(finished) return;
      finished = true;
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
      if(error) reject(error);
      else resolve();
    };
    const abort = () => finish(new Error("Brand preparation cancelled"));
    if(signal.aborted) { abort(); return; }
    signal.addEventListener("abort",abort,{once:true});
    image.onload = () => {
      if(typeof image.decode === "function") {
        void image.decode().then(() => finish(), () => finish(new Error("Cannot decode LUEMI logo")));
      } else {
        finish();
      }
    };
    image.onerror = () => finish(new Error("Cannot load LUEMI logo"));
    image.src = logoSrc;
  });
}

export function App() {
  const [auth,setAuth] = useState<AuthState>("connecting");
  const [introElapsed,setIntroElapsed] = useState(false);
  const [visualReady,setVisualReady] = useState(false);
  const [welcomeExiting,setWelcomeExiting] = useState(false);
  const transitionTimer = useRef<number | null>(null);
  const [phase,setPhase] = useState<"welcome"|"form">("welcome");
  const [demoOpen,setDemoOpen] = useState(false);
  const [scope] = useState(()=>localScope());
  const [step,setStep] = useState(1);
  const [draft,setDraft] = useState<RegistrationDraft>(()=>newDraft());
  const [photos,setPhotos] = useState<PhotoItem[]>([]);
  const ownedUrls = useRef<string[]>([]);
  const photoJobs=useRef(new Map<string,AbortController>());
  const photoTimers=useRef(new Map<string,number>());
  const photoQueue=useRef<Promise<void>>(Promise.resolve());
  const photoIds=useRef(new Set<string>());
  const photoGeneration=useRef(0);
  const [photosRestored,setPhotosRestored] = useState(false);
  const draftId=useRef<string>(crypto.randomUUID());
  const revision=useRef(0);
  const saveSequence=useRef(0);
  const persistEnabled=useRef(false);
  const retryKind=useRef<"load"|"save"|"clear">("load");
  const [loadRetry,setLoadRetry]=useState(0);
  const [saveRetry,setSaveRetry]=useState(0);
  const [storageState,setStorageState]=useState<"loading"|"idle"|"dirty"|"saving"|"saved"|"error">("loading");
  const [storageCode,setStorageCode]=useState<StorageCode|null>(null);
  const [error,setError] = useState("");
  const [theme,setTheme] = useState<ThemeChoice>(()=>window.Telegram?.WebApp?.colorScheme==="dark"?"dark":"light");
  const rootRef=useRef<HTMLElement>(null);
  const contentRef=useRef<HTMLDivElement>(null);
  const discoveryBackRef=useRef<()=>void>(()=>{});
  const activeTheme=theme;
  const patch = useCallback((change:Partial<RegistrationDraft>)=>{
    persistEnabled.current=true;
    setStorageState("dirty");
    setDraft(prev=>({...prev,...change}));
    setError("");
  },[]);
  useEffect(()=>{
    // Telegram's native white loading screen must disappear as soon as the
    // app shell can paint. The separate branded intro remains visible.
    const webApp=window.Telegram?.WebApp;
    const frame=window.requestAnimationFrame(()=>{
      webApp?.ready?.();
      webApp?.expand?.();
      try {
        if(webApp?.isVersionAtLeast?.("8.0")) webApp.requestFullscreen?.();
        webApp?.disableVerticalSwipes?.();
      } catch {
        // Unsupported clients retain Telegram's expanded, non-fullscreen UI.
      }
    });
    return ()=>{
      window.cancelAnimationFrame(frame);
      if(transitionTimer.current!==null)window.clearTimeout(transitionTimer.current);
    };
  },[]);
  useEffect(()=>{
    if(!visualReady)return;
    const timer=window.setTimeout(()=>setIntroElapsed(true),1950);
    return ()=>window.clearTimeout(timer);
  },[visualReady]);
  useEffect(()=>{
    const webApp=window.Telegram?.WebApp;
    try{
      const background=activeTheme==="dark"?"#181320":"#fffbfd";
      webApp?.setHeaderColor?.(background);
      webApp?.setBackgroundColor?.(background);
    } catch {
      // Older clients do not support every color-setting method.
    }
  },[activeTheme]);
  useEffect(()=>{
    const webApp = window.Telegram?.WebApp;
    const initData = webApp?.initData;
    const controller = new AbortController();
    let disposed = false;
    // A failed network request must never leave a motionless endless loader.
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    void (async () => {
      try {
        // The brand image, fonts and verified Telegram identity are actual
        // critical resources. Run them in parallel, never invent a percentage.
        const visualsReady = Promise.all([
          prepareBrandImage(controller.signal),
          document.fonts.ready
        ]).then(()=>{if(!disposed)setVisualReady(true);});
        const identityReady: Promise<BootstrapResponse | null> = !initData
          ? Promise.resolve(null)
          : (async () => {
              const live = await fetch("/api/health/live",{signal:controller.signal});
              if(!live.ok || ((await live.json()) as HealthResponse).status!=="ok")
                throw new Error("API unavailable");
              const response = await fetch("/api/auth/telegram",{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({initData}),
                signal:controller.signal
              });
              if(response.status===503) return null;
              if(!response.ok) throw new Error("Telegram authorization failed");
              return (await response.json()) as BootstrapResponse;
            })();
        const [,user] = await Promise.all([visualsReady,identityReady]);
        if(disposed) return;
        if(!initData) {
          setAuth("outside-telegram");
        } else if(user===null) {
          setAuth("needs-bot");
        } else {
          setDraft(current=>({...current,name:current.name||user.user.firstName}));
          setAuth("authorized");
          // Fullscreen and expand are requested when the shell first paints.
        }
      } catch {
        if(!disposed) setAuth("error");
      } finally {
        window.clearTimeout(timeoutId);
        // Telegram.ready is sent immediately after the first app-shell paint.
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  },[]);
  // Keep the *outer* Mini App at its original fullscreen height so its
  // footer cannot jump above the keyboard. Only the form scroll area shrinks.
  useEffect(()=>{
    const vv=window.visualViewport;
    let stableHeight=Math.max(window.innerHeight,vv?.height??0),stableWidth=window.innerWidth;
    let focusTimer:number|null=null;
    const webApp=window.Telegram?.WebApp;
    const update=()=>{
      const visible=vv?.height??window.innerHeight;
      if(Math.abs(window.innerWidth-stableWidth)>40){
        stableWidth=window.innerWidth;stableHeight=webApp?.viewportStableHeight||window.innerHeight;
      }else if(visible>stableHeight-30)stableHeight=Math.max(stableHeight,visible);
      const overlay=Math.max(0,stableHeight-visible);
      const keyboard=overlay>145;
      rootRef.current?.style.setProperty("--app-height",stableHeight+"px");
      rootRef.current?.style.setProperty("--keyboard-overlay",keyboard?overlay+"px":"0px");
      rootRef.current?.setAttribute("data-keyboard",keyboard?"open":"closed");
    };
    update();
    const onFocus=(event:FocusEvent)=>{
      const field=event.target;
      if(!(field instanceof HTMLInputElement)&&!(field instanceof HTMLTextAreaElement))return;
      if(focusTimer!==null)window.clearTimeout(focusTimer);
      focusTimer=window.setTimeout(()=>{
        focusTimer=null;
        if(document.activeElement===field)field.scrollIntoView({block:"center",behavior:"smooth"});
      },190);
    };
    vv?.addEventListener("resize",update);vv?.addEventListener("scroll",update);
    window.addEventListener("resize",update);
    webApp?.onEvent?.("viewportChanged",update);
    document.addEventListener("focusin",onFocus);
    return ()=>{
      vv?.removeEventListener("resize",update);vv?.removeEventListener("scroll",update);
      window.removeEventListener("resize",update);
      webApp?.offEvent?.("viewportChanged",update);
      if(focusTimer!==null)window.clearTimeout(focusTimer);
      document.removeEventListener("focusin",onFocus);
    };
  },[]);
  // Restore text and photo manifest from the same validated revision.
  // Legacy import is read-only until a complete v2 write has committed.
  useEffect(()=>{
    let disposed=false;
    const controller=new AbortController(),generation=photoGeneration.current;
    if(!scope){retryKind.current="load";setStorageState("error");setStorageCode("scope");return;}
    setStorageState("loading");
    void loadDraftSnapshot(scope).then(async result=>{
      if(disposed)return;
      if(!result.ok){
        retryKind.current="load";setStorageCode(result.code);setStorageState("error");return;
      }
      const snapshot=result.snapshot;
      if(snapshot){
        draftId.current=snapshot.draftId;
        revision.current=snapshot.revision;
        setDraft(snapshot.draft);
        setStep(snapshot.step);
      }
      const restoredPhotos:PhotoItem[]=[];
      for(const item of snapshot?.photos??[]){
        if(disposed||generation!==photoGeneration.current)break;
        let preview=item.preview;
        if(!preview){
          const job=photoQueue.current.then(async()=>{preview=await preparePhotoPreview(item.file,controller.signal);});
          photoQueue.current=job.catch(()=>{});
          try{await job;}catch{
            if(disposed||controller.signal.aborted)break;
            restoredPhotos.push({...item,src:"",status:"error"});continue;
          }
        }
        if(disposed||generation!==photoGeneration.current)break;
        const src=URL.createObjectURL(preview!);ownedUrls.current.push(src);
        restoredPhotos.push({...item,preview,src,status:"ready"});
      }
      if(disposed||generation!==photoGeneration.current||photoIds.current.size){
        for(const photo of restoredPhotos)if(photo.src){
          URL.revokeObjectURL(photo.src);
          ownedUrls.current=ownedUrls.current.filter(url=>url!==photo.src);
        }
        if(!disposed){setPhotosRestored(true);setStorageState("idle");}
        return;
      }
      photoIds.current=new Set(restoredPhotos.map(p=>p.id));
      setPhotos(restoredPhotos);
      // Only a validated legacy pair needs automatic migration.
      persistEnabled.current=result.source==="legacy";
      setStorageCode(null);
      setStorageState(result.source==="legacy"?"dirty":"idle");
      setPhotosRestored(true);
    }).catch(()=>{
      if(!disposed){retryKind.current="load";setStorageCode("io");setStorageState("error");}
    });
    return ()=>{disposed=true;controller.abort();};
  },[scope,loadRetry]);
  useEffect(()=>{
    if(!photosRestored||!scope||!persistEnabled.current)return;
    const current=++saveSequence.current;
    const newRevision=++revision.current;
    setStorageState("dirty");
    const timer=window.setTimeout(()=>{
      if(current!==saveSequence.current)return;
      setStorageState("saving");
      void saveDraftSnapshot(scope,draftId.current,newRevision,draft,step,photos).then(result=>{
        if(current!==saveSequence.current)return;
        if(result.ok){setStorageState("saved");setStorageCode(null);}
        else{retryKind.current="save";setStorageCode(result.code);setStorageState("error");}
      }).catch(()=>{
        if(current===saveSequence.current){
          retryKind.current="save";setStorageCode("io");setStorageState("error");
        }
      });
    },160);
    return ()=>window.clearTimeout(timer);
  },[scope,photosRestored,draft,step,photos,saveRetry]);
  useEffect(()=>()=>{
    photoGeneration.current++;
    for(const job of photoJobs.current.values())job.abort();
    photoJobs.current.clear();
    for(const timer of photoTimers.current.values())window.clearTimeout(timer);
    photoTimers.current.clear();
    for(const url of ownedUrls.current)URL.revokeObjectURL(url);
    ownedUrls.current=[];
  },[]);
  const registerDiscoveryBack=useCallback((handler:()=>void)=>{discoveryBackRef.current=handler;},[]);
  const back=useCallback(()=>{
    setError("");
    if(phase==="form"){
      if(step>1)setStep(step-1);
      else setPhase("welcome");
    }
  },[phase,step]);
  useEffect(()=>{
    const button=window.Telegram?.WebApp?.BackButton;
    if(!button)return;
    if(auth==="authorized"&&(demoOpen||phase==="form")){
      const handle=demoOpen?()=>discoveryBackRef.current():back;
      button.show();button.onClick(handle);
      return ()=>{button.offClick(handle);button.hide();};
    }
    button.hide();
  },[phase,auth,back,demoOpen]);
  const changeStep=(target:number)=>{
    persistEnabled.current=true;
    setStorageState("dirty");
    setError("");
    setStep(Math.max(1,Math.min(8,target)));
    contentRef.current?.scrollTo({top:0,behavior:"auto"});
  };
  const next=()=>{
    const nextError=validateStep(draft,step,photos.length);
    if(nextError){setError(nextError);return;}
    if(step<8)changeStep(step+1);
  };
  const addPhotos=(files:File[])=>{
    if(!files.length)return;
    persistEnabled.current=true;setStorageState("dirty");
    const accepted:PhotoItem[]=[];
    let problem="";
    for(const file of files){
      if(photoIds.current.size>=6){problem="Максимум 6 фотографий.";break;}
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>12*1024*1024){
        problem="Разрешены JPEG, PNG и WebP до 12 МБ. Для HEIC выбери JPEG.";continue;
      }
      const id=crypto.randomUUID();
      photoIds.current.add(id);
      accepted.push({id,src:"",file,status:"reading",progress:0});
    }
    if(accepted.length)setPhotos(prev=>[...prev,...accepted]);
    for(const photo of accepted){
      const controller=new AbortController();photoJobs.current.set(photo.id,controller);
      photoQueue.current=photoQueue.current.then(async()=>{
        try{
          const preview=await preparePhotoPreview(photo.file,controller.signal);
          if(controller.signal.aborted)return;
          const src=URL.createObjectURL(preview);ownedUrls.current.push(src);
          setPhotos(current=>current.map(p=>p.id===photo.id?{...p,src,preview,status:"success",progress:100}:p));
          photoTimers.current.set(photo.id,window.setTimeout(()=>{
            photoTimers.current.delete(photo.id);
            if(!controller.signal.aborted)setPhotos(current=>current.map(p=>p.id===photo.id?{...p,status:"ready"}:p));
          },850));
        }catch{
          if(!controller.signal.aborted){
            setPhotos(current=>current.map(p=>p.id===photo.id?{...p,status:"error"}:p));
            setError("Не удалось обработать фотографию.");
          }
        }finally{photoJobs.current.delete(photo.id);}
      });
    }
    setError(problem);
  };
  const removePhoto=(id:string)=>{
    persistEnabled.current=true;setStorageState("dirty");
    photoJobs.current.get(id)?.abort();photoJobs.current.delete(id);
    const timer=photoTimers.current.get(id);
    if(timer!==undefined)window.clearTimeout(timer);
    photoTimers.current.delete(id);photoIds.current.delete(id);
    const item=photos.find(p=>p.id===id);
    if(item?.src){URL.revokeObjectURL(item.src);ownedUrls.current=ownedUrls.current.filter(url=>url!==item.src);}
    setPhotos(prev=>prev.filter(p=>p.id!==id));
  };
  const movePhoto=(from:number,to:number)=>{
    persistEnabled.current=true;setStorageState("dirty");
    setPhotos(prev=>{
      if(from<0||from>=prev.length||to<0||to>=prev.length)return prev;
      const next=[...prev];const [item]=next.splice(from,1);next.splice(to,0,item);return next;
    });
  };
  const resetDraft=()=>{
    if(!window.confirm("Удалить сохранённый на этом устройстве черновик, включая фотографии?"))return;
    photoGeneration.current++;
    for(const job of photoJobs.current.values())job.abort();
    photoJobs.current.clear();photoIds.current.clear();
    for(const timer of photoTimers.current.values())window.clearTimeout(timer);
    photoTimers.current.clear();
    persistEnabled.current=false;
    const clearSequence=++saveSequence.current;
    for(const url of ownedUrls.current)URL.revokeObjectURL(url);
    ownedUrls.current=[];
    draftId.current=crypto.randomUUID();revision.current=0;
    setPhotos([]);setDraft(newDraft());setStep(1);setError("");
    setStorageState("saving");setStorageCode(null);
    if(!scope){retryKind.current="clear";setStorageCode("scope");setStorageState("error");return;}
    void clearDraftSnapshot(scope).then(result=>{
      if(clearSequence!==saveSequence.current)return;
      if(result.ok){setStorageState("idle");setStorageCode(null);}
      else{retryKind.current="clear";setStorageCode(result.code);setStorageState("error");}
    }).catch(()=>{
      if(clearSequence===saveSequence.current){retryKind.current="clear";setStorageCode("io");setStorageState("error");}
    });
    setPhotosRestored(true);
  };
  const retryStorage=()=>{
    if(retryKind.current==="load"){
      setStorageCode(null);setStorageState("loading");setLoadRetry(value=>value+1);return;
    }
    if(retryKind.current==="clear"){
      if(!scope){setStorageCode("scope");return;}
      const token=++saveSequence.current;
      setStorageState("saving");
      void clearDraftSnapshot(scope).then(result=>{
        if(token!==saveSequence.current)return;
        if(result.ok){setStorageCode(null);setStorageState("idle");}
        else{setStorageCode(result.code);setStorageState("error");}
      }).catch(()=>{if(token===saveSequence.current){setStorageCode("io");setStorageState("error");}});
      return;
    }
    persistEnabled.current=true;
    setStorageCode(null);setStorageState("dirty");
    setSaveRetry(value=>value+1);
  };
  const beginRegistration=()=>{
    if(welcomeExiting)return;
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
      setPhase("form");
      return;
    }
    setWelcomeExiting(true);
    transitionTimer.current=window.setTimeout(()=>{
      setPhase("form");
      setWelcomeExiting(false);
      transitionTimer.current=null;
    },280);
  };
  const changeTheme=useCallback(()=>setTheme(value=>value==="light"?"dark":"light"),[]);
  const themeName=theme==="light"?"Тёмная":"Светлая";
  const beginDemo=()=>{setDemoOpen(true);setError("");};
  const exitDemo=useCallback(()=>{setDemoOpen(false);setPhase("form");setStep(8);},[]);
  const readyPhotos=useMemo(()=>photos.filter(p=>p.status==="ready"||p.status==="success").map(p=>({id:p.id,src:p.src})),[photos]);
  const themeButton=<button className="theme-switch" type="button" onClick={changeTheme}
    aria-label={"Включить тему: "+themeName}>
    {theme==="light"?<Moon size={17} strokeWidth={1.8}/>:<Sun size={17} strokeWidth={1.8}/>}
  </button>;
  return <main ref={rootRef} className="luemi-shell" data-theme={activeTheme} data-phase={phase}
    data-scene={auth==="authorized"&&phase==="form"?"form":"intro"}>
    <div className="milky-mist" aria-hidden="true"/>
    {(auth!=="authorized"||phase==="welcome")&&<div className="theme-dock">{themeButton}</div>}
    {demoOpen&&auth==="authorized"?<DiscoveryApp draft={draft} photos={readyPhotos} theme={theme} onTheme={changeTheme} onExit={exitDemo} registerBack={registerDiscoveryBack}/>:null}
    {!demoOpen&&(auth!=="authorized"||phase==="welcome"?<section className={"entry-state"+(welcomeExiting?" exiting":"")+(visualReady?" visually-ready":"")} aria-live="polite">
      <div className="intro-mark">
        <img src={logoSrc} alt="luemi" className="intro-logo"/>
      </div>
      <h1>Твоя история начинается здесь</h1>
      {auth==="outside-telegram"&&<p>Открой LUEMI через <a href="https://t.me/LuemiAppBot">@LuemiAppBot</a> внутри Telegram.</p>}
      {auth==="needs-bot"&&<p>Тестовый сервер готов, но авторизация пока отключена.</p>}
      {auth==="error"&&<><p>Не удалось подтвердить вход. Попробуй снова через Telegram.</p><button className="primary-action" type="button" onClick={()=>window.location.reload()}>Повторить</button></>}
      {auth==="authorized"&&introElapsed&&visualReady&&<div className="intro-cta">
        <button className="primary-action" type="button" onClick={beginRegistration} disabled={welcomeExiting}>
          Начать <ArrowRight size={21} strokeWidth={1.9} aria-hidden="true"/>
        </button>
      </div>}
    </section>:<section className="onboarding-screen">
      <div className="onboard-brand" aria-label="LUEMI и прогресс регистрации">
        <div className="onboard-brand-row">
          <div className="onboard-wordmark"><img src={logoSrc} alt="luemi" className="onboard-logo"/></div>
          {themeButton}
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={8} aria-label="Прогресс регистрации"><span style={{width:step/8*100+"%"}}/></div>
      </div>
      <header className="onboard-head">
        <h1>{steps[step-1].title}</h1>
        <p>{steps[step-1].subtitle}</p>
      </header>
      <div key={step} className="onboard-body" ref={contentRef}>
        <RegistrationStep data={draft} patch={patch} step={step} photos={photos}
          addPhotos={addPhotos} removePhoto={removePhoto} movePhoto={movePhoto} editStep={changeStep} resetDraft={resetDraft} openDemo={beginDemo}/>
      </div>
      {step===5&&<SelectedInterests selected={draft.interests}
        onChange={id=>patch({interests:draft.interests.filter(x=>x!==id)})}/>}
      <div className="onboard-footer">
        {error&&<p className="field-error" role="alert">{error}</p>}
        {storageState==="error"&&<p className="field-error" role="alert">
          Не удалось сохранить или восстановить черновик на устройстве ({storageCode??"io"}).
          Данные не удалены. <button type="button" onClick={retryStorage}>Повторить</button>
        </p>}
        {(storageState==="saving"||storageState==="dirty")&&
          <p className="footer-hint" role="status">Сохранение черновика…</p>}
        {storageState==="saved"&&<p className="footer-hint" role="status">Черновик сохранён на устройстве</p>}
        <div className="footer-controls">
          <GlassArrow onClick={back}/>
          <span className="footer-hint">{step===8?"Публикация пока закрыта":"Технический предпросмотр"}</span>
          <GlassArrow forward onClick={next} disabled={step===8}/>
        </div>
      </div>
    </section>)}
  </main>;
}
