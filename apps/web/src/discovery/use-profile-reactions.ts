import {useEffect,useRef,useState} from "react";
import {getProfileMatchState,likePublishedUser,openNewMatch,type ProfileMatchState,type RealLikeKind} from "../registration/real-live-client";
import {canSendProfileReaction,type ProfileReactionControls} from "./owner-profile/ProfileReactions";

export function useProfileReactions(profileId:string|null,onSent:(()=>void)|undefined,
 onConversation:((matchId:string,conversationId:string)=>void)|undefined):ProfileReactionControls|undefined{
 const [state,setState]=useState<ProfileMatchState|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [attempt,setAttempt]=useState(0);
 const pending=useRef(false);
 const active=useRef(false);
 useEffect(()=>{
  if(!profileId)return;
  const controller=new AbortController();
  active.current=true;
  setError("");
  void getProfileMatchState(profileId,controller.signal).then(result=>{
   if(!controller.signal.aborted)setState(result);
  }).catch(()=>{
   if(!controller.signal.aborted)setError("Не удалось загрузить симпатии.");
  });
  return ()=>{active.current=false;controller.abort();};
 },[profileId,attempt]);
 if(!profileId)return undefined;
 const run=async(action:()=>Promise<void>,failure:(reason:string)=>string)=>{
  if(pending.current)return;
  pending.current=true;
  setBusy(true);setError("");
  try{await action();}
  catch(cause){if(active.current)setError(failure(cause instanceof Error?cause.message:""));}
  finally{pending.current=false;if(active.current)setBusy(false);}
 };
 return {state,busy,error,retry:()=>setAttempt(value=>value+1),send:(kind:RealLikeKind)=>{
  if(!state||!canSendProfileReaction(state))return;
  void run(async()=>{
   const receipt=await likePublishedUser(profileId,kind);
   onSent?.();
   if(active.current)setState({...state,outgoing:receipt.kind,matchId:receipt.matched?receipt.matchId??null:null});
  },reason=>reason==="superlikes_empty"?"Суперлайки закончились.":reason==="daily_like_limit"?
   "Дневной лимит симпатий закончился.":"Не удалось отправить симпатию. Попробуйте снова.");
 },openChat:()=>{
  const matchId=state?.matchId;
  if(!matchId||!onConversation)return;
  void run(async()=>{
   const conversationId=await openNewMatch(matchId);
   if(active.current)onConversation(matchId,conversationId);
  },()=>"Не удалось открыть переписку. Попробуйте снова.");
 }};
}
