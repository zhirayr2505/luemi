/** REM-01C isolated genuine PhotoSorter fixture; NEVER a production route. */
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {PhotoSorter,type PhotoItem} from "./registration/PhotoSorter";
import "./styles.css";
const make=(i:number):PhotoItem=>({
 id:"photo-"+i,
 src:"data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#ad86d4"/></svg>'),
 file:new File([new Uint8Array([137,80,78,71,13,10,26,10])],"photo-"+i+".png",{type:"image/png"}),
 status:"ready"
});
declare global {interface Window {__REM01C_SORTER__?:{moves:Array<[number,number]>;removes:string[]}}}
const log={moves:[] as Array<[number,number]>,removes:[] as string[]};
window.__REM01C_SORTER__=log;
function Fixture(){
 const [photos,setPhotos]=useState<PhotoItem[]>(Array.from({length:6},(_,i)=>make(i)));
 const movePhoto=(from:number,to:number)=>{
  log.moves.push([from,to]);
  setPhotos(list=>{
   const next=[...list];const [item]=next.splice(from,1);next.splice(to,0);return next;
  });
 };
 return <main className="luemi-shell" data-theme="light" data-phase="form">
  <section className="onboarding-screen">
   <div className="onboard-body" style={{height:300,maxHeight:300,minHeight:300,flex:"none",overflowY:"auto"}}>
    <div style={{height:75}} data-testid="top-filler">До фото</div>
    <output data-testid="photo-order">{photos.map(p=>p.id).join(",")}</output>
    <PhotoSorter photos={photos} movePhoto={movePhoto}
     addPhotos={()=>{}} removePhoto={id=>{log.removes.push(id);setPhotos(p=>p.filter(x=>x.id!==id));}}/>
    <div style={{height:480}} data-testid="bottom-filler">После фото</div>
   </div>
  </section>
 </main>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Fixture/></React.StrictMode>);
