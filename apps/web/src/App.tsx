import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {ArrowRight,Moon,Sun,Pencil} from "lucide-react";
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
const RealDiscoveryHome = lazy(() => import("./discovery/RealDiscoveryHome").then(m=>({default:m.RealDiscoveryHome})));
const RealLiveFeed = lazy(() => import("./registration/RealLiveFeed").then(m=>({default:m.RealLiveFeed})));
const RealChats = lazy(() => import("./chats/RealChats").then(m=>({default:m.RealChats})));
const RealRegistrationV2 = lazy(() => import("./registration/v2/RealRegistration").then(m=>({default:m.RealRegistrationV2})));
import {readyRegistrationPhotos} from "./discovery/ProfileModel";
import {startStartup} from "./startup/startup-coordinator";
import {authenticateBootstrap,recoverDeletion,type AuthStartupIdentity} from "./auth/session-adapter";
import {remoteDraftPilot,readRemoteRevision,saveRemoteDraft,saveRemoteFields} from "./registration/server-draft";
import {recoverServerFields} from "./registration/remote-recovery";
import {remoteMediaPilot,uploadPrivatePhotos,readConfirmedPrivateMediaCount} from "./registration/server-media";
import {registrationSubmissionDecision} from "./registration/real-submit-gate";
import {realFeedPilot,ownerPublicationStatus,publishMyProfile,unpublishMyProfile,withdrawRealConsent,requestMyAccountDeletion,deletionReasons,type DeletionReason,type PublishedFeedPage} from "./registration/real-live-client";
import {warmPublishedRecommendations,type WarmRecommendationSet} from "./registration/recommendation-warmup";
import {PublicationJourney,type PublishJourneyPhase} from "./registration/PublicationJourney";

import type {OwnerPublicationStatus} from "./registration/real-live-client";
import {PrivateAccountView} from "./registration/PrivateAccountView";
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

type AuthState = "connecting" | "outside-telegram" | "authorized" | "needs-bot" | "needs-invite" | "test-full" | "pending-deletion" | "error";
type ThemeChoice = "light" | "dark";
const logoSrc = "/assets/brand/wordmark_original_raster_alpha_W06.webp";
// Closed beta may never enter the synthetic Discovery deck.
const realOnly=import.meta.env.VITE_LUEMI_REAL_ONLY==="1";
const instantPublicationUi=import.meta.env.VITE_LUEMI_INSTANT_PUBLICATION_UI==="1";
// A public build cannot silently fall back to local-only media or beta notices.
const publicMediaUiMissing=import.meta.env.VITE_LUEMI_OPEN_SIGNUPS_UI==="1"&&
 (!remoteDraftPilot.enabled||!remoteMediaPilot.enabled||
  import.meta.env.VITE_LUEMI_FRIENDS_TEST_MODE==="1");
