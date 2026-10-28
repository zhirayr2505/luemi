import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {ArrowRight,Moon,Sun} from "lucide-react";
import {SafetyAppealPanel} from "./SafetyAppealPanel";
import {GlassArrow} from "./ui/Glass";
import type { HealthResponse } from "@luemi/contracts";
import { cleanName,nameValid,newDraft,goals, steps, validateStep, type RegistrationDraft } from "./registration/model";
import { RegistrationStep, SelectedInterests, type PhotoItem } from "./registration/Steps";
import {localScope,loadDraftSnapshot,saveDraftSnapshot,clearDraftSnapshot,type StorageCode} from "./registration/local-draft";
import {preparePhotoPreview} from "./registration/photo-preview";
import {installViewportController} from "./viewport/viewport-controller";
// Load the heavy Discovery/profile route only after the entry shell can paint.
const DiscoveryApp = lazy(() => import("./discovery/DiscoveryApp").then(m => ({default:m.DiscoveryApp})));
const RealLiveFeed = lazy(() => import("./registration/RealLiveFeed").then(m=>({default:m.RealLiveFeed})));
const RealChats = lazy(() => import("./chats/RealChats").then(m=>({default:m.RealChats})));
const RealRegistrationV2 = lazy(() => import("./registration/v2/RealRegistration").then(m=>({default:m.RealRegistrationV2})));
import {readyRegistrationPhotos} from "./discovery/ProfileModel";
import {startStartup} from "./startup/startup-coordinator";
import {authenticateBootstrap,type AuthStartupIdentity} from "./auth/session-adapter";
import {remoteDraftPilot,readRemoteRevision,saveRemoteDraft,saveRemoteFields} from "./registration/server-draft";
import {recoverServerFields} from "./registration/remote-recovery";
import {remoteMediaPilot,uploadPrivatePhotos} from "./registration/server-media";
import {realFeedPilot,ownerPublicationStatus,publishMyProfile,unpublishMyProfile,withdrawRealConsent,requestMyAccountDeletion} from "./registration/real-live-client";
import {registrationSubmissionDecision} from "./registration/real-submit-gate";
import type {OwnerPublicationStatus} from "./registration/real-live-client";
import "./registration/real-home.css";

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

type AuthState = "connecting" | "outside-telegram" | "authorized" | "needs-bot" | "needs-invite" | "error";
type ThemeChoice = "light" | "dark";
const logoSrc = "/assets/brand/wordmark_original_raster_alpha_W06.webp";
// Closed beta may never enter the synthetic Discovery deck.
const realOnly=import.meta.env.VITE_LUEMI_REAL_ONLY==="1";
// Safe invited-only routing; real publication remains gated until trusted FaceTrust.
const registrationV2Pilot=remoteDraftPilot.enabled&&!realFeedPilot.enabled&&
 import.meta.env.VITE_LUEMI_REGISTRATION_V2==="1";
