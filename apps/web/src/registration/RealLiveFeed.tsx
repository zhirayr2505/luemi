import {useEffect,useRef,useState} from "react";
import {getPublishedFeed,blockPublishedUser,reportPublishedUser,likePublishedUser,realMatchPilot} from "./real-live-client";
import type {RealPublishedProfile} from "./real-live-client";
import {Flag} from "../ui/Flag";
import "./real-live-feed.css";

/** Beta-only real profiles. Never inserted into approved DEMO motion deck. */
export function RealLiveFeed({onClose,onMatched}:{onClose?:()=>void;onMatched?:()=>void}){
 const [profiles,setProfiles]=useState<RealPublishedProfile[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [reason,setReason]=useState<"spam"|"harassment"|"impersonation"|"unsafe_media">("spam");
 const [photo,setPhoto]=useState<Record<string,number>>({});
 const [status,setStatus]=useState("");
 const [reload,setReload]=useState(0);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [loadingMore,setLoadingMore]=useState(false);
 const pageAbort=useRef<AbortController|null>(null);
 useEffect(()=>{
  const signal=new AbortController();
  pageAbort.current?.abort();
  setLoading(true);setError("");setProfiles([]);setNextCursor(null);
  void getPublishedFeed(signal.signal).then(data=>{
   if(signal.signal.aborted)return;
   setProfiles(data.profiles);setNextCursor(data.nextCursor);setLoading(false);
  }).catch(()=>{
   if(signal.signal.aborted)return;
   setError("Не удалось получить подтверждённые анкеты.");setLoading(false);
  });
  return()=>{signal.abort();pageAbort.current?.abort();};
 },[reload]);
 const loadMore=async()=>{
  if(!nextCursor||loading||loadingMore||busy)return;
  const controller=new AbortController();
  pageAbort.current?.abort();
  pageAbort.current=controller;
  setLoadingMore(true);setStatus("");
  try{
   const page=await getPublishedFeed(controller.signal,nextCursor);
   if(controller.signal.aborted)return;
   setProfiles(existing=>{
    const ids=new Set(existing.map(p=>p.id));
    return [...existing,...page.profiles.filter(p=>!ids.has(p.id))];
   });
   setNextCursor(page.nextCursor);
  }catch{
   if(!controller.signal.aborted)setStatus("Следующие анкеты не загрузились. Попробуй ещё раз.");
  }finally{
   if(pageAbort.current===controller){pageAbort.current=null;setLoadingMore(false);}
  }
 };
 const like=async(p:RealPublishedProfile)=>{
  if(busy)return;
  setBusy(p.id);setStatus("");
  try{
   const receipt=await likePublishedUser(p.id);
   setProfiles(current=>current.filter(x=>x.id!==p.id));
   if(receipt.matched){
    setStatus("Взаимная симпатия! Теперь можно переписываться.");
    onMatched?.();
   }else setStatus("Симпатия отправлена 💜");
  }catch{setStatus("Не удалось отправить симпатию. Попробуйте снова.");}
  finally{setBusy(null);}
 };
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
     <div><strong>Знакомства</strong><p>Только настоящие опубликованные анкеты</p></div>
     {onClose&&<button type="button" onClick={onClose} aria-label="Закрыть ленту">Закрыть</button>}
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
        {realMatchPilot.enabled&&<button type="button" disabled={busy!==null} onClick={()=>{void like(p);}}>💜 Нравится</button>}
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
       {!realMatchPilot.enabled&&<p className="luemi-real-feed-footnote">Симпатии и чаты появятся после отдельной проверки сервера.</p>}
      </div>
     </article>;
    })}
   </div>
   {!loading&&!error&&nextCursor&&<button type="button" className="luemi-real-feed-refresh"
    disabled={loadingMore||busy!==null} onClick={()=>{void loadMore();}}>
    {loadingMore?"Загружаем ещё…":"Показать ещё анкеты"}
   </button>}
 </section>;
}
