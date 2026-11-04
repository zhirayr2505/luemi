import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {flushSync} from "react-dom";

import {ArrowRight,Pencil} from "lucide-react";
import {SafetyAppealPanel} from "./SafetyAppealPanel";
import {GlassArrow} from "./ui/Glass";
import type { HealthResponse } from "@luemi/contracts";
import { birthDateValid,cleanName,nameValid,newDraft,goals,selectedCityValid,steps,validateStep,type RegistrationDraft } from "./registration/model";
import { RegistrationStep, SelectedInterests, type PhotoItem } from "./registration/Steps";
import {localScope,loadDraftSnapshot,saveDraftSnapshot,clearDraftSnapshot,type StorageCode} from "./registration/local-draft";
import {preparePhotoPreview} from "./registration/photo-preview";
import {installViewportController} from "./viewport/viewport-controller";
// Load the heavy Discovery/profile route only after the entry shell can paint.
const DiscoveryApp = lazy(() => import("./discovery/DiscoveryApp").then(m => ({default:m.DiscoveryApp})));
const RealDiscoveryHome = lazy(() => import("./discovery/RealDiscoveryHome").then(m=>({default:m.RealDiscoveryHome})));
const RealLiveFeed = lazy(() => import("./registration/RealLiveFeed").then(m=>({default:m.RealLiveFeed})));
const RealChats = lazy(() => import("./chats/RealChats").then(m=>({default:m.RealChats})));
import {RealRegistrationV2} from "./registration/v2/RealRegistration";
import {readyRegistrationPhotos} from "./discovery/ProfileModel";
import {startStartup} from "./startup/startup-coordinator";
import {authenticateBootstrap,recoverDeletion,type AuthStartupIdentity} from "./auth/session-adapter";
import {remoteDraftPilot,readRemoteRevision,saveRemoteDraft,saveRemoteFields} from "./registration/server-draft";
import {recoverServerFields} from "./registration/remote-recovery";
import {remoteMediaPilot,uploadPrivatePhotos,uploadPrivatePhoto,deletePrivatePhoto,orderPrivatePhotos,reconcilePrivatePhotos,readConfirmedPrivateMediaCount,planPrivatePhotos} from "./registration/server-media";
import {registrationSubmissionDecision} from "./registration/real-submit-gate";
import {realFeedPilot,ownerPublicationStatus,publishMyProfile,unpublishMyProfile,withdrawRealConsent,requestMyAccountDeletion,deletionReasons,type DeletionReason,type PublishedFeedPage} from "./registration/real-live-client";
import {warmPublishedRecommendations,type WarmRecommendationSet} from "./registration/recommendation-warmup";
import {PublicationJourney,type PublishJourneyPhase} from "./registration/PublicationJourney";

