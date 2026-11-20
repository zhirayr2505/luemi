import {useEffect,useRef,useState} from "react";
import {getProfileMatchState,openNewMatch,type ProfileMatchState,type RealLikeKind} from "../registration/real-live-client";
import {canSendProfileReaction,type ProfileReactionControls} from "./owner-profile/ProfileReactions";
import type {ProfileReactionAction} from "./use-profile-reaction-queue";

export function useProfileReactions(profileId:string|null,action:ProfileReactionAction|undefined,
 enqueue:((kind:RealLikeKind)=>void)|undefined,onConversation:((matchId:string,conversationId:string)=>void)|undefined):ProfileReactionControls|undefined{
 const [observed,setObserved]=useState<ProfileMatchState|null>(null);
 const [chatBusy,setChatBusy]=useState(false);
 const [localError,setLocalError]=useState("");
 const [attempt,setAttempt]=useState(0);
 const [initialAction]=useState(action);
 const openingChat=useRef(false);
 const active=useRef(false);
 useEffect(()=>{
  if(!profileId)return;
  const controller=new AbortController();
  active.current=true;
  void getProfileMatchState(profileId,controller.signal).then(result=>{
   if(!controller.signal.aborted)setObserved(result);
  }).catch(()=>{
   if(!controller.signal.aborted)setLocalError("Не удалось загрузить симпатии.");
  });
  return ()=>{active.current=false;controller.abort();};
 },[profileId,attempt]);
 if(!profileId)return undefined;
 // Apply a receipt that arrived while this profile was open. On a fresh visit
 // the GET is authoritative, including when a match has since changed.
 const receipt=action?.phase==="sent"&&action!==initialAction?action.receipt:null;
 const state=observed&&receipt&&!observed.outgoing&&!observed.matchId?{...observed,outgoing:receipt.kind,matchId:receipt.matchId}:observed;
 const pendingKind=action?.phase==="pending"||action?.phase==="sending"?action.kind:null;
 const error=localError||(action?.phase==="failed"?action.error:"");
 return {state,pendingKind,busy:chatBusy||action?.phase==="sending",error,
  retry:()=>{setLocalError("");setAttempt(value=>value+1);},
  send:kind=>{
   if(pendingKind||!canSendProfileReaction(state))return;
   setLocalError("");enqueue?.(kind);
  },openChat:()=>{
   const matchId=state?.matchId;
   if(!matchId||!onConversation||openingChat.current)return;
   openingChat.current=true;
   setChatBusy(true);setLocalError("");
   void openNewMatch(matchId).then(conversationId=>{
    if(active.current)onConversation(matchId,conversationId);
   }).catch(()=>{
    if(active.current)setLocalError("Не удалось открыть переписку. Попробуйте снова.");
   }).finally(()=>{
    openingChat.current=false;
    if(active.current)setChatBusy(false);
   });
  }};
}
