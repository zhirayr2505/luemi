import {useState} from "react";
/** Optional entry fallback for suspended adults. No cookies or saved initData. */
export function SafetyAppealPanel(){
 const [statement,setStatement]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 if(import.meta.env.VITE_LUEMI_SAFETY_APPEALS_UI!=="1"||
   import.meta.env.VITE_LUEMI_AUTH_V2!=="1")return null;
 const submit=async()=>{
  if(busy||statement.trim().length<20||statement.trim().length>750)return;
  const initData=window.Telegram?.WebApp?.initData;
  if(!initData){setMessage("Открой LUEMI через Telegram, чтобы подтвердить личность.");return;}
  setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/v3/safety/appeal",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({initData,statement:statement.trim()})
   });
   if(res.status===202){
    setMessage("Апелляция отправлена на рассмотрение. Доступ пока не восстановлен.");
    setStatement("");
   }else if(res.status===409){
    setMessage("Апелляция по этому ограничению уже отправлена.");
   }else if(res.status===404){
    setMessage("Активного ограничения с доступной апелляцией не найдено.");
   }else{
    setMessage("Апелляцию отправить не удалось. Попробуй позже.");
   }
  }catch{setMessage("Нет соединения с сервером. Попробуй позже.");}
  finally{setBusy(false);}
 };
 return <details className="luemi-safety-appeal" style={{
  maxWidth:420,width:"100%",margin:"14px auto",padding:"14px",
  borderRadius:18,background:"var(--glass-base,rgba(255,255,255,.42))"}}>
  <summary>Оспорить ограничение аккаунта</summary>
  <p style={{fontSize:13}}>Если вход закрыт из-за решения модератора, опиши ситуацию.
   Только одна апелляция на каждое решение. Восстановление доступа не гарантируется.</p>
  <textarea aria-label="Причина апелляции" value={statement} rows={4}
   maxLength={750} placeholder="Опиши ситуацию (20–750 символов)"
   onChange={e=>setStatement(e.target.value)}
   style={{width:"100%",borderRadius:12,padding:10,resize:"vertical"}}/>
  <button type="button" disabled={busy||statement.trim().length<20}
   onClick={()=>{void submit();}}>Отправить на рассмотрение</button>
  {message&&<p role="status" style={{fontSize:13}}>{message}</p>}
 </details>;
}
