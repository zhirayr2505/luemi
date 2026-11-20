import {Heart,Star} from "lucide-react";
import type {ProfileMatchState,RealLikeKind} from "../../registration/real-live-client";

export type ProfileReactionControls={
 state:ProfileMatchState|null;
 busy:boolean;
 error:string;
 send:(kind:RealLikeKind)=>void;
 openChat:()=>void;
 retry:()=>void;
};

export function canSendProfileReaction(state:ProfileMatchState|null):boolean{
 return !!state&&!state.outgoing&&!state.matchId;
}

export function ProfileReactionButtons({layout,controls}:{
 layout:"expanded"|"compact";controls:ProfileReactionControls;
}){
 const show=canSendProfileReaction(controls.state);
 return <div className={`profile-reaction-buttons profile-reaction-buttons--${layout}`}
  data-reaction-layout={layout}>
  {show&&<>
   <button className="profile-reaction-button" type="button" aria-label="Поставить лайк"
    disabled={controls.busy} onClick={()=>controls.send("ordinary")}><Heart size={22} aria-hidden="true"/></button>
   <button className="profile-reaction-button profile-reaction-button--super" type="button" aria-label="Отправить суперлайк"
    disabled={controls.busy} onClick={()=>controls.send("super")}><Star size={22} aria-hidden="true"/></button>
  </>}
 </div>;
}

export function ProfileReactionBadge({controls}:{controls:ProfileReactionControls}){
 const {state,error,busy,openChat,retry}=controls;
 const kind=state?.outgoing??state?.incoming;
 const mutual=!!state?.matchId;
 const special=kind==="super"&&!mutual;
 const label=mutual?"Взаимный лайк":state?.outgoing?
  special?"Суперлайк отправлен":"Симпатия отправлена":state?.incoming?
   special?"Вам отправили суперлайк":"Вам отправили симпатию":"";
 if(!label&&!error)return null;
 const tone=mutual?"mutual":special?"super":"like";
 return <div className={`profile-reaction-badge profile-reaction-badge--${tone}`}>
  {label&&<div className="profile-reaction-badge-row">
   <div className="profile-reaction-status" role="status" aria-live="polite">
    <span className="profile-reaction-label" key={label}>
     {mutual?<span className="profile-reaction-hearts" aria-hidden="true"><Heart size={21}/><Heart size={18}/></span>:
      special?<Star size={21} aria-hidden="true"/>:<Heart size={21} aria-hidden="true"/>}
     {label}
    </span>
   </div>
   {mutual&&<button type="button" onClick={openChat} disabled={busy}>Написать</button>}
  </div>}
  {error&&<div className="profile-reaction-badge-row">
   <span role="alert">{error}</span>
   {!state&&<button type="button" onClick={retry} disabled={busy}>Повторить</button>}
  </div>}
 </div>;
}
