import {useEffect,useState} from "react";
import {geoCsrf} from "../auth/session-adapter";
import {createChatTransport,sumUnreadMessages} from "../chats/chat-transport";
import {getIncomingLikeCount,realMatchPilot} from "../registration/real-live-client";

const NAVIGATION_POLL_MS=20000;

function useVisibleCount(load:(signal:AbortSignal)=>Promise<number>,enabled:boolean,revision:string){
 const [count,setCount]=useState(0);
 useEffect(()=>{
  if(!enabled)return;
  const controller=new AbortController();
  let inFlight=false;
  const refresh=async()=>{
   if(controller.signal.aborted||inFlight||document.visibilityState!=="visible")return;
   inFlight=true;
   try{
    const next=await load(controller.signal);
    if(!controller.signal.aborted)setCount(next);
   }catch{/* Keep the last confirmed count during a temporary connection error. */}
   finally{inFlight=false;}
  };
  void refresh();
  const timer=window.setInterval(refresh,NAVIGATION_POLL_MS);
  document.addEventListener("visibilitychange",refresh);
  return ()=>{
   controller.abort();
   window.clearInterval(timer);
   document.removeEventListener("visibilitychange",refresh);
  };
 },[load,enabled,revision]);
 return [count,setCount] as const;
}

async function unreadMessages(signal:AbortSignal){
 const csrf=geoCsrf();
 if(!csrf)return 0;
 const {conversations}=await createChatTransport(csrf).list(signal);
 return sumUnreadMessages(conversations);
}

export function useNavigationCounts(mainTab:string,likesRevision:number){
 const enabled=realMatchPilot.enabled&&!!geoCsrf();
 const [likes]=useVisibleCount(getIncomingLikeCount,enabled,`${mainTab}:${likesRevision}`);
 const [chats,setChats]=useVisibleCount(unreadMessages,enabled&&mainTab!=="chats","");
 return {likes:enabled?likes:0,chats:enabled?chats:0,setChats};
}
