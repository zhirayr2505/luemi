import {useEffect,useState} from "react";
import {getPublishedFeed,blockPublishedUser,reportPublishedUser} from "./real-live-client";
import type {RealPublishedProfile} from "./real-live-client";
import {Flag} from "../ui/Flag";
import "./real-live-feed.css";

/** Beta-only real profiles. Never inserted into approved DEMO motion deck. */
export function RealLiveFeed({onClose}:{onClose:()=>void}){
 const [profiles,setProfiles]=useState<RealPublishedProfile[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [reason,setReason]=useState<"spam"|"harassment"|"impersonation"|"unsafe_media">("spam");
 const [photo,setPhoto]=useState<Record<string,number>>({});
 const [status,setStatus]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const signal=new AbortController();
  setLoading(true);setError("");
  void getPublishedFeed(signal.signal).then(data=>{
   if(signal.signal.aborted)return;
   setProfiles(data);setLoading(false);
  }).catch(()=>{
   if(signal.signal.aborted)return;
   setError("Не удалось получить подтверждённые анкеты.");setLoading(false);
  });
  return()=>signal.abort();
 },[reload]);
 const block=async(p:RealPublishedProfile)=>{
  if(busy||!window.confirm("Заблокировать анкету "+p.name+"? Вы больше не увидите друг друга."))return;
  setBusy(p.id);setStatus("");
  try{
   await blockPublishedUser(p.id);
   setProfiles(current=>current.filter(x=>x.id!==p.id));
   setStatus("Анкета заблокирована.");
  }catch{setStatus("Не удалось заблокировать анкету. Попробуйте снова.");}
  finally{setBusy(null);}
 };
 const report=async(p:RealPublishedProfile)=>{
  if(busy||!window.confirm("Отправить жалобу на анкету "+p.name+"?"))return;
  setBusy(p.id);setStatus("");
  try{await reportPublishedUser(p.id,reason);setStatus("Жалоба отправлена на рассмотрение.");}
  catch{setStatus("Не удалось отправить жалобу.");}
  finally{setBusy(null);}
 };
 return <section className="luemi-real-feed" aria-label="Лента проверенных пользователей">
   <header className="luemi-real-feed-head">
     <div><strong>Лента</strong><p>Только опубликованные анкеты · тестовый режим</p></div>
     <button type="button" onClick={onClose} aria-label="Закрыть настоящую ленту">Закрыть</button>
   </header>
   {loading&&<p role="status">Загрузка анкет…</p>}
   {error&&<p role="alert">{error}</p>}
   {!loading&&<button className="luemi-real-feed-refresh" type="button"
     onClick={()=>setReload(n=>n+1)}>Обновить ленту</button>}
   {!loading&&!error&&!profiles.length&&
    <p className="luemi-real-feed-empty">Сейчас нет доступных проверенных анкет. Здесь никогда не показываются вымышленные пользователи.</p>}
   {status&&<p role="status">{status}</p>}
   <div className="luemi-real-feed-cards">
    {profiles.map(p=>{
     const active=Math.min(photo[p.id]??0,p.photos.length-1);
     return <article key={p.id} className="luemi-real-feed-card">
      <div className="luemi-real-feed-picture">
       <img src={p.photos[active]?.url} alt={"Фотография анкеты "+p.name}
        loading="lazy" decoding="async" referrerPolicy="no-referrer"/>
       {p.photos.length>1&&<div className="luemi-real-feed-photo-controls">
        <button type="button" aria-label="Предыдущая фотография"
         onClick={()=>setPhoto(state=>({...state,[p.id]:Math.max(0,active-1)}))}>‹</button>
        <span>{active+1} / {p.photos.length}</span>
        <button type="button" aria-label="Следующая фотография"
         onClick={()=>setPhoto(state=>({...state,[p.id]:Math.min(p.photos.length-1,active+1)}))}>›</button>
       </div>}
      </div>
      <div className="luemi-real-feed-content">
       <h3>{p.name}, {p.age}</h3>
       <p><Flag code={p.countryCode} size={17}/>{" "}{p.city}</p>
       <p>{p.about}</p>
       <div className="luemi-real-feed-chips">{p.interests.slice(0,4).map(x=><span key={x}>{x}</span>)}</div>
       <div className="luemi-real-feed-actions">
        <button type="button" disabled={busy!==null} onClick={()=>{void block(p);}}>Заблокировать</button>
        <label>Причина жалобы
         <select value={reason} onChange={e=>setReason(e.target.value as typeof reason)}>
          <option value="spam">Спам</option><option value="harassment">Преследование</option>
          <option value="impersonation">Чужая личность</option>
          <option value="unsafe_media">Неприемлемое фото</option>
         </select>
        </label>
        <button type="button" disabled={busy!==null} onClick={()=>{void report(p);}}>Пожаловаться</button>
       </div>
       <p className="luemi-real-feed-footnote">Симпатии и чаты появятся после отдельной проверки сервера.</p>
      </div>
     </article>;
    })}
   </div>
 </section>;
}
