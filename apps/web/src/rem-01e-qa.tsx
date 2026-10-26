/** Isolated, actual ProfileMaster and RegistrationPreview DOM parity harness. No server side effects. */
import React from "react";
import {createRoot} from "react-dom/client";
import {RegistrationPreview} from "./registration/Preview";
import {ProfileMaster} from "./discovery/ProfileMorphA2";
import {fromLocalDraft,readyRegistrationPhotos} from "./discovery/ProfileModel";
import type {ProfileMasterData} from "./discovery/ProfileModel";
import {newDraft} from "./registration/model";
import type {PhotoItem} from "./registration/PhotoSorter";
import "./styles.css";
const query=new URLSearchParams(location.search);
const mode=query.get("mode")??"step8";
const kind=query.get("kind")??"six";
const theme=query.get("theme")==="dark"?"dark":"light";
const src=(i:number)=>kind==="broken"&&i===2?"/__rem04b-broken.jpg":
 kind==="delayed"&&i===2?"/__rem04b-delayed.svg":
 "data:image/svg+xml,"+encodeURIComponent(
 '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="440"><rect width="300" height="440" fill="'+["#9e72cf","#ee9dc2","#86b9db","#a5d4c8","#efbb93","#baabe8"][i%6]+'"/><text x="15" y="100" font-size="54">PHOTO '+i+'</text></svg>'
);
const make=(i:number,status:PhotoItem["status"]="ready"):PhotoItem=>({
 id:"photo-"+i,src:status==="ready"||status==="success"?src(i):"",
 file:new File(["mock"],"photo-"+i+".jpg",{type:"image/jpeg"}),
 status,progress:status==="reading"?20:100
});
const originals:PhotoItem[]=kind==="none"?[]:kind==="one"?[make(0)]:
 kind==="mixed"?[make(0),make(1,"reading"),make(2),make(3,"error"),make(4,"success"),make(5)]:
 Array.from({length:6},(_,i)=>make(i));
const draft={...newDraft(),name:"Лея",day:"29",month:"02",year:"2000",gender:"woman" as const,
 city:"Ереван",country:"Армения",countryCode:"AM",placeId:"city:123",goal:kind==="undecided"?"undecided" as const:"serious" as const,
 about:kind==="empty"?"":"Музыка и путешествия ✨",interests:kind==="empty"?[]:["travel","music"],
 languages:kind==="empty"?[]:["ru","hy"],trialConsent:true};
const local=fromLocalDraft(draft,readyRegistrationPhotos(originals));
const server:ProfileMasterData={...local,id:"server-01",source:"server",verified:true,premium:true,
 photos:[
  {id:"published-one",src:src(0),status:"published"},
  {id:"hidden",src:src(1),status:"hidden"},
  {id:"rejected",src:src(2),status:"rejected"},
  {id:"pending",src:src(3),status:"pending"},
  {id:"published-two",src:src(4),status:"published"}
 ]};
const action=(name:string)=>document.getElementById("events")!.textContent=name;
createRoot(document.getElementById("root")!).render(<div className="luemi-shell" data-theme={theme}>
 <output id="events" data-testid="events" style={{position:"absolute",top:0,right:0,zIndex:300,pointerEvents:"none"}}/>
 {mode==="step8"?<section className="onboarding-screen">
  <div className="onboard-brand"><div className="onboard-wordmark">LUEMI</div></div>
  <header className="onboard-head"><h1>Посмотри на себя</h1></header>
  <div className="onboard-body" style={{overflowY:"auto"}}>
   <RegistrationPreview data={draft} photos={originals} editStep={step=>action("edit-"+step)} openDemo={()=>action("demo")}/>
  </div>
  <div className="onboard-footer"><div className="footer-controls">
   <button type="button" className="nav-circle">‹</button><span>Регистрация · 8/8</span>
   <button type="button" className="nav-circle forward">›</button>
  </div></div>
 </section>:<div className="qa-master-host" style={{height:"100%",width:"100%"}}>
  <ProfileMaster data={mode==="server"||mode==="visitor"?server:local}
   mode={mode==="server"?"owner":mode==="visitor"?"visitor":
    mode==="public"?"preview":mode==="local"?"local-self-preview":"owner"}
   onEdit={()=>action("edit")} active onClose={()=>action("close")}/>
 </div>}
</div>);
