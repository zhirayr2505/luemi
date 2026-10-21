/** Developer-only Vite HTML entry. Not referenced by production index.html. */
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {DiscoveryApp} from "./discovery/DiscoveryApp";
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
function VisualQA(){
 const [theme,setTheme]=useState<"light"|"dark">("light");
 return <main className="luemi-shell" data-theme={theme} data-phase="form">
  <DiscoveryApp draft={draft} photos={qaPhotos}
   theme={theme} onTheme={()=>setTheme(value=>value==="light"?"dark":"light")}
   onExit={()=>{}} registerBack={()=>{}}/>
 </main>;
}
createRoot(document.getElementById("root")!).render(
 <React.StrictMode>
  <VisualQA/>
 </React.StrictMode>
);
