import {useEffect,useRef,useState} from "react";
import {Camera,CameraOff,RotateCcw,ShieldAlert} from "lucide-react";
import {CameraPreviewController} from "./camera-preview-controller";

/**
 * Live preview ONLY. A user tapping through the on-screen prompts never
 * provides liveness evidence. No canvas capture, recording, embeddings,
 * uploads or verification status changes happen here.
 */
export function FaceTrustCamera(){
 const videoRef=useRef<HTMLVideoElement|null>(null);
 const controller=useRef<CameraPreviewController<MediaStream>|null>(null);
 const busy=useRef(false);
 const [state,setState]=useState<"idle"|"requesting"|"preview"|"error">("idle");
 const [reason,setReason]=useState("");
 const [index,setIndex]=useState(0);
 const challenges=["Посмотри прямо в камеру","Медленно поверни голову налево",
  "Теперь направо","Посмотри немного вверх"];
 const detach=()=>{
  const video=videoRef.current;
  if(video){try{video.pause();}catch{/* Safari/WebView may be tearing down. */}video.srcObject=null;}
 };
 const stop=()=>{
  controller.current?.close();
  detach();busy.current=false;setState("idle");setIndex(0);setReason("");
 };
 useEffect(()=>{
  const active=new CameraPreviewController<MediaStream>();
  controller.current=active;
  const onHidden=()=>{
   // Telegram backgrounding must immediately release the camera and clear
   // any pending consent/permission request, including while still loading.
   if(document.visibilityState==="hidden"){
    active.close();
    detach();
    busy.current=false;
    setState("idle");setIndex(0);setReason("");
   }
  };
  document.addEventListener("visibilitychange",onHidden);
  return()=>{
   document.removeEventListener("visibilitychange",onHidden);
   active.dispose();
   if(controller.current===active)controller.current=null;
   detach();busy.current=false;
  };
 },[]);
 const begin=async()=>{
  if(busy.current||state==="preview")return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||
     document.visibilityState==="hidden"){
   setReason("Камера недоступна. Открой LUEMI через Telegram и разреши доступ к селфи-камере.");
   setState("error");return;
  }
  const active=controller.current;
  if(!active)return;
  busy.current=true;setReason("");setState("requesting");setIndex(0);
  try{
   const result=await active.open(
    ()=>navigator.mediaDevices.getUserMedia({
     audio:false,video:{facingMode:"user",width:{ideal:640},
      height:{ideal:480},frameRate:{ideal:15,max:24}}
    }),
    async(stream)=>{
     const video=videoRef.current;
     if(!video)throw new Error("camera_element_unmounted");
     video.srcObject=stream;
     await video.play();
    }
   );
   // A backgrounded/unmounted camera does not gain a new preview state.
   if(result==="preview"&&controller.current===active&&
      document.visibilityState==="visible")setState("preview");
  }catch{
   if(controller.current===active&&document.visibilityState==="visible"){
    active.close();detach();
    setReason("Не удалось включить камеру. Проверь разрешения Telegram или попробуй снова.");
    setState("error");
   }
  }finally{if(controller.current===active)busy.current=false;}
 };
 return <div className="v2-face-camera" aria-label="Предпросмотр селфи-камеры без верификации">
   <div className="v2-camera v2-live-camera">
    <video ref={videoRef} muted playsInline autoPlay
     aria-label="Предпросмотр фронтальной камеры без записи"/>
    {state!=="preview"&&<div className="v2-face-outline"><Camera size={63} strokeWidth={1.1}/></div>}
    <span className="v2-camera-caption">Только предпросмотр. Ни фото, ни видео не сохраняются и не отправляются.</span>
   </div>
   {state==="preview"?<>
    <p className="v2-camera-prompt" role="status">{challenges[index]}</p>
    <div className="v2-camera-indicators" aria-label="Движения для ознакомления с камерой">
      {challenges.map((_,i)=><span key={i} className={i<=index?"is-done":""}/>)}
    </div>
    <p className="v2-footnote">Это ознакомление с камерой: нажатие «Следующее движение» не подтверждает личность.</p>
    <button type="button" className="v2-secondary" onClick={()=>index<challenges.length-1?
      setIndex(v=>v+1):stop()}>
     {index===challenges.length-1?"Закрыть камеру":"Следующее движение"}
    </button>
    <button type="button" className="v2-camera-stop" onClick={stop}><CameraOff size={16}/> Отключить камеру</button>
   </>:<button type="button" className="v2-secondary" disabled={state==="requesting"} onClick={()=>{void begin();}}>
    {state==="error"?<RotateCcw size={17}/>:<Camera size={17}/>}
    {state==="requesting"?"Запрашиваем разрешение…":state==="error"?"Повторить попытку":"Проверить селфи-камеру"}
   </button>}
   {reason&&<p className="v2-feedback" role="alert">{reason}</p>}
   <div className="v2-note"><ShieldAlert size={18}/>
     Настоящая биометрическая проверка пока не подключена. Движения головы не оцениваются алгоритмом, поэтому анкета не получает отметку FaceTrust.
   </div>
 </div>;
}
