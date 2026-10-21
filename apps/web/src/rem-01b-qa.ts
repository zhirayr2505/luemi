/** Isolated real IndexedDB/browser fixture. Never included in production index.html. */
import {newDraft} from "./registration/model";
import {parseRegistrationDraft,parseEnvelope,parsePhotos,DRAFT_TTL_MS} from "./registration/draft-schema";
import {localScope,loadDraftSnapshot,saveDraftSnapshot,clearDraftSnapshot} from "./registration/local-draft";
import type {PhotoItem} from "./registration/PhotoSorter";
const initData=(id:number)=>"user="+encodeURIComponent(JSON.stringify({id,first_name:"QA"}));
window.Telegram={WebApp:{initData:initData(91001)}};
const api={
 setAccount:(id:number)=>{if(window.Telegram?.WebApp)window.Telegram.WebApp.initData=initData(id);},
 scope:()=>localScope(),
 makeDraft:(name:string)=>({...newDraft(name),trialConsent:true}),
 makePhoto:(id:string):PhotoItem=>({id,file:new File([Uint8Array.from([1,2,3,4,5])],id+".png",{type:"image/png"}),src:"",status:"ready"}),
 load:()=>loadDraftSnapshot(),
 save:(scope:string,draftId:string,rev:number,draft:ReturnType<typeof newDraft>,step:number,photos:PhotoItem[])=>
  saveDraftSnapshot(scope,draftId,rev,draft,step,photos),
 clear:(scope:string)=>clearDraftSnapshot(scope),
 validate:parseRegistrationDraft,photos:parsePhotos,envelope:parseEnvelope,ttl:DRAFT_TTL_MS
};
declare global {interface Window {__REM01B_QA__?:typeof api}}
window.__REM01B_QA__=api;
document.getElementById("ready")!.textContent="ready";
