import {Heart,Star} from "lucide-react";
import type {ProfileMatchState,RealLikeKind} from "../../registration/real-live-client";

export type ProfileReactionControls={
 state:ProfileMatchState|null;
 busy:boolean;
 error:string;
 pendingKind?:RealLikeKind|null;
 send:(kind:RealLikeKind)=>void;
 demo?:true;
 openChat?:()=>void;
 retry?:()=>void;
};

export function canSendProfileReaction(state:ProfileMatchState|null):boolean{
 return !!state&&!state.outgoing&&!state.matchId;
}

const reactionGlyphs=["like-incoming","like-outgoing","superlike-incoming","superlike-outgoing","like-mutual"] as const;
type ReactionGlyph=typeof reactionGlyphs[number];

export function profileReactionAsset(glyph:ReactionGlyph){
 return "/assets/profile/reactions/"+glyph+".svg";
}

function reactionGlyph(state:ProfileMatchState|null,pendingKind?:RealLikeKind|null):ReactionGlyph|null{
 if(state?.matchId)return "like-mutual";
 const outgoing=pendingKind??state?.outgoing;
 if(outgoing)return outgoing==="super"?"superlike-outgoing":"like-outgoing";
 if(state?.incoming)return state.incoming==="super"?"superlike-incoming":"like-incoming";
 return null;
}

export function ProfileReactionIndicator({controls}:{controls:ProfileReactionControls}){
 const glyph=reactionGlyph(controls.state,controls.pendingKind);
 return <span className="profile-reaction-indicator" data-visible={glyph?true:undefined} aria-hidden="true">
  {reactionGlyphs.map(icon=><img key={icon} src={profileReactionAsset(icon)} alt="" width="26" height="26"
   data-active={glyph===icon?true:undefined} draggable={false}/>)}
 </span>;
}

export function ProfileReactionButtons({layout,controls}:{
 layout:"expanded"|"compact";controls:ProfileReactionControls;
}){
 const show=!controls.pendingKind&&canSendProfileReaction(controls.state);
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
 const label=controls.demo&&state?.outgoing?
  special?"Тестовый суперлайк поставлен":"Тестовый лайк поставлен":
  mutual?"Взаимный лайк":state?.outgoing?
  special?"Суперлайк отправлен":"Симпатия отправлена":state?.incoming?
   special?"Вам отправили суперлайк":"Вам отправили симпатию":"";
 if(!label&&!error)return null;
 const glyph=reactionGlyph(state);
 const tone=mutual?"mutual":special?"super":"like";
 return <div className={`profile-reaction-badge profile-reaction-badge--${tone}`}>
  {label&&<div className="profile-reaction-badge-row">
   <div className="profile-reaction-status" role="status" aria-live="polite">
    <span className="profile-reaction-label" key={label}>
     {glyph&&<img src={profileReactionAsset(glyph)} alt="" width="25" height="25"/>}
     {label}
    </span>
   </div>
   {mutual&&openChat&&<button type="button" onClick={openChat} disabled={busy}>Написать</button>}
  </div>}
  {error&&<div className="profile-reaction-badge-row">
   <span role="alert">{error}</span>
   {!state&&retry&&<button type="button" onClick={retry} disabled={busy}>Повторить</button>}
  </div>}
 </div>;
}