import type {OwnerPublicationStatus} from "./registration/real-live-client";
import {PrivateAccountView} from "./registration/PrivateAccountView";
import "./registration/real-home.css";
import "./registration/cinematic-welcome.css";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {start_param?: string};
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
        setBottomBarColor?: (color: string) => void;
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
// Every server-backed account uses one registration implementation. The old
// local demo flow is isolated below and can no longer replace V2 because of a
// stale deployment flag.
const registrationV2Pilot=remoteDraftPilot.enabled;
const testingNotice=import.meta.env.VITE_LUEMI_FRIENDS_TEST_MODE==="1"?"ÑƒÑĞ»Ğ¾Ğ²Ğ¸Ñ Ğ·Ğ°ĞºÑ€Ñ‹Ñ‚Ğ¾Ğ³Ğ¾ Ñ‚ĞµÑÑ‚Ğ°":"Ğ¿Ğ¾Ğ»Ğ¸Ñ‚Ğ¸ĞºÑƒ Ğ¾Ğ±Ñ€Ğ°Ğ±Ğ¾Ñ‚ĞºĞ¸ Ğ´Ğ°Ğ½Ğ½Ñ‹Ñ…";

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
  const [connectAttempt,setConnectAttempt]=useState(0);
  const startupGeneration=useRef(0);
  const [visualReady,setVisualReady] = useState(false);
  const introElapsed=visualReady;
  const [introText,setIntroText] = useState("");
  const routeTransitioning = useRef(false);
  const [registrationFallback,setRegistrationFallback] = useState(false);
  const [phase,setPhase] = useState<"welcome"|"form">("welcome");
  const [demoOpen,setDemoOpen] = useState(false);
  const [realHome,setRealHome] = useState(false);
  const [realHomeTab,setRealHomeTab] = useState<"feed"|"chats"|"profile">("feed");
  const [publishedEditor,setPublishedEditor]=useState<{name:string;about:string;goal:string}|null>(null);
  const submitting=useRef(false);
  const [scope,setScope] = useState<string|null>(()=>localScope());
  const actorScopeRef=useRef<string|null>(scope);
  const accountEpoch=useRef(0);
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
  // Telegram may prefill a first name for a brand-new account; that alone is
  // not registration progress and must still show â€œĞĞ°Ñ‡Ğ°Ñ‚ÑŒ Ğ·Ğ½Ğ°ĞºĞ¾Ğ¼ÑÑ‚Ğ²Ğ¾â€.
  const registrationStarted=step>1||draft.day.length>0||!!draft.gender||
    draft.city.length>0||draft.about.trim().length>0||photos.length>0;
  const photosLive=useRef<PhotoItem[]>([]);
  photosLive.current=photos;
  const draftLive=useRef(draft);draftLive.current=draft;
  // Photo bytes are queued as soon as the current actor has consented. The
  // final preview still reconciles the manifest before publication.
  const privateAssetIds=useRef(new Map<string,string>());
  const privateMediaQueue=useRef<Promise<unknown>>(Promise.resolve());
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
  const closePublicationJourney=useCallback(()=>setJourney(null),[]);
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
  const theme:ThemeChoice="dark";
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
    if(typeof change.trialConsent==="boolean")setServerConsent(change.trialConsent);
  },[]);
  useEffect(()=>{
    if(draft.trialConsent)setServerConsent(true);
  },[draft.trialConsent]);
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
    };
  },[]);
  useEffect(()=>{
    // Telegram may delay a font/image decode callback. The welcome screen and
    // its CTA must still become usable while those assets finish in background.
    const fallback=window.setTimeout(()=>setVisualReady(true),650);
    return()=>window.clearTimeout(fallback);
  },[]);
  useEffect(()=>{
    if(!visualReady||auth==="connecting")return;
    setIntroText("Ğ¢Ğ²Ğ¾Ñ Ğ¸ÑÑ‚Ğ¾Ñ€Ğ¸Ñ Ğ½Ğ°Ñ‡Ğ¸Ğ½Ğ°ĞµÑ‚ÑÑ Ğ·Ğ´ĞµÑÑŒ");
  },[auth,visualReady]);
  useEffect(()=>{
    const webApp=window.Telegram?.WebApp;
    try{
      const background=auth==="authorized"&&!realHome?(phase==="form"?"#1c1424":"#211725"):
        activeTheme==="dark"?"#211725":"#fffbfd";
      webApp?.setHeaderColor?.(background);
      webApp?.setBackgroundColor?.(background);
      webApp?.setBottomBarColor?.(background);
    } catch {
      // Older clients do not support every color-setting method.
    }
  },[activeTheme,auth,realHome,phase]);
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
        // Use the server-verified actor returned by the bootstrap response.
        // Reading the module-level scope here can race a second Telegram login.
        const authenticatedScope=("mode" in user&&user.mode==="session_v2")?user.user.id:localScope();
        if(!authenticatedScope&&import.meta.env.VITE_LUEMI_AUTH_V2==="1"){
          setAuth("error");return;
        }
        if(authenticatedScope&&actorScopeRef.current!==authenticatedScope){
          // A new verified Telegram actor cannot inherit any previous in-memory data.
          actorScopeRef.current=authenticatedScope;
          ++accountEpoch.current;
          ++saveSequence.current;++photoGeneration.current;
          persistEnabled.current=false;
          for(const job of photoJobs.current.values())job.abort();
          photoJobs.current.clear();
          for(const url of ownedUrls.current)URL.revokeObjectURL(url);
          ownedUrls.current=[];photoIds.current.clear();privateAssetIds.current.clear();
          setPhotos([]);setPhotosRestored(false);
          setStep(1);setDraft(newDraft(user.user.firstName));
          draftId.current=crypto.randomUUID();revision.current=0;
          setPrivateDraftSaved(false);setServerPhotoCount(0);setServerConsent(false);
          setRealHome(false);setRealHomeTab("feed");setPhase("welcome");
          setPublishStatus(null);setPublicationCheck("idle");setServerStatus("");
          setMediaStatus("");setJourney(null);setJourneyError("");
          setScope(authenticatedScope);
        }else setDraft(current=>({...current,name:current.name||user.user.firstName}));
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
        // A new account must see the branded welcome screen. A private draft
        // is restored by the draft loader below, which is the only place that
        // may deliberately enter the registration form.
        setRealHome(false);
      }
    }).catch(()=>{
      if(!disposed){
        setPublicationCheck("error");
        setPublishFeedback("ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€Ğ¸Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ Ğ½Ğ° ÑĞµÑ€Ğ²ĞµÑ€Ğµ. ĞĞ¸Ñ‡ĞµĞ³Ğ¾ Ğ½Ğµ Ğ¿Ğ¾Ñ‚ĞµÑ€ÑĞ½Ğ¾ â€” Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸ Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ĞºÑƒ.");
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
    if(auth!=="authorized"||!scope)return;
    const accountScope=scope,epoch=accountEpoch.current;
    const isLive=()=>!disposed&&generation===photoGeneration.current&&
      accountEpoch.current===epoch&&actorScopeRef.current===accountScope&&scope===accountScope;
    setStorageState("loading");
    void loadDraftSnapshot(scope).then(async result=>{
      if(!isLive())return;
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
          if(!isLive())return;
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
            if(!isLive())return;
            setServerPhotoCount(received);
            setRealHomeTab("profile");setRealHome(true);
          }catch{
            if(!isLive())return;
            setServerStatus("ĞŸĞ¾Ğ»Ñ Ğ²Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ¾Ğ²Ğ»ĞµĞ½Ñ‹ Ñ ÑĞµÑ€Ğ²ĞµÑ€Ğ°. Ğ”Ğ»Ñ Ğ·Ğ°Ğ²ĞµÑ€ÑˆĞµĞ½Ğ¸Ñ Ğ½ÑƒĞ¶Ğ½Ñ‹ ÑĞ¾Ñ…Ñ€Ğ°Ğ½Ñ‘Ğ½Ğ½Ñ‹Ğµ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸.");
            setRealHome(false);
          }
        }else{
          setRealHomeTab("profile");setRealHome(true);
        }
      }else if(snapshot){
        const restoredDraft=snapshot.draft.name.trim()?snapshot.draft:
          {...snapshot.draft,name:draftLive.current.name};
        setDraft(restoredDraft);
        setStep(snapshot.step);
        // Keep an unfinished account on the branded welcome. Restored progress
        // changes the CTA to â€œĞŸÑ€Ğ¾Ğ´Ğ¾Ğ»Ğ¶Ğ¸Ñ‚ÑŒ Ñ€ĞµĞ³Ğ¸ÑÑ‚Ñ€Ğ°Ñ†Ğ¸Ñâ€ but never bypasses it.
      }else if(realFeedPilot.enabled){
        // A new device can recover fields, but must select its city and photos
        // again. Never claim that private media bytes are in this response.
        try{
          const remote=await readRemoteRevision();
          if(!isLive())return;
          if(remote.state==="private"){
            const recovered=recoverServerFields(remote.fields);
            if(recovered){setDraft(recovered);setStep(3);}
          }
        }catch{/* Offline users retain the empty local draft. */}
      }
      const restoredPhotos:PhotoItem[]=[];
      for(const item of snapshot?.photos??[]){
        if(!isLive())break;
        let preview=item.preview;
        if(!preview){
          const job=photoQueue.current.then(async()=>{preview=await preparePhotoPreview(item.file,controller.signal);});
          photoQueue.current=job.catch(()=>{});
          try{await job;}catch{
            if(!isLive()||controller.signal.aborted)break;
            restoredPhotos.push({...item,src:"",status:"error"});continue;
          }
        }
        if(!isLive())break;
        const src=URL.createObjectURL(preview!);ownedUrls.current.push(src);
        restoredPhotos.push({...item,preview,src,status:"ready"});
      }
      if(!isLive()||photoIds.current.size){
        for(const photo of restoredPhotos)if(photo.src){
          URL.revokeObjectURL(photo.src);
          ownedUrls.current=ownedUrls.current.filter(url=>url!==photo.src);
        }
        if(isLive()){setPhotosRestored(true);setStorageState("idle");}
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
      if(isLive()){retryKind.current="load";setStorageCode("io");setStorageState("error");}
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
  const backActionRef=useRef(back);
   backActionRef.current=back;
   useEffect(()=>{
     const button=window.Telegram?.WebApp?.BackButton;
     if(!button)return;
     if(auth==="authorized"&&(demoOpen||phase==="form")){
       const handle=()=>{
         if(journey==="error"){setJourney(null);setJourneyError("");return;}
         if(journey!==null)return;
         if(demoOpen)discoveryBackRef.current();
         else backActionRef.current();
       };
       button.show();button.onClick(handle);
       return ()=>{button.offClick(handle);button.hide();};
     }
     button.hide();
   },[phase,auth,demoOpen,journey]);
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
  const syncChosenPhotos=useCallback((consented:boolean):Promise<string[]>=>{
    const taskEpoch=accountEpoch.current;
    const run=async():Promise<string[]>=>{
      if(!remoteMediaPilot.enabled||auth!=="authorized"||taskEpoch!==accountEpoch.current)return[];
      try{
        if(consented){
          if(taskEpoch!==accountEpoch.current)return[];
          // The request role accepts bytes only AFTER the server has stored
          // an 18+ private draft and current consent version.
          const previous=await readRemoteRevision();
          if(taskEpoch!==accountEpoch.current)return[];
          await saveRemoteDraft(draftLive.current,previous.revision);
          const ready=photosLive.current.filter(p=>p.status==="ready");
          if(ready.length){
            const plan=await planPrivatePhotos(ready);
            for(const assetId of plan.staleAssetIds){
              await deletePrivatePhoto(assetId);
              for(const [localId,mappedId] of privateAssetIds.current)
                if(mappedId===assetId)privateAssetIds.current.delete(localId);
            }
            for(const photo of ready){
              const matched=plan.matched.get(photo.id);
              if(matched&&matched.state!=="reserved")privateAssetIds.current.set(photo.id,matched.assetId);
              else if(matched?.state==="reserved")privateAssetIds.current.delete(photo.id);
            }
            setPhotos(current=>{
              let changed=false;
              const next=current.map(photo=>{
                const matched=plan.matched.get(photo.id);
                if(!matched||matched.state==="reserved"||photo.serverStatus==="saved")return photo;
                changed=true;return {...photo,serverStatus:"saved" as const};
              });
              return changed?next:current;
            });
          }
          for(const photo of ready){
            if(!photoIds.current.has(photo.id)||privateAssetIds.current.has(photo.id))continue;
            setPhotos(current=>current.map(item=>item.id===photo.id?{...item,serverStatus:"uploading"}:item));
            const id=await uploadPrivatePhoto(photo);
            privateAssetIds.current.set(photo.id,id);
            setPhotos(current=>current.map(item=>item.id===photo.id?{...item,serverStatus:"saved"}:item));
          }
        }
        // Always clean owner-removed objects even if consent is later unchecked.
        for(const [localId,assetId] of [...privateAssetIds.current]){
          // Unchecking consent withdraws the authorization to retain any
          // unpublished photo, even when it is still selected locally.
          if(consented&&photoIds.current.has(localId))continue;
          await deletePrivatePhoto(assetId);
          privateAssetIds.current.delete(localId);
        }
        const ids=photosLive.current.map(p=>privateAssetIds.current.get(p.id))
          .filter((id):id is string=>!!id);
        if(consented&&ids.length===photosLive.current.filter(p=>p.status==="ready").length&&ids.length){
          await orderPrivatePhotos(ids);
        }
        return ids;
      }catch(e){
        setPhotos(current=>current.map(photo=>photo.status==="ready"&&!privateAssetIds.current.has(photo.id)
          ?{...photo,serverStatus:"error" as const}:photo));
        throw e;
      }
    };
    const task=privateMediaQueue.current.then(run,run);
    privateMediaQueue.current=task.catch(()=>{});
    return task;
  },[auth]);
  const draftReadyForPrivateMedia=nameValid(draft.name)&&
    birthDateValid(draft.day,draft.month,draft.year)&&!!draft.gender&&draft.trialConsent&&
    selectedCityValid(draft)&&!!draft.audience&&!!draft.goal;
  useEffect(()=>{
    if(!remoteMediaPilot.enabled||auth!=="authorized"||!serverConsent||!scope||
      !draftReadyForPrivateMedia||photos.length<3||
      !photos.some(photo=>photo.status==="ready"&&!privateAssetIds.current.has(photo.id)))return;
    const epoch=accountEpoch.current;
    void syncChosenPhotos(true).catch(()=>{
      if(epoch===accountEpoch.current)setMediaStatus("ĞĞµ Ğ²ÑĞµ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ·Ğ°Ğ³Ñ€ÑƒĞ·Ğ¸Ğ»Ğ¸ÑÑŒ. ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ğ¼ Ğ¿Ñ€Ğ¸ ÑĞ»ĞµĞ´ÑƒÑÑ‰ĞµĞ¼ Ğ¸Ğ·Ğ¼ĞµĞ½ĞµĞ½Ğ¸Ğ¸.");
    });
  },[auth,photos,scope,serverConsent,draftReadyForPrivateMedia,syncChosenPhotos]);
  const addPhotos=(files:File[])=>{
    if(!files.length)return;
    setPrivateDraftSaved(false);setMediaStatus("");setPublishStatus(null);
    persistEnabled.current=true;setStorageState("dirty");
    const accepted:PhotoItem[]=[];
    let problem="";
    for(const file of files){
      if(photoIds.current.size>=6){problem="ĞœĞ°ĞºÑĞ¸Ğ¼ÑƒĞ¼ 6 Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹.";break;}
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>12*1024*1024){
        problem="Ğ Ğ°Ğ·Ñ€ĞµÑˆĞµĞ½Ñ‹ JPEG, PNG Ğ¸ WebP Ğ´Ğ¾ 12 ĞœĞ‘. Ğ”Ğ»Ñ HEIC Ğ²Ñ‹Ğ±ĞµÑ€Ğ¸ JPEG.";continue;
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
          },180));
        }catch{
          if(!controller.signal.aborted){
            setPhotos(current=>current.map(p=>p.id===photo.id?{...p,status:"error"}:p));
            setError("ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¾Ğ±Ñ€Ğ°Ğ±Ğ¾Ñ‚Ğ°Ñ‚ÑŒ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ñ.");
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
    const assetId=privateAssetIds.current.get(id);
    if(assetId){
      privateAssetIds.current.delete(id);
      const task=privateMediaQueue.current.then(()=>deletePrivatePhoto(assetId));
      privateMediaQueue.current=task.catch(()=>{});
      void task.catch(()=>setMediaStatus("Ğ¤Ğ¾Ñ‚Ğ¾ ÑƒĞ±Ñ€Ğ°Ğ½Ğ¾ Ğ¸Ğ· Ğ°Ğ½ĞºĞµÑ‚Ñ‹. Ğ¡ĞµÑ€Ğ²ĞµÑ€Ğ½Ğ¾Ğµ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ñ‚ÑÑ Ğ¿Ğ¾Ğ·Ğ¶Ğµ."));
    }
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
    if(!window.confirm("Ğ£Ğ´Ğ°Ğ»Ğ¸Ñ‚ÑŒ ÑĞ¾Ñ…Ñ€Ğ°Ğ½Ñ‘Ğ½Ğ½Ñ‹Ğ¹ Ğ½Ğ° ÑÑ‚Ğ¾Ğ¼ ÑƒÑÑ‚Ñ€Ğ¾Ğ¹ÑÑ‚Ğ²Ğµ Ñ‡ĞµÑ€Ğ½Ğ¾Ğ²Ğ¸Ğº, Ğ²ĞºĞ»ÑÑ‡Ğ°Ñ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸?"))return;
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
    if(routeTransitioning.current||realOnly&&!remoteDraftPilot.enabled||
      realFeedPilot.enabled&&publicationCheck!=="ready")return;
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches||
      document.visibilityState!=="visible"){
      setRegistrationFallback(false);
      setPhase("form");
      return;
    }
    const viewDocument=document as Document&{startViewTransition?:(update:()=>void)=>{finished:Promise<void>}};
    if(viewDocument.startViewTransition){
      routeTransitioning.current=true;
      document.documentElement.dataset.luemiRoute="true";
      try{
        const transition=viewDocument.startViewTransition(()=>flushSync(()=>{
          setRegistrationFallback(false);setPhase("form");
        }));
        const clear=()=>{delete document.documentElement.dataset.luemiRoute;routeTransitioning.current=false;};
        void transition.finished.then(clear,clear);
      }catch{
        delete document.documentElement.dataset.luemiRoute;
        routeTransitioning.current=false;
        setRegistrationFallback(true);
        setPhase("form");
      }
      return;
    }
    // Older Android WebViews get one entrance on the new screen. A timed
    // exit followed by another entrance left an empty frame between them.
    setRegistrationFallback(true);
    setPhase("form");
  };
  const changeTheme=useCallback(()=>{},[]);
  const beginDemo=()=>{if(realOnly){setError("ĞĞ°ÑÑ‚Ğ¾ÑÑ‰Ğ°Ñ Ñ€ĞµĞ³Ğ¸ÑÑ‚Ñ€Ğ°Ñ†Ğ¸Ñ Ğ¿Ğ¾ĞºĞ° Ğ½Ğµ Ğ¿Ğ¾Ğ´ĞºĞ»ÑÑ‡ĞµĞ½Ğ°. Ğ”ĞµĞ¼Ğ¾Ğ½ÑÑ‚Ñ€Ğ°Ñ†Ğ¸Ğ¾Ğ½Ğ½Ñ‹Ğµ Ğ°Ğ½ĞºĞµÑ‚Ñ‹ Ğ½ĞµĞ´Ğ¾ÑÑ‚ÑƒĞ¿Ğ½Ñ‹.");return;}setDemoOpen(true);setError("");};
  const exitDemo=useCallback(()=>{setDemoOpen(false);setPhase("form");setStep(8);},[]);
  const readyPhotos=useMemo(()=>readyRegistrationPhotos(photos),[photos]);
  const persistServerDraft=async()=>{
    if(!remoteDraftPilot.enabled||!serverConsent||serverSaving||auth!=="authorized")return;
    for(let n=1;n<=6;n++){
      const problem=validateStep(draft,n,photos.length,new Date(),realFeedPilot.enabled?"live":"demo");
      if(problem){setServerStatus("ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ ÑˆĞ°Ğ³ "+n+": "+problem);return;}
    }
    if(photos.length<3||photos.length>6||photos.some(photo=>photo.status!=="ready")){
      setServerStatus("Ğ’Ñ‹Ğ±ĞµÑ€Ğ¸ Ğ¾Ñ‚ 3 Ğ´Ğ¾ 6 Ğ³Ğ¾Ñ‚Ğ¾Ğ²Ñ‹Ñ… Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹.");return;
    }
    if(!scope||!photosRestored){
      setServerStatus("Ğ¤Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ ĞµÑ‰Ñ‘ Ğ²Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ°Ğ²Ğ»Ğ¸Ğ²Ğ°ÑÑ‚ÑÑ. ĞŸĞ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ñ‚ÑŒ ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ğ¸Ğµ.");return;
    }
    setServerSaving(true);setServerStatus("Ğ¡Ğ¾Ñ…Ñ€Ğ°Ğ½ÑĞµĞ¼ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ½Ğ° ÑÑ‚Ğ¾Ğ¼ ÑƒÑÑ‚Ñ€Ğ¾Ğ¹ÑÑ‚Ğ²Ğµâ€¦");
    try{
      // The private beta intentionally has NO server photo upload. Check a
      // committed, verified IndexedDB copy before ever saying registration
      // succeeded or navigating away from the preview.
      const token=++saveSequence.current,photoRevision=++revision.current;
      const local=await saveDraftSnapshot(scope,draftId.current,photoRevision,draft,8,photos);
      if(!local.ok){
        retryKind.current="save";setStorageState("error");setStorageCode(local.code);
        setServerStatus("ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ ÑĞ¾Ñ…Ñ€Ğ°Ğ½Ğ¸Ñ‚ÑŒ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ½Ğ° ÑƒÑÑ‚Ñ€Ğ¾Ğ¹ÑÑ‚Ğ²Ğµ. ĞÑĞ²Ğ¾Ğ±Ğ¾Ğ´Ğ¸ Ğ¼ĞµÑÑ‚Ğ¾ Ğ¸Ğ»Ğ¸ Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ÑŒ Ñ…Ñ€Ğ°Ğ½Ğ¸Ğ»Ğ¸Ñ‰Ğµ Ğ¸ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸.");
        return;
      }
      if(token===saveSequence.current){setStorageState("saved");setStorageCode(null);}
      setServerStatus("Ğ¤Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ñ‹. ĞŸĞ¾Ğ´Ñ‚Ğ²ĞµÑ€Ğ¶Ğ´Ğ°ĞµĞ¼ Ğ°Ğ½ĞºĞµÑ‚Ñƒ Ğ½Ğ° ÑĞµÑ€Ğ²ĞµÑ€Ğµâ€¦");
      const previous=await readRemoteRevision();
      if(previous.state==="private"&&!window.confirm(
        "ĞĞ° ÑĞµÑ€Ğ²ĞµÑ€Ğµ ÑƒĞ¶Ğµ ĞµÑÑ‚ÑŒ Ğ¿Ñ€Ğ¸Ğ²Ğ°Ñ‚Ğ½Ğ°Ñ Ğ°Ğ½ĞºĞµÑ‚Ğ°. ĞĞ±Ğ½Ğ¾Ğ²Ğ¸Ñ‚ÑŒ ĞµÑ‘ Ñ‚ĞµĞºÑƒÑ‰Ğ¸Ğ¼Ğ¸ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğ¼Ğ¸?"
      )){setServerStatus("Ğ¡ĞµÑ€Ğ²ĞµÑ€Ğ½Ğ°Ñ Ğ°Ğ½ĞºĞµÑ‚Ğ° Ğ¾ÑÑ‚Ğ°Ğ²Ğ»ĞµĞ½Ğ° Ğ±ĞµĞ· Ğ¸Ğ·Ğ¼ĞµĞ½ĞµĞ½Ğ¸Ğ¹.");return;}
      await saveRemoteDraft(draft,previous.revision);
      setPrivateDraftSaved(true);
      setPublishStatus(null);
      setServerStatus("ĞŸĞ¾Ğ»Ñ Ğ°Ğ½ĞºĞµÑ‚Ñ‹ ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ñ‹ Ğ½Ğ° ÑĞµÑ€Ğ²ĞµÑ€Ğµ. ĞŸÑƒĞ±Ğ»Ğ¸ĞºĞ°Ñ†Ğ¸Ñ Ğ·Ğ°ĞºÑ€Ñ‹Ñ‚Ğ°, Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ¾ÑÑ‚Ğ°Ğ»Ğ¸ÑÑŒ Ğ½Ğ° ÑÑ‚Ğ¾Ğ¼ ÑƒÑÑ‚Ñ€Ğ¾Ğ¹ÑÑ‚Ğ²Ğµ.");
      // A private test account exists already. Show its server-backed
      // profile instead of leaving the user on the last registration step.
      if(!realFeedPilot.enabled){setRealHomeTab("profile");setRealHome(true);}
    }catch(e){
      setPrivateDraftSaved(false);
      setServerStatus(e instanceof Error&&e.message==="revision_conflict"?
        "Ğ§ĞµÑ€Ğ½Ğ¾Ğ²Ğ¸Ğº Ğ¸Ğ·Ğ¼ĞµĞ½Ñ‘Ğ½ Ğ² Ğ´Ñ€ÑƒĞ³Ğ¾Ğ¹ ÑĞµÑÑĞ¸Ğ¸. ĞĞ¸Ñ‡ĞµĞ³Ğ¾ Ğ½Ğµ Ğ¿ĞµÑ€ĞµĞ·Ğ°Ğ¿Ğ¸ÑĞ°Ğ½Ğ¾ â€” Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ Ğ¸ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸.":
        "Ğ¡ĞµÑ€Ğ²ĞµÑ€Ğ½Ğ¾Ğµ ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ğ¸Ğµ Ğ½Ğµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ. Ğ›Ğ¾ĞºĞ°Ğ»ÑŒĞ½Ñ‹Ğ¹ Ñ‡ĞµÑ€Ğ½Ğ¾Ğ²Ğ¸Ğº Ğ¸ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ½Ğµ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ñ‹.");
    }finally{setServerSaving(false);}
  };
  const persistPrivatePhotos=async()=>{
    if(!remoteMediaPilot.enabled||!privateDraftSaved||!serverConsent||
      mediaSaving||serverSaving||auth!=="authorized")return;
    if(photos.length<3||photos.length>6||photos.some(p=>p.status!=="ready")){
      setMediaStatus("Ğ”Ğ»Ñ Ğ·Ğ°Ğ³Ñ€ÑƒĞ·ĞºĞ¸ Ñ‚Ñ€ĞµĞ±ÑƒĞµÑ‚ÑÑ Ğ¾Ñ‚ 3 Ğ´Ğ¾ 6 Ğ¾Ğ±Ñ€Ğ°Ğ±Ğ¾Ñ‚Ğ°Ğ½Ğ½Ñ‹Ñ… Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹.");
      return;
    }
    setMediaSaving(true);setMediaStatus("");
    try{
      const uploadedIds=await uploadPrivatePhotos([...photos],(done,total)=>
        setMediaStatus("ĞÑ‚Ğ¿Ñ€Ğ°Ğ²Ğ»ĞµĞ½Ğ¾ "+done+" Ğ¸Ğ· "+total+". Ğ’ÑĞµ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ¿Ñ€Ğ¸Ğ²Ğ°Ñ‚Ğ½Ñ‹."));
      const received=await readConfirmedPrivateMediaCount(photos.length,uploadedIds);
      setServerPhotoCount(received);
      setPublishStatus(null);
      setMediaStatus("Ğ¡ĞµÑ€Ğ²ĞµÑ€ Ğ¿Ğ¾Ğ´Ñ‚Ğ²ĞµÑ€Ğ´Ğ¸Ğ» ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ğ¸Ğµ "+received+" Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹. Ğ”Ğ¾ Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ĞºĞ¸ Ğ¾Ğ½Ğ¸ Ğ½Ğ¸ĞºĞ¾Ğ¼Ñƒ Ğ½Ğµ Ğ²Ğ¸Ğ´Ğ½Ñ‹.");
    }catch{
      setMediaStatus("ĞĞµ Ğ²ÑĞµ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ¾Ñ‚Ğ¿Ñ€Ğ°Ğ²Ğ»ĞµĞ½Ñ‹. Ğ£Ğ¶Ğµ Ğ¿Ñ€Ğ¸Ğ½ÑÑ‚Ñ‹Ğµ Ğ¾ÑÑ‚Ğ°ÑÑ‚ÑÑ Ğ¿Ñ€Ğ¸Ğ²Ğ°Ñ‚Ğ½Ñ‹Ğ¼Ğ¸. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ ÑĞ¾ĞµĞ´Ğ¸Ğ½ĞµĞ½Ğ¸Ğµ Ğ¿ĞµÑ€ĞµĞ´ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¾Ğ¼.");
    }finally{setMediaSaving(false);}
  };
  /** A private account is complete only when its photos are durably stored. */
  const confirmPrivateRegistration=async()=>{
    if(!remoteDraftPilot.enabled||!remoteMediaPilot.enabled||submitting.current||
       auth!=="authorized")return;
    for(let n=1;n<=7;n++){
      const problem=validateStep(draft,n,photos.length,new Date(),"live");
      if(problem){setServerStatus("ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ: "+problem);return;}
    }
    if(photos.length<3||photos.length>6||photos.some(p=>p.status!=="ready")){
      setServerStatus("Ğ”Ğ»Ñ ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ğ¸Ñ Ğ½ÑƒĞ¶Ğ½Ñ‹ 3â€“6 Ğ³Ğ¾Ñ‚Ğ¾Ğ²Ñ‹Ñ… Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹.");return;
    }
    if(!serverConsent){setServerStatus("ĞŸĞ¾Ğ´Ñ‚Ğ²ĞµÑ€Ğ´Ğ¸ ÑĞ¾Ğ³Ğ»Ğ°ÑĞ¸Ğµ Ğ½Ğ° Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ğ¸Ğµ Ğ°Ğ½ĞºĞµÑ‚Ñ‹ Ğ¸ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹.");return;}
    submitting.current=true;setServerSaving(true);setServerStatus("Ğ¡Ğ¾Ñ…Ñ€Ğ°Ğ½ÑĞµĞ¼ Ğ°Ğ½ĞºĞµÑ‚Ñƒ Ğ½Ğ° ÑĞµÑ€Ğ²ĞµÑ€Ğµâ€¦");
    try{
      const previous=await readRemoteRevision();
      await saveRemoteDraft(draft,previous.revision);
      setPrivateDraftSaved(true);
      setServerStatus("Ğ—Ğ°Ğ³Ñ€ÑƒĞ¶Ğ°ĞµĞ¼ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ² Ğ¿Ñ€Ğ¸Ğ²Ğ°Ñ‚Ğ½Ğ¾Ğµ Ñ…Ñ€Ğ°Ğ½Ğ¸Ğ»Ğ¸Ñ‰Ğµâ€¦");
      const uploadedIds=await uploadPrivatePhotos([...photos],(done,total)=>
        setServerStatus("ĞÑ‚Ğ¿Ñ€Ğ°Ğ²Ğ»ĞµĞ½Ğ¾ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹: "+done+" Ğ¸Ğ· "+total+"."));
      const received=await readConfirmedPrivateMediaCount(photos.length,uploadedIds);
      setServerPhotoCount(received);
      setServerStatus("Ğ¡ĞµÑ€Ğ²ĞµÑ€ Ğ¿Ğ¾Ğ´Ñ‚Ğ²ĞµÑ€Ğ´Ğ¸Ğ» Ğ°Ğ½ĞºĞµÑ‚Ñƒ Ğ¸ "+received+" Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹.");
      setRealHomeTab("profile");setRealHome(true);
    }catch(e){
      setServerStatus(e instanceof Error&&e.message==="revision_conflict"
       ?"ĞĞ½ĞºĞµÑ‚Ğ° Ğ¸Ğ·Ğ¼ĞµĞ½ĞµĞ½Ğ° Ğ½Ğ° Ğ´Ñ€ÑƒĞ³Ğ¾Ğ¼ ÑƒÑÑ‚Ñ€Ğ¾Ğ¹ÑÑ‚Ğ²Ğµ. Ğ›Ğ¾ĞºĞ°Ğ»ÑŒĞ½Ñ‹Ğµ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ñ‹; Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ¸Ñ… Ğ¸ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸."
       :"Ğ¡ĞµÑ€Ğ²ĞµÑ€ Ğ½Ğµ Ğ¿Ğ¾Ğ´Ñ‚Ğ²ĞµÑ€Ğ´Ğ¸Ğ» ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ğ¸Ğµ Ğ²ÑĞµÑ… Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹. Ğ›Ğ¾ĞºĞ°Ğ»ÑŒĞ½Ñ‹Ğµ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ Ğ½Ğµ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ñ‹; Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸ Ğ¾Ñ‚Ğ¿Ñ€Ğ°Ğ²ĞºÑƒ.");
    }finally{submitting.current=false;setServerSaving(false);}
  };
  const finishSuccessfulPublication=async(status:OwnerPublicationStatus)=>{
    setPublishStatus(status);
    const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),9000);
    try{
      const warmed=await warmPublishedRecommendations(controller.signal,phase=>setJourney(phase),draft);
      warmRef.current?.release();warmRef.current=warmed;
      setWarmFeed(warmed.page);
    }catch{
      // Published status is durable. Warmup failure does not lock the UI.
      setWarmFeed(null);
    }finally{window.clearTimeout(timeout);}
    // Mount the real app behind the branded curtain first, then let the
    // completion transition reveal an already-painted first feed.
    setRealHomeTab("feed");setRealHome(true);setJourney("complete");
  };
  const confirmRealRegistration=async()=>{
    if(!realFeedPilot.enabled||submitting.current)return;
    for(let n=1;n<=7;n++){
      const problem=validateStep(draft,n,photos.length,new Date(),"live");
      if(problem){setPublishFeedback("ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ: "+problem);return;}
    }
    if(photos.length<3||photos.length>6||photos.some(p=>p.status!=="ready")){
      setPublishFeedback("Ğ”Ğ»Ñ ÑĞ¾Ğ·Ğ´Ğ°Ğ½Ğ¸Ñ Ğ°Ğ½ĞºĞµÑ‚Ñ‹ Ğ½ÑƒĞ¶Ğ½Ğ¾ 3â€“6 Ğ³Ğ¾Ñ‚Ğ¾Ğ²Ñ‹Ñ… Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹.");return;
    }
    if(!draft.trialConsent){setPublishFeedback("ĞŸÑ€Ğ¸Ğ¼Ğ¸ ÑƒÑĞ»Ğ¾Ğ²Ğ¸Ñ Ñ€ĞµĞ³Ğ¸ÑÑ‚Ñ€Ğ°Ñ†Ğ¸Ğ¸ Ğ½Ğ° Ğ¿ĞµÑ€Ğ²Ğ¾Ğ¼ ÑˆĞ°Ğ³Ğµ.");return;}
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
      // All network photo work deliberately starts here, after the preview.
      // The publication curtain remains visible until the profile and feed
      // are both ready, so no extra upload page can flash between them.
      const uploadedIds=await syncChosenPhotos(true);
      if(uploadedIds.length!==photos.length)throw new Error("incomplete_media");
      await reconcilePrivatePhotos(uploadedIds);
      await readConfirmedPrivateMediaCount(photos.length,uploadedIds);
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
       ?"ĞĞ½ĞºĞµÑ‚Ğ° Ğ¸Ğ·Ğ¼ĞµĞ½Ğ¸Ğ»Ğ°ÑÑŒ Ğ² Ğ´Ñ€ÑƒĞ³Ğ¾Ğ¹ ÑĞµÑÑĞ¸Ğ¸. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ Ğ¸ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸ ÑĞ¾Ğ·Ğ´Ğ°Ğ½Ğ¸Ğµ.":
       reason==="incomplete_media"
        ?"ĞĞµ Ğ²ÑĞµ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ ÑĞ¾Ñ…Ñ€Ğ°Ğ½Ğ¸Ğ»Ğ¸ÑÑŒ. ĞĞ°Ğ¶Ğ¼Ğ¸ Â«ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ñ‚ÑŒÂ» â€” Ğ·Ğ°Ğ³Ñ€ÑƒĞ·ĞºĞ° Ğ¿Ñ€Ğ¾Ğ´Ğ¾Ğ»Ğ¶Ğ¸Ñ‚ÑÑ.":
        reason.includes("invalid_image")||reason.includes("unsupported_source_photo")
        ?"ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¾Ğ±Ñ€Ğ°Ğ±Ğ¾Ñ‚Ğ°Ñ‚ÑŒ Ğ¾Ğ´Ğ½Ñƒ Ğ¸Ğ· Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹. ĞŸĞ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹ ÑĞ½Ğ¾Ğ²Ğ° Ğ¸Ğ»Ğ¸ Ğ·Ğ°Ğ¼ĞµĞ½Ğ¸ ÑĞ½Ğ¸Ğ¼Ğ¾Ğº.":
        reason.includes("photo_order_conflict")||reason.includes("photo_limit")
        ?"ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ ÑĞ¾Ğ³Ğ»Ğ°ÑĞ¾Ğ²Ğ°Ñ‚ÑŒ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸. ĞŸĞ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹ ĞµÑ‰Ñ‘ Ñ€Ğ°Ğ·.":
        "Ğ¡Ğ¾ĞµĞ´Ğ¸Ğ½ĞµĞ½Ğ¸Ğµ Ğ¿Ñ€ĞµÑ€Ğ²Ğ°Ğ»Ğ¾ÑÑŒ Ğ¿Ñ€Ğ¸ ÑĞ¾Ğ·Ğ´Ğ°Ğ½Ğ¸Ğ¸ Ğ°Ğ½ĞºĞµÑ‚Ñ‹. ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸ â€” ÑĞ¾Ñ…Ñ€Ğ°Ğ½Ñ‘Ğ½Ğ½Ñ‹Ğµ Ñ„Ğ¾Ñ‚Ğ¾ Ğ½Ğµ Ğ¿Ñ€Ğ¾Ğ¿Ğ°Ğ´ÑƒÑ‚.";
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
        setPublishFeedback(instantPublicationUi?"ĞĞµ Ğ²ÑĞµ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ ÑƒÑĞ¿ĞµÑˆĞ½Ğ¾ Ğ·Ğ°Ğ³Ñ€ÑƒĞ¶ĞµĞ½Ñ‹. ĞĞ½ĞºĞµÑ‚Ğ° Ğ¿Ğ¾ĞºĞ° ÑĞºÑ€Ñ‹Ñ‚Ğ°.":"Ğ¤Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ ĞµÑ‰Ñ‘ Ğ¿Ñ€Ğ¾Ñ…Ğ¾Ğ´ÑÑ‚ Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ĞºÑƒ Ğ¸Ğ»Ğ¸ Ñ‚Ñ€ĞµĞ±ÑƒÑÑ‚ Ğ¸ÑĞ¿Ñ€Ğ°Ğ²Ğ»ĞµĞ½Ğ¸Ñ. ĞĞ½ĞºĞµÑ‚Ğ° Ğ¿Ğ¾ĞºĞ° ÑĞºÑ€Ñ‹Ñ‚Ğ°.");return;
      }
      const draftOnServer=await readRemoteRevision();
      if(draftOnServer.state!=="private")throw new Error("missing_draft");
      await publishMyProfile(draftOnServer.revision);
      const confirmed=await ownerPublicationStatus();
      if(confirmed.state!=="published")throw new Error("publication_unconfirmed");
      setPublishStatus(confirmed);setRealHome(true);
    }catch{setPublishFeedback("ĞŸÑ€Ğ¾Ğ²ĞµÑ€ĞºĞ° Ğ½Ğµ Ğ·Ğ°Ğ²ĞµÑ€ÑˆĞ¸Ğ»Ğ°ÑÑŒ. ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸ Ğ¿Ñ€Ğ¸ ÑÑ‚Ğ°Ğ±Ğ¸Ğ»ÑŒĞ½Ğ¾Ğ¼ ÑĞ¾ĞµĞ´Ğ¸Ğ½ĞµĞ½Ğ¸Ğ¸.");}
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
    }catch{setPublishFeedback("ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ·Ğ°Ğ³Ñ€ÑƒĞ·Ğ¸Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ Ğ´Ğ»Ñ Ñ€ĞµĞ´Ğ°ĞºÑ‚Ğ¸Ñ€Ğ¾Ğ²Ğ°Ğ½Ğ¸Ñ.");}
    finally{setPublishBusy(false);}
  };
  const savePublishedEditor=async()=>{
    if(!publishedEditor||publishBusy)return;
    if(!nameValid(publishedEditor.name)||[...publishedEditor.about].length>750||
      !goals.some(g=>g.id===publishedEditor.goal)){
      setPublishFeedback("ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ¸Ğ¼Ñ, Ñ†ĞµĞ»ÑŒ Ğ¸ Ñ‚ĞµĞºÑÑ‚ Ğ¾ ÑĞµĞ±Ğµ (Ğ´Ğ¾ 750 ÑĞ¸Ğ¼Ğ²Ğ¾Ğ»Ğ¾Ğ²).");return;
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
      setPublishFeedback("Ğ˜Ğ·Ğ¼ĞµĞ½ĞµĞ½Ğ¸Ñ Ğ¾Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ¾Ğ²Ğ°Ğ½Ñ‹.");
    }catch{setPublishFeedback("ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¾Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ¾Ğ²Ğ°Ñ‚ÑŒ Ğ¸Ğ·Ğ¼ĞµĞ½ĞµĞ½Ğ¸Ñ. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ ÑĞ¾ĞµĞ´Ğ¸Ğ½ĞµĞ½Ğ¸Ğµ Ğ¸ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸.");}
    finally{setPublishBusy(false);}
  };
  const hideProfile=async()=>{
    if(!realFeedPilot.enabled||publishBusy||
       !window.confirm("Ğ¡Ğ½ÑÑ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ Ñ Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ°Ñ†Ğ¸Ğ¸ Ğ¸ ÑĞºÑ€Ñ‹Ñ‚ÑŒ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ¾Ñ‚ Ğ´Ñ€ÑƒĞ³Ğ¸Ñ… Ğ¿Ğ¾Ğ»ÑŒĞ·Ğ¾Ğ²Ğ°Ñ‚ĞµĞ»ĞµĞ¹?"))return;
    setPublishBusy(true);setPublishFeedback("");
    try{
      await unpublishMyProfile();
      setPublishStatus(await ownerPublicationStatus());
      setRealHome(false);setPhase("form");setStep(8);
      setPublishFeedback("ĞĞ½ĞºĞµÑ‚Ğ° ÑĞºÑ€Ñ‹Ñ‚Ğ°. Ğ”Ñ€ÑƒĞ³Ğ¸Ğ¼ Ğ¿Ğ¾Ğ»ÑŒĞ·Ğ¾Ğ²Ğ°Ñ‚ĞµĞ»ÑĞ¼ ĞµÑ‘ Ñ„Ğ¾Ñ‚Ğ¾ Ğ±Ğ¾Ğ»ÑŒÑˆĞµ Ğ½ĞµĞ´Ğ¾ÑÑ‚ÑƒĞ¿Ğ½Ñ‹.");
    }catch{setPublishFeedback("ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ ÑĞºÑ€Ñ‹Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ ÑĞ¾ĞµĞ´Ğ¸Ğ½ĞµĞ½Ğ¸Ğµ.");}
    finally{setPublishBusy(false);}
  };
  const withdrawPersonalConsent=async()=>{
    if(!realFeedPilot.enabled||publishBusy||auth!=="authorized")return;
    if(!window.confirm(
      "ĞÑ‚Ğ¾Ğ·Ğ²Ğ°Ñ‚ÑŒ ÑĞ¾Ğ³Ğ»Ğ°ÑĞ¸Ğµ? ĞĞ½ĞºĞµÑ‚Ğ° Ğ¸ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ ÑÑ€Ğ°Ğ·Ñƒ ÑĞºÑ€Ğ¾ÑÑ‚ÑÑ Ğ¾Ñ‚ Ğ´Ñ€ÑƒĞ³Ğ¸Ñ… Ğ»ÑĞ´ĞµĞ¹. Ğ”Ğ°Ğ½Ğ½Ñ‹Ğµ Ğ¾ÑÑ‚Ğ°Ğ½ÑƒÑ‚ÑÑ Ğ½Ğ° ÑĞµÑ€Ğ²ĞµÑ€Ğµ Ğ´Ğ¾ Ğ¾Ñ‚Ğ´ĞµĞ»ÑŒĞ½Ğ¾Ğ³Ğ¾ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ñ."
    ))return;
    setPublishBusy(true);setPublishFeedback("");
    try{
      await withdrawRealConsent();
      setServerConsent(false);setPrivateDraftSaved(false);setRealHome(false);setPhase("form");setStep(8);
      setPublishStatus(null);
      setPublishFeedback("Ğ¡Ğ¾Ğ³Ğ»Ğ°ÑĞ¸Ğµ Ğ¾Ñ‚Ğ¾Ğ·Ğ²Ğ°Ğ½Ğ¾, Ğ°Ğ½ĞºĞµÑ‚Ğ° Ğ¸ Ñ„Ğ¾Ñ‚Ğ¾ ÑĞºÑ€Ñ‹Ñ‚Ñ‹. Ğ”Ğ°Ğ½Ğ½Ñ‹Ğµ ĞĞ• ÑƒĞ´Ğ°Ğ»ĞµĞ½Ñ‹: ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚Ğ° Ğ¿Ğ¾ÑĞ²Ğ¸Ñ‚ÑÑ Ğ¾Ñ‚Ğ´ĞµĞ»ÑŒĞ½Ğ¾.");
    }catch{
      setPublishFeedback("ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¾Ñ‚Ğ¾Ğ·Ğ²Ğ°Ñ‚ÑŒ ÑĞ¾Ğ³Ğ»Ğ°ÑĞ¸Ğµ. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ ÑĞ¾ĞµĞ´Ğ¸Ğ½ĞµĞ½Ğ¸Ğµ Ğ¸ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸.");
    }finally{setPublishBusy(false);}
  };
  const eraseMyAccount=async()=>{
    if(!realFeedPilot.enabled||publishBusy||auth!=="authorized")return;
    if(!window.confirm("ĞĞ°Ñ‡Ğ°Ñ‚ÑŒ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ? ĞĞ½ĞºĞµÑ‚Ğ° Ğ¸ Ñ„Ğ¾Ñ‚Ğ¾ ÑÑ€Ğ°Ğ·Ñƒ Ğ¸ÑÑ‡ĞµĞ·Ğ½ÑƒÑ‚ Ğ¸Ğ· Ğ·Ğ½Ğ°ĞºĞ¾Ğ¼ÑÑ‚Ğ². Ğ§ĞµÑ€ĞµĞ· 72 Ñ‡Ğ°ÑĞ°, ĞµÑĞ»Ğ¸ Ñ‚Ñ‹ Ğ½Ğµ Ğ²Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ¾Ğ²Ğ¸ÑˆÑŒ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚, Ğ½Ğ°Ñ‡Ğ½Ñ‘Ñ‚ÑÑ Ğ¾ĞºĞ¾Ğ½Ñ‡Ğ°Ñ‚ĞµĞ»ÑŒĞ½Ğ°Ñ Ğ¾Ñ‡Ğ¸ÑÑ‚ĞºĞ°."))return;
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
      setPublishFeedback("ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¾Ñ‚Ğ¿Ñ€Ğ°Ğ²Ğ¸Ñ‚ÑŒ Ğ·Ğ°Ğ¿Ñ€Ğ¾Ñ Ğ½Ğ° ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ. ĞĞºĞºĞ°ÑƒĞ½Ñ‚ Ğ½Ğµ ÑÑ‡Ğ¸Ñ‚Ğ°ĞµÑ‚ÑÑ ÑƒĞ´Ğ°Ğ»Ñ‘Ğ½Ğ½Ñ‹Ğ¼.");
    }finally{setPublishBusy(false);}
  };
  const restoreMyAccount=async()=>{
    if(recoveryBusy)return;
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData){setRecoveryError("Ğ”Ğ»Ñ Ğ²Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ¾Ğ²Ğ»ĞµĞ½Ğ¸Ñ Ğ¾Ñ‚ĞºÑ€Ğ¾Ğ¹ LUEMI Ğ²Ğ½ÑƒÑ‚Ñ€Ğ¸ Telegram.");return;}
    setRecoveryBusy(true);setRecoveryError("");
    try{
      await recoverDeletion(initData);
      setAccountDeletionRequested(false);setDeletionUntil(null);setAuth("connecting");
      setConnectAttempt(v=>v+1);
    }catch(e){
      setRecoveryError(e instanceof Error&&e.message==="recovery_expired"
        ?"Ğ¡Ñ€Ğ¾Ğº Ğ²Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ¾Ğ²Ğ»ĞµĞ½Ğ¸Ñ Ğ¸ÑÑ‚Ñ‘Ğº. Ğ£Ğ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ ÑƒĞ¶Ğµ Ğ½ĞµĞ»ÑŒĞ·Ñ Ğ¾Ñ‚Ğ¼ĞµĞ½Ğ¸Ñ‚ÑŒ."
        :e instanceof Error&&e.message==="reopen_telegram"
        ?"Ğ—Ğ°ĞºÑ€Ğ¾Ğ¹ Ğ¸ Ğ·Ğ°Ğ½Ğ¾Ğ²Ğ¾ Ğ¾Ñ‚ĞºÑ€Ğ¾Ğ¹ LUEMI Ñ‡ĞµÑ€ĞµĞ· Telegram, Ğ·Ğ°Ñ‚ĞµĞ¼ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸."
        :"ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ²Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ¾Ğ²Ğ¸Ñ‚ÑŒ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚. ĞŸĞ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹ ĞµÑ‰Ñ‘ Ñ€Ğ°Ğ·.");
    }finally{setRecoveryBusy(false);}
  };
  const deletionSettingsPanel=realFeedPilot.enabled?<>
   <p className="luemi-legal-link"><a href="/privacy" target="_blank" rel="noopener noreferrer">ĞšĞ¾Ğ½Ñ„Ğ¸Ğ´ĞµĞ½Ñ†Ğ¸Ğ°Ğ»ÑŒĞ½Ğ¾ÑÑ‚ÑŒ Ğ¸ Ğ¸ÑĞ¿Ğ¾Ğ»ÑŒĞ·Ğ¾Ğ²Ğ°Ğ½Ğ¸Ğµ Ğ´Ğ°Ğ½Ğ½Ñ‹Ñ…</a></p>
   <button type="button" disabled={publishBusy} onClick={()=>setAccountSettingsOpen(v=>!v)}>ĞĞ°ÑÑ‚Ñ€Ğ¾Ğ¹ĞºĞ¸ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚Ğ°</button>
           {accountSettingsOpen&&<section className="registration-preview-review" aria-label="ĞĞ°ÑÑ‚Ñ€Ğ¾Ğ¹ĞºĞ¸ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ñ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚Ğ°">
            <h2>ĞœĞ¾Ğ¸ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ</h2>
            <p>Ğ­ĞºÑĞ¿Ğ¾Ñ€Ñ‚ Ğ´Ğ¾ÑÑ‚ÑƒĞ¿Ğ½Ğ¾Ğ¹ Ğ°Ğ½ĞºĞµÑ‚Ñ‹ Ğ¸ Ğ¸ÑÑ‚Ğ¾Ñ€Ğ¸Ğ¸ Ñ‡Ğ°Ñ‚Ğ¾Ğ². ĞÑ€Ğ¸Ğ³Ğ¸Ğ½Ğ°Ğ»ÑŒĞ½Ñ‹Ğµ Ñ„Ğ¾Ñ‚Ğ¾ ÑƒÑÑ‚Ñ€Ğ¾Ğ¹ÑÑ‚Ğ²Ğ°, ÑĞºÑ€Ñ‹Ñ‚Ñ‹Ğµ Ñƒ Ğ¾Ğ±Ğ¾Ğ¸Ñ… ÑĞ¾Ğ¾Ğ±Ñ‰ĞµĞ½Ğ¸Ñ Ğ¸ Ğ¼Ğ°Ñ‚ĞµÑ€Ğ¸Ğ°Ğ»Ñ‹ Ğ·Ğ°ĞºÑ€Ñ‹Ñ‚Ñ‹Ñ… Ğ¶Ğ°Ğ»Ğ¾Ğ± ÑÑĞ´Ğ° Ğ½Ğµ Ğ²Ñ…Ğ¾Ğ´ÑÑ‚.</p>
            <button type="button" disabled={exportBusy||auth!=="authorized"} onClick={()=>{
              setExportBusy(true);setPublishFeedback("");
              void import("./registration/export-my-account")
                .then(module=>module.exportMyAvailableData())
                .catch(()=>setPublishFeedback("ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¿Ğ¾Ğ´Ğ³Ğ¾Ñ‚Ğ¾Ğ²Ğ¸Ñ‚ÑŒ ÑĞºÑĞ¿Ğ¾Ñ€Ñ‚. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ ÑĞµÑÑĞ¸Ñ Telegram Ğ¸ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸."))
                .finally(()=>setExportBusy(false));
             }}>{exportBusy?"Ğ“Ğ¾Ñ‚Ğ¾Ğ²Ğ¸Ğ¼ Ñ„Ğ°Ğ¹Ğ»â€¦":"Ğ¡ĞºĞ°Ñ‡Ğ°Ñ‚ÑŒ Ğ´Ğ¾ÑÑ‚ÑƒĞ¿Ğ½Ñ‹Ğµ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ"}</button>
            <h2>Ğ£Ğ´Ğ°Ğ»Ğ¸Ñ‚ÑŒ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚</h2>
            <p>ĞĞ½ĞºĞµÑ‚Ğ° Ğ¸ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ ÑÑ€Ğ°Ğ·Ñƒ Ğ¸ÑÑ‡ĞµĞ·Ğ½ÑƒÑ‚ Ğ¸Ğ· Ğ·Ğ½Ğ°ĞºĞ¾Ğ¼ÑÑ‚Ğ². Ğ’ Ñ‚ĞµÑ‡ĞµĞ½Ğ¸Ğµ 72 Ñ‡Ğ°ÑĞ¾Ğ² Ğ¼Ğ¾Ğ¶Ğ½Ğ¾ Ğ²Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ¾Ğ²Ğ¸Ñ‚ÑŒ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚.</p>
            <label>ĞŸÑ€Ğ¸Ñ‡Ğ¸Ğ½Ğ° ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ñ<select className="glass-control" value={deletionReason}
              onChange={e=>setDeletionReason(e.target.value as DeletionReason)}>
              {deletionReasons.map(([value,title])=><option key={value} value={value}>{title}</option>)}
            </select></label>
            <label>ĞšĞ¾Ğ¼Ğ¼ĞµĞ½Ñ‚Ğ°Ñ€Ğ¸Ğ¹ (Ğ½ĞµĞ¾Ğ±ÑĞ·Ğ°Ñ‚ĞµĞ»ÑŒĞ½Ğ¾)<textarea className="glass-control" value={deletionDetails}
              maxLength={500} placeholder="Ğ Ğ°ÑÑĞºĞ°Ğ¶Ğ¸, Ñ‡Ñ‚Ğ¾ Ğ¼Ğ¾Ğ¶Ğ½Ğ¾ ÑƒĞ»ÑƒÑ‡ÑˆĞ¸Ñ‚ÑŒ"
              onChange={e=>setDeletionDetails(e.target.value)}/></label>
            <button type="button" disabled={publishBusy} onClick={()=>{void eraseMyAccount();}}>
              {publishBusy?"ĞÑ‚Ğ¿Ñ€Ğ°Ğ²Ğ»ÑĞµĞ¼ Ğ·Ğ°Ğ¿Ñ€Ğ¾Ñâ€¦":"ĞĞ°Ñ‡Ğ°Ñ‚ÑŒ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ"}
            </button>
           </section>}
  </>:null;
  const remainingMs=deletionUntil?Math.max(0,new Date(deletionUntil).getTime()-clockNow):0;
  const remainingTime=`${Math.floor(remainingMs/86400000)} Ğ´Ğ½. ${String(Math.floor(remainingMs%86400000/3600000)).padStart(2,"0")}:${String(Math.floor(remainingMs%3600000/60000)).padStart(2,"0")}:${String(Math.floor(remainingMs%60000/1000)).padStart(2,"0")}`;
  if(accountDeletionRequested||auth==="pending-deletion")return <main className="luemi-shell" data-theme={activeTheme}
    data-scene="intro" role="status" style={{padding:"32px 22px",display:"grid",alignContent:"center",gap:18}}>
    <img src={logoSrc} alt="LUEMI" style={{width:150,maxWidth:"100%",justifySelf:"center"}}/>
    <h2>ĞĞºĞºĞ°ÑƒĞ½Ñ‚ Ğ³Ğ¾Ñ‚Ğ¾Ğ²Ğ¸Ñ‚ÑÑ Ğº ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ñ</h2>
    <p>ĞĞ½ĞºĞµÑ‚Ğ° Ğ¸ Ñ„Ğ¾Ñ‚Ğ¾ ÑƒĞ¶Ğµ ÑĞºÑ€Ñ‹Ñ‚Ñ‹ Ğ¾Ñ‚ Ğ´Ñ€ÑƒĞ³Ğ¸Ñ… Ğ»ÑĞ´ĞµĞ¹, Ğ° Ğ¿Ñ€ĞµĞ¶Ğ½Ğ¸Ğµ ÑĞµÑÑĞ¸Ğ¸ Ğ¾Ñ‚ĞºĞ»ÑÑ‡ĞµĞ½Ñ‹.</p>
    <p role="timer" aria-live="off">Ğ”Ğ¾ Ğ¾ĞºĞ¾Ğ½Ñ‡Ğ°Ñ‚ĞµĞ»ÑŒĞ½Ğ¾Ğ³Ğ¾ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ñ: <strong>{remainingTime}</strong></p>
    {deletionUntil&&<p>Ğ¡Ñ€Ğ¾Ğº Ğ´Ğ¾ {new Date(deletionUntil).toLocaleString("ru-RU")} Ğ¿Ğ¾ Ğ²Ñ€ĞµĞ¼ĞµĞ½Ğ¸ ÑƒÑÑ‚Ñ€Ğ¾Ğ¹ÑÑ‚Ğ²Ğ°.</p>}
    <p>Ğ’Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ¾Ğ²Ğ¸Ñ‚ÑŒ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚ Ğ¼Ğ¾Ğ¶Ğ½Ğ¾ Ñ‚Ğ¾Ğ»ÑŒĞºĞ¾ Ğ¾Ñ‚Ğ´ĞµĞ»ÑŒĞ½Ñ‹Ğ¼ Ğ¿Ğ¾Ğ´Ñ‚Ğ²ĞµÑ€Ğ¶Ğ´ĞµĞ½Ğ¸ĞµĞ¼. ĞŸÑ€Ğ¾ÑÑ‚Ğ¾Ğ¹ Ğ²Ñ…Ğ¾Ğ´ Ğ² Telegram Ğ½Ğµ Ğ¾Ñ‚Ğ¼ĞµĞ½ÑĞµÑ‚ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ.</p>
    <button type="button" className="primary-action" disabled={recoveryBusy||remainingMs===0}
     onClick={()=>{void restoreMyAccount();}}>{recoveryBusy?"Ğ’Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ°Ğ²Ğ»Ğ¸Ğ²Ğ°ĞµĞ¼â€¦":"Ğ’Ğ¾ÑÑÑ‚Ğ°Ğ½Ğ¾Ğ²Ğ¸Ñ‚ÑŒ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚"}</button>
    {recoveryError&&<p role="alert">{recoveryError}</p>}
    {localDeletionFailed&&<p role="alert">Ğ›Ğ¾ĞºĞ°Ğ»ÑŒĞ½Ñ‹Ğ¹ Ñ‡ĞµÑ€Ğ½Ğ¾Ğ²Ğ¸Ğº Ğ½Ğ° ÑƒÑÑ‚Ñ€Ğ¾Ğ¹ÑÑ‚Ğ²Ğµ Ğ½Ğµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¾Ñ‡Ğ¸ÑÑ‚Ğ¸Ñ‚ÑŒ. ĞœĞ¾Ğ¶Ğ½Ğ¾ Ğ¾Ñ‡Ğ¸ÑÑ‚Ğ¸Ñ‚ÑŒ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ Mini App Ğ²Ñ€ÑƒÑ‡Ğ½ÑƒÑ.</p>}
    <p>ĞŸĞ¾ÑĞ»Ğµ ÑÑ€Ğ¾ĞºĞ° ÑĞµÑ€Ğ²ĞµÑ€ Ğ½Ğ°Ñ‡Ğ½Ñ‘Ñ‚ Ğ±ĞµĞ·Ğ²Ğ¾Ğ·Ğ²Ñ€Ğ°Ñ‚Ğ½Ğ¾Ğµ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ Ñ„Ğ°Ğ¹Ğ»Ğ¾Ğ² Ğ¸ Ğ·Ğ°Ğ¿Ğ¸ÑĞµĞ¹.</p>
    <p><a href="/privacy" target="_blank" rel="noopener noreferrer">ĞšĞ°Ğº LUEMI Ğ¾Ğ±Ñ€Ğ°Ğ±Ğ°Ñ‚Ñ‹Ğ²Ğ°ĞµÑ‚ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ</a></p>
  </main>;
  const journeyOverlay=journey!==null?<PublicationJourney phase={journey} error={journeyError}
    onRetry={()=>{setJourney(null);void confirmRealRegistration();}}
    onBack={()=>{setJourney(null);setPhase("form");}}
    onComplete={closePublicationJourney}/>:null;
  // Returning members enter their account directly after authentication.
  // All signed-in accounts retain the approved LUEMI four-tab Discovery,
  // cinematic photo cards and Profile Morph V3. REAL_ONLY changes data, not UI.
  if(realHome&&auth==="authorized"&&realFeedPilot.enabled)
   return <><main ref={rootRef} className="luemi-shell" data-theme={activeTheme}>
    <Suspense fallback={<div className="discovery-empty" role="status">ĞÑ‚ĞºÑ€Ñ‹Ğ²Ğ°ĞµĞ¼ LUEMIâ€¦</div>}>
     <RealDiscoveryHome draft={draft} theme={theme} onTheme={changeTheme}
       initialFeed={warmFeed} publishedProfile={publishStatus?.profile} ownerPhotoPreview={readyPhotos}
      onEdit={()=>{setRealHome(false);setPhase("form");setStep(8);}}
      accountPanel={<section className="luemi-real-account" aria-label="ĞĞ°ÑÑ‚Ñ€Ğ¾Ğ¹ĞºĞ¸ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚Ğ°">
       <h1>ĞœĞ¾Ğ¹ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚</h1>
       {publishStatus?.state!=="published"&&<>
        <p role="status">ĞĞ½ĞºĞµÑ‚Ğ° ĞµÑ‰Ñ‘ Ğ½Ğµ Ğ¾Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ¾Ğ²Ğ°Ğ½Ğ°. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ¸ Ğ·Ğ°Ğ²ĞµÑ€ÑˆĞ¸ Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ°Ñ†Ğ¸Ñ.</p>
        <p>Ğ“Ğ¾Ñ‚Ğ¾Ğ²Ñ‹Ñ… Ñ„Ğ¾Ñ‚Ğ¾: {publishStatus?.approved??0}</p>
        <button type="button" disabled={publishBusy} onClick={()=>{void resumePublication();}}>
         {publishBusy?"ĞŸÑƒĞ±Ğ»Ğ¸ĞºÑƒĞµĞ¼â€¦":"Ğ—Ğ°Ğ²ĞµÑ€ÑˆĞ¸Ñ‚ÑŒ Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ°Ñ†Ğ¸Ñ"}</button>
       </>}
       <p role="status">{publishStatus?.state==="published"?
        "ĞĞ½ĞºĞµÑ‚Ğ° Ğ¾Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ¾Ğ²Ğ°Ğ½Ğ° Ğ¸ Ğ²Ğ¸Ğ´Ğ½Ğ° Ğ¿Ğ¾Ğ´Ñ…Ğ¾Ğ´ÑÑ‰Ğ¸Ğ¼ Ğ¿Ğ¾Ğ»ÑŒĞ·Ğ¾Ğ²Ğ°Ñ‚ĞµĞ»ÑĞ¼.":"Ğ¡Ñ‚Ğ°Ñ‚ÑƒÑ Ğ°Ğ½ĞºĞµÑ‚Ñ‹ Ğ¼Ğ¾Ğ¶Ğ½Ğ¾ Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€Ğ¸Ñ‚ÑŒ Ğ·Ğ´ĞµÑÑŒ."}</p>
       {publishStatus?.state==="published"&&<div className="registration-static-actions">
        <button type="button" className="registration-static-edit" disabled={publishBusy}
         onClick={()=>{void openPublishedEditor();}}>Ğ˜Ğ·Ğ¼ĞµĞ½Ğ¸Ñ‚ÑŒ Ğ¸Ğ½Ñ„Ğ¾Ñ€Ğ¼Ğ°Ñ†Ğ¸Ñ</button>
        <button type="button" className="registration-static-edit" disabled={publishBusy}
         onClick={()=>{void hideProfile();}}>Ğ¡ĞºÑ€Ñ‹Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ</button>
       </div>}
       {publishedEditor&&<section className="registration-preview-review" aria-label="Ğ˜Ğ·Ğ¼ĞµĞ½ĞµĞ½Ğ¸Ğµ Ğ°Ğ½ĞºĞµÑ‚Ñ‹">
        <label>Ğ˜Ğ¼Ñ<input className="glass-control" value={publishedEditor.name} maxLength={48}
         onChange={e=>setPublishedEditor(p=>p?{...p,name:cleanName(e.target.value)}:p)}/></label>
        <label>Ğ¦ĞµĞ»ÑŒ Ğ·Ğ½Ğ°ĞºĞ¾Ğ¼ÑÑ‚Ğ²Ğ°<select className="glass-control" value={publishedEditor.goal}
         onChange={e=>setPublishedEditor(p=>p?{...p,goal:e.target.value}:p)}>
         {goals.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
        </select></label>
        <label>Ğ ÑĞµĞ±Ğµ<textarea className="glass-control" value={publishedEditor.about} maxLength={750}
         onChange={e=>setPublishedEditor(p=>p?{...p,about:e.target.value}:p)}/></label>
        <button type="button" disabled={publishBusy} onClick={()=>{void savePublishedEditor();}}>Ğ¡Ğ¾Ñ…Ñ€Ğ°Ğ½Ğ¸Ñ‚ÑŒ Ğ¸Ğ·Ğ¼ĞµĞ½ĞµĞ½Ğ¸Ñ</button>
        <button type="button" disabled={publishBusy} onClick={()=>setPublishedEditor(null)}>ĞÑ‚Ğ¼ĞµĞ½Ğ°</button>
       </section>}
       {publishStatus?.state==="published"&&<button type="button"
        disabled={publishBusy} onClick={()=>{void withdrawPersonalConsent();}}>
        ĞÑ‚Ğ¾Ğ·Ğ²Ğ°Ñ‚ÑŒ ÑĞ¾Ğ³Ğ»Ğ°ÑĞ¸Ğµ Ğ¸ ÑĞºÑ€Ñ‹Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ</button>}
       {deletionSettingsPanel}
       {publishFeedback&&<p role="status">{publishFeedback}</p>}
      </section>}/>
    </Suspense>
   </main>{journeyOverlay}</>;
  if(realHome&&auth==="authorized")return <main ref={rootRef} className="luemi-shell" data-theme={activeTheme}>
    <section className="luemi-real-home" data-account-mode={!realFeedPilot.enabled&&remoteDraftPilot.enabled?"private":"standard"}
      data-telegram-ui={window.Telegram?.WebApp?"true":"false"} aria-label="LUEMI â€” Ğ½Ğ°ÑÑ‚Ğ¾ÑÑ‰Ğ¸Ğµ Ğ°Ğ½ĞºĞµÑ‚Ñ‹">
      <header className="luemi-real-home-top">
        <img src={logoSrc} alt="LUEMI" className="onboard-logo"/>
      </header>
      <div className="luemi-real-home-main">
        {!realFeedPilot.enabled&&remoteDraftPilot.enabled?<PrivateAccountView draft={draft} photos={readyPhotos} serverPhotoCount={serverPhotoCount}/>:publishStatus?.state!=="published"&&realHomeTab==="profile"?<section className="luemi-real-account" aria-label="Ğ¡Ñ‚Ğ°Ñ‚ÑƒÑ Ñ€ĞµĞ³Ğ¸ÑÑ‚Ñ€Ğ°Ñ†Ğ¸Ğ¸">
          <h1>ĞĞ½ĞºĞµÑ‚Ğ° ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ğ°</h1>
          <p role="status">{instantPublicationUi?"Ğ¢Ğ²Ğ¾Ñ Ğ°Ğ½ĞºĞµÑ‚Ğ° ĞµÑ‰Ñ‘ Ğ½Ğµ Ğ¾Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ¾Ğ²Ğ°Ğ½Ğ°. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ ÑĞ¾Ñ…Ñ€Ğ°Ğ½ĞµĞ½Ğ¸Ğµ Ğ²ÑĞµÑ… Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¹ Ğ½Ğ° ÑĞµÑ€Ğ²ĞµÑ€Ğµ.":"Ğ¢Ğ²Ğ¾Ğ¹ Telegram-Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚ Ğ·Ğ°Ñ€ĞµĞ³Ğ¸ÑÑ‚Ñ€Ğ¸Ñ€Ğ¾Ğ²Ğ°Ğ½. ĞŸĞ¾ĞºĞ° Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸Ğ¸ Ğ¿Ñ€Ğ¾Ñ…Ğ¾Ğ´ÑÑ‚ Ğ¼Ğ¾Ğ´ĞµÑ€Ğ°Ñ†Ğ¸Ñ, Ñ‚Ğ²Ğ¾Ñ Ğ°Ğ½ĞºĞµÑ‚Ğ° ÑĞºÑ€Ñ‹Ñ‚Ğ° Ğ¾Ñ‚ Ğ´Ñ€ÑƒĞ³Ğ¸Ñ…."}</p>
          <p>ĞĞ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ¾Ğ²Ğ°Ğ½Ğ½Ñ‹Ğµ Ğ°Ğ½ĞºĞµÑ‚Ñ‹ Ğ´Ñ€ÑƒĞ³Ğ¸Ñ… Ğ»ÑĞ´ĞµĞ¹ Ğ¼Ğ¾Ğ¶Ğ½Ğ¾ ÑĞ¼Ğ¾Ñ‚Ñ€ĞµÑ‚ÑŒ Ğ²Ğ¾ Ğ²ĞºĞ»Ğ°Ğ´ĞºĞµ Â«Ğ—Ğ½Ğ°ĞºĞ¾Ğ¼ÑÑ‚Ğ²Ğ°Â».</p>
          <p>{instantPublicationUi?"Ğ—Ğ°Ğ³Ñ€ÑƒĞ¶ĞµĞ½Ğ¾ Ñ„Ğ¾Ñ‚Ğ¾: ":"ĞŸÑ€Ğ¸Ğ½ÑÑ‚Ğ¾ Ñ„Ğ¾Ñ‚Ğ¾: "}{publishStatus?.approved??0}{!instantPublicationUi&&<> Â· Ğ½Ğ° Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ĞºĞµ: {publishStatus?.pending??0}</>} Â· Ñ‚Ñ€ĞµĞ±ÑƒÑÑ‚ Ğ²Ğ½Ğ¸Ğ¼Ğ°Ğ½Ğ¸Ñ: {publishStatus?.other??0}</p>
          <button type="button" disabled={publishBusy} onClick={()=>{void resumePublication();}}>
            {publishBusy?"Ğ¡Ğ¾Ñ…Ñ€Ğ°Ğ½ÑĞµĞ¼â€¦":instantPublicationUi?"Ğ—Ğ°Ğ²ĞµÑ€ÑˆĞ¸Ñ‚ÑŒ Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ°Ñ†Ğ¸Ñ":"ĞŸÑ€Ğ¾Ğ²ĞµÑ€Ğ¸Ñ‚ÑŒ Ğ¼Ğ¾Ğ´ĞµÑ€Ğ°Ñ†Ğ¸Ñ Ğ¸ Ğ¾Ñ‚ĞºÑ€Ñ‹Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ"}
          </button>
          <button type="button" disabled={publishBusy} onClick={()=>{setRealHome(false);setPhase("form");setStep(8);}}>
            Ğ’ĞµÑ€Ğ½ÑƒÑ‚ÑŒÑÑ Ğº Ğ°Ğ½ĞºĞµÑ‚Ğµ Ğ¸ Ñ„Ğ¾Ñ‚Ğ¾Ğ³Ñ€Ğ°Ñ„Ğ¸ÑĞ¼
          </button>
          {deletionSettingsPanel}
          {publishFeedback&&<p role="status">{publishFeedback}</p>}
        </section>:realHomeTab==="profile"?<section className="luemi-real-account" aria-label="ĞœĞ¾Ñ Ğ°Ğ½ĞºĞµÑ‚Ğ°">
          <h1>ĞœĞ¾Ñ Ğ°Ğ½ĞºĞµÑ‚Ğ°</h1>
          {publishStatus?.profile&&<article className="luemi-real-account-card">
            <div className="luemi-real-account-photos">
              {publishStatus.profile.photos.map((photo,i)=>
                <img key={photo} src={photo} alt={"ĞœĞ¾Ñ‘ Ñ„Ğ¾Ñ‚Ğ¾ "+(i+1)} loading={i?"lazy":"eager"} decoding="async"/>)}
            </div>
            <h2>{publishStatus.profile.name}, {publishStatus.profile.age}</h2>
            <p>{publishStatus.profile.city}</p>
            <p>{publishStatus.profile.about}</p>
            <div className="luemi-real-account-interests">{publishStatus.profile.interests.map(interest=>
              <span key={interest}>{interest}</span>)}</div>
          </article>}
          <p role="status">{publishStatus?.state==="published"?"ĞĞ½ĞºĞµÑ‚Ğ° Ğ¾Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ¾Ğ²Ğ°Ğ½Ğ° Ğ¸ Ğ´Ğ¾ÑÑ‚ÑƒĞ¿Ğ½Ğ° Ğ´Ñ€ÑƒĞ³Ğ¸Ğ¼ Ğ»ÑĞ´ÑĞ¼.":"ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑĞµĞ¼ ÑÑ‚Ğ°Ñ‚ÑƒÑ Ğ°Ğ½ĞºĞµÑ‚Ñ‹â€¦"}</p>
          <div className="registration-static-actions">
            <button type="button" className="registration-static-edit" disabled={publishBusy} onClick={()=>{void openPublishedEditor();}}>Ğ ĞµĞ´Ğ°ĞºÑ‚Ğ¸Ñ€Ğ¾Ğ²Ğ°Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ</button>
            <button type="button" className="registration-static-edit" disabled={publishBusy} onClick={()=>{void hideProfile();}}>Ğ¡ĞºÑ€Ñ‹Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ</button>
          </div>
          {publishedEditor&&<section className="registration-preview-review" aria-label="Ğ ĞµĞ´Ğ°ĞºÑ‚Ğ¸Ñ€Ğ¾Ğ²Ğ°Ğ½Ğ¸Ğµ Ğ°Ğ½ĞºĞµÑ‚Ñ‹">
            <label>Ğ˜Ğ¼Ñ<input className="glass-control" value={publishedEditor.name} maxLength={48}
              onChange={e=>setPublishedEditor(p=>p?{...p,name:cleanName(e.target.value)}:p)}/></label>
            <label>Ğ¦ĞµĞ»ÑŒ Ğ·Ğ½Ğ°ĞºĞ¾Ğ¼ÑÑ‚Ğ²Ğ°<select className="glass-control" value={publishedEditor.goal}
              onChange={e=>setPublishedEditor(p=>p?{...p,goal:e.target.value}:p)}>
              {goals.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
            </select></label>
            <label>Ğ ÑĞµĞ±Ğµ<textarea className="glass-control" value={publishedEditor.about} maxLength={750}
              onChange={e=>setPublishedEditor(p=>p?{...p,about:e.target.value}:p)}/></label>
            <button type="button" disabled={publishBusy} onClick={()=>{void savePublishedEditor();}}>Ğ¡Ğ¾Ñ…Ñ€Ğ°Ğ½Ğ¸Ñ‚ÑŒ Ğ¸Ğ·Ğ¼ĞµĞ½ĞµĞ½Ğ¸Ñ</button>
            <button type="button" disabled={publishBusy} onClick={()=>setPublishedEditor(null)}>ĞÑ‚Ğ¼ĞµĞ½Ğ°</button>
          </section>}
          <button type="button" disabled={publishBusy} onClick={()=>{void withdrawPersonalConsent();}}>ĞÑ‚Ğ¾Ğ·Ğ²Ğ°Ñ‚ÑŒ ÑĞ¾Ğ³Ğ»Ğ°ÑĞ¸Ğµ Ğ¸ ÑĞºÑ€Ñ‹Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ</button>
          {deletionSettingsPanel}
          {publishFeedback&&<p role="status">{publishFeedback}</p>}
        </section>:<Suspense fallback={<p role="status">Ğ—Ğ°Ğ³Ñ€ÑƒĞ¶Ğ°ĞµĞ¼â€¦</p>}>
          {realHomeTab==="chats"&&import.meta.env.VITE_LUEMI_REAL_CHATS==="1"?
            <RealChats/>:<RealLiveFeed onMatched={()=>setRealHomeTab("chats")}/>}
        </Suspense>}
      </div>
      {!realFeedPilot.enabled&&remoteDraftPilot.enabled&&<footer className="luemi-private-edit-bar">
        <button type="button" onClick={()=>{setRealHome(false);setPhase("form");setStep(8);}}>
          <Pencil size={19} aria-hidden="true"/> Ğ ĞµĞ´Ğ°ĞºÑ‚Ğ¸Ñ€Ğ¾Ğ²Ğ°Ñ‚ÑŒ Ğ°Ğ½ĞºĞµÑ‚Ñƒ <ArrowRight size={19} aria-hidden="true"/>
        </button>
      </footer>}
      {realFeedPilot.enabled&&publishStatus!==null&&<nav className="luemi-real-home-nav" aria-label="Ğ Ğ°Ğ·Ğ´ĞµĞ»Ñ‹ LUEMI">
        <button type="button" aria-current={realHomeTab==="feed"?"page":undefined} onClick={()=>setRealHomeTab("feed")}>Ğ—Ğ½Ğ°ĞºĞ¾Ğ¼ÑÑ‚Ğ²Ğ°</button>
        {publishStatus?.state==="published"&&import.meta.env.VITE_LUEMI_REAL_CHATS==="1"&&
          <button type="button" aria-current={realHomeTab==="chats"?"page":undefined} onClick={()=>setRealHomeTab("chats")}>Ğ§Ğ°Ñ‚Ñ‹</button>}
        <button type="button" aria-current={realHomeTab==="profile"?"page":undefined} onClick={()=>setRealHomeTab("profile")}>ĞŸÑ€Ğ¾Ñ„Ğ¸Ğ»ÑŒ</button>
      </nav>}
    </section>
  </main>;
  if(auth==="authorized"&&journey!==null)return journeyOverlay;
  if(auth==="authorized"&&phase==="form"&&registrationV2Pilot&&!demoOpen)
    return <RealRegistrationV2 draft={draft} key={scope??"registration"} patch={patch} photos={photos}
       fallbackEntry={registrationFallback}
       addPhotos={addPhotos} removePhoto={removePhoto} movePhoto={movePhoto}
       resetDraft={resetDraft} theme={theme} onTheme={changeTheme}
        onSave={()=>{void (realFeedPilot.enabled?confirmRealRegistration():
          remoteMediaPilot.enabled?confirmPrivateRegistration():persistServerDraft());}}
        mediaEnabled={remoteMediaPilot.enabled}
       serverSaving={serverSaving||publishBusy}
       serverStatus={realFeedPilot.enabled?publishFeedback:serverStatus}
       mediaStatus={mediaStatus}
       storageError={storageState==="error"?(storageCode??"io"):null}
       restored={photosRestored} resumeReview={step===8&&privateDraftSaved}
       onRetryStorage={retryStorage}
       onExit={()=>{setRegistrationFallback(false);setPhase("welcome");}} registerBack={registerV2Back}/>;
  return <main ref={rootRef} className="luemi-shell" data-theme={activeTheme} data-phase={phase}
    data-registration-preview={auth==="authorized"&&phase==="form"&&!demoOpen&&step===8?"true":undefined}
    data-scene={auth==="authorized"&&phase==="form"?"form":"intro"}>
    <div className="milky-mist" aria-hidden="true"/>
    {demoOpen&&auth==="authorized"&&!realFeedPilot.enabled&&!realOnly?<Suspense fallback={null}><DiscoveryApp draft={draft} photos={readyPhotos} theme={theme} onTheme={changeTheme} onExit={exitDemo} registerBack={registerDiscoveryBack}/></Suspense>:null}
    {!demoOpen&&(auth!=="authorized"||phase==="welcome"?<section className={"entry-state cinematic-entry"+(visualReady?" visually-ready":"")} aria-live="polite">
      <div className="intro-mark">
        <img src={logoSrc} alt="luemi" className="intro-logo"/>
      </div>
      {auth!=="connecting"&&!(auth==="authorized"&&realFeedPilot.enabled&&publicationCheck==="checking")&&
       <h1 className={registrationStarted?"intro-returning-title":undefined} aria-label={auth==="authorized"?"Ğ‘Ğ¾Ğ»ÑŒÑˆĞµ, Ñ‡ĞµĞ¼ Ğ·Ğ½Ğ°ĞºĞ¾Ğ¼ÑÑ‚Ğ²Ğ°":introText}>
         {auth==="authorized"?"Ğ‘Ğ¾Ğ»ÑŒÑˆĞµ, Ñ‡ĞµĞ¼ Ğ·Ğ½Ğ°ĞºĞ¾Ğ¼ÑÑ‚Ğ²Ğ°":introText}
         {auth!=="authorized"&&<span className="intro-type-cursor" aria-hidden="true">|</span>}
       </h1>}
      {auth==="authorized"&&!(realFeedPilot.enabled&&publicationCheck==="checking")&&
       <p className="intro-subtitle">Ğ ĞµĞ°Ğ»ÑŒĞ½Ñ‹Ğµ Ğ»ÑĞ´Ğ¸. ĞĞ°ÑÑ‚Ğ¾ÑÑ‰Ğ¸Ğµ ÑĞ¼Ğ¾Ñ†Ğ¸Ğ¸.<br/>Ğ‘Ğ»Ğ¸Ğ¶Ğµ, Ñ‡ĞµĞ¼ ĞºĞ°Ğ¶ĞµÑ‚ÑÑ.</p>}
      {auth==="outside-telegram"&&<p>ĞÑ‚ĞºÑ€Ğ¾Ğ¹ LUEMI Ñ‡ĞµÑ€ĞµĞ· <a href="https://t.me/LuemiAppBot">@LuemiAppBot</a> Ğ²Ğ½ÑƒÑ‚Ñ€Ğ¸ Telegram.</p>}
      {auth==="needs-bot"&&<><p>{realOnly?"Ğ¡ĞµÑ€Ğ²ĞµÑ€ Ğ°Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ğ·Ğ°Ñ†Ğ¸Ğ¸ Ğ¿Ğ¾ĞºĞ° Ğ½ĞµĞ´Ğ¾ÑÑ‚ÑƒĞ¿ĞµĞ½. ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸ Ğ²Ñ…Ğ¾Ğ´ Ğ¿Ğ¾Ğ·Ğ¶Ğµ.":"Ğ¢ĞµÑÑ‚Ğ¾Ğ²Ñ‹Ğ¹ ÑĞµÑ€Ğ²ĞµÑ€ Ğ³Ğ¾Ñ‚Ğ¾Ğ², Ğ½Ğ¾ Ğ°Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ğ·Ğ°Ñ†Ğ¸Ñ Ğ¿Ğ¾ĞºĞ° Ğ¾Ñ‚ĞºĞ»ÑÑ‡ĞµĞ½Ğ°."}</p>
        {realOnly&&<button className="primary-action" type="button" onClick={()=>{setAuth("connecting");setConnectAttempt(v=>v+1);}}>ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ñ‚ÑŒ Ğ²Ñ…Ğ¾Ğ´</button>}</>}
      {auth==="test-full"&&<><p role="status">Ğ’ÑĞµ Ğ¼ĞµÑÑ‚Ğ° Ğ² Ñ‚ĞµĞºÑƒÑ‰ĞµĞ¹ Ñ‚ĞµÑÑ‚Ğ¾Ğ²Ğ¾Ğ¹ Ğ³Ñ€ÑƒĞ¿Ğ¿Ğµ LUEMI Ğ·Ğ°Ğ½ÑÑ‚Ñ‹. Ğ£Ğ¶Ğµ Ğ·Ğ°Ñ€ĞµĞ³Ğ¸ÑÑ‚Ñ€Ğ¸Ñ€Ğ¾Ğ²Ğ°Ğ½Ğ½Ñ‹Ğµ ÑƒÑ‡Ğ°ÑÑ‚Ğ½Ğ¸ĞºĞ¸ Ğ¼Ğ¾Ğ³ÑƒÑ‚ Ğ¿Ñ€Ğ¾Ğ´Ğ¾Ğ»Ğ¶Ğ¸Ñ‚ÑŒ Ğ²Ñ…Ğ¾Ğ´.</p>
        <button className="primary-action" type="button" onClick={()=>{setAuth("connecting");setConnectAttempt(v=>v+1);}}>ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ñ‚ÑŒ Ğ²Ñ…Ğ¾Ğ´</button></>}
      {auth==="needs-invite"&&<><p role="alert">Ğ˜Ğ´Ñ‘Ñ‚ Ğ·Ğ°ĞºÑ€Ñ‹Ñ‚Ñ‹Ğ¹ Ñ‚ĞµÑÑ‚ LUEMI. Ğ”Ğ»Ñ Ğ¿Ñ€Ğ¸Ğ³Ğ»Ğ°ÑˆĞµĞ½Ğ¸Ñ Ğ¾Ñ‚Ğ¿Ñ€Ğ°Ğ²ÑŒ Ğ²Ğ»Ğ°Ğ´ĞµĞ»ÑŒÑ†Ñƒ ÑĞ²Ğ¾Ğ¹ Telegram ID Ğ¸Ğ· ĞºĞ¾Ğ¼Ğ°Ğ½Ğ´Ñ‹ /myid Ğ² @LuemiAppBot.</p>
        <button className="primary-action" type="button" onClick={()=>{setAuth("connecting");setConnectAttempt(v=>v+1);}}>ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ñ‚ÑŒ Ğ²Ñ…Ğ¾Ğ´</button></>}
=ço-¢G§²ÚîÆ­yÖW'6öâÇ6WEW'6öåÓ×W6U7FFSÅ&VÅV&Æ—6†VE&öf–ÆWÆçVÆÃâ†çVÆÂ“°¢6öç7B¶66÷VçD÷VâÇ6WD66÷VçD÷VåÓ×W6U7FFR†fÇ6R“°¢6öç7B¶6†EF‡&VD÷VâÇ6WD6†EF‡&VD÷VåÓ×W6U7FFR†fÇ6R“°¢òò6W76–öâÖöæÇ’&öö¶Ö&·3¢F†R’†2æòGW&&ÆR6fVB×&öf–ÆW2VæGö–çB–WBà¢6öç7B·6fVD–G2Ç6WE6fVD–G5Ó×W6U7FFSÅ&VFöæÇ•6WCÇ7G&–æsãâ‚‚“ÓææWr6WCÇ7G&–æsâ‚’“°¢6öç7B¶†–FFVä–G2Ç6WD†–FFVä–G5Ó×W6U7FFSÅ&VFöæÇ•6WCÇ7G&–æsãâ‚‚“ÓææWr6WCÇ7G&–æsâ‚’“°¢6öç7Böä†–FS×W6T6ÆÆ&6²‚†–C§7G&–ær“Óç6WD†–FFVä–G2†W†—7F–æsÓææWr6WB…²ââæW†—7F–ærÆ–EÒ’’ÅµÒ“°¢6öç7Böå6fSÒ†–C§7G&–ær“Óç6WE6fVD–G2‡&Wf–÷W3Óç°¢6öç7BæW‡CÖæWr6WB‡&Wf–÷W2“¶–b†æW‡Bæ†2†–B’–æW‡BæFVÆWFR†–B“¶VÇ6RæW‡BæFB†–B“·&WGW&âæW‡C°¢Ò“°¢6öç7B–æFWƒ×F'2æf–æD–æFW‚‡CÓçE³ÓÓÓÖ'&÷w6R“°¢6öç7BvW3×W6U&VcÄ…DÔÄF—dVÆVÖVçCâ†çVÆÂ’ÇF÷F'57W&f6S×W6U&VcÄ…DÔÄF—dVÆVÖVçCâ†çVÆÂ“°¢6öç7BvUG&6³×W6U&VcÄ…DÔÄF—dVÆVÖVçCâ†çVÆÂ’ÇVæFW&Æ–æS×W6U&VcÄ…DÔÅ7äVÆVÖVçCâ†çVÆÂ“°¢6öç7BvW%6WGFÆUF–ÖW#×W6U&VcÆçVÖ&W'ÆçVÆÃâ†çVÆÂ“°¢6öç7BÖ÷F–öäWF†÷&—G“×W6U&Vb†7&VFU&öf–ÆTÖ÷F–öäWF†÷&—G’‚’“°¢6öç7B–çWD÷væW'6†—×W6U&Vb†æWrvW7GW&T&&—FW"‚’“°¢6öç7BvW7GW&S×W6U&VcÄvW7GW&WÆçVÆÃâ†çVÆÂ“°¢6öç7B7W7VæD'&÷w6S×W6U&VcÂ‚“Óçfö–Câ‚‚“Óç·Ò“°¢6öç7B6Æ–6´&Æö6µVçF–Ã×W6U&Vbƒ“°¢6öç7B'&÷w6TÖ÷F–öã×W6U&Vb†æWrÖ÷F–öä6öçG&öÆÆW"‚&'&÷w6R"Ç°¢g&ÖS¦6#Óç&WVW7Dæ–ÖF–öäg&ÖR†6"’Æ6æ6VÄg&ÖS¦–CÓæ6æ6VÄæ–ÖF–öäg&ÖR†–B¢Ò’“°¢6öç7B'&÷w6U6WGFÆS×W6U&VcÇ·Fö¶Vã¤Ö÷F–öåFö¶Vã·F&vWC¦çVÖ&W'×ÆçVÆÃâ†çVÆÂ“°¢6öç7B'&÷w6U÷6—F–öã×W6U&Vbƒ“°¢6öç7BVç7W&T'&÷w6TÖ÷F–öãÒ‚“Óç°¢–b†'&÷w6TÖ÷F–öâæ7W'&VçBç6æ6†÷B‚’æF—7÷6VB¢'&÷w6TÖ÷F–öâæ7W'&VçCÖæWrÖ÷F–öä6öçG&öÆÆW"‚&'&÷w6R"Ç°¢g&ÖS¦6#Óç&WVW7Dæ–ÖF–öäg&ÖR†6"’Æ6æ6VÄg&ÖS¦–CÓæ6æ6VÄæ–ÖF–öäg&ÖR†–B¢ÒÆ'&÷w6U÷6—F–öâæ7W'&VçB“°¢&WGW&â'&÷w6TÖ÷F–öâæ7W'&VçC°¢Ó°¢6öç7B†VFW#×W6U&VcÄ†VFW$Ö÷F–öãâ†çVÆÂ“°¢6öç7B67&öÆÅ÷6—F–öç3×W6U&Vb‡²&f÷"×–÷R#£ÆæV&'“£Ò“°¢6öç7Bf—6—F÷$&6µ&Vc×W6U&VcÂ‚‚“Óæ&ööÆVâ—ÆçVÆÃâ†çVÆÂ’Ç&öf–ÆT&6µ&Vc×W6U&VcÂ‚‚“Óæ&ööÆVâ—ÆçVÆÃâ†çVÆÂ“°¢6öç7B6†D&6µ&Vc×W6U&VcÂ‚‚“Óçfö–B—ÆçVÆÃâ†çVÆÂ“°¢6öç7B&Vv—7FW%f—6—F÷$&6³×W6T6ÆÆ&6²‚†fã¢‚‚“Óæ&ööÆVâ—ÆçVÆÂ“Óç·f—6—F÷$&6µ&Vbæ7W'&VçCÖfã·ÒÅµÒ“°¢6öç7B&Vv—7FW%&öf–ÆT&6³×W6T6ÆÆ&6²‚†fã¢‚‚“Óæ&ööÆVâ—ÆçVÆÂ“Óç·&öf–ÆT&6µ&Vbæ7W'&VçCÖfã·ÒÅµÒ“°¢6öç7Böå67&öÆÅF÷×W6T6ÆÆ&6²‚‡F#¤'&÷w6UF"ÇF÷¦çVÖ&W"“Óç°¢–b‡F#ÓÓÒ&fVVB"—&WGW&ã°¢67&öÆÅ÷6—F–öç2æ7W'&VçE·F%Ó×F÷°¢–b†Ö–åF#ÓÓÒ&F—66÷fW""bf'&÷w6SÓÓ×F"bbW'6öâ–†VFW"æ7W'&VçCòç6WE67&öÆÅF÷‡F÷“°¢ÒÅ¶Ö–åF"Æ'&÷w6RÇW'6öåÒ“°¢W6TÆ–÷WDVffV7B‚‚“Óç°¢–b†Ö–åF#ÓÓÒ'&öf–ÆR'ÇÇW'6öâ—&WGW&ã°¢†VFW"æ7W'&VçCòç&W6WB‚“°¢–b†Ö–åF#ÓÓÒ&F—66÷fW""bf'&÷w6RÓÒ&fVVB"–†VFW"æ7W'&VçCòç6WE67&öÆÅF÷‡67&öÆÅ÷6—F–öç2æ7W'&VçE¶'&÷w6UÒ“°¢ÒÅ¶Ö–åF"Æ'&÷w6RÇW'6öåÒ“°¢6öç7B÷væW#×W6TÖVÖò‚‚“ÓçV&Æ—6†VEFôÖ7FW"‡V&Æ—6†VE&öf–ÆRÆ÷væW%†÷Fõ&Wf–Wr’Å·V&Æ—6†VE&öf–ÆRÆ÷væW%†÷Fõ&Wf–WuÒ“°¢6öç7B6VÆV7EF#Ò†–æFWƒ¦çVÖ&W"“Óç°¢6öç7B&÷VæFVCÔÖF‚æÖ‚ƒÄÖF‚æÖ–â‡F'2æÆVæwF‚ÓÆ–æFW‚’“°¢–b‡F'5¶&÷VæFVEÕ³ÓÓÓÖ'&÷w6R—&WGW&ã°¢6WD'&÷w6R‡F'5¶&÷VæFVEÕ³Ò“°¢6VÆV7F–öä†F–2‚“°¢Ó°¢òòöæRg&7F–öæÂ6ö÷&F–æFRG&—fW2F†R'&÷w6RG&6²æB—G2VæFW&Æ–æRà¢6öç7B–çD'&÷w6SÒ‡G&6µƒ¦çVÖ&W"Æ–æµƒ¦çVÖ&W"“Óç°¢Ö÷F–öäWF†÷&—G’æ7W'&VçBç'Vâ‚&'&÷w6R"Å$ôd”ÄUôÔõD”ôåõu$•DU%õD$ÄRæ'&÷w6RÂ‚“Óç°¢vUG&6²æ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×F"Ööfg6WB"Â#‚"“°¢vUG&6²æ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’ÖG&r"ÇG&6µ‚²'‚"“°¢VæFW&Æ–æRæ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×F"Ööfg6WB"Â#‚"“°¢VæFW&Æ–æRæ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×VæFW&Æ–æRÖG&r"Æ–æµ‚²'‚"“°¢Ò“°¢Ó°¢6öç7Bg&÷¦Vä'&÷w6SÒ‚“Óç°¢Vç7W&T'&÷w6TÖ÷F–öâ‚“°¢6öç7Bv–GFƒ×vW2æ7W'&VçCòæ6Æ–VçEv–GF‡ÇÇv–æF÷ræ–ææW%v–GFƒ°¢òò&÷F‚552G&ç6—F–öç26â†fRF–ffW&VçB–âÖfÆ–v‡BÖG&—‚fÇVW2à¢6öç7BG&6µƒÖ6ö×WFVEG&ç6ÆF–öâ‡vUG&6²æ7W'&VçB’Æ–æµƒÖ6ö×WFVEG&ç6ÆF–öâ‡VæFW&Æ–æRæ7W'&VçB“°¢6öç7Bg&7F–öãÖg&7F–öæÅG&6²‡vUG&6²æ7W'&VçBÇv–GF‚Æ'&÷w6U÷6—F–öâæ7W'&VçB“°¢6öç7BöÆCÖ'&÷w6U6WGFÆRæ7W'&VçC°¢–b†öÆB—¶'&÷w6TÖ÷F–öâæ7W'&VçBæ–çFW''WB†öÆBçFö¶VâÂ&–çFW''WFVB"“¶'&÷w6U6WGFÆRæ7W'&VçCÖçVÆÃ·Ğ¢–b‡vW%6WGFÆUF–ÖW"æ7W'&VçBÓÖçVÆÂ—¶6ÆV%F–ÖV÷WB‡vW%6WGFÆUF–ÖW"æ7W'&VçB“·vW%6WGFÆUF–ÖW"æ7W'&VçCÖçVÆÃ·Ğ¢vUG&6²æ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2×6WGFÆ–ær"“°¢VæFW&Æ–æRæ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2×6WGFÆ–ær"“°¢vUG&6²æ7W'&VçCòæ6Æ74Æ—7BæFB‚&—2Öf–ævW"×G&6¶–ær"“°¢VæFW&Æ–æRæ7W'&VçCòæ6Æ74Æ—7BæFB‚&—2Öf–ævW"×G&6¶–ær"“°¢–çD'&÷w6R‡G&6µ‚Æ–æµ‚“°¢'&÷w6U÷6—F–öâæ7W'&VçCÖg&7F–öã°¢&WGW&â·v–GF‚Æg&7F–öâÇG&6µ‚Æ–æµ‡Ó°¢Ó°¢6öç7Bf–æ—6…vW%6WGFÆSÒ‡Fö¶Vã¤Ö÷F–öåFö¶VçÆçVÆÃÖ'&÷w6U6WGFÆRæ7W'&VçCòçFö¶VãóöçVÆÂ“Óç°¢6öç7B7W'&VçCÖ'&÷w6U6WGFÆRæ7W'&VçC°¢–b‚7W'&VçGÇÂFö¶VçÇÂ'&÷w6TÖ÷F–öâæ7W'&VçBæ÷vç2‡Fö¶Vâ’—&WGW&ã°¢6öç7Bv–GFƒ×vW2æ7W'&VçCòæ6Æ–VçEv–GF‡ÇÃ°¢–b„ÖF‚æ'2†6ö×WFVEG&ç6ÆF–öâ‡vUG&6²æ7W'&VçB’¶7W'&VçBçF&vWB§v–GF‚“ã—&WGW&ã°¢–b‚'&÷w6TÖ÷F–öâæ7W'&VçBæf–æ—6‚‡Fö¶VâÇ·–çC¢‚“Óç°¢Ö÷F–öäWF†÷&—G’æ7W'&VçBç'Vâ‚&'&÷w6R"Å$ôd”ÄUôÔõD”ôåõu$•DU%õD$ÄRæ'&÷w6RÂ‚“Óç°¢vUG&6²æ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×F"Ööfg6WB"Â‚Ö7W'&VçBçF&vWB£’²"R"“°¢VæFW&Æ–æRæ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×F"Ööfg6WB"Â†7W'&VçBçF&vWB£’²"R"“°¢vUG&6²æ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’ÖG&r"Â#‚"“°¢VæFW&Æ–æRæ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×VæFW&Æ–æRÖG&r"Â#‚"“°¢Ò“°¢ÒÆöä6öÖÖ—C¢‚“Óç°¢'&÷w6U÷6—F–öâæ7W'&VçCÖ7W'&VçBçF&vWC°¢vUG&6²æ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2×6WGFÆ–ær"“°¢VæFW&Æ–æRæ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2×6WGFÆ–ær"“°¢'&÷w6U6WGFÆRæ7W'&VçCÖçVÆÃ°¢–b‡vW%6WGFÆUF–ÖW"æ7W'&VçBÓÖçVÆÂ–6ÆV%F–ÖV÷WB‡vW%6WGFÆUF–ÖW"æ7W'&VçB“°¢vW%6WGFÆUF–ÖW"æ7W'&VçCÖçVÆÃ°¢òò¶VW&V7B&V6öæ6–Æ–F–öâÂ–æW'B6†ævW2æBæV&'’7F—fF–öâ÷WBö`¢òòF†RÖ÷f–ærg&ÖRâF†RG&6²ö–æF–6F÷"†fRÇ&VG’&V6†VBF†RF&vWBà¢6VÆV7EF"†7W'&VçBçF&vWB“°¢×Ò’—&WGW&ã°¢Ó°¢6öç7B6WGFÆTG&sÒ‡F&vWD–æFWƒ¦çVÖ&W"ÇFö¶Vã¤Ö÷F–öåFö¶VçÆçVÆÃÖçVÆÂ“Óç°¢6öç7BF&vWCÔÖF‚æÖ‚ƒÄÖF‚æÖ–â‡F'2æÆVæwF‚ÓÇF&vWD–æFW‚’“°¢òòg&VW¦RBF†RÆ7Bf—6–&ÆRÖG&—‚Â–æ6ÇVF–ær'WGFöâöF÷Bæf–vF–öâÖ–B×6WGFÆRà¢–b‚Fö¶Vâ–g&÷¦Vä'&÷w6R‚“°¢6öç7B3Ö'&÷w6TÖ÷F–öâæ7W'&VçC°¢–b‚Fö¶Vâ—°¢Fö¶VãÖ2æ&Vv–â†'&÷w6U÷6—F–öâæ7W'&VçB“°¢–b‚Fö¶Vâ—&WGW&ã°¢2æ6Æ–Ò‡Fö¶Vâ“°¢Ğ¢–b‚2ç6WGFÆR‡Fö¶VâÇF&vWB’—&WGW&ã°¢'&÷w6U6WGFÆRæ7W'&VçC×·Fö¶VâÇF&vWGÓ°¢vUG&6²æ7W'&VçCòæ6Æ74Æ—7BæFB‚&—2×6WGFÆ–ær"“°¢VæFW&Æ–æRæ7W'&VçCòæ6Æ74Æ—7BæFB‚&—2×6WGFÆ–ær"“°¢òòfÇW6‚öæRg&÷¦Vâg&ÖR$Tdõ$R&RÖVæ&Æ–ær÷&–v–æÂ552G&ç6—F–öç2à¢fö–BvUG&6²æ7W'&VçCòæöfg6WEv–GFƒ°¢vUG&6²æ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2Öf–ævW"×G&6¶–ær"“°¢VæFW&Æ–æRæ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2Öf–ævW"×G&6¶–ær"“°¢Ö÷F–öäWF†÷&—G’æ7W'&VçBç'Vâ‚&'&÷w6R"Å$ôd”ÄUôÔõD”ôåõu$•DU%õD$ÄRæ'&÷w6RÂ‚“Óç°¢vUG&6²æ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×F"Ööfg6WB"Â‚×F&vWB£’²"R"“°¢VæFW&Æ–æRæ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×F"Ööfg6WB"Â‡F&vWB£’²"R"“°¢vUG&6²æ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’ÖG&r"Â#‚"“°¢VæFW&Æ–æRæ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×VæFW&Æ–æRÖG&r"Â#‚"“°¢Ò“°¢òò÷&–v–æÂG&ç6—F–öæVæB&VÖ–ç2&–Ö'’âfÆÆ&6²6öÖÖ—G2öæ6RöæÇ’à¢vW%6WGFÆUF–ÖW"æ7W'&VçC×v–æF÷rç6WEF–ÖV÷WB‚‚“Óç°¢òòBã3×2F†R'&÷w6W"6†÷VÆB†fR–çFVBF†RFW&Ö–æÂÖG&—‚à¢òòFVÆ–VBG&ç6—F–öâ†2æ÷F†W"g&ÖRFòf–æ—6‚ÂæWfW"7FÆR6öÖÖ—Bà¢–b†'&÷w6U6WGFÆRæ7W'&VçCòçFö¶VãÓÓ×Fö¶Vâ—°¢–b„ÖF‚æ'2†6ö×WFVEG&ç6ÆF–öâ‡vUG&6²æ7W'&VçB’·F&vWB¢‡vW2æ7W'&VçCòæ6Æ–VçEv–GF‡ÇÃ’“ã—°¢vW%6WGFÆUF–ÖW"æ7W'&VçC×v–æF÷rç6WEF–ÖV÷WB‚‚“Óæf–æ—6…vW%6WGFÆR‡Fö¶Vâ’Ãƒ“°¢ÖVÇ6Rf–æ—6…vW%6WGFÆR‡Fö¶Vâ“°¢Ğ¢ÒÃ3ƒ“°¢Ó°¢6öç7B&WVW7D'&÷w6UF#Ò†“¦çVÖ&W"“Óç°¢–b†vW7GW&Ræ7W'&VçCòçG&6¶–ær—&WGW&ã°¢6WGFÆTG&r†’“°¢Ó°¢W6TVffV7B‚‚“Óâ‚“Óç¶–çWD÷væW'6†—æ7W'&VçBæF—7÷6R‚“¶'&÷w6TÖ÷F–öâæ7W'&VçBæF—7÷6R‚“°¢–b‡vW%6WGFÆUF–ÖW"æ7W'&VçBÓÖçVÆÂ—v–æF÷ræ6ÆV%F–ÖV÷WB‡vW%6WGFÆUF–ÖW"æ7W'&VçB“°¢ÒÅµÒ“°¢6öç7BF÷vãÒ†WfVçC¤'&÷w6T–çWBÆ¶–æC¤–çWD¶–æCÒ'ö–çFW""“Óç°¢Vç7W&T'&÷w6TÖ÷F–öâ‚“°¢–b†WfVçBæ—5&–Ö'“ÓÓÖfÇ6R—¶–çWD÷væW'6†—æ7W'&VçBç6V6öæDf–ævW"‚“¶6æ6VÅ7v—R‚“·&WGW&ã·Ğ¢–b†WfVçBçö–çFW%G—SÓÓÒ&Ö÷W6R"bfWfVçBæ'WGFöâÓÓ—&WGW&ã°¢6öç7BF&vWCÖWfVçBçF&vWB–ç7Fæ6VöbVÆVÖVçCöWfVçBçF&vWC¦çVÆÃ°¢–b‚F&vWB—&WGW&ã°¢–b‡F&vWBæ6Æ÷6W7B‚%·&öÆSÖF–ÆöuÒÂæF—66÷fW'’Öf–ÇFW"×6†VWBÂæg’×&–ÂÂæg’ÖW‡æFVBÂæg’ÖÖævR"’—&WGW&ã°¢6öç7BfVVD6&C×F&vWBæ6Æ÷6W7CÄ…DÔÄVÆVÖVçCâ‚"æfVVB×c"Ö6&B"“°¢òòF†R†÷Fò&V6övæ—¦W"÷vç2F†RVçF—&R6&÷W6VÂ7W&f6Râ&VçB6æF–FFP¢òòF†W&R&6W2v—F‚†÷Fòö–çFW"6GW&RöâæG&ö–BF÷V6‚6WVVæ6W2à¢–b‡F&vWBæ6Æ÷6W7B‚"æfVVB×c"×†÷Fòæ6&÷W6VÂÖg&ÖR"’—&WGW&ã°¢6öç7B–çFW&7F—fS×F&vWBæ6Æ÷6W7B‚&'WGFöâÆÆ–çWBÇFW‡F&VÇ6VÆV7BÅ¶6öçFVçFVF—F&ÆUÒ"“°¢òò'&÷w6RF÷V6‚7F'G26âÆæBöâf÷%–÷RôæV&'’F–ÆR'WGFöâgFW"¢òò67&öÆÆW"Æ–÷WBF–6²âD—27F–ÆÂ†æFÆVB'’—G2æF—fRöä6Æ–6³²öæÇ¢òòâ†—2Ö6öæf—&ÖVB†÷&—¦öçFÂE$r6Æ–×2F†RvW"æB7W&W76W26Æ–6²à¢òò¶VWÖöFÂ6öçG&öÇ2Â&–Ç2ÂVF—Bf–VÆG2æB÷F†W"7W7FöÒvW7GW&W2—6öÆFVBà¢6öç7BF–ÆU7v—SÒ–çFW&7F—fSòæÖF6†W2‚&'WGFöâ"’b`¢–çFW&7F—fRæ6Æ÷6W7B‚"æg’×67&öÆÂÂææ"×67&öÆÂ"’b`¢–çFW&7F—fRæ6Æ÷6W7B‚"æg’×&–ÂÂæg’ÖW‡æFVBÂæg’ÖÖævRÂæF—66÷fW'’Ö7F–öâ"“°¢–b†–çFW&7F—fRbbF–ÆU7v—Rb`¢–çFW&7F—fRæÖF6†W2‚"æF—66÷fW'’ÖæÖRÖ'WGFöâÂæfVVB×c"ÖW‡æBÂæF—66÷fW'’×F÷×F'2·&öÆS×F%Ò"’—&WGW&ã°¢–b†WfVçBæ6Æ–VçE‚Ò‡vW2æ7W'&VçCòævWD&÷VæF–æt6Æ–VçE&V7B‚’æÆVgCóó“Ã#b—&WGW&ã°¢òòF†RFWF–Ç27V'G&VR÷vç2FW‡BvW7GW&W2WfVâv†Vâ—B&V6†W2&÷fRF†P¢òòöÆB7WFöfbâF†R6&÷W6VÂ6öç7VÖW2–â×&ævR†÷Fò7v—W2–â6GW&S°¢òò7v—R7BF†Rf–æÂ†÷Fò6â72F‡&÷Vv‚FòF†—2vW"à¢–b†fVVD6&B—¶6öç7B&V7CÖfVVD6&BævWD&÷VæF–æt6Æ–VçE&V7B‚“°¢–b‚F&vWBæ6Æ÷6W7B‚"æfVVB×c"ÖFWF–Ç2ÂæfVVB×c"×†÷Fòæ6&÷W6VÂÖg&ÖR"’b`¢6&DvW7GW&U¦öæR†WfVçBæ6Æ–VçE’Ç&V7BçF÷Ç&V7Bæ†V–v‡B’ÓÒ&'&÷w6R"—&WGW&ã·Ğ¢6öç7B6W&–ÃÖ–çWD÷væW'6†—æ7W'&VçBæ&Vv–â†¶–æBÆWfVçBçö–çFW$–BÂ&'&÷w6R"“°¢–b‡6W&–ÃÓÓÖçVÆÂ—&WGW&ã°¢–çWD÷væW'6†—æ7W'&VçBæ&Vv–â†¶–æBÆWfVçBçö–çFW$–BÂ&æF—fR"“°¢vW7GW&Ræ7W'&VçC×¶–C¦WfVçBçö–çFW$–BÆ¶–æBÇƒ¦WfVçBæ6Æ–VçE‚Ç“¦WfVçBæ6Æ–VçE’À¢7F'FVC§W&f÷&Öæ6Rææ÷r‚’ÇG&6¶–æs¦fÇ6RÆ–æFWƒ¦–æFW‚À¢v–GFƒ§vW2æ7W'&VçCòæ6Æ–VçEv–GF‡ÇÇv–æF÷ræ–ææW%v–GF‚Ç6W&–ÂÇFö¶Vã¦çVÆÂÀ¢÷&–v–åG&6³£Æ÷&–v–ä–æ³£ÆÆ7Eƒ¦WfVçBæ6Æ–VçE‡Ó°¢Ó°¢6öç7BÖ÷fSÒ†WfVçC¤'&÷w6T–çWBÆ¶–æC¤–çWD¶–æCÒ'ö–çFW""“Óç°¢6öç7BsÖvW7GW&Ræ7W'&VçC¶–b‚wÇÆræ¶–æBÓÖ¶–æGÇÆræ–BÓÖWfVçBçö–çFW$–GÇÆrææF—fR—&WGW&ã°¢ÆWBƒÖWfVçBæ6Æ–VçE‚Örçƒ¶6öç7B“ÖWfVçBæ6Æ–VçE’Örç“°¢ræÆ7EƒÖWfVçBæ6Æ–VçEƒ°¢–b‚rçG&6¶–ær—°¢–b„ÖF‚æ'2‡’“ã"bdÖF‚æ'2‡’“äÖF‚æ'2‡‚’—°¢–çWD÷væW'6†—æ7W'&VçBææF—fU67&öÆÂ†rç6W&–Â“¶rææF—fS×G'VS·&WGW&ã°¢Ğ¢–b„ÖF‚æ'2‡‚“ÃgÇÄÖF‚æ'2‡‚“ÄÖF‚æ'2‡’’£ã"—&WGW&ã°¢òò†—2F—&V7F–öâ&÷fRÇ&VG’F—7F–æwV—6†VBæF—fRâ×’g&öÒ'&÷w6Râ×‚à¢òò&W7F–ær67&öÆÅF÷â×W7BäõBF—6&ÆR†÷&—¦öçFÂ7v—W2f÷"F†RVçF—&P¢òòf÷%–÷RôæV&'’67&öÆÆW"âæF—fRfW'F–6ÂÖ÷F–öâ&WF–ç2W†6ÇW6—fR÷væW'6†—à¢–b‚WfVçBæ6æ6VÆ&ÆR—°¢–çWD÷væW'6†—æ7W'&VçBææF—fU67&öÆÂ†rç6W&–Â“¶rææF—fS×G'VS·&WGW&ã°¢Ğ¢–b‚–çWD÷væW'6†—æ7W'&VçBæ6Æ–Ò‚&'&÷w6R"Ærç6W&–Â’—&WGW&ã°¢6öç7Bg&÷¦VãÖg&÷¦Vä'&÷w6R‚“°¢rçG&6¶–æs×G'VS¶rçv–GFƒÖg&÷¦Vâçv–GFƒ¶ræ–æFWƒÖg&÷¦Vâæg&7F–öã°¢ræ÷&–v–åG&6³Ög&÷¦VâçG&6µƒ¶ræ÷&–v–ä–æ³Ög&÷¦Vâæ–æµƒ°¢òòF†R†—2F‡&W6†öÆB—2&V6övæ—F–öâ†6RÂæ÷BÖ÷fVÖVçBöbF†RG&6²à¢òò7F'Bg&öÒF†Rf—6–&ÆRg&ÖRv†Vâ÷væW'6†——26Æ–ÖVBà¢rçƒÖWfVçBæ6Æ–VçEƒ¶rç7F'FVC×W&f÷&Öæ6Rææ÷r‚“·ƒÓ°¢rçFö¶VãÖ'&÷w6TÖ÷F–öâæ7W'&VçBæ&Vv–â†ræ–æFW‚“°¢–b†rçFö¶Vâ–'&÷w6TÖ÷F–öâæ7W'&VçBæ6Æ–Ò†rçFö¶Vâ“°¢–b†¶–æCÓÓÒ'ö–çFW""—G'—¶WfVçBæ7W'&VçEF&vWBç6WEö–çFW$6GW&R†WfVçBçö–çFW$–B“·Ö6F6‡²ò¢öÆFW"vV%f–Wr¢÷Ğ¢Ğ¢–b‚rçFö¶VçÇÂ–çWD÷væW'6†—æ7W'&VçBæ÷vç2‚&'&÷w6R"Ærç6W&–Â’—&WGW&ã°¢–b†WfVçBæ6æ6VÆ&ÆR–WfVçBç&WfVçDFVfVÇB‚“°¢6öç7BÆ–Ö—FVCÒ†ræ–æFWƒÃÒãbgƒã—ÇÂ†ræ–æFWƒã×F'2æÆVæwF‚ÓÒãbgƒÃ“°¢6öç7B6†–gCÖÆ–Ö—FVC÷‚¢ã##¤ÖF‚æÖ‚‚Örçv–GF‚ÄÖF‚æÖ–â†rçv–GF‚Ç‚’“°¢6öç7BG&6µƒÖræ÷&–v–åG&6²·6†–gBÆ–æµƒÖræ÷&–v–ä–æ²×6†–gBó3°¢òò6öÆW66VBöæR$bv—F‚vVæW&F–öâwV&C²æò&V7B&VæFW'2GW&–ærÖ÷fRà¢'&÷w6TÖ÷F–öâæ7W'&VçBç66†VGVÆU–çB†rçFö¶VâÇG&6µ‚Â‚“Óç–çD'&÷w6R‡G&6µ‚Æ–æµ‚’“°¢Ó°¢6öç7BWÒ†WfVçC¤'&÷w6T–çWBÆ6æ6VÃÖfÇ6RÆ¶–æC¤–çWD¶–æCÒ'ö–çFW""“Óç°¢6öç7BsÖvW7GW&Ræ7W'&VçC¶–b‚wÇÆræ¶–æBÓÖ¶–æGÇÆræ–BÓÖWfVçBçö–çFW$–B—&WGW&ã°¢vW7GW&Ræ7W'&VçCÖçVÆÃ°¢–b‚rçG&6¶–æwÇÂrçFö¶Vâ—°¢–b†rææF—fR––çWD÷væW'6†—æ7W'&VçBæf–æ—6‚‚&æF—fR"Ærç6W&–Â“°¢VÇ6R°¢òò&VÆV6RöæÇ’F†—26ö×öæVçBw26æF–FFW2âæ÷F†W"&V6övæ—¦W"Ö’7F–ÆÀ¢òò&ö6W72—G2æF—fRF÷V6†VæBgFW"F†R7–çF†WF–2ö–çFW'Wà¢–çWD÷væW'6†—æ7W'&VçBæf–æ—6„6æF–FFR†rç6W&–ÂÂ&'&÷w6R"“°¢–çWD÷væW'6†—æ7W'&VçBæf–æ—6„6æF–FFR†rç6W&–ÂÂ&æF—fR"“°¢Ğ¢&WGW&ã°¢Ğ¢–b‚–çWD÷væW'6†—æ7W'&VçBæf–æ—6‚‚&'&÷w6R"Ærç6W&–Â’—&WGW&ã°¢–b†¶–æCÓÓÒ'ö–çFW""—G'—¶–b†WfVçBæ7W'&VçEF&vWBæ†5ö–çFW$6GW&R†WfVçBçö–çFW$–B’–WfVçBæ7W'&VçEF&vWBç&VÆV6Uö–çFW$6GW&R†WfVçBçö–çFW$–B“·Ö6F6‡²ò¢–×Æ–6—B&VÆV6R¢÷Ğ¢6öç7BƒÖWfVçBæ6Æ–VçE‚Örç‚ÆVÆ6VCÔÖF‚æÖ‚ƒÇW&f÷&Öæ6Rææ÷r‚’Örç7F'FVB“°¢6öç7BfVÆö6—G“ÔÖF‚æ'2‡‚’öVÆ6VC°¢6öç7B&uF&vWCÒ6æ6VÂbb„ÖF‚æ'2‡‚“ærçv–GF‚¢ã‡ÇÇfVÆö6—G“âãSR¢ôÖF‚ç&÷VæB†ræ–æFW‚’²‡ƒÃó¢Ó“¤ÖF‚ç&÷VæB†ræ–æFW‚“°¢6öç7BF&vWCÔÖF‚æÖ‚ƒÄÖF‚æÖ–â‡F'2æÆVæwF‚ÓÇ&uF&vWB’“°¢6Æ–6´&Æö6µVçF–Âæ7W'&VçC×W&f÷&Öæ6Rææ÷r‚’³#c°¢òòfÇW6‚F†R&VÆV6R÷6—F–öâ&Vf÷&R6æ6VÆÆ–ærVæF–ærf–ævW"$bâF†P¢òò5526WGFÆRæ÷r7F'G2BF†R7GVÂf–æÂö–çFW"Æö6F–öâÂæ÷BâöÆFW ¢òò6ö×÷6—FVBg&ÖRà¢6öç7BÆ–Ö—FVCÒ†ræ–æFWƒÃÒãbgƒã—ÇÂ†ræ–æFWƒã×F'2æÆVæwF‚ÓÒãbgƒÃ“°¢6öç7B6†–gCÖÆ–Ö—FVC÷‚¢ã##¤ÖF‚æÖ‚‚Örçv–GF‚ÄÖF‚æÖ–â†rçv–GF‚Ç‚’“°¢'&÷w6TÖ÷F–öâæ7W'&VçBç–çB†rçFö¶VâÆræ÷&–v–åG&6²·6†–gBÀ¢‚“Óç–çD'&÷w6R†ræ÷&–v–åG&6²·6†–gBÆræ÷&–v–ä–æ²×6†–gBó2’“°¢6WGFÆTG&r‡F&vWBÆrçFö¶Vâ“°¢Ó°¢6öç7B6æ6VÅ7v—SÒ‚“Óç¶6öç7BsÖvW7GW&Ræ7W'&VçC¶vW7GW&Ræ7W'&VçCÖçVÆÃ°¢–b‚r—&WGW&ã°¢–çWD÷væW'6†—æ7W'&VçBæ6æ6VÂ‚“°¢–b†rçG&6¶–ær—°¢–b†rçFö¶Vâ–'&÷w6TÖ÷F–öâæ7W'&VçBæ6æ6VÂ†rçFö¶VâÂ&vW7GW&RÖ6æ6VÂ"“°¢6WGFÆTG&r†–æFW‚“°¢Ğ¢Ó°¢òòæG&ö–BvV%f–Wr6â6æ6VÂö–çFW"WfVçG226ööâ2—G2æF—fRâ&V6övæ—¦W ¢òòF¶W2÷fW"âæöâ×76—fRF÷V6†Ö÷fR&V6övæ—¦W2†÷&—¦öçFÂ–çFVçBöâF†R6ÖP¢òò7W&f6RæB&WfVçG2öæÇ’F†BvW7GW&S²fW'F–6Â67&öÆÆ–ær7F—2æF—fRà¢W6TVffV7B‚‚“Óç°¢6öç7B7W&f6W3Õ·vW2æ7W'&VçBÇF÷F'57W&f6Ræ7W'&VçEÒæf–ÇFW"‚†æöFR“¦æöFR—2…DÔÄF—dVÆVÖVçCÓâæöFR“°¢6öç7B–çWCÒ‡F÷V6ƒ¥F÷V6‚ÆWfVçC¥F÷V6„WfVçBÆVÃ¤…DÔÄVÆVÖVçB“¤'&÷w6T–çWCÓâ‡°¢ö–çFW$–C§F÷V6‚æ–FVçF–f–W"Æ6Æ–VçEƒ§F÷V6‚æ6Æ–VçE‚Æ6Æ–VçE“§F÷V6‚æ6Æ–VçE’À¢F&vWC¦WfVçBçF&vWBÆ7W'&VçEF&vWC¦VÂÆ6æ6VÆ&ÆS¦WfVçBæ6æ6VÆ&ÆRÀ¢&WfVçDFVfVÇC¢‚“ÓæWfVçBç&WfVçDFVfVÇB‚’Æ—5&–Ö'“§G'VRÇö–çFW%G—S¢'F÷V6‚ ¢Ò“°¢6öç7B6ÆVçW3×7W&f6W2æÖ†VÃÓç°¢6öç7B7F'CÒ†WfVçC¥F÷V6„WfVçB“Óç°¢–b†WfVçBçF÷V6†W2æÆVæwF‚ÓÓ—¶6æ6VÅ7v—R‚“·&WGW&ã·Ğ¢F÷vâ†–çWB†WfVçBæ6†ævVEF÷V6†W5³ÒÆWfVçBÆVÂ’Â'F÷V6‚"“°¢Ó°¢6öç7BG&6³Ò†WfVçC¥F÷V6„WfVçB“Óç°¢–b†WfVçBçF÷V6†W2æÆVæwF‚ÓÓ—¶6æ6VÅ7v—R‚“·&WGW&ã·Ğ¢Ö÷fR†–çWB†WfVçBçF÷V6†W5³ÒÆWfVçBÆVÂ’Â'F÷V6‚"“°¢Ó°¢6öç7BVæCÒ†WfVçC¥F÷V6„WfVçB“Óç°¢f÷"†6öç7BF÷V6‚öb'&’æg&öÒ†WfVçBæ6†ævVEF÷V6†W2’—W†–çWB‡F÷V6‚ÆWfVçBÆVÂ’ÆfÇ6RÂ'F÷V6‚"“°¢Ó°¢6öç7B6æ6VÃÒ†WfVçC¥F÷V6„WfVçB“Óç°¢f÷"†6öç7BF÷V6‚öb'&’æg&öÒ†WfVçBæ6†ævVEF÷V6†W2’—W†–çWB‡F÷V6‚ÆWfVçBÆVÂ’ÇG'VRÂ'F÷V6‚"“°¢Ó°¢VÂæFDWfVçDÆ—7FVæW"‚'F÷V6‡7F'B"Ç7F'BÇ·76—fS§G'VWÒ“°¢VÂæFDWfVçDÆ—7FVæW"‚'F÷V6†Ö÷fR"ÇG&6²Ç·76—fS¦fÇ6WÒ“°¢VÂæFDWfVçDÆ—7FVæW"‚'F÷V6†VæB"ÆVæBÇ·76—fS§G'VWÒ“°¢VÂæFDWfVçDÆ—7FVæW"‚'F÷V6†6æ6VÂ"Æ6æ6VÂÇ·76—fS§G'VWÒ“°¢&WGW&â‚“Óç¶VÂç&VÖ÷fTWfVçDÆ—7FVæW"‚'F÷V6‡7F'B"Ç7F'B“¶VÂç&VÖ÷fTWfVçDÆ—7FVæW"‚'F÷V6†Ö÷fR"ÇG&6²“°¢VÂç&VÖ÷fTWfVçDÆ—7FVæW"‚'F÷V6†VæB"ÆVæB“¶VÂç&VÖ÷fTWfVçDÆ—7FVæW"‚'F÷V6†6æ6VÂ"Æ6æ6VÂ“·Ó°¢Ò“°¢&WGW&â‚“Óæ6ÆVçW2æf÷$V6‚†6ÆVçWÓæ6ÆVçW‚’“°¢Ò“°¢7W7VæD'&÷w6Ræ7W'&VçCÒ‚“Óç°¢6æ6VÅ7v—R‚“°¢6öç7BVæF–æsÖ'&÷w6U6WGFÆRæ7W'&VçC°¢–b‚VæF–ær—&WGW&ã°¢'&÷w6TÖ÷F–öâæ7W'&VçBæ6æ6VÂ‡VæF–ærçFö¶VâÂ&W‡FW&æÂ"“¶'&÷w6U6WGFÆRæ7W'&VçCÖçVÆÃ°¢–b‡vW%6WGFÆUF–ÖW"æ7W'&VçBÓÖçVÆÂ–6ÆV%F–ÖV÷WB‡vW%6WGFÆUF–ÖW"æ7W'&VçB“°¢vW%6WGFÆUF–ÖW"æ7W'&VçCÖçVÆÃ°¢vUG&6²æ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2Öf–ævW"×G&6¶–ær"Â&—2×6WGFÆ–ær"“°¢VæFW&Æ–æRæ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2Öf–ævW"×G&6¶–ær"Â&—2×6WGFÆ–ær"“°¢vUG&6²æ7W'&VçCòæ6Æ74Æ—7BæFB‚&—2Öf–ævW"×G&6¶–ær"“°¢VæFW&Æ–æRæ7W'&VçCòæ6Æ74Æ—7BæFB‚&—2Öf–ævW"×G&6¶–ær"“°¢Ö÷F–öäWF†÷&—G’æ7W'&VçBç'Vâ‚&'&÷w6R"Å$ôd”ÄUôÔõD”ôåõu$•DU%õD$ÄRæ'&÷w6RÂ‚“Óç°¢vUG&6²æ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×F"Ööfg6WB"Â‚Ö–æFW‚£’²"R"“°¢vUG&6²æ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’ÖG&r"Â#‚"“°¢VæFW&Æ–æRæ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×F"Ööfg6WB"Â†–æFW‚£’²"R"“°¢VæFW&Æ–æRæ7W'&VçCòç7G–ÆRç6WE&÷W'G’‚"ÒÖÇVVÖ’×VæFW&Æ–æRÖG&r"Â#‚"“°¢Ò“°¢fö–BvUG&6²æ7W'&VçCòæöfg6WEv–GFƒ°¢vUG&6²æ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2Öf–ævW"×G&6¶–ær"“°¢VæFW&Æ–æRæ7W'&VçCòæ6Æ74Æ—7Bç&VÖ÷fR‚&—2Öf–ævW"×G&6¶–ær"“°¢'&÷w6U÷6—F–öâæ7W'&VçCÖ–æFWƒ°¢Ó°¢W6TVffV7B‚‚“Óç°¢6öç7B7F÷Ò‚“Óç7W7VæD'&÷w6Ræ7W'&VçB‚“°¢6öç7B†–FFVãÒ‚“Óç¶–b†Fö7VÖVçBæ†–FFVâ—7F÷‚“·Ó°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&&ÇW""Ç7F÷“¶Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'f—6–&–Æ—G–6†ævR"Æ†–FFVâ“°¢&WGW&â‚“Óç·v–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚&&ÇW""Ç7F÷“¶Fö7VÖVçBç&VÖ÷fTWfVçDÆ—7FVæW"‚'f—6–&–Æ—G–6†ævR"Æ†–FFVâ“·Ó°¢ÒÅµÒ“° ¢W6TVffV7B‚‚“Óç¶–b†Ö–åF"ÓÒ&F—66÷fW"'ÇÇW'6öçÇÆ66÷VçD÷Vâ—7W7VæD'&÷w6Ræ7W'&VçB‚“·ÒÅ¶Ö–åF"ÇW'6öâÆ66÷VçD÷VåÒ“°¢6öç7B&6µ&Vc×W6U&VcÂ‚“Óçfö–Câ‚‚“Óç·Ò“°¢&6µ&Vbæ7W'&VçCÒ‚“Óç°¢–b†6†EF‡&VD÷Vâ—¶6†D&6µ&Vbæ7W'&VçCòâ‚“·&WGW&ã·Ğ¢–b†f–ÇFW$÷Vâ—·6WDf–ÇFW$÷Vâ†fÇ6R“·&WGW&ã·Ğ¢–b‡W'6öâ—¶–b‡f—6—F÷$&6µ&Vbæ7W'&VçCòâ‚’—&WGW&ã·6WEW'6öâ†çVÆÂ“·&WGW&ã·Ğ¢–b†66÷VçD÷Vâ—·6WD66÷VçD÷Vâ†fÇ6R“·&WGW&ã·Ğ¢–b†Ö–åF#ÓÓÒ'&öf–ÆR"bg&öf–ÆT&6µ&Vbæ7W'&VçCòâ‚’—&WGW&ã°¢–b†Ö–åF"ÓÒ&F—66÷fW""—·6WDÖ–åF"‚&F—66÷fW""“·&WGW&ã·Ğ¢–b†'&÷w6RÓÒ&fVVB"—·&WVW7D'&÷w6UF"ƒ“·&WGW&ã·Ğ¢Ó°¢W6TVffV7B‚‚“Óç¶6öç7B¶W“Ò†S¤¶W–&ö&DWfVçB“Óç¶–b†Ræ¶W“ÓÓÒ$W66R"–&6µ&Vbæ7W'&VçB‚“·Ó°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&¶W–F÷vâ"Æ¶W’“·&WGW&â‚“Óçv–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚&¶W–F÷vâ"Æ¶W’“·ÒÅµÒ“°¢&WGW&âÇ6V7F–öâ6Æ74æÖSÒ&F—66÷fW'’Ö&VÂÖF—66÷fW'’Ö†öÖR ¢FF×&öf–ÆR×&VæFW&W#×¶æG&ö–EvV%f–Wsò&æG&ö–B#¢'7FæF&B'ÒFF×&öf–ÆRÖÖöFS×¶Ö–åF#ÓÓÒ'&öf–ÆR'ÇÂW'6öãò'G'VR#¢&fÇ6R'Ğ¢FFÖ6†B×F‡&VC×¶6†EF‡&VD÷Vãò'G'VR#¢&fÇ6R'Óà¢ÆF—b6Æ74æÖSÒ&F—66÷fW'’ÖÖ&–VçB"&–Ö†–FFVãÒ'G'VR"óà¢²6†EF‡&VD÷VâbcÄvÆö&Ä†VFW"&Vc×¶†VFW'ÒÖöFS×¶Ö–åF#ÓÓÒ'&öf–ÆR#ò'&öf–ÆR#¦Ö–åF#ÓÓÒ&6†G2#ò&6†G2#¢&'&÷w6R'ÒF†VÖS×·F†VÖWÒöåF†VÖS×¶öåF†VÖWĞ¢öäf–ÇFW'3×²‚“Óç6WDf–ÇFW$÷Vâ‡G'VR—Òöå6fVC×²‚“Óç·6WEW'6öâ†çVÆÂ“·6WDÖ–åF"‚&Æ–¶W2"“·×ÒóçĞ¢ÆF—b6Æ74æÖSÒ&F—66÷fW'’ÖÖ–â×æVÇ2#à¢Ç6V7F–öâ6Æ74æÖSÒ&F—66÷fW'’×æVÂF—66÷fW'’Ö'&÷w6R×æVÂ"†–FFVã×¶Ö–åF"ÓÒ&F—66÷fW"'Óà¢ÆF—b6Æ74æÖSÒ&F—66÷fW'’×F÷×F'2"&Vc×·F÷F'57W&f6WÒ&öÆSÒ'F&Æ—7B"&–ÖÆ&VÃÒ-
}M]½²}İ­íÍ-" ¢öä¶W”F÷vã×¶SÓç¶6öç7BæW‡CÖRæ¶W“ÓÓÒ$'&÷u&–v‡B#ôÖF‚æÖ–âƒ"Æ–æFW‚³“ ¢Ræ¶W“ÓÓÒ$'&÷tÆVgB#ôÖF‚æÖ‚ƒÆ–æFW‚Ó“¦Ræ¶W“ÓÓÒ$†öÖR#ó¦Ræ¶W“ÓÓÒ$VæB#ó#¢Ó°¢–b†æW‡CÃ—&WGW&ã¶Rç&WfVçDFVfVÇB‚“·&WVW7D'&÷w6UF"†æW‡B“·×Ğ¢öåö–çFW$F÷vã×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"–F÷vâ†R“·×Ğ¢öåö–çFW$Ö÷fS×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"–Ö÷fR†R“·×Ğ¢öåö–çFW%W×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"—W†R“·×Ğ¢öåö–çFW$6æ6VÃ×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"—W†RÇG'VR“·×Ğ¢öäÆ÷7Eö–çFW$6GW&S×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"—W†RÇG'VR“·×Óà¢·F'2æÖ‚…¶–BÆÆ&VÅÒÆ’“ÓãÆ'WGFöâ¶W“×¶–GÒG—SÒ&'WGFöâ"&öÆSÒ'F""6Æ74æÖS×¶'&÷w6SÓÓÖ–Cò&7F—fR#¢"'Ğ¢&–×6VÆV7FVC×¶'&÷w6SÓÓÖ–GÒF$–æFWƒ×¶'&÷w6SÓÓÖ–Có¢ÓĞ¢öä6Æ–6³×²‚“Óç¶–b‡W&f÷&Öæ6Rææ÷r‚“ãÖ6Æ–6´&Æö6µVçF–Âæ7W'&VçB—&WVW7D'&÷w6UF"†’“·×Óç¶Æ&VÇÓÂö'WGFöãâ—Ğ¢Ç7â6Æ74æÖSÒ&F—66÷fW'’×F"×VæFW&Æ–æR"&Vc×·VæFW&Æ–æWÒ&–Ö†–FFVãÒ'G'VR ¢7G–ÆS×·²"ÒÖÇVVÖ’×F"Ööfg6WB#¦–æFW‚£²"R'Ò2555&÷W'F–W7Òóà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&F—66÷fW'’×vW2"&Vc×·vW7Ğ¢öåö–çFW$F÷vã×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"–F÷vâ†R“·×Ğ¢öåö–çFW$Ö÷fS×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"–Ö÷fR†R“·×Ğ¢öåö–çFW%W×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"—W†R“·×Ğ¢öåö–çFW$6æ6VÃ×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"—W†RÇG'VR“·×Ğ¢öäÆ÷7Eö–çFW$6GW&S×¶SÓç¶–b†Rçö–çFW%G—RÓÒ'F÷V6‚"–6æ6VÅ7v—R‚“·×Ğ¢öä6Æ–6´6GW&S×¶SÓç¶–b‡W&f÷&Öæ6Rææ÷r‚“Æ6Æ–6´&Æö6µVçF–Âæ7W'&VçB—¶Rç&WfVçDFVfVÇB‚“¶Rç7F÷&÷vF–öâ‚“·××Óà¢ÆF—b6Æ74æÖSÒ&F—66÷fW'’×vR×G&6²"&Vc×·vUG&6·Ğ¢öåG&ç6—F–öäVæC×¶SÓç¶–b†RçF&vWCÓÓÖRæ7W'&VçEF&vWBbfRç&÷W'G”æÖSÓÓÒ'G&ç6f÷&Ò"–f–æ—6…vW%6WGFÆR‚“·×Ğ¢7G–ÆS×·²"ÒÖÇVVÖ’×F"Ööfg6WB#¢‚Ö–æFW‚£’²"R'Ò2555&÷W'F–W7Óà¢·F'2æÖ‚…¶–BÆÆ&VÅÒ“ÓãÇ6V7F–öâ¶W“×¶–GÒ6Æ74æÖSÒ&F—66÷fW'’×vR"&öÆSÒ'F'æVÂ"&–ÖÆ&VÃ×¶Æ&VÇĞ¢&–Ö†–FFVã×¶'&÷w6RÓÖ–GÒ–æW'C×¶'&÷w6RÓÖ–GÓà¢ÄÆ—fTFV6²7F—fS×¶Ö–åF#ÓÓÒ&F—66÷fW""bf'&÷w6SÓÓÖ–GÒF#×¶–GÒG&gC×¶G&gGĞ¢–æ—F–ÄfVVC×¶–æ—F–ÄfVVGÒ6fVC×·6fVD–G7Òöå6fS×¶öå6fWÒf–ÇFW'3×¶f–ÇFW'7Ğ¢öäVF—Df–ÇFW'3×²‚“Óç6WDf–ÇFW$÷Vâ‡G'VR—Ğ¢†–FFVä–G3×¶†–FFVä–G7Òöä†–FS×¶öä†–FWĞ¢öå67&öÆÅF÷×·F÷Óæöå67&öÆÅF÷†–BÇF÷—Ğ¢öäVF—DÆö6F–öã×²‚“Óç6WDÖ–åF"‚'&öf–ÆR"—Ğ¢öåW'6öã×·6WEW'6öçÒöäÖF6†VC×²‚“Óç6WDÖ–åF"‚&6†G2"—Òóà¢Â÷6V7F–öãâ—Ğ¢ÂöF—cà¢ÂöF—cà¢Â÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ&F—66÷fW'’×æVÂ"†–FFVã×¶Ö–åF"ÓÒ&Æ–¶W2'Óà¢Å&VÄÖF6†W27F—fS×¶Ö–åF#ÓÓÒ&Æ–¶W2'Òöä6†C×²‚“Óç6WDÖ–åF"‚&6†G2"—Òóà¢Â÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ&F—66÷fW'’×æVÂ&VÂÖF—66÷fW'’Ö6†B×æVÂ"†–FFVã×¶Ö–åF"ÓÒ&6†G2'Óà¢¶Ö–åF#ÓÓÒ&6†G2"bcÅ&VÄ6†G2öåF‡&VD6†ævS×·6WD6†EF‡&VD÷VçÒ&Vv—7FW%F‡&VD&6³×¶†æFÆW#Óç¶6†D&6µ&Vbæ7W'&VçCÖ†æFÆW#·×ÒóçĞ¢Â÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ&F—66÷fW'’×æVÂF—66÷fW'’×&öf–ÆR×æVÂ"†–FFVã×¶Ö–åF"ÓÒ'&öf–ÆR'Óà¢¶÷væW#óÅ&öf–ÆTÖ7FW"FF×¶÷væW'ÒÖöFSÒ&÷væW""öäVF—C×²‚“Óç6WD66÷VçD÷Vâ‡G'VR—Ğ¢&Vv—7FW$&6³×·&Vv—7FW%&öf–ÆT&6·Ğ¢öäÖ÷F–öå&öw&W73×²‡&öw&W72ÆG&vv–ær“Óæ†VFW"æ7W'&VçCòç6WE&öf–ÆU&öw&W72‡&öw&W72ÆG&vv–ær—Ğ¢7F—fS×¶Ö–åF#ÓÓÒ'&öf–ÆR"bbW'6öçÒóã£ÄÇVVÖ”V×G•7FFR–6öã×µW6W%&÷VæGÒF—FÆSÒ-	İ­]-=í-í--ò ¢FW67&—F–öãÒ-	}-]‚ı=½­mâÂ}-í²=-M]-Â-í’ıíM½Ââ#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖSÒ&F—66÷fW'’ÖvÆ72Ö'WGFöâ"öä6Æ–6³×²‚“Óç6WD66÷VçD÷Vâ‡G'VR—Óí	í-­½-Âİ-í­ƒÂö'WGFöãà¢ÂôÇVVÖ”V×G•7FFSçĞ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖSÒ'&VÂÖF—66÷fW'’×6WGF–æw2"&–ÖÆ&VÃÒ-	İ-í­‚­­=İ-"F—FÆSÒ-	İ-í­‚­­=İ- ¢öä6Æ–6³×²‚“Óç6WD66÷VçD÷Vâ‡G'VR—ÓãÅ6WGF–æw3"6—¦S×³#ÒóãÂö'WGFöãà¢Â÷6V7F–öãà¢ÂöF—cà¢·W'6öâbcÅf—6—F÷%&öf–ÆU&÷WFR¶W“×·W'6öâæ–GÒFF×·f—6—F÷%FôÖ7FW"‡W'6öâ—ÒF†VÖS×·F†VÖWÒöåF†VÖS×¶öåF†VÖWĞ¢öäW†—C×²‚“Óç6WEW'6öâ†çVÆÂ—Ò&Vv—7FW$&6³×·&Vv—7FW%f—6—F÷$&6·ÒóçĞ¢²6†EF‡&VD÷VâbcÄÇVVÖ”&÷GFöÔæf–vF–öâ6Æ74æÖSÒ&F—66÷fW'’Ö&÷GFöÒÖæb"—FV×3×¶æf–vF–öä—FV×7ÒfÇVS×¶Ö–åF'Ğ¢öä6†ævS×¶–CÓç·6WEW'6öâ†çVÆÂ“·6WD6†EF‡&VD÷Vâ†fÇ6R“·6WDÖ–åF"†–B“·×ÒóçĞ¢¶66÷VçD÷VâbcÆF—b6Æ74æÖSÒ&F—66÷fW'’ÖÖöFÂÖ&6¶G&÷&VÂÖF—66÷fW'’Ö66÷VçBÖÖöFÂ ¢öä6Æ–6³×²‚“Óç6WD66÷VçD÷Vâ†fÇ6R—Óà¢Ç6V7F–öâ6Æ74æÖSÒ'&VÂÖF—66÷fW'’Ö66÷VçB×6†VWB"&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÃÒ-	İ-í­‚ıíM½ò ¢öä6Æ–6³×¶SÓæRç7F÷&÷vF–öâ‚—Óà¢Æ'WGFöâ6Æ74æÖSÒ'&VÂÖF—66÷fW'’Ö66÷VçBÖ6Æ÷6R"G—SÒ&'WGFöâ"öä6Æ–6³×²‚“Óç6WD66÷VçD÷Vâ†fÇ6R—Óí	}­½-ÃÂö'WGFöãà¢ÆF—cç¶66÷VçEæVÇÓÂöF—cà¢Æ'WGFöâ6Æ74æÖSÒ&F—66÷fW'’ÖvÆ72Ö'WGFöâ"G—SÒ&'WGFöâ"öä6Æ–6³×²‚“Óç·6WD66÷VçD÷Vâ†fÇ6R“¶öäVF—B‚“·×Óí
]M­-í--Âİ­]-3Âö'WGFöãà¢Â÷6V7F–öãà¢ÂöF—cçĞ¢Å&VÄfVVDf–ÇFW'2÷Vã×¶f–ÇFW$÷VçÒf–ÇFW#×¶f–ÇFW'7Ò–çFW&W7D6÷VçC×¶G&gBæ–çFW&W7G2æÆVæwF‡Ğ¢öä6Æ÷6S×²‚“Óç6WDf–ÇFW$÷Vâ†fÇ6R—ÒöäÇ“×¶æW‡CÓç°¢6WDf–ÇFW'2†æW‡B“·6WDf–ÇFW$÷Vâ†fÇ6R“·6WEW'6öâ†çVÆÂ“·6WDÖ–åF"‚&F—66÷fW""“·&WVW7D'&÷w6UF"ƒ“°¢×Òóà¢Â÷6V7F–öãã°§Ğ 