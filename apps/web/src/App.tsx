import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {ArrowRight,Moon,Sun} from "lucide-react";
import {GlassArrow} from "./ui/Glass";
import type { HealthResponse } from "@luemi/contracts";
import { newDraft, steps, validateStep, type RegistrationDraft } from "./registration/model";
import { RegistrationStep, SelectedInterests, type PhotoItem } from "./registration/Steps";
import {localScope,loadDraftSnapshot,saveDraftSnapshot,clearDraftSnapshot,type StorageCode} from "./registration/local-draft";
import {preparePhotoPreview} from "./registration/photo-preview";
import {installViewportController} from "./viewport/viewport-controller";
// Load the heavy Discovery/profile route only after the entry shell can paint.
const DiscoveryApp = lazy(() => import("./discovery/DiscoveryApp").then(m => ({default:m.DiscoveryApp})));
import {readyRegistrationPhotos} from "./discovery/ProfileModel";
import {startStartup} from "./startup/startup-coordinator";
import {authenticateBootstrap,type AuthStartupIdentity} from "./auth/session-adapter";

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
  const [connectAttempt,setConnectAttempt]=useState(0);
  const startupGeneration=useRef(0);
  const [visualReady,setVisualReady] = useState(false);
  const [welcomeExiting,setWelcomeExiting] = useState(false);
  const transitionTimer = useRef<number | null>(null);
  const [phase,setPhase] = useState<"welcome"|"form">("welcome");
  const [demoOpen,setDemoOpen] = useState(false);
  const [scope] = useState(()=>localScope());
  // Prewarm the optional Discovery chunk after the welcome screen appears.
  // Never let large profile/viewer modules block Telegram entry and registration.
  useEffect(()=>{
    if(!introElapsed)return;
    const timer=window.setTimeout(()=>{void import("./discovery/DiscoveryApp");},800);
    return ()=>window.clearTimeout(timer);
  },[introElapsed]);
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
    const initData=window.Telegram?.WebApp?.initData;
    // Every retry and StrictMode setup has a distinct generation.
    // An expired, aborted or disposed attempt can never change this instance.
    const generation=++startupGeneration.current;
    const isCurrent=()=>generation===startupGeneration.current;
    const run=startStartup<AuthStartupIdentity|null>({
      deadlineMs:15000,
      optionalBudgetMs:650,
      critical:async signal=>{
        if(!initData)return null;
        const live=await fetch("/api/health/live",{signal});
        if(!live.ok||((await live.json()) as HealthResponse).status!=="ok")
          throw new Error("API unavailable");
        return authenticateBootstrap(initData,signal);
      },
      // Fonts and the original LUEMI logo are optional *render preparation*,
      // never an authentication prerequisite. Keep the exact original asset
      // in the DOM; if preload hangs or fails the existing system font and
      // preserved-size image placeholder remain. No replacement branding.
      optional:async signal=>{
        await Promise.all([prepareBrandImage(signal),document.fonts.ready]);
      },
      onOptionalReady:()=>{
        if(isCurrent())setVisualReady(true);
      },
      onCritical:result=>{
        if(!isCurrent())return;
        if(result.kind==="error"){setAuth("error");return;}
        if(!initData){setAuth("outside-telegram");return;}
        const user=result.value;
        if(!user){setAuth("needs-bot");return;}
        setDraft(current=>({...current,name:current.name||user.user.firstName}));
        setAuth("authorized");
      }
    });
    return ()=>{
      // The coordinator synchronously invalidates every late continuation.
      // A retry increments the generation on its next setup.
      run.dispose();
    };
  },[connectAttempt]);
  // LU-22: one frame-coalesced source of truth. The shell tracks the *visible*
  // viewport while the footer remains in the flex layout above the keyboard.
  // No modal/route motion code is changed by this stage.
  useLayoutEffect(()=>{
    if(!rootRef.current)return;
    const controller=installViewportController(rootRef.current,()=>window.Telegram?.WebApp);
    return ()=>controller.dispose();
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
  const readyPhotos=useMemo(()=>readyRegistrationPhotos(photos),[photos]);
  const themeButton=<button className="theme-switch" type="button" onClick={changeTheme}
    aria-label={"Включить тему: "+themeName}>
    {theme==="light"?<Moon size={17} strokeWidth={1.8}/>:<Sun size={17} strokeWidth={1.8}/>}
  </button>;
  return <main ref={rootRef} className="luemi-shell" data-theme={activeTheme} data-phase={phase}
    data-scene={auth==="authorized"&&phase==="form"?"form":"intro"}>
    <div className="milky-mist" aria-hidden="true"/>
    {(auth!=="authorized"||phase==="welcome")&&<div className="theme-dock">{themeButton}</div>}
    {demoOpen&&auth==="authorized"?<Suspense fallback={null}><DiscoveryApp draft={draft} photos={readyPhotos} theme={theme} onTheme={changeTheme} onExit={exitDemo} registerBack={registerDiscoveryBack}/></Suspense>:null}
    {!demoOpen&&(auth!=="authorized"||phase==="welcome"?<section className={"entry-state"+(welcomeExiting?" exiting":"")+(visualReady?" visually-ready":"")} aria-live="polite">
      <div className="intro-mark">
        <img src={logoSrc} alt="luemi" className="intro-logo"/>
      </div>
      <h1>Твоя история начинается здесь</h1>
      {auth==="outside-telegram"&&<p>Открой LUEMI через <a href="https://t.me/LuemiAppBot">@LuemiAppBot</a> внутри Telegram.</p>}
      {auth==="needs-bot"&&<p>Тестовый сервер готов, но авторизация пока отключена.</p>}
      {auth==="error"&&<><p>Не удалось подтвердить вход. Попробуй снова через Telegram.</p><button className="primary-action" type="button" onClick={()=>{setAuth("connecting");setConnectAttempt(v=>v+1);}}>Повторить</button></>}
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
