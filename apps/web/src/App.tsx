import { useCallback, useEffect, useRef, useState } from "react";
import type { BootstrapResponse, HealthResponse } from "@luemi/contracts";
import { newDraft, steps, validateStep, type RegistrationDraft } from "./registration/model";
import { RegistrationStep, type PhotoItem } from "./registration/Steps";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        version?: string;
        isVersionAtLeast?: (version: string) => boolean;
        requestFullscreen?: () => void;
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
type ThemeChoice = "system" | "light" | "dark";
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
  const [brandReady,setBrandReady] = useState(false);
  const [introElapsed,setIntroElapsed] = useState(false);
  const [welcomeExiting,setWelcomeExiting] = useState(false);
  const transitionTimer = useRef<number | null>(null);
  const [phase,setPhase] = useState<"welcome"|"form">("welcome");
  const [step,setStep] = useState(1);
  const [draft,setDraft] = useState<RegistrationDraft>(()=>newDraft());
  const [photos,setPhotos] = useState<PhotoItem[]>([]);
  const ownedUrls = useRef<string[]>([]);
  const [error,setError] = useState("");
  const [theme,setTheme] = useState<ThemeChoice>("system");
  const activeTheme=theme==="system"?(window.Telegram?.WebApp?.colorScheme??"light"):theme;
  const patch = useCallback((change:Partial<RegistrationDraft>)=>{
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
      } catch {
        // Unsupported clients retain Telegram's expanded, non-fullscreen UI.
      }
    });
    const timer=window.setTimeout(()=>setIntroElapsed(true),1800);
    return ()=>{
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      if(transitionTimer.current!==null)window.clearTimeout(transitionTimer.current);
    };
  },[]);
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
        ]).then(() => {if(!disposed) setBrandReady(true);});
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
  // Preview photos are local-only. Remove temporary browser URLs on unmount.
  useEffect(()=>()=>{
    for(const url of ownedUrls.current)URL.revokeObjectURL(url);
    ownedUrls.current=[];
  },[]);
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
    if(phase==="form"&&auth==="authorized"){
      button.show();
      button.onClick(back);
      return ()=>{button.offClick(back);button.hide();};
    }
    button.hide();
  },[phase,auth,back]);
  const changeStep=(target:number)=>{
    setError("");
    setStep(Math.max(1,Math.min(8,target)));
    window.scrollTo({top:0,behavior:"instant"});
  };
  const next=()=>{
    const nextError=validateStep(draft,step,photos.length);
    if(nextError){setError(nextError);return;}
    if(step<8)changeStep(step+1);
  };
  const addPhotos=(files:FileList|null)=>{
    if(!files?.length)return;
    let problem="";
    setPhotos(prev=>{
      const items=[...prev];
      for(const file of Array.from(files)){
        if(items.length>=6){problem="Максимум 6 фотографий.";break;}
        if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>12*1024*1024){
          problem="Разрешены JPEG, PNG, WebP не более 12 МБ на файл.";continue;
        }
        const url=URL.createObjectURL(file);
        ownedUrls.current.push(url);
        items.push({id:crypto.randomUUID(),src:url,file});
      }
      return items;
    });
    if(problem)setError(problem);
    else setError("");
  };
  const removePhoto=(id:string)=>{
    setPhotos(prev=>{
      const item=prev.find(p=>p.id===id);
      if(item){URL.revokeObjectURL(item.src);ownedUrls.current=ownedUrls.current.filter(url=>url!==item.src);}
      return prev.filter(p=>p.id!==id);
    });
  };
  const movePhoto=(from:number,to:number)=>{
    setPhotos(prev=>{
      if(from<0||from>=prev.length||to<0||to>=prev.length)return prev;
      const next=[...prev];const [item]=next.splice(from,1);next.splice(to,0,item);return next;
    });
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
  const changeTheme=()=>setTheme(old=>old==="system"?"light":old==="light"?"dark":"system");
  const themeName=theme==="system"?"Система":theme==="light"?"Светлая":"Тёмная";
  return <main className="luemi-shell" data-theme={activeTheme} data-phase={phase} data-scene={auth==="authorized"&&phase==="form"?"form":"intro"}>
    <div className="milky-mist" aria-hidden="true"/>
    <div className="theme-dock"><button className="theme-switch" type="button" onClick={changeTheme} aria-label={"Тема: "+themeName+". Переключить"}>{themeName}</button></div>
    {(auth!=="authorized"||phase==="welcome")?<section className={"entry-state"+(welcomeExiting?" exiting":"")} aria-live="polite">
      <div className="intro-mark">
        {brandReady
          ? <img src={logoSrc} alt="luemi" className="intro-logo"/>
          : <span className="intro-placeholder" aria-hidden="true"/>}
      </div>
      <h1>Твоя история начинается здесь</h1>
      {auth==="connecting"&&<div className="loading-track animated" role="progressbar" aria-label="Подготовка ресурсов и проверка входа Telegram"><span/></div>}
      {auth==="connecting"&&<p>{brandReady?"Проверяем защищённый вход Telegram…":"Подготавливаем оформление LUEMI…"}</p>}
      {auth==="outside-telegram"&&<p>Открой LUEMI через <a href="https://t.me/LuemiAppBot">@LuemiAppBot</a> внутри Telegram.</p>}
      {auth==="needs-bot"&&<p>Тестовый сервер готов, но авторизация пока отключена.</p>}
      {auth==="error"&&<><p>Не удалось подтвердить вход. Попробуй снова через Telegram.</p><button className="primary-action" type="button" onClick={()=>window.location.reload()}>Повторить</button></>}
      {auth==="authorized"&&introElapsed&&<div className="intro-cta">
        <button className="primary-action" type="button" onClick={beginRegistration} disabled={welcomeExiting}>
          Начать <span aria-hidden="true">→</span>
        </button>
      </div>}
    </section>:<section className="onboarding-screen">
      <div className="onboard-brand" aria-label="LUEMI и прогресс регистрации">
        <img src={logoSrc} alt="luemi" className="onboard-logo"/>
        <div className="progress-track" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={8} aria-label="Прогресс регистрации"><span style={{width:step/8*100+"%"}}/></div>
      </div>
      <header className="onboard-head">
        <h1>{steps[step-1].title}</h1>
        <p>{steps[step-1].subtitle}</p>
      </header>
      <div key={step} className="onboard-body">
        <RegistrationStep data={draft} patch={patch} step={step} photos={photos}
          addPhotos={addPhotos} removePhoto={removePhoto} movePhoto={movePhoto} editStep={changeStep}/>
      </div>
      <div className="onboard-footer">
        {error&&<p className="field-error" role="alert">{error}</p>}
        <div className="footer-controls">
          <button className="nav-circle" type="button" onClick={back} aria-label="Назад"><span aria-hidden="true">←</span></button>
          <span className="footer-hint">{step===8?"Публикация пока закрыта":"Технический предпросмотр"}</span>
          <button className="nav-circle forward" type="button" onClick={next} disabled={step===8} aria-label="Далее"><span aria-hidden="true">→</span></button>
        </div>
      </div>
    </section>}
  </main>;
}