// Safe invited-only routing; real publication remains gated until trusted FaceTrust.
// REAL_ONLY must never fall back to the legacy registration form.
const registrationV2Pilot=remoteDraftPilot.enabled&&
 (realOnly||import.meta.env.VITE_LUEMI_REGISTRATION_V2==="1");
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
  const [serverPhotoCount,setServerPhotoCount]=useState(0);
  const [mediaSaving,setMediaSaving]=useState(false);
  const [mediaStatus,setMediaStatus]=useState("");
  const [publishStatus,setPublishStatus]=useState<OwnerPublicationStatus|null>(null);
  const [publicationCheck,setPublicationCheck]=useState<"idle"|"checking"|"ready"|"error">("idle");
  const [publicationRetry,setPublicationRetry]=useState(0);
  const [publishBusy,setPublishBusy]=useState(false);
  const [publishFeedback,setPublishFeedback]=useState("");
  const [journey,setJourney]=useState<PublishJourneyPhase|null>(null);
  const [journeyError,setJourneyError]=useState("");
  const [warmFeed,setWarmFeed]=useState<PublishedFeedPage|null>(null);
  const warmRef=useRef<WarmRecommendationSet|null>(null);
  useEffect(()=>()=>{warmRef.current?.release();warmRef.current=null;},[]);
  const [accountDeletionRequested,setAccountDeletionRequested]=useState(false);
  const [deletionUntil,setDeletionUntil]=useState<string|null>(null);
  const [deletionReason,setDeletionReason]=useState<DeletionReason>("prefer_not_to_say");
  const [deletionDetails,setDeletionDetails]=useState("");
  const [accountSettingsOpen,setAccountSettingsOpen]=useState(false);
  const [exportBusy,setExportBusy]=useState(false);
  const [recoveryBusy,setRecoveryBusy]=useState(false);
  const [recoveryError,setRecoveryError]=useState("");
  const [clockNow,setClockNow]=useState(()=>Date.now());
  useEffect(()=>{
   if(!accountDeletionRequested&&auth!=="pending-deletion")return;
   const timer=window.setInterval(()=>setClockNow(Date.now()),1000);
   return()=>window.clearInterval(timer);
  },[accountDeletionRequested,auth]);
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
        if(result.kind==="error"){if(result.reason.startsWith("deletion_pending:")){setDeletionUntil(result.reason.slice("deletion_pending:".length));setAuth("pending-deletion");return;}setAuth(result.reason==="invitation_required"?"needs-invite":
          result.reason==="test_full"?"test-full":"error");return;}
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
      }else{
        // An interrupted upload (e.g. only one photo) is not a profile.
        // Keep the user in registration and resume idempotently on retry.
        setRealHome(false);setPhase("form");
      }
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
        if(remoteMediaPilot.enabled){
          // Returning accounts must have a confirmed durable media set.
          try{
            const received=await readConfirmedPrivateMediaCount(3);
            if(disposed)return;
            setServerPhotoCount(received);
            setRealHomeTab("profile");setRealHome(true);
          }catch{
            if(disposed)return;
            setServerStatus("Поля восстановлены с сервера. Для завершения нужны сохранённые фотографии.");
            setRealHome(false);
          }
        }else{
          setRealHomeTab("profile");setRealHome(true);
        }
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
    setPhotos([]);setDraft(newDraft());setStep(1);setError("");setServerStatus("");setServerConsent(false);setPrivateDraftSaved(false);setServerPhotoCount(0);setMediaStatus("");setPublishStatus(null);
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
    if(publicMediaUiMissing||welcomeExiting||realOnly&&!remoteDraftPilot.enabled||
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
    if(photos.length<3||photos.length>6||photos.some(photo=>photo.status!=="ready")){
      setServerStatus("Выбери от 3 до 6 готовых фотографий.");return;
    }
    if(!scope||!photosRestored){
      setServerStatus("Фотографии ещё восстанавливаются. Попробуй повторить сохранение.");return;
    }
    setServerSaving(true);setServerStatus("Сохраняем фотографии на этом устройстве…");
    try{
      // The private beta intentionally has NO server photo upload. Check a
      // committed, verified IndexedDB copy before ever saying registration
      // succeeded or navigating away from the preview.
      const token=++saveSequence.current,photoRevision=++revision.current;
      const local=await saveDraftSnapshot(scope,draftId.current,photoRevision,draft,8,photos);
      if(!local.ok){
        retryKind.current="save";setStorageState("error");setStorageCode(local.code);
        setServerStatus("Не удалось сохранить фотографии на устройстве. Освободи место или проверь хранилище и повтори.");
        return;
      }
      if(token===saveSequence.current){setStorageState("saved");setStorageCode(null);}
      setServerStatus("Фотографии сохранены. Подтверждаем анкету на сервере…");
      const previous=await readRemoteRevision();
      if(previous.state==="private"&&!window.confirm(
        "На сервере уже есть приватная анкета. Обновить её текущими данными?"
      )){setServerStatus("Серверная анкета оставлена без изменений.");return;}
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
      const uploadedIds=await uploadPrivatePhotos([...photos],(done,total)=>
        setMediaStatus("Отправлено "+done+" из "+total+". Все фотографии приватны."));
      const received=await readConfirmedPrivateMediaCount(photos.length,uploadedIds);
      setServerPhotoCount(received);
      setPublishStatus(null);
      setMediaStatus("Сервер подтвердил сохранение "+received+" фотографий. До проверки они никому не видны.");
    }catch{
      setMediaStatus("Не все фотографии отправлены. Уже принятые остаются приватными. Проверь соединение перед повтором.");
    }finally{setMediaSaving(false);}
  };
  /** A private account is complete only when its photos are durably stored. */
  const confirmPrivateRegistration=async()=>{
    if(!remoteDraftPilot.enabled||!remoteMediaPilot.enabled||submitting.current||
       auth!=="authorized")return;
    for(let n=1;n<=7;n++){
      const problem=validateStep(draft,n,photos.length,new Date(),"live");
      if(problem){setServerStatus("Проверь анкету: "+problem);return;}
    }
    if(photos.length<3||photos.length>6||photos.some(p=>p.status!=="ready")){
      setServerStatus("Для сохранения нужны 3–6 готовых фотографий.");return;
    }
    if(!serverConsent){setServerStatus("Подтверди согласие на хранение анкеты и фотографий.");return;}
    submitting.current=true;setServerSaving(true);setServerStatus("Сохраняем анкету на сервере…");
    try{
      const previous=await readRemoteRevision();
      await saveRemoteDraft(draft,previous.revision);
      setPrivateDraftSaved(true);
      setServerStatus("Загружаем фотографии в приватное хранилище…");
      const uploadedIds=await uploadPrivatePhotos([...photos],(done,total)=>
        setServerStatus("Отправлено фотографий: "+done+" из "+total+"."));
      const received=await readConfirmedPrivateMediaCount(photos.length,uploadedIds);
      setServerPhotoCount(received);
      setServerStatus("Сервер подтвердил анкету и "+received+" фотографий.");
      setRealHomeTab("profile");setRealHome(true);
    }catch(e){
      setServerStatus(e instanceof Error&&e.message==="revision_conflict"
       ?"Анкета изменена на другом устройстве. Локальные данные сохранены; проверь их и повтори."
       :"Сервер не подтвердил сохранение всех фотографий. Локальные данные не удалены; повтори отправку.");
    }finally{submitting.current=false;setServerSaving(false);}
  };
  const finishSuccessfulPublication=async(status:OwnerPublicationStatus)=>{
    setPublishStatus(status);
    const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),9000);
    try{
      const warmed=await warmPublishedRecommendations(controller.signal,phase=>setJourney(phase));
      warmRef.current?.release();warmRef.current=warmed;
      setWarmFeed(warmed.page);
    }catch{
      // Published status is durable. Warmup failure does not lock the UI.
      setWarmFeed(null);
    }finally{window.clearTimeout(timeout);}
    setJourney(null);setRealHomeTab("feed");setRealHome(true);
  };
  const confirmRealRegistration=async()=>{
    if(!realFeedPilot.enabled||submitting.current)return;
    for(let n=1;n<=7;n++){
      const problem=validateStep(draft,n,photos.length,new Date(),"live");
      if(problem){setPublishFeedback("Проверь анкету: "+problem);return;}
    }
    if(photos.length<3||photos.length>6||photos.some(p=>p.status!=="ready")){
      setPublishFeedback("Для создания анкеты нужно 3–6 готовых фотографий.");return;
    }
    if(!serverConsent){setPublishFeedback("Прими условия обработки и публикации анкеты.");return;}
    submitting.current=true;setPublishBusy(true);setPublishFeedback("");
    setJourneyError("");setJourney("publishing");
    try{
      const existing=await ownerPublicationStatus();setPublishStatus(existing);
      if(registrationSubmissionDecision(existing)==="already-published"){
        await finishSuccessfulPublication(existing);return;
      }
      // Reserved uploads (other>0) are retried by the same photo id, not rejected.
      // A failed second upload must not strand an already accepted first photo.
      // Stable per-photo clientKey reuses successful uploads and retries the
      // missing photos; one approved image never redirects to account settings.
      const previous=await readRemoteRevision();
      await saveRemoteDraft(draft,previous.revision);
      setPrivateDraftSaved(true);
      if(existing.approved<photos.length||existing.pending>0||existing.other>0){
        const uploadedIds=await uploadPrivatePhotos([...photos],(done,total)=>
          setPublishFeedback("Сохранено "+done+" из "+total+" фотографий."));
        await readConfirmedPrivateMediaCount(photos.length,uploadedIds);
      }else await readConfirmedPrivateMediaCount(photos.length);
      const media=await ownerPublicationStatus();setPublishStatus(media);
      if(media.approved<photos.length||media.pending!==0||media.other!==0)
        throw new Error("incomplete_media");
      const saved=await readRemoteRevision();
      if(saved.state!=="private")throw new Error("missing_draft");
      await publishMyProfile(saved.revision);
      const confirmed=await ownerPublicationStatus();
      if(confirmed.state!=="published"||!confirmed.profile)
        throw new Error("publication_unconfirmed");
      await finishSuccessfulPublication(confirmed);
    }catch(e){
      const reason=e instanceof Error?e.message:"";
      const message=reason==="revision_conflict"
       ?"Анкета изменилась в другой сессии. Проверь данные и повтори создание.":
       reason==="incomplete_media"
       ?"Не все фотографии подтверждены сервером. Повтори: уже сохранённые фото не пропадут.":
       "Не удалось завершить публикацию. Анкета и уже загруженные фотографии сохранены. Повтори попытку.";
      setPublishFeedback(message);setJourneyError(message);setJourney("error");
    }finally{submitting.current=false;setPublishBusy(false);}
  };
  const resumePublication=async()=>{
    if(!realFeedPilot.enabled||submitting.current)return;
    submitting.current=true;setPublishBusy(true);setPublishFeedback("");
    try{
      const status=await ownerPublicationStatus();setPublishStatus(status);
      if(status.state==="published"){setRealHome(true);return;}
      if(status.approved<3||status.approved>6||status.pending||status.other){
        setPublishFeedback(instantPublicationUi?"Не все фотографии успешно загружены. Анкета пока скрыта.":"Фотографии ещё проходят проверку или требуют исправления. Анкета пока скрыта.");return;
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
    if(!window.confirm("Начать удаление? Анкета и фото сразу исчезнут из знакомств. Через 72 часа, если ты не восстановишь аккаунт, начнётся окончательная очистка."))return;
    setPublishBusy(true);setPublishFeedback("");
    try{
      const until=await requestMyAccountDeletion(deletionReason,deletionDetails);
      setDeletionUntil(until);
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
  const restoreMyAccount=async()=>{
    if(recoveryBusy)return;
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData){setRecoveryError("Для восстановления открой LUEMI внутри Telegram.");return;}
    setRecoveryBusy(true);setRecoveryError("");
    try{
      await recoverDeletion(initData);
      setAccountDeletionRequested(false);setDeletionUntil(null);setAuth("connecting");
      setConnectAttempt(v=>v+1);
    }catch(e){
      setRecoveryError(e instanceof Error&&e.message==="recovery_expired"
        ?"Срок восстановления истёк. Удаление уже нельзя отменить."
        :e instanceof Error&&e.message==="reopen_telegram"
        ?"Закрой и заново открой LUEMI через Telegram, затем повтори."
        :"Не удалось восстановить аккаунт. Попробуй ещё раз.");
    }finally{setRecoveryBusy(false);}
  };
  const deletionSettingsPanel=realFeedPilot.enabled?<>
   <p className="luemi-legal-link"><a href="/privacy" target="_blank" rel="noopener noreferrer">Конфиденциальность и использование данных</a></p>
   <button type="button" disabled={publishBusy} onClick={()=>setAccountSettingsOpen(v=>!v)}>Настройки аккаунта</button>
           {accountSettingsOpen&&<section className="registration-preview-review" aria-label="Настройки удаления аккаунта">
            <h2>Мои данные</h2>
            <p>Экспорт доступной анкеты и истории чатов. Оригинальные фото устройства, скрытые у обоих сообщения и материалы закрытых жалоб сюда не входят.</p>
            <button type="button" disabled={exportBusy||auth!=="authorized"} onClick={()=>{
              setExportBusy(true);setPublishFeedback("");
              void import("./registration/export-my-account")
                .then(module=>module.exportMyAvailableData())
                .catch(()=>setPublishFeedback("Не удалось подготовить экспорт. Проверь сессию Telegram и повтори."))
                .finally(()=>setExportBusy(false));
             }}>{exportBusy?"Готовим файл…":"Скачать доступные данные"}</button>
            <h2>Удалить аккаунт</h2>
            <p>Анкета и фотографии сразу исчезнут из знакомств. В течение 72 часов можно восстановить аккаунт.</p>
            <label>Причина удаления<select className="glass-control" value={deletionReason}
              onChange={e=>setDeletionReason(e.target.value as DeletionReason)}>
              {deletionReasons.map(([value,title])=><option key={value} value={value}>{title}</option>)}
            </select></label>
            <label>Комментарий (необязательно)<textarea className="glass-control" value={deletionDetails}
              maxLength={500} placeholder="Расскажи, что можно улучшить"
              onChange={e=>setDeletionDetails(e.target.value)}/></label>
            <button type="button" disabled={publishBusy} onClick={()=>{void eraseMyAccount();}}>
              {publishBusy?"Отправляем запрос…":"Начать удаление"}
            </button>
           </section>}
  </>:null;
  const remainingMs=deletionUntil?Math.max(0,new Date(deletionUntil).getTime()-clockNow):0;
  const remainingTime=`${Math.floor(remainingMs/86400000)} дн. ${String(Math.floor(remainingMs%86400000/3600000)).padStart(2,"0")}:${String(Math.floor(remainingMs%3600000/60000)).padStart(2,"0")}:${String(Math.floor(remainingMs%60000/1000)).padStart(2,"0")}`;
  if(accountDeletionRequested||auth==="pending-deletion")return <main className="luemi-shell" data-theme={activeTheme}
    data-scene="intro" role="status" style={{padding:"32px 22px",display:"grid",alignContent:"center",gap:18}}>
    <img src={logoSrc} alt="LUEMI" style={{width:150,maxWidth:"100%",justifySelf:"center"}}/>
    <h2>Аккаунт готовится к удалению</h2>
    <p>Анкета и фото уже скрыты от других людей, а прежние сессии отключены.</p>
    <p role="timer" aria-live="off">До окончательного удаления: <strong>{remainingTime}</strong></p>
    {deletionUntil&&<p>Срок до {new Date(deletionUntil).toLocaleString("ru-RU")} по времени устройства.</p>}
    <p>Восстановить аккаунт можно только отдельным подтверждением. Простой вход в Telegram не отменяет удаление.</p>
    <button type="button" className="primary-action" disabled={recoveryBusy||remainingMs===0}
     onClick={()=>{void restoreMyAccount();}}>{recoveryBusy?"Восстанавливаем…":"Восстановить аккаунт"}</button>
    {recoveryError&&<p role="alert">{recoveryError}</p>}
    {localDeletionFailed&&<p role="alert">Локальный черновик на устройстве не удалось очистить. Можно очистить данные Mini App вручную.</p>}
    <p>После срока сервер начнёт безвозвратное удаление файлов и записей.</p>
    <p><a href="/privacy" target="_blank" rel="noopener noreferrer">Как LUEMI обрабатывает данные</a></p>
  </main>;
  const themeButton=<button className="theme-switch" type="button" onClick={changeTheme}
    aria-label={"Включить тему: "+themeName}>
    {theme==="light"?<Moon size={17} strokeWidth={1.8}/>:<Sun size={17} strokeWidth={1.8}/>}
  </button>;
  // All signed-in accounts retain the approved LUEMI four-tab Discovery,
  // cinematic photo cards and Profile Morph V3. REAL_ONLY changes data, not UI.
  if(realHome&&auth==="authorized"&&realFeedPilot.enabled)
   return <main ref={rootRef} className="luemi-shell" data-theme={activeTheme}>
    <Suspense fallback={<div className="discovery-empty" role="status">Открываем LUEMI…</div>}>
     <RealDiscoveryHome draft={draft} theme={theme} onTheme={changeTheme}
      initialFeed={warmFeed} publishedProfile={publishStatus?.profile}
      onEdit={()=>{setRealHome(false);setPhase("form");setStep(8);}}
      accountPanel={<section className="luemi-real-account" aria-label="Настройки аккаунта">
       <h1>Мой аккаунт</h1>
       {publishStatus?.state!=="published"&&<>
        <p role="status">Анкета ещё не опубликована. Проверь фотографии и заверши публикацию.</p>
        <p>Готовых фото: {publishStatus?.approved??0}</p>
        <button type="button" disabled={publishBusy} onClick={()=>{void resumePublication();}}>
         {publishBusy?"Публикуем…":"Завершить публикацию"}</button>
       </>}
       <p role="status">{publishStatus?.state==="published"?
        "Анкета опубликована и видна подходящим пользователям.":"Статус анкеты можно проверить здесь."}</p>
       {publishStatus?.state==="published"&&<div className="registration-static-actions">
        <button type="button" className="registration-static-edit" disabled={publishBusy}
         onClick={()=>{void openPublishedEditor();}}>Изменить информацию</button>
        <button type="button" className="registration-static-edit" disabled={publishBusy}
         onClick={()=>{void hideProfile();}}>Скрыть анкету</button>
       </div>}
       {publishedEditor&&<section className="registration-preview-review" aria-label="Изменение анкеты">
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
       {publishStatus?.state==="published"&&<button type="button"
        disabled={publishBusy} onClick={()=>{void withdrawPersonalConsent();}}>
        Отозвать согласие и скрыть анкету</button>}
       {deletionSettingsPanel}
       {publishFeedback&&<p role="status">{publishFeedback}</p>}
      </section>}/>
    </Suspense>
   </main>;
  if(realHome&&auth==="authorized")return <main ref={rootRef} className="luemi-shell" data-theme={activeTheme}>
    <section className="luemi-real-home" data-account-mode={!realFeedPilot.enabled&&remoteDraftPilot.enabled?"private":"standard"}
      data-telegram-ui={window.Telegram?.WebApp?"true":"false"} aria-label="LUEMI — настоящие анкеты">
      <header className="luemi-real-home-top">
        <img src={logoSrc} alt="LUEMI" className="onboard-logo"/>
        {themeButton}
      </header>
      <div className="luemi-real-home-main">
        {!realFeedPilot.enabled&&remoteDraftPilot.enabled?<PrivateAccountView draft={draft} photos={readyPhotos} serverPhotoCount={serverPhotoCount}/>:publishStatus?.state!=="published"&&realHomeTab==="profile"?<section className="luemi-real-account" aria-label="Статус регистрации">
          <h1>Анкета сохранена 💜</h1>
          <p role="status">{instantPublicationUi?"Твоя анкета ещё не опубликована. Проверь сохранение всех фотографий на сервере.":"Твой Telegram-аккаунт зарегистрирован. Пока фотографии проходят модерацию, твоя анкета скрыта от других."}</p>
          <p>Опубликованные анкеты других людей можно смотреть во вкладке «Знакомства».</p>
          <p>{instantPublicationUi?"Загружено фото: ":"Принято фото: "}{publishStatus?.approved??0}{!instantPublicationUi&&<> · на проверке: {publishStatus?.pending??0}</>} · требуют внимания: {publishStatus?.other??0}</p>
          <button type="button" disabled={publishBusy} onClick={()=>{void resumePublication();}}>
            {publishBusy?"Сохраняем…":instantPublicationUi?"Завершить публикацию":"Проверить модерацию и открыть анкету"}
          </button>
          <button type="button" disabled={publishBusy} onClick={()=>{setRealHome(false);setPhase("form");setStep(8);}}>
            Вернуться к анкете и фотографиям
          </button>
          {deletionSettingsPanel}
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
          {deletionSettingsPanel}
          {publishFeedback&&<p role="status">{publishFeedback}</p>}
        </section>:<Suspense fallback={<p role="status">Загружаем…</p>}>
          {realHomeTab==="chats"&&import.meta.env.VITE_LUEMI_REAL_CHATS==="1"?
            <RealChats/>:<RealLiveFeed onMatched={()=>setRealHomeTab("chats")}/>}
        </Suspense>}
      </div>
      {!realFeedPilot.enabled&&remoteDraftPilot.enabled&&<footer className="luemi-private-edit-bar">
        <button type="button" onClick={()=>{setRealHome(false);setPhase("form");setStep(8);}}>
          <Pencil size={19} aria-hidden="true"/> Редактировать анкету <ArrowRight size={19} aria-hidden="true"/>
        </button>
      </footer>}
      {realFeedPilot.enabled&&publishStatus!==null&&<nav className="luemi-real-home-nav" aria-label="Разделы LUEMI">
        <button type="button" aria-current={realHomeTab==="feed"?"page":undefined} onClick={()=>setRealHomeTab("feed")}>Знакомства</button>
        {publishStatus?.state==="published"&&import.meta.env.VITE_LUEMI_REAL_CHATS==="1"&&
          <button type="button" aria-current={realHomeTab==="chats"?"page":undefined} onClick={()=>setRealHomeTab("chats")}>Чаты</button>}
        <button type="button" aria-current={realHomeTab==="profile"?"page":undefined} onClick={()=>setRealHomeTab("profile")}>Профиль</button>
      </nav>}
    </section>
  </main>;
  if(auth==="authorized"&&journey!==null)
    return <PublicationJourney phase={journey} error={journeyError}
      onRetry={()=>{setJourney(null);void confirmRealRegistration();}}
      onBack={()=>{setJourney(null);setPhase("form");}}/>;
  if(auth==="authorized"&&phase==="form"&&registrationV2Pilot&&!demoOpen)
    return <Suspense fallback={<main className="luemi-shell" data-theme={activeTheme}
      role="status" style={{padding:24}}>Открываем регистрацию…</main>}>
      <RealRegistrationV2 draft={draft} patch={patch} photos={photos}
       addPhotos={addPhotos} removePhoto={removePhoto} movePhoto={movePhoto}
       resetDraft={resetDraft} serverConsent={serverConsent}
       theme={theme} onTheme={changeTheme}
       setServerConsent={setServerConsent}
        onSave={()=>{void (realFeedPilot.enabled?confirmRealRegistration():
          remoteMediaPilot.enabled?confirmPrivateRegistration():persistServerDraft());}}
        mediaEnabled={remoteMediaPilot.enabled}
        publicationEnabled={realFeedPilot.enabled}
       serverSaving={serverSaving||publishBusy}
        serverStatus={realFeedPilot.enabled?publishFeedback:serverStatus}
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
      {auth==="test-full"&&<><p role="status">Все места в текущей тестовой группе LUEMI заняты. Уже зарегистрированные участники могут продолжить вход.</p>
        <button className="primary-action" type="button" onClick={()=>{setAuth("connecting");setConnectAttempt(v=>v+1);}}>Повторить вход</button></>}
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
        {publicMediaUiMissing&&<p role="alert">Загрузка фотографий на сервер не подключена. Регистрация временно недоступна, чтобы не потерять данные.</p>}
        {!publicMediaUiMissing&&(!realFeedPilot.enabled&&(!realOnly||remoteDraftPilot.enabled)||publicationCheck==="ready")&&
          <button className="primary-action" type="button" onClick={beginRegistration} disabled={welcomeExiting}>
            Начать <ArrowRight size={21} strokeWidth={1.9} aria-hidden="true"/>
          </button>}
      </div>}
      <p className="luemi-privacy-footer"><a href="/privacy" target="_blank" rel="noopener noreferrer">Конфиденциальность и использование данных</a></p>
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
            {" "}Я прочитал(а) <a href={remoteDraftPilot.policy} target="_blank" rel="noopener noreferrer">{testingNotice}</a> и согласен(-на) сохранить анкету и {instantPublicationUi?"сразу опубликовать фотографии в профиле.":"отправить фотографии на проверку перед публикацией."}
          </label>
          <button type="button" disabled={publishBusy} onClick={()=>{void resumePublication();}}>{instantPublicationUi?"Опубликовать анкету":"Проверить модерацию и публикацию"}</button>
          {publishStatus&&<p role="status">{instantPublicationUi?"Загружено фото: ":"Принято фото: "}{publishStatus.approved}{!instantPublicationUi&&<> · ожидают проверки: {publishStatus.pending}</>}</p>}
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
