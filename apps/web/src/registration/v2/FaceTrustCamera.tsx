import {useEffect,useRef,useState} from "react";
import {Camera,CameraOff,RotateCcw,ShieldAlert} from "lucide-react";

/**
 * Camera permission and positioning rehearsal for LUEMI FaceTrust.
 * Does not process/record/upload a frame and NEVER produces liveness evidence.
 * The future server SDK must replace this component's rehearsal state.
 */
export function FaceTrustCamera(){
 const videoRef=useRef<HTMLVideoElement|null>(null);
 const streamRef=useRef<MediaStream|null>(null);
 const [state,setState]=useState<"idle"|"requesting"|"preview"|"error">("idle");
 const [reason,setReason]=useState("");
 const [index,setIndex]=useState(0);
 const challenges=["Посмотри прямо в камеру","Медленно поверни голову налево",
  "Теперь направо","Посмотри немного вверх"];
 const cleanup=()=>{
  const stream=streamRef.current;streamRef.current=null;
  if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
  stream?.getTracks().forEach(track=>track.stop());
 };
 useEffect(()=>()=>cleanup(),[]);
 const begin=async()=>{
  if(state==="requesting")return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
   setReason("Камера недоступна в этом браузере. Открой LUEMI через Telegram на телефоне.");
   setState("error");return;
  }
  setReason("");setState("requesting");setIndex(0);
  try{
   const stream=await navigator.mediaDevices.getUserMedia({
    audio:false,video:{facingMode:"user",width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:24}}
   });
   streamRef.current=stream;
   const video=videoRef.current;
   if(!video){cleanup();setState("idle");return;}
   video.srcObject=stream;
   try{await video.play();}catch{
    cleanup();setReason("Не удалось показать изображение. Проверь доступ к камере.");setState("error");return;
   }
   setState("preview");
  }catch{
   cleanup();setReason("Доступ к селфи-камере отклонён или недоступен. Проверь разрешения Telegram.");
   setState("error");
  }
 };
 const stop=()=>{cleanup();setState("idle");setIndex(0);setReason("");};
 return <div className="v2-face-camera" aria-label="Предварительная проверка селфи-камеры">
   <div className="v2-camera v2-live-camera">
    <video ref={videoRef} muted playsInline autoPlay
     aria-label="Предпросмотр фронтальной камеры без записи"/>
    {state!=="preview"&&<div className="v2-face-outline"><Camera size={63} strokeWidth={1.1}/></div>}
    <span className="v2-camera-caption">Только предпросмотр. Ни фото, ни видео не сохраняются и не отправляются.</span>
   </div>
   {state==="preview"?<>
    <p className="v2-camera-prompt" role="status">{challenges[index]}</p>
    <div className="v2-camera-indicators" aria-label="Инструкции для тестирования камеры">
      {challenges.map((_,i)=><span key={i} className={i<=index?"is-done":""}/>)}
    </div>
    <p className="v2-footnote">Это ознакомление с камерой: нажимая «Следующее движение», ты не проходишь проверку личности.</p>
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
     Настоящая биометрическая проверка пока не подключена. Движения головы здесь не оцениваются алгоритмом, поэтому анкета не получает отметку FaceTrust.
   </div>
 </div>;
}
