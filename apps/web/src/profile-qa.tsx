/** Developer-only Vite HTML entry. Not referenced by production index.html. */
import React,{useCallback,useRef,useState} from "react";
import {resourceIdentity,type ViewerSource} from "./discovery/photo-viewer-state";
import {createRoot} from "react-dom/client";
import {DiscoveryApp} from "./discovery/DiscoveryApp";
import {PhotoViewer} from "./discovery/PhotoViewer";
import {projectProfile,type ProfileMasterData,type ProfilePhoto} from "./discovery/ProfileModel";
import {viewerPhotoContext} from "./discovery/photo-viewer-state";
import {newDraft} from "./registration/model";
import "./styles.css";

const base=newDraft("ZHIIIRRO");
const draft={...base,trialConsent:true,day:"12",month:"5",year:"1998",gender:"man" as const,
 country:"Россия",city:"Краснодар",countryCode:"RU",placeId:"qa-krasnodar",
 goal:"communication" as const,audience:"women" as const,about:("Одна история — тысяча возможностей. "+("Кадр тестового описания и проверка независимого вертикального скролла. ").repeat(8)).slice(0,700),
 interests:["кино","спорт","фотография"],languages:["ru"]};
// Three distinct deterministic *local* fixture images. This developer-only
// entry is not the production index.html and does not change real user photos.
const qaSvg=(label:string,color:string)=>"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960"><rect width="720" height="960" fill="${color}"/><circle cx="360" cy="385" r="155" fill="#ffffff" fill-opacity=".35"/><path d="M75 910 Q360 400 645 910" fill="#ffffff" fill-opacity=".26"/><text x="360" y="910" fill="#ffffff" font-size="42" font-family="Arial" text-anchor="middle">${label}</text></svg>`
);
const qaPhotos=[
  {id:"qa-photo-lilac",src:qaSvg("LUEMI QA 1","#8d74cb")},
  {id:"qa-photo-rose",src:qaSvg("LUEMI QA 2","#c471a0")},
  {id:"qa-photo-indigo",src:qaSvg("LUEMI QA 3","#5863a8")}
];

/** REM-03A only — isolated, deterministic PhotoViewer identity/media QA fixture.
 * Never included in the production entrypoint or persisted to IndexedDB. */
const fixturePhotos:ProfilePhoto[]=[
 {id:"qa-alpha",src:qaSvg("ALPHA","#ab85dd"),status:"published",addedAt:"2026-01-02T12:00:00Z"},
 {id:"qa-beta",src:qaSvg("BETA","#db779d"),status:"published",addedAt:"2026-02-03T12:00:00Z"},
 {id:"qa-gamma",src:qaSvg("GAMMA","#667ed8"),status:"published",addedAt:"2026-03-04T12:00:00Z"}
];
function MediaQA(){
 const [items,setItems]=useState<ProfilePhoto[]>(fixturePhotos);
 const [openId,setOpenId]=useState<string|null>(null);
 const [origin,setOrigin]=useState<"hero"|"grid"|"outside"|null>(null);
 const [originId,setOriginId]=useState<string|null>(null);
 const backHandler=useRef<(()=>boolean)|null>(null);
 const profileBack=useRef(0);
 const closed=useRef(0);
 const profile:ProfileMasterData={
  id:"qa-media-profile",source:"server",name:"QA Media",age:28,
  city:"Краснодар",country:"Россия",countryCode:"RU",goal:null,about:"",
  interests:[],languages:[],photos:items,verified:false,premium:false,
  registeredAt:null,updatedAt:null
 };
 const view=projectProfile(profile,"owner");
 (window as Window&{__luemiQaMedia?:unknown}).__luemiQaMedia={
  open:(id:string)=>{setOrigin(null);setOpenId(id);},
  prepareOrigin:(id:string,kind:"hero"|"grid"|"outside")=>{setOriginId(id);setOrigin(kind);},
  openFrom:(id:string,kind:"hero"|"grid"|"outside")=>{
   setOriginId(id);setOrigin(kind);setOpenId(id);
  },
  removeOrigin:()=>setOrigin(null),
  close:()=>setOpenId(null),
  back:()=>{if(!backHandler.current?.())profileBack.current++;},
  stats:()=>({closeCommits:closed.current,photoCount:items.length,openId,
   profileBack:profileBack.current}),
  change:(operation:string)=>setItems(current=>{
   if(operation==="count-0")return [];
   if(operation==="count-1")return fixturePhotos.slice(0,1);
   if(operation==="count-2")return fixturePhotos.slice(0,2);
   if(operation==="count-6")return [
    ...fixturePhotos,
    {id:"qa-delta",src:qaSvg("DELTA","#4a93a3"),status:"published" as const,addedAt:"2026-04-05"},
    {id:"qa-epsilon",src:qaSvg("EPSILON","#ae8b42"),status:"published" as const,addedAt:"2026-05-06"},
    {id:"qa-zeta",src:qaSvg("ZETA","#7b65ad"),status:"published" as const,addedAt:"2026-06-07"}
   ];
   if(operation==="aspect-portrait"||operation==="aspect-landscape"||
    operation==="aspect-panorama"||operation==="aspect-tall"){
    const sizes:Record<string,[number,number]>={
     "aspect-portrait":[720,960],"aspect-landscape":[1600,650],
     "aspect-panorama":[3000,300],"aspect-tall":[480,1500]
    };
    const [w,h]=sizes[operation];
    const src="data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(
     '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+
     '" viewBox="0 0 '+w+' '+h+'"><rect width="'+w+'" height="'+h+
     '" fill="#ad83d4"/><circle cx="'+(w/2)+'" cy="'+(h/2)+
     '" r="'+Math.min(w,h)/7+'" fill="white"/></svg>');
    return fixturePhotos.map(p=>p.id==="qa-alpha"?{...p,src,version:operation}:p);
   }
   if(operation==="reset")return [...fixturePhotos];
   if(operation==="reorder")return [...current].reverse();
   if(operation==="remove-current"){
    const visibleId=document.querySelector<HTMLImageElement>(".pm-viewer-image")?.dataset.photoId;
    return current.filter(p=>p.id!==visibleId);
   }
   if(operation==="remove-last")return current.slice(0,-1);
   if(operation==="remove-all")return [];
   if(operation==="revoke-beta")return current.map(p=>p.id==="qa-beta"?{...p,status:"hidden" as const}:p);
   if(operation==="replace-beta")return current.map(p=>p.id==="qa-beta"?
    {...p,src:qaSvg("BETA VERSION TWO","#2c9a7b"),version:"v2"}:p);
   if(operation==="cold-beta")return current.map(p=>p.id==="qa-beta"?
    {...p,src:"/qa-media-cold.png",version:"cold"}:p);
   if(operation==="broken-beta")return current.map(p=>p.id==="qa-beta"?
    {...p,src:"/qa-media-broken.png",fallback:qaSvg("BETA FALLBACK","#d9a456"),version:"broken"}:p);
   if(operation==="error-beta")return current.map(p=>p.id==="qa-beta"?
    {...p,src:"/qa-media-broken.png",fallback:undefined,version:"error"}:p);
   return current;
  })
 };
 const sourcePhoto=view.photos.find(p=>p.id===(originId??openId));
 const source:ViewerSource|null=origin&&sourcePhoto?{
  photoId:sourcePhoto.id,contextId:viewerPhotoContext(view),
  resourceKey:resourceIdentity(sourcePhoto),
  resolveElement:()=>document.getElementById("qa-source-photo")
 }:null;
 return <>
  {origin&&sourcePhoto&&<div data-qa-source={origin}
   style={{position:"fixed",zIndex:20,overflow:"hidden",left:origin==="grid"?55:16,
    top:origin==="outside"?-900:110,width:origin==="grid"?210:330,
    height:origin==="grid"?280:390,pointerEvents:"none"}}>
   <img id="qa-source-photo" data-photo-id={sourcePhoto.id} alt=""
    src={sourcePhoto.src} style={{width:"100%",height:"100%",display:"block",
     objectFit:"cover",objectPosition:origin==="hero"?"center 20%":"center center"}}/>
  </div>}
  {openId&&<PhotoViewer view={view} photos={view.photos} initialPhotoId={openId}
   contextId={viewerPhotoContext(view)} source={source}
   registerBack={cb=>{backHandler.current=cb;}}
   onClose={()=>{closed.current++;setOpenId(null);}}/>}
 </>;
}
function VisualQA(){
 const [theme,setTheme]=useState<"light"|"dark">("light");
 // Developer fixture: exercise the exact DiscoveryApp callback registered by
 // Telegram BackButton without requiring a production WebApp mock.
 const registerBack=useCallback((handler:()=>void)=>{
  (window as Window & {__luemiQaBack?:()=>void}).__luemiQaBack=handler;
 },[]);
 return <main className="luemi-shell" data-theme={theme} data-phase="form">
  <DiscoveryApp draft={draft} photos={qaPhotos}
   theme={theme} onTheme={()=>setTheme(value=>value==="light"?"dark":"light")}
   onExit={()=>{}} registerBack={registerBack}/>
  <MediaQA/>
 </main>;
}
createRoot(document.getElementById("root")!).render(
 <React.StrictMode>
  <VisualQA/>
 </React.StrictMode>
);
