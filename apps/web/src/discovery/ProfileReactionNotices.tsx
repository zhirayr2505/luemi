import {useEffect,useState,type CSSProperties} from "react";
import {profileReactionAsset} from "./owner-profile/ProfileReactions";
import {PROFILE_REACTION_UNDO_MS,profileReactionKey,type PendingProfileReaction} from "./use-profile-reaction-queue";

function ReactionNotice({notice,onUndo}:{notice:PendingProfileReaction;onUndo:()=>void}){
 const {target,kind,deadline}=notice;
 const [elapsed]=useState(()=>PROFILE_REACTION_UNDO_MS-Math.max(0,deadline-Date.now()));
 const [remaining,setRemaining]=useState(()=>PROFILE_REACTION_UNDO_MS-elapsed);
 useEffect(()=>{
  const tick=()=>{
   const left=Math.max(0,deadline-Date.now());
   setRemaining(left);
   if(left>0)timer=window.setTimeout(tick,left%1000||1000);
  };
  let timer=window.setTimeout(tick,Math.max(0,deadline-Date.now())%1000||1000);
  return ()=>window.clearTimeout(timer);
 },[deadline]);
 const superlike=kind==="super";
 const message=target.demo?(superlike?"Тестовый суперлайк":"Тестовая симпатия"):
  superlike?"Вы отправили суперлайк":"Вы отправили симпатию";
 const seconds=Math.ceil(remaining/1000);
 return <div className="profile-reaction-notice">
  <img className="profile-reaction-notice-glyph" src={profileReactionAsset(superlike?"superlike-outgoing":"like-outgoing")} alt="" width="28" height="28"/>
  <div className="profile-reaction-notice-copy" role="status">
   <span>{message}</span>
   <span className="profile-reaction-notice-name">{target.name}</span>
  </div>
  <button type="button" className="profile-reaction-undo" onClick={onUndo} disabled={seconds===0}>Отменить</button>
  <span className="profile-reaction-countdown" aria-hidden="true">
   <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
    <circle className="profile-reaction-ring-track" cx="14" cy="14" r="12" strokeWidth="2"/>
    <circle className="profile-reaction-ring-fill" cx="14" cy="14" r="12" strokeWidth="2" pathLength="1"
     style={{"--reaction-duration":PROFILE_REACTION_UNDO_MS+"ms","--reaction-elapsed":-elapsed+"ms"} as CSSProperties}/>
   </svg>
   <span>{seconds}</span>
  </span>
 </div>;
}

export function ProfileReactionNotices({notices,undo,overProfile=false}:{
 notices:readonly PendingProfileReaction[];undo:(key:string)=>void;overProfile?:boolean;
}){
 if(!notices.length)return null;
 return <div className="profile-reaction-notices" data-over-profile={overProfile||undefined}>
  {notices.map(notice=>{
   const key=profileReactionKey(notice.target);
   return <ReactionNotice key={key+":"+notice.deadline} notice={notice} onUndo={()=>undo(key)}/>;
  })}
 </div>;
}
