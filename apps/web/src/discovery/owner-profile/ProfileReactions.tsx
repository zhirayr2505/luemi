import {Heart,MessageCircle,Star} from "lucide-react";
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

export function profileReactionAsset(glyph:ReactionGlyph|"like-skipped"){
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
 const label=glyph&&(controls.demo&&glyph==="superlike-outgoing"?"Тестовый суперлайк поставлен":
  controls.demo&&glyph==="like-outgoing"?"Тестовый лайк поставлен":glyphNames[glyph]);
 return <span className="profile-reaction-indicator" data-visible={glyph?true:undefined}
  role="img" aria-label={label??undefined} aria-hidden={glyph?undefined:true}>
  {reactionGlyphs.map(icon=><img key={icon} src={profileReactionAsset(icon)} alt="" width="26" height="26"
   data-active={glyph===icon?true:undefined} draggable={false}/>)}
 </span>;
}

export function showProfileChat(controls:ProfileReactionControls|undefined):boolean{
 return !!(controls?.state?.matchId&&controls.openChat);
}

const glyphNames:Record<ReactionGlyph,string>={
 "like-incoming":"Вам отправили симпатию",
 "like-outgoing":"Симпатия отправлена",
 "superlike-incoming":"Вам отправили суперлайк",
 "superlike-outgoing":"Суперлайк отправлен",
 "like-mutual":"Взаимный лайк"
};

export function ProfileReactionButtons({layout,controls}:{
 layout:"expanded"|"compact";controls:ProfileReactionControls;
}){
 const show=!controls.pendingKind&&canSendProfileReaction(controls.state);
 return <div className={`profile-reaction-buttons profile-reaction-buttons--${layout}`}
  data-reaction-layout={layout} data-chat={showProfileChat(controls)||undefined}>
  {showProfileChat(controls)&&<button className="profile-reaction-button" type="button" aria-label="Написать"
   disabled={controls.busy} onClick={controls.openChat}><MessageCircle size={22} aria-hidden="true"/></button>}
  {show&&<>
   <button className="profile-reaction-button" type="button" aria-label="Поставить лайк"
    disabled={controls.busy} onClick={()=>controls.send("ordinary")}><Heart size={22} aria-hidden="true"/></button>
   <button className="profile-reaction-button profile-reaction-button--super" type="button" aria-label="Отправить суперлайк"
    disabled={controls.busy} onClick={()=>controls.send("super")}><Star size={22} aria-hidden="true"/></button>
  </>}
 </div>;
}

export function ProfileReactionError({controls}:{controls:ProfileReactionControls}){
 const {state,error,busy,retry}=controls;
 if(!error)return null;
 return <div className="profile-reaction-error">
  <span role="alert">{error}</span>
  {!state&&retry&&<button type="button" onClick={retry} disabled={busy}>Повторить</button>}
 </div>;
}
