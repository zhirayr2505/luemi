/* Development-only isolated UI harness. No Telegram credentials or production
   publication: the browser test exercises all seven current registration stages. */
import {useCallback,useState} from "react";
import {createRoot} from "react-dom/client";
import {RealRegistrationV2} from "./RealRegistration";
import {newDraft,type RegistrationDraft} from "../model";
import type {PhotoItem} from "../PhotoSorter";
import "../../styles.css";
import "../../ui/luemi-v5.css";

function IsolatedRegistrationQA(){
 const [draft,setDraft]=useState<RegistrationDraft>(()=>newDraft());
 const [photos,setPhotos]=useState<PhotoItem[]>([]);
 const [publishing,setPublishing]=useState(false);
 const [published,setPublished]=useState(false);
 const patch=useCallback((update:Partial<RegistrationDraft>)=>setDraft(prev=>({...prev,...update})),[]);
 const addPhotos=useCallback((files:File[])=>setPhotos(prev=>[
  ...prev,...files.slice(0,Math.max(0,6-prev.length)).map(file=>({
   id:crypto.randomUUID(),file,src:URL.createObjectURL(file),status:"ready" as const
  }))
 ]),[]);
 const removePhoto=useCallback((id:string)=>setPhotos(prev=>{
  const old=prev.find(photo=>photo.id===id);
  if(old)URL.revokeObjectURL(old.src);
  return prev.filter(photo=>photo.id!==id);
 }),[]);
 const movePhoto=useCallback((from:number,to:number)=>setPhotos(prev=>{
  const next=[...prev];
  if(from<0||from>=next.length||to<0||to>=next.length)return prev;
  const [item]=next.splice(from,1);next.splice(to,0,item);return next;
 }),[]);
 const submit=()=>{
  if(publishing)return;
  setPublishing(true);
  // Clearly synthetic end marker: this is NOT a server publication.
  window.setTimeout(()=>{setPublishing(false);setPublished(true);},350);
 };
 const registerBack=(back:()=>void)=>{
  (window as Window&{__luemiQABack?:()=>void}).__luemiQABack=back;
 };
 return <div className="luemi-shell" data-theme="dark" data-testid="registration-qa-shell">
  {published?<main role="status" data-testid="qa-synthetic-complete">
    <h1>Синтетическая проверка завершена</h1>
    <p>Все семь экранов пройдены. Серверная публикация не выполнялась.</p>
   </main>:<RealRegistrationV2
    draft={draft} patch={patch} photos={photos}
    fallbackEntry={false} restored={true} resumeReview={false}
    addPhotos={addPhotos} removePhoto={removePhoto} movePhoto={movePhoto}
    resetDraft={()=>setDraft(newDraft())} theme="dark" onTheme={()=>{}}
    onSave={submit} mediaEnabled={true} serverSaving={publishing}
    serverStatus="" mediaStatus="" storageError={null}
    onRetryStorage={()=>{}} onExit={()=>{}} registerBack={registerBack}/>}
 </div>;
}
const root=document.getElementById("root");
if(!root)throw new Error("Missing isolated QA root");
createRoot(root).render(<IsolatedRegistrationQA/>);
