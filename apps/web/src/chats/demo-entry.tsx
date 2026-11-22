import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {RealChats} from "./RealChats.js";
import {createDemoChatTransport} from "./demo-transport.js";
import "../styles.css";
import "../ui/luemi-v5.css";

function Demo(){
 const demo=useMemo(()=>createDemoChatTransport(),[]);
 useEffect(()=>()=>demo.dispose(),[demo]);
 const [offline,setOffline]=useState(false);
 const [key,setKey]=useState(0);
 if(import.meta.env.PROD&&import.meta.env.VITE_LUEMI_CHATS_DEMO!=="1")
  return <main>Chats demo is disabled in production.</main>;
 return <main style={{height:"100dvh",display:"flex",flexDirection:"column",padding:12,background:"var(--luemi-bg-deep)",color:"var(--luemi-text)"}}>
  <aside style={{display:"flex",flex:"none",flexWrap:"wrap",gap:8,marginBottom:8}}>
   <button type="button" onClick={()=>{
    const next=!offline;
    setOffline(next);
    demo.setOffline(next);
    setKey(value=>value+1);
   }}>{offline?"Вернуть сеть":"Отключить сеть"}</button>
   <button type="button" onClick={()=>demo.pushIncoming()}>Входящее</button>
   <span>Только локальное демо</span>
  </aside>
  <div key={key} style={{flex:1,minHeight:0,width:"100%",maxWidth:520,margin:"0 auto"}}>
   <RealChats transport={demo.transport}/>
  </div>
 </main>;
}

const root=document.getElementById("root");
if(root)createRoot(root).render(<React.StrictMode><Demo/></React.StrictMode>);
