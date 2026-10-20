/** Developer-only Vite HTML entry. Not referenced by production index.html. */
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {DiscoveryApp} from "./discovery/DiscoveryApp";
import {demoPeople} from "./discovery/demo-people";
import {newDraft} from "./registration/model";
import "./styles.css";

const base=newDraft("ZHIIIRRO");
const draft={...base,trialConsent:true,day:"12",month:"5",year:"1998",gender:"man" as const,
 country:"Россия",city:"Краснодар",countryCode:"RU",placeId:"qa-krasnodar",
 goal:"communication" as const,audience:"women" as const,about:"Одна история — тысяча возможностей.",
 interests:["кино","спорт","фотография"],languages:["ru"]};
const example=demoPeople[0].photos[0];
const mockPhoto=example.fallback||example.src;
function VisualQA(){
 const [theme,setTheme]=useState<"light"|"dark">("light");
 return <main className="luemi-shell" data-theme={theme} data-phase="form">
  <DiscoveryApp draft={draft} photos={[{id:"visual-qa-photo",src:mockPhoto}]}
   theme={theme} onTheme={()=>setTheme(value=>value==="light"?"dark":"light")}
   onExit={()=>{}} registerBack={()=>{}}/>
 </main>;
}
createRoot(document.getElementById("root")!).render(
 <React.StrictMode>
  <VisualQA/>
 </React.StrictMode>
);
