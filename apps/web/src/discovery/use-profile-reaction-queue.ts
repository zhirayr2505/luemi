import {useEffect,useRef,useState} from "react";
import {likePublishedUser,rejectIncomingLike,type RealLikeKind} from "../registration/real-live-client";
import type {LikesAction} from "./likes-gallery-gesture";

export const PROFILE_REACTION_UNDO_MS=5000;
type Target={id:string;name:string;demo?:true};
export const isProfileLike=(kind:LikesAction|undefined):kind is RealLikeKind=>kind==="ordinary"||kind==="super";
type QueuedReaction={target:Target;kind:LikesAction;deadline:number};
export type PendingProfileReaction=QueuedReaction&{phase:"pending";timer:number};
export type ProfileReactionAction=PendingProfileReaction|QueuedReaction&(
 {phase:"sending"}|{phase:"sent";receipt:{kind:LikesAction;matchId:string|null}}|{phase:"failed";error:string}
);

export function profileReactionKey(target:Pick<Target,"id"|"demo">){
 return (target.demo?"demo:":"live:")+target.id;
}

export function useProfileReactionQueue(onSent:(profileId:string)=>void){
 const entries=useRef(new Map<string,ProfileReactionAction>());
 const [actions,setActions]=useState<ReadonlyMap<string,ProfileReactionAction>>(entries.current);
 const refresh=()=>setActions(new Map(entries.current));

 useEffect(()=>{
  const current=entries.current;
  return ()=>{
   for(const action of current.values())if(action.phase==="pending")window.clearTimeout(action.timer);
   current.clear();
  };
 },[]);

 const send=async(key:string,pending:PendingProfileReaction)=>{
  if(entries.current.get(key)!==pending)return;
  const {target,kind,deadline}=pending;
  const sending:ProfileReactionAction={target,kind,deadline,phase:"sending"};
  entries.current.set(key,sending);
  refresh();
  try{
   let receipt={kind,matchId:null as string|null};
   if(!target.demo){
    if(kind==="skip")await rejectIncomingLike(target.id);
    else {
     const sent=await likePublishedUser(target.id,kind);
     receipt={kind:sent.kind,matchId:sent.matched?sent.matchId??null:null};
    }
   }
   if(entries.current.get(key)!==sending)return;
   entries.current.set(key,{...sending,phase:"sent",receipt});
   if(!target.demo&&kind!=="skip")onSent(target.id);
  }catch(cause){
   if(entries.current.get(key)!==sending)return;
   const reason=cause instanceof Error?cause.message:"";
   const error=kind==="skip"?"Не удалось пропустить анкету. Попробуйте снова.":reason==="superlikes_empty"?"Суперлайки закончились.":reason==="daily_like_limit"?
    "Дневной лимит симпатий закончился.":"Не удалось отправить симпатию. Попробуйте снова.";
   entries.current.set(key,{...sending,phase:"failed",error});
  }
  refresh();
 };
 const enqueue=(target:Target,kind:LikesAction)=>{
  const key=profileReactionKey(target),existing=entries.current.get(key);
  if(existing&&existing.phase!=="failed")return;
  const deadline=Date.now()+PROFILE_REACTION_UNDO_MS;
  const timer=window.setTimeout(()=>{void send(key,pending);},PROFILE_REACTION_UNDO_MS);
  const pending:PendingProfileReaction={target,kind,deadline,phase:"pending",timer};
  entries.current.set(key,pending);
  refresh();
 };
 const undo=(key:string)=>{
  const action=entries.current.get(key);
  if(action?.phase!=="pending"||Date.now()>=action.deadline)return;
  window.clearTimeout(action.timer);
  entries.current.delete(key);
  refresh();
 };
 const notices=[...actions.values()].filter((action):action is PendingProfileReaction=>action.phase==="pending");
 return {actions,enqueue,undo,notices};
}
