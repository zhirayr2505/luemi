import React,{useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {RealChats} from "./RealChats.js";
import {createDemoChatTransport} from "./demo-transport.js";
import "../styles.css";

function Demo(){const demo=useMemo(()=>createDemoChatTransport(),[]);const [offline,setOffline]=useState(false);const [key,setKey]=useState(0);
 if(import.meta.env.PROD&&import.meta.env.VITE_LUEMI_CHATS_DEMO!=="1")return <main>Chats demo is disabled in production.</main>;
 return <main style={{height:"100dvh",padding:12,boxSizing:"border-box",background:"#eee6f3"}}><aside style={{display:"flex",gap:8,marginBottom:8}}><button onClick={()=>{const next=!offline;setOffline(next);demo.setOffline(next);setKey(v=>v+1);}}>{offline?"Вернуть сеть":"Отключить сеть"}</button><button onClick={()=>{demo.pushIncoming();setKey(v=>v+1);}}>Входящее</button><span>Только локальное демо</span></aside><div key={key} style={{height:"calc(100% - 40px)",maxWidth:520,margin:"auto"}}><RealChats transport={demo.transport}/></div></main>;
}
const root=document.getElementById("root");if(root)createRoot(root).render(<React.StrictMode><Demo/></React.StrictMode>);