const testingNotice=import.meta.env.VITE_LUEMI_FRIENDS_TEST_MODE==="1"?"условия закрытого теста":"политику обработки данных";

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
  const [realHome,setRealHome] = useState(false);
  const [realHomeTab,setRealHomeTab] = useState<"feed"|"chats"|"profile">("feed");
  const [publishedEditor,setPublishedEditor]=useState<{name:string;about:string;goal:string}|null>(null);
  const submitting=useRef(false);
  const [scope] = useState(()=>localScope());
  // Prewarm the optional Discovery chunk after the welcome screen appears.
  // Never let large profile/viewer modules block Telegram entry and registration.
  useEffect(()=>{
    if(!introElapsed||realOnly)return;
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
  const [serverConsent,setServerConsent]=useState(false);
  const [serverSaving,setServerSaving]=useState(false);
  const [serverStatus,setServerStatus]=useState("");
  const [privateDraftSaved,setPrivateDraftSaved]=useState(false);
  const [mediaSaving,setMediaSaving]=useState(false);
  const [mediaStatus,setMediaStatus]=useState("");
  const [publishStatus,setPublishStatus]=useState<OwnerPublicationStatus|null>(null);
  const [publicationCheck,setPublicationCheck]=useState<"idle"|"checking"|"ready"|"error">("idle");
  const [publicationRetry,setPublicationRetry]=useState(0);
  const [publishBusy,setPublishBusy]=useState(false);
  const [publishFeedback,setPublishFeedback]=useState("");
  const [accountDeletionRequested,setAccountDeletionRequested]=useState(false);
  const [localDeletionFailed,setLocalDeletionFailed]=useState(false);
  const [theme,setTheme] = useState<ThemeChoice>(()=>window.Telegram?.WebApp?.colorScheme==="dark"?"dark":"light");
  const rootRef=useRef<HTMLElement>(null);
  const contentRef=useRef<HTMLDivElement>(null);
  const discoveryBackRef=useRef<()=>void>(()=>{});
  const v2BackRef=useRef<()=>void>(()=>{});
  const activeTheme=theme;
  const patch = useCallback((change:Partial<RegistrationDraft>)=>{
    persistEnabled.current=true;
    setStorageState("dirty");
    setDraft(prev=>({...prev,...change}));
    setServerStatus(""); // A changed local draft is no longer identical to the server copy.
    setPrivateDraftSaved(false);
    setPublishStatus(null);
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
        if(result.kind==="error"){setAuth(result.reason==="invitation_required"?"needs-invite":"error");return;}
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
  useEffect(()=>{
    if(auth!=="authorized"||!realFeedPilot.enabled)return;
    let disposed=false;
    setPublicationCheck("checking");
    void ownerPublicationStatus().then(status=>{
      if(disposed)return;
      setPublishStatus(status);
      setPublicationCheck("ready");
      if(status.state==="published"){
        setRealHome(true);
      }else if(status.pending>0||status.approved>0||status.other>0){
        // The Telegram account and private registration are real already.
        // Continue to a private, non-discoverable review dashboard; do not
        // incorrectly ask this person to start a demo registration again.
        setRealHomeTab("profile");
        setRealHome(true);
      }else setPhase("form");
    }).catch(()=>{
      if(!disposed){
        setPublicationCheck("error");
        setPublishFeedback("Не удалось проверить анкету на сервере. Ничего не потеряно — повтори проверку.");
      }
    });
    return()=>{disposed=true;};
  },[auth,publicationRetry]);
  // LU-22: one frame-coalesced source of truth. The shell tracks the *visible*
  // viewport while the footer remains in the flex layout above the keyboard.
  // No modal/route motion code is changed by this stage.
  useLayoutEffect(()=>{
    if(!rootRef.current)return;
    const controller=installViewportController(rootRef.current,()=>window.Telegram?.WebApp);
    return ()=>controller.dispose();
  },[realHome,accountDeletionRequested]);
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
      // An invited account must restore the confirmed server draft, not
      // mistake old device-only demo fields for its registered identity.
      let savedTester:RegistrationDraft|null=null;
      if(remoteDraftPilot.enabled&&!realFeedPilot.enabled&&auth==="authorized"){
        try{
          const remote=await readRemoteRevision();
          if(disposed)return;
          if(remote.state==="private")
            savedTester=recoverServerFields(remote.fields);
        }catch{/* The offline local draft remains recoverable. */}
      }
      if(snapshot){
        draftId.current=snapshot.draftId;
        revision.current=snapshot.revision;
      }
      if(savedTester){
        setDraft(savedTester);setStep(8);setPhase("form");
        setPrivateDraftSaved(true);
        setRealHomeTab("profile");setRealHome(true);
      }else if(snapshot){
        setDraft(snapshot.draft);
        setStep(snapshot.step);
        if(realFeedPilot.enabled)setPhase("form");
      }else if(realFeedPilot.enabled){
        // A new device can recover fields, but must select its city and photos
        // again. Never claim that private media bytes are in this response.
        try{
          const remote=await readRemoteRevision();
          if(disposed)return;
          if(remote.state==="private"){
            const recovered=recoverServerFields(remote.fields);
            if(recovered){setDraft(recovered);setStep(3);setPhase("form");}
          }
        }catch{/* Offline users retain the empty local draft. */}
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
  },[scope,loadRetry,auth]);
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
  const registerV2Back=useCallback((handler:()=>void)=>{v2BackRef.current=handler;},[]);
  const back=useCallback(()=>{
    setError("");
    if(phase==="form"){
      if(registrationV2Pilot){v2BackRef.current();return;}
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
    const nextError=validateStep(draft,step,photos.length,new Date(),realFeedPilot.enabled?"live":"demo");
    if(nextError){setError(nextError);return;}
    if(step<8)changeStep(step+1);
  };
  const addPhotos=(files:File[])=>{
    if(!files.length)return;
    setPrivateDraftSaved(false);setMediaStatus("");setPublishStatus(null);
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
    setPrivateDraftSaved(false);setMediaStatus("");
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
    setPrivateDraftSaved(false);setMediaStatus("");
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
    setPhotos([]);setDraft(newDraft());setStep(1);setError("");setServerStatus("");setServerConsent(false);setPrivateDraftSaved(false);setMediaStatus("");setPublishStatus(null);
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
    if(welcomeExiting||realOnly&&!remoteDraftPilot.enabled||
      realFeedPilot.enabled&&publicationCheck!=="ready")return;
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
  const beginDemo=()=>{if(realOnly){setError("Настоящая регистрация пока не подключена. Демонстрационные анкеты недоступны.");return;}setDemoOpen(true);setError("");};
  const exitDemo=useCallback(()=>{setDemoOpen(false);setPhase("form");setStep(8);},[]);
  const readyPhotos=useMemo(()=>readyRegistrationPhotos(photos),[photos]);
  const persistServerDraft=async()=>{
    if(!remoteDraftPilot.enabled||!serverConsent||serverSaving||auth!=="authorized")return;
    for(let n=1;n<=6;n++){
      const problem=validateStep(draft,n,photos.length,new Date(),realFeedPilot.enabled?"live":"demo");
      if(problem){setServerStatus("Проверь шаг "+n+": "+problem);return;}
    }
    setServerSaving(true);setServerStatus("");
    try{
      const previous=await readRemoteRevision();
      if(previous.state==="private"&&!window.confirm(
        "На сервере уже есть приватный черновик. Заменить его текущими полями? Фотографии останутся на этом устройстве."
      )){setServerStatus("Серверный черновик оставлен без изменений.");return;}
      await saveRemoteDraft(draft,previous.revision);
      setPrivateDraftSaved(true);
      setPublishStatus(null);
      setServerStatus("Поля анкеты сохранены на сервере. Публикация закрыта, фотографии остались на этом устройстве.");
      // A private test account exists already. Show its server-backed
      // profile instead of leaving the user on the last registration step.
      if(!realFeedPilot.enabled){setRealHomeTab("profile");setRealHome(true);}
    }catch(e){
      setPrivateDraftSaved(false);
      setServerStatus(e instanceof Error&&e.message==="revision_conflict"?
        "Черновик изменён в другой сессии. Ничего не перезаписано — проверь данные и повтори.":
        "Серверное сохранение не удалось. Локальный черновик и фотографии не удалены.");
    }finally{setServerSaving(false);}
  };
  const persistPrivatePhotos=async()=>{
    if(!remoteMediaPilot.enabled||!privateDraftSaved||!serverConsent||
      mediaSaving||serverSaving||auth!=="authorized")return;
    if(photos.length<3||photos.length>6||photos.some(p=>p.status!=="ready")){
      setMediaStatus("Для загрузки требуется от 3 до 6 обработанных фотографий.");
      return;
    }
    setMediaSaving(true);setMediaStatus("");
    try{
      await uploadPrivatePhotos([...photos],(done,total)=>
        setMediaStatus("Отправлено "+done+" из "+total+". Все фотографии приватны."));
      setPublishStatus(null);
      setMediaStatus("Фотографии приняты в приватную очередь модерации. Они никому не видны и не опубликованы.");
    }catch{
      setMediaStatus("Не все фотографии отправлены. Уже принятые остаются приватными. Проверь соединение перед повтором.");
    }finally{setMediaSaving(false);}
  };
  const confirmRealRegistration=async()=>{
    if(!realFeedPilot.enabled||submitting.current)return;
    for(let n=1;n<=7;n++){
      const problem=validateStep(draft,n,photos.length,new Date(),realFeedPilot.enabled?"live":"demo");
      if(problem){setError(`Проверь шаг ${n}: ${problem}`);return;}
    }
    if(photos.length<3||photos.length>6||photos.some(p=>p.status!=="ready")){
      setError("Нужно от 3 до 6 готовых фотографий.");return;
    }
    if(!serverConsent){setError("Подтверди согласие на обработку данных и публикацию анкеты.");return;}
    submitting.current=true;setPublishBusy(true);setError("");setPublishFeedback("");
    try{
      const existing=await ownerPublicationStatus();
      setPublishStatus(existing);
      const decision=registrationSubmissionDecision(existing);
      if(decision==="already-published"){
        setRealHome(true);
        setPublishFeedback("Анкета уже опубликована.");
        return;
      }
      if(decision==="awaiting-review"){
        setPublishFeedback("Фотографии уже на сервере и проходят модерацию. Повторно отправлять их не нужно.");
        setRealHomeTab("profile");setRealHome(true);
        return;
      }
      if(decision==="ready-to-publish"){
        setPublishFeedback("Фотографии уже одобрены. Нажми «Проверить модерацию и публикацию», чтобы открыть анкету.");
        return;
      }
      if(decision==="review-needs-attention"){
        setPublishFeedback("На сервере уже есть фотографии, требующие дополнительной проверки или исправления. Не отправляем повторно те же файлы.");
        setRealHomeTab("profile");setRealHome(true);
        return;
      }
      setPublishFeedback("Сохраняем анкету…");
      const previous=await readRemoteRevision();
      await saveRemoteDraft(draft,previous.revision);
      setPrivateDraftSaved(true);
      setPublishFeedback("Отправляем фотографии на проверку…");
      await uploadPrivatePhotos([...photos],(done,total)=>
        setPublishFeedback(`Отправлено ${done} из ${total} фотографий.`));
      const status=await ownerPublicationStatus();setPublishStatus(status);
      if(status.approved>=3&&status.approved<=6&&status.pending===0&&status.other===0){
        const saved=await readRemoteRevision();
        await publishMyProfile(saved.revision);
        const confirmed=await ownerPublicationStatus();
        if(confirmed.state!=="published")throw new Error("publication_unconfirmed");
        setPublishStatus(confirmed);setRealHome(true);
        setPublishFeedback("Анкета опубликована.");
      }else{
        setPublishFeedback("Анкета сохранена на сервере. Фото ожидают проверки; другие пользователи пока не видят её.");
        setRealHomeTab("profile");setRealHome(true);
      }
    }catch(e){
      setPublishFeedback(e instanceof Error&&e.message==="revision_conflict"
        ?"Анкета изменилась в другой сессии. Твои данные остались на устройстве; проверь их и повтори."
        :"Не удалось завершить сохранение или публикацию. Черновик остаётся на устройстве; повтори после восстановления сети.");
    }finally{submitting.current=false;setPublishBusy(false);}
  };
  const resumePublication=async()=>{
    if(!realFeedPilot.enabled||submitting.current)return;
    submitting.current=true;setPublishBusy(true);setPublishFeedback("");
    try{
      const status=await ownerPublicationStatus();setPublishStatus(status);
      if(status.state==="published"){setRealHome(true);return;}
      if(status.approved<3||status.approved>6||status.pending||status.other){
        setPublishFeedback("Фотографии ещё проходят проверку или требуют исправления. Анкета пока скрыта.");return;
      }
      const draftOnServer=await readRemoteRevision();
      if(draftOnServer.state!=="private")throw new Error("missing_draft");
      await publishMyProfile(draftOnServer.revision);
      const confirmed=await ownerPublicationStatus();
      if(confirmed.state!=="published")throw new Error("publication_unconfirmed");
      setPublishStatus(confirmed);setRealHome(true);
    }catch{setPublishFeedback("Проверка не завершилась. Повтори при стабильном соединении.");}
    finally{submitting.current=false;setPublishBusy(false);}
  };
  const openPublishedEditor=async()=>{
    if(publishBusy)return;
    setPublishBusy(true);setPublishFeedback("");
    try{
      const remote=await readRemoteRevision();
      if(remote.state!=="private")throw new Error("draft_missing");
      setPublishedEditor({name:String(remote.fields.displayName??""),
       about:String(remote.fields.about??""),goal:String(remote.fields.goal??"")});
    }catch{setPublishFeedback("Не удалось загрузить анкету для редактирования.");}
    finally{setPublishBusy(false);}
  };
  const savePublishedEditor=async()=>{
    if(!publishedEditor||publishBusy)return;
    if(!nameValid(publishedEditor.name)||[...publishedEditor.about].length>750||
      !goals.some(g=>g.id===publishedEditor.goal)){
      setPublishFeedback("Проверь имя, цель и текст о себе (до 750 символов).");return;
    }
    setPublishBusy(true);setPublishFeedback("");
    try{
      const remote=await readRemoteRevision();
      if(remote.state!=="private")throw new Error("draft_missing");
      await saveRemoteFields({...remote.fields,displayName:publishedEditor.name.trim(),
       about:publishedEditor.about.trim(),goal:publishedEditor.goal},remote.revision);
      await publishMyProfile(remote.revision+1);
      const status=await ownerPublicationStatus();
      if(status.state!=="published")throw new Error("publication_unconfirmed");
      setPublishStatus(status);setPublishedEditor(null);
      setPublishFeedback("Изменения опубликованы.");
    }catch{setPublishFeedback("Не удалось опубликовать изменения. Проверь соединение и повтори.");}
    finally{setPublishBusy(false);}
  };
  const hideProfile=async()=>{
    if(!realFeedPilot.enabled||publishBusy||
       !window.confirm("Снять анкету с публикации и скрыть фотографии от других пользователей?"))return;
    setPublishBusy(true);setPublishFeedback("");
    try{
      await unpublishMyProfile();
      setPublishStatus(await ownerPublicationStatus());
      setRealHome(false);setPhase("form");setStep(8);
      setPublishFeedback("Анкета скрыта. Другим пользователям её фото больше недоступны.");
    }catch{setPublishFeedback("Не удалось скрыть анкету. Проверь соединение.");}
    finally{setPublishBusy(false);}
  };
  const withdrawPersonalConsent=async()=>{
    if(!realFeedPilot.enabled||publishBusy||auth!=="authorized")return;
    if(!window.confirm(
      "Отозвать согласие? Анкета и фотографии сразу скроются от других людей. Данные останутся на сервере до отдельного удаления."
    ))return;
    setPublishBusy(true);setPublishFeedback("");
    try{
      await withdrawRealConsent();
      setServerConsent(false);setPrivateDraftSaved(false);setRealHome(false);setPhase("form");setStep(8);
      setPublishStatus(null);
      setPublishFeedback("Согласие отозвано, анкета и фото скрыты. Данные НЕ удалены: удаление аккаунта появится отдельно.");
    }catch{
      setPublishFeedback("Не удалось отозвать согласие. Проверь соединение и повтори.");
    }finally{setPublishBusy(false);}
  };
  const eraseMyAccount=async()=>{
    if(!realFeedPilot.enabled||publishBusy||auth!=="authorized")return;
    if(window.prompt("Для запроса полного удаления аккаунта впиши УДАЛИТЬ")!=="УДАЛИТЬ")return;
    if(!window.confirm(
      "Удалить доступ к аккаунту навсегда? Сессии будут отозваны сразу. Файлы и записи будут удаляться отдельно. Отменить запрос после отправки нельзя."
    ))return;
    setPublishBusy(true);setPublishFeedback("");
    try{
      await requestMyAccountDeletion();
      // Server receipt means all sessions were revoked, but remote file/database
      // purge is still pending. Never label this a completed deletion.
      setAccountDeletionRequested(true);setRealHome(false);setServerConsent(false);
      persistEnabled.current=false;
      ++saveSequence.current;photoGeneration.current++;
      for(const job of photoJobs.current.values())job.abort();
      photoJobs.current.clear();
      for(const timer of photoTimers.current.values())window.clearTimeout(timer);
      photoTimers.current.clear();
      for(const url of ownedUrls.current)URL.revokeObjectURL(url);
      ownedUrls.current=[];photoIds.current.clear();
      setPhotos([]);setDraft(newDraft());
      try{
        const result=scope?await clearDraftSnapshot(scope):null;
        if(!result?.ok)setLocalDeletionFailed(true);
      }catch{setLocalDeletionFailed(true);}
    }catch{
      setPublishFeedback("Не удалось отправить запрос на удаление. Аккаунт не считается удалённым.");
    }finally{setPublishBusy(false);}
  };
  if(accountDeletionRequested)return <main className="luemi-shell" data-theme={activeTheme}
    data-scene="intro" role="status" style={{padding:"32px 22px",display:"grid",alignContent:"center",gap:18}}>
    <img src={logoSrc} alt="LUEMI" style={{width:150,maxWidth:"100%",justifySelf:"center"}}/>
    <h2>Запрос на удаление принят</h2>
    <p>Ваш аккаунт отключён, активные сессии закрыты, анкета и фотографии скрыты. Удаление файлов из хранилища и остальных данных ещё выполняется.</p>
    {localDeletionFailed&&<p role="alert">Локальный черновик на этом устройстве не удалось очистить. Удалите данные Telegram Mini App вручную.</p>}
    <p>Не закрывайте этот текст с ожиданием мгновенного полного удаления: подтверждения завершения очистки сервер ещё не выдавал.</p>
  </main>;
  const themeButton=<button className="theme-switch" type="button" onClick={changeTheme}
    aria-label={"Включить тему: "+themeName}>
    {theme==="light"?<Moon size={17} strokeWidth={1.8}/>:<Sun size={17} strokeWidth={1.8}/>}
  </button>;
  if(realHome&&auth==="authorized")return <main ref={rootRef} className="luemi-shell" data-theme={activeTheme}>
    <section className="luemi-real-home" aria-label="LUEMI — настоящие анкеты">
      <header className="luemi-real-home-top">
        <img src={logoSrc} alt="LUEMI" className="onboard-logo"/>
        {themeButton}
      </header>
      <div className="luemi-real-home-main">
        {!realFeedPilot.enabled&&remoteDraftPilot.enabled?<section className="luemi-real-account" aria-label="Моя закрытая анкета">
          <h1>Моя анкета 💜</h1>
          <p role="status">Анкета сохранена в LUEMI. При повторном входе она восстановится с сервера.</p>
          <article className="luemi-real-account-card" aria-label="Данные моей анкеты">
            {readyPhotos.length>0&&<div className="luemi-real-account-photos" aria-label="Локальные фотографии">
              {readyPhotos.map((photo,i)=><img key={photo.id} src={photo.src} alt={"Моё фото на устройстве "+(i+1)} loading="lazy" decoding="async"/>)}</div>}
            <h2>{draft.name}</h2>
            <p>{draft.city}{draft.countryCode?" · "+draft.countryCode:""}</p>
            {draft.goal&&<p>{goals.find(g=>g.id===draft.goal)?.label??draft.goal}</p>}
            {draft.about&&<p>{draft.about}</p>}
            <div className="luemi-real-account-interests">{draft.interests.map(interest=>
              <span key={interest}>{interest}</span>)}</div>
          </article>
          <p>Это закрытый тест. Анкету видишь только ты. Фотографии остаются на твоём устройстве, а лента, симпатии и чаты пока не включены.</p>
          <button type="button" onClick={()=>{setRealHome(false);setPhase("form");setStep(8);}}>
            Редактировать анкету
          </button>
          <p>Чтобы прекратить участие и запросить удаление данных, напиши в Telegram <a href="https://t.me/zhiiirro">@zhiiirro</a>.</p>
        </section>:publishStatus?.state!=="published"?<section className="luemi-real-account" aria-label="Статус регистрации">
          <h1>Анкета сохранена 💜</h1>
          <p role="status">Твой Telegram-аккаунт зарегистрирован. До завершения проверки фотографии и анкета никому не показываются.</p>
          <p>Одобрено фото: {publishStatus?.approved??0} · на проверке: {publishStatus?.pending??0} · требуют внимания: {publishStatus?.other??0}</p>
          <button type="button" disabled={publishBusy} onClick={()=>{void resumePublication();}}>
            {publishBusy?"Проверяем…":"Проверить модерацию и открыть анкету"}
          </button>
          <button type="button" disabled={publishBusy} onClick={()=>{setRealHome(false);setPhase("form");setStep(8);}}>
            Вернуться к анкете и фотографиям
          </button>
          {publishFeedback&&<p role="status">{publishFeedback}</p>}
        </section>:realHomeTab==="profile"?<section className="luemi-real-account" aria-label="Моя анкета">
          <h1>Моя анкета</h1>
          {publishStatus?.profile&&<article className="luemi-real-account-card">
            <div className="luemi-real-account-photos">
              {publishStatus.profile.photos.map((photo,i)=>
                <img key={photo} src={photo} alt={"Моё фото "+(i+1)} loading={i?"lazy":"eager"} decoding="async"/>)}
            </div>
            <h2>{publishStatus.profile.name}, {publishStatus.profile.age}</h2>
            <p>{publishStatus.profile.city}</p>
            <p>{publishStatus.profile.about}</p>
            <div className="luemi-real-account-interests">{publishStatus.profile.interests.map(interest=>
              <span key={interest}>{interest}</span>)}</div>
          </article>}
          <p role="status">{publishStatus?.state==="published"?"Анкета опубликована и доступна другим людям.":"Проверяем статус анкеты…"}</p>
          <div className="registration-static-actions">
            <button type="button" className="registration-static-edit" disabled={publishBusy} onClick={()=>{void openPublishedEditor();}}>Редактировать анкету</button>
            <button type="button" className="registration-static-edit" disabled={publishBusy} onClick={()=>{void hideProfile();}}>Скрыть анкету</button>
          </div>
          {publishedEditor&&<section className="registration-preview-review" aria-label="Редактирование анкеты">
            <label>Имя<input className="glass-control" value={publishedEditor.name} maxLength={48}
              onChange={e=>setPublishedEditor(p=>p?{...p,name:cleanName(e.target.value)}:p)}/></label>
            <label>Цель знакомства<select className="glass-control" value={publishedEditor.goal}
              onChange={e=>setPublishedEditor(p=>p?{...p,goal:e.target.value}:p)}>
              {goals.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
            </select></label>
            <label>О себе<textarea className="glass-control" value={publishedEditor.about} maxLength={750}
              onChange={e=>setPublishedEditor(p=>p?{...p,about:e.target.value}:p)}/></label>
            <button type="button" disabled={publishBusy} onClick={()=>{void savePublishedEditor();}}>Сохранить изменения</button>
            <button type="button" disabled={publishBusy} onClick={()=>setPublishedEditor(null)}>Отмена</button>
          </section>}
          <button type="button" disabled={publishBusy} onClick={()=>{void withdrawPersonalConsent();}}>Отозвать согласие и скрыть анкету</button>
          <button type="button" disabled={publishBusy} onClick={()=>{void eraseMyAccount();}}>Запросить удаление аккаунта и фото</button>
          {publishFeedback&&<p role="status">{publishFeedback}</p>}
        </section>:<Suspense fallback={<p role="status">Загружаем…</p>}>
          {realHomeTab==="chats"&&import.meta.env.VITE_LUEMI_REAL_CHATS==="1"?
            <RealChats/>:<RealLiveFeed onMatched={()=>setRealHomeTab("chats")}/>}
        </Suspense>}
      </div>
      {publishStatus?.state==="published"&&<nav className="luemi-real-home-nav" aria-label="Разделы LUEMI">
        <button type="button" aria-current={realHomeTab==="feed"?"page":undefined} onClick={()=>setRealHomeTab("feed")}>Знакомства</button>
        {import.meta.env.VITE_LUEMI_REAL_CHATS==="1"&&
          <button type="button" aria-current={realHomeTab==="chats"?"page":undefined} onClick={()=>setRealHomeTab("chats")}>Чаты</button>}
        <button type="button" aria-current={realHomeTab==="profile"?"page":undefined} onClick={()=>setRealHomeTab("profile")}>Профиль</button>
      </nav>}
    </section>
  </main>;
  if(auth==="authorized"&&phase==="form"&&registrationV2Pilot&&!demoOpen)
    return <Suspense fallback={<main className="luemi-shell" data-theme={activeTheme}
      role="status" style={{padding:24}}>Открываем регистрацию…</main>}>
      <RealRegistrationV2 draft={draft} patch={patch} photos={photos}
       addPhotos={addPhotos} removePhoto={removePhoto} movePhoto={movePhoto}
       resetDraft={resetDraft} serverConsent={serverConsent}
       theme={theme} onTheme={changeTheme}
       setServerConsent={setServerConsent} onSave={()=>{void persistServerDraft();}}
       serverSaving={serverSaving} serverStatus={serverStatus}
       storageError={storageState==="error"?(storageCode??"io"):null}
       restored={photosRestored} resumeReview={step===8&&privateDraftSaved}
       onRetryStorage={retryStorage}
       onExit={()=>setPhase("welcome")} registerBack={registerV2Back}/>
    </Suspense>;
  return <main ref={rootRef} className="luemi-shell" data-theme={activeTheme} data-phase={phase}
    data-registration-preview={auth==="authorized"&&phase==="form"&&!demoOpen&&step===8?"true":undefined}
    data-scene={auth==="authorized"&&phase==="form"?"form":"intro"}>
    <div className="milky-mist" aria-hidden="true"/>
    {(auth!=="authorized"||phase==="welcome")&&<div className="theme-dock">{themeButton}</div>}
    {demoOpen&&auth==="authorized"&&!realFeedPilot.enabled&&!realOnly?<Suspense fallback={null}><DiscoveryApp draft={draft} photos={readyPhotos} theme={theme} onTheme={changeTheme} onExit={exitDemo} registerBack={registerDiscoveryBack}/></Suspense>:null}
    {!demoOpen&&(auth!=="authorized"||phase==="welcome"?<section className={"entry-state"+(welcomeExiting?" exiting":"")+(visualReady?" visually-ready":"")} aria-live="polite">
      <div className="intro-mark">
        <img src={logoSrc} alt="luemi" className="intro-logo"/>
      </div>
      <h1>Твоя история начинается здесь</h1>
      {auth==="outside-telegram"&&<p>Открой LUEMI через <a href="https://t.me/LuemiAppBot">@LuemiAppBot</a> внутри Telegram.</p>}
      {auth==="needs-bot"&&<><p>{realOnly?"Сервер авторизации пока недоступен. Повтори вход позже.":"Тестовый сервер готов, но авторизация пока отключена."}</p>
        {realOnly&&<button className="primary-action" type="button" onClick={()=>{setAuth("connecting");setConnectAttempt(v=>v+1);}}>Повторить вход</button>}</>}
      {auth==="needs-invite"&&<><p role="alert">Идёт закрытый тест LUEMI. Для приглашения отправь владельцу свой Telegram ID из команды /myid в @LuemiAppBot.</p>
        <button className="primary-action" type="button" onClick={()=>{setAuth("connecting");setConnectAttempt(v=>v+1);}}>Повторить вход</button></>}
      {auth==="error"&&<><p>Не удалось подтвердить вход. Попробуй снова через Telegram.</p><button className="primary-action" type="button" onClick={()=>{setAuth("connecting");setConnectAttempt(v=>v+1);}}>Повторить</button><SafetyAppealPanel/></>}
      {auth==="authorized"&&introElapsed&&visualReady&&<div className="intro-cta">
        {realFeedPilot.enabled&&publicationCheck==="checking"&&
          <p role="status">Проверяем твою анкету на сервере…</p>}
        {realFeedPilot.enabled&&publicationCheck==="error"&&
          <><p role="alert">{publishFeedback}</p>
          <button type="button" className="primary-action" onClick={()=>setPublicationRetry(v=>v+1)}>Повторить проверку</button></>}
        {realOnly&&!remoteDraftPilot.enabled&&
          <p role="status">Настоящая регистрация пока не подключена. Демонстрационные анкеты выключены.</p>}
        {(!realFeedPilot.enabled&&(!realOnly||remoteDraftPilot.enabled)||publicationCheck==="ready")&&
          <button className="primary-action" type="button" onClick={beginRegistration} disabled={welcomeExiting}>
            Начать <ArrowRight size={21} strokeWidth={1.9} aria-hidden="true"/>
          </button>}
      </div>}
    </section>:<section className={"onboarding-screen"+(step===8?" registration-static-screen":"")}>
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
          addPhotos={addPhotos} removePhoto={removePhoto} movePhoto={movePhoto} resetDraft={resetDraft}/>
        {step===8&&realFeedPilot.enabled&&<section className="registration-preview-review" aria-label="Публикация анкеты">
          <label><input type="checkbox" checked={serverConsent} onChange={e=>setServerConsent(e.target.checked)}/>
            {" "}Я прочитал(а) <a href={remoteDraftPilot.policy} target="_blank" rel="noopener noreferrer">{testingNotice}</a> и согласен(-на) сохранить анкету и отправить фотографии на проверку перед публикацией.
          </label>
          <button type="button" disabled={publishBusy} onClick={()=>{void resumePublication();}}>Проверить модерацию и публикацию</button>
          {publishStatus&&<p role="status">Одобрено фото: {publishStatus.approved} · ожидают проверки: {publishStatus.pending}</p>}
          {publishFeedback&&<p role="status">{publishFeedback}</p>}
        </section>}
        {step===8&&remoteDraftPilot.enabled&&!realFeedPilot.enabled&&<section className="registration-preview-review" aria-label="Приватное серверное сохранение">
          <strong>Закрытый тест — настоящая серверная анкета</strong>
          <p>Поля анкеты сохранятся в закрытой базе LUEMI. Фотографии пока останутся на устройстве; анкету не увидят другие участники до включения публикации.</p>
          <label>
            <input type="checkbox" checked={serverConsent} onChange={e=>setServerConsent(e.target.checked)}/>
            {" "}Я прочитал(а) <a href={remoteDraftPilot.policy} target="_blank" rel="noopener noreferrer">
              {testingNotice}</a> и согласен(-на) сохранить черновик на сервере.
          </label>
          <button type="button" className="primary-action" disabled={!serverConsent||serverSaving}
            onClick={()=>{void persistServerDraft();}}>
            {serverSaving?"Сохранение…":"Сохранить приватный черновик"}
          </button>
          {serverStatus&&<p role="status">{serverStatus}</p>}
          {remoteMediaPilot.enabled&&privateDraftSaved&&serverConsent&&
            <div className="registration-preview-review" aria-label="Приватная загрузка фотографий">
              <p>Фотографии пройдут серверную проверку и попадут в очередь модерации. Публикация пока запрещена. Передавать можно только 3–6 фотографий.</p>
              <button className="primary-action" type="button" disabled={serverSaving||mediaSaving}
                onClick={()=>{void persistPrivatePhotos();}}>
                {mediaSaving?"Отправка фотографий…":"Отправить фото на приватную проверку"}
              </button>
              {mediaStatus&&<p role="status">{mediaStatus}</p>}
            </div>}
        </section>}
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
        {step===8?<div className="registration-static-actions">
          <button type="button" className="registration-static-edit" onClick={()=>changeStep(7)}>Редактировать</button>
          <button type="button" className="registration-static-confirm"
            onClick={realFeedPilot.enabled?()=>{void confirmRealRegistration();}:remoteDraftPilot.enabled?()=>{void persistServerDraft();}:beginDemo}
            disabled={publishBusy||serverSaving||(realOnly&&!remoteDraftPilot.enabled)}>
            {publishBusy||serverSaving?"Сохраняем…":remoteDraftPilot.enabled&&!realFeedPilot.enabled?"Сохранить анкету":realOnly&&!realFeedPilot.enabled?"Сервис недоступен":"Всё верно"}</button>
        </div>:<div className="footer-controls">
          <GlassArrow onClick={back}/>
          <span className="footer-hint">{realFeedPilot.enabled||realOnly?"Регистрация LUEMI":"Предпросмотр интерфейса"}</span>
          <GlassArrow forward onClick={next}/>
        </div>}
      </div>
    </section>)}
  </main>;
}
