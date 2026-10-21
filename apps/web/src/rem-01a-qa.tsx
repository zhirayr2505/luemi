/** REM-01A isolated React integration fixture. Never shipped by production index.html. */
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {GeoPicker} from "./registration/GeoPicker";
import {Flag} from "./ui/Flag";
import {PhotoSorter,type PhotoItem} from "./registration/PhotoSorter";
import {newDraft,type RegistrationDraft} from "./registration/model";
import "./styles.css";
declare global {interface Window {__REM01A_FIXTURE__?:{patches:Array<Partial<RegistrationDraft>>;moves:Array<[number,number]>}}}
const evidence={patches:[] as Array<Partial<RegistrationDraft>>,moves:[] as Array<[number,number]>};
window.__REM01A_FIXTURE__=evidence;
const sample=(id:string,color:string):PhotoItem=>({
 id,src:"data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect width="300" height="420" fill="'+color+'"/></svg>'),
 file:new File([new Uint8Array([1,2,3])],id+".png",{type:"image/png"}),status:"ready"
});
function GeoFixture(){
 const [draft,setDraft]=useState(newDraft("QA"));
 const [mounted,setMounted]=useState(true);
 const patch=(values:Partial<RegistrationDraft>)=>{
  evidence.patches.push(values);setDraft(previous=>({...previous,...values}));
 };
 return <main className="luemi-shell" data-theme="light" data-phase="form">
  <section className="onboarding-screen">
   <header className="onboard-head"><h1>Геолокация · тест</h1></header>
   <div className="onboard-body">
    <button type="button" onClick={()=>setMounted(false)}>Убрать шаг геолокации</button>
    <aside data-testid="flag-qa"><Flag code=" ru " title="QA known flag"/><Flag code="ZZ" title="QA unsupported flag"/></aside>
    <output data-testid="geo-current">{JSON.stringify({city:draft.city,country:draft.country,countryCode:draft.countryCode,placeId:draft.placeId,scope:draft.searchScope,radius:draft.radius})}</output>
    {mounted&&<GeoPicker data={draft} patch={patch}/>}
   </div>
  </section>
 </main>;
}
function SorterFixture(){
 const [photos,setPhotos]=useState<PhotoItem[]>([sample("qa-red","#ce739a"),sample("qa-blue","#686dd0")]);
 const movePhoto=(from:number,to:number)=>{
  evidence.moves.push([from,to]);
  setPhotos(items=>{const result=[...items];const [item]=result.splice(from,1);result.splice(to,0,item);return result;});
 };
 return <main className="luemi-shell" data-theme="light" data-phase="form">
  <section className="onboarding-screen"><div className="onboard-body">
   <output data-testid="photo-order">{photos.map(p=>p.id).join(",")}</output>
   <PhotoSorter photos={photos} addPhotos={()=>{}} removePhoto={()=>{}} movePhoto={movePhoto}/>
  </div></section>
 </main>;
}
createRoot(document.getElementById("root")!).render(
 <React.StrictMode>{location.pathname.includes("sorter-qa")?<SorterFixture/>:<GeoFixture/>}</React.StrictMode>
);
