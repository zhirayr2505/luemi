/** Browser-only visual fixture. Not included in the production Vite entry. */
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {RealRegistrationV2} from "./RealRegistration";
import {newDraft,type RegistrationDraft} from "../model";
import type {PhotoItem} from "../PhotoSorter";
import "../../styles.css";
const initial:RegistrationDraft={...newDraft("Тестовый профиль"),trialConsent:true,day:"12",month:"05",year:"1998",gender:"man",city:"Краснодар",country:"Россия",countryCode:"RU",placeId:"qa:krasnodar",audience:"women",goal:"serious",about:"Люблю вечерние прогулки, хороший юмор и честные разговоры.",interests:["путешествия","музыка","кофе"]};
function fixturePhoto(i:number):PhotoItem{
 const canvas=document.createElement("canvas");canvas.width=500;canvas.height=600;
 const ctx=canvas.getContext("2d")!;
 ctx.fillStyle=["#76616a","#54475b","#68505c"][i];ctx.fillRect(0,0,500,600);
 ctx.fillStyle="#e8d7d1";ctx.beginPath();ctx.arc(250,230,85,0,Math.PI*2);ctx.fill();ctx.fillRect(120,360,260,240);
 const src=canvas.toDataURL("image/png");return {id:String(i),src,file:new File([src,String(i)],"qa-"+i+".png",{type:"image/png"}),status:"ready",serverStatus:"saved"};
}
function QA(){
 const [draft,setDraft]=useState(initial),[photos,setPhotos]=useState<PhotoItem[]>([fixturePhoto(0),fixturePhoto(1),fixturePhoto(2)]);
 return <RealRegistrationV2 fallbackEntry={false} draft={draft} patch={change=>setDraft(d=>({...d,...change}))} photos={photos}
  addPhotos={()=>{}} removePhoto={id=>setPhotos(p=>p.filter(x=>x.id!==id))}
  movePhoto={(from,to)=>setPhotos(p=>{const next=[...p];next.splice(to,0,next.splice(from,1)[0]);return next;})}
  resetDraft={()=>{}} theme="dark" onTheme={()=>{}} onSave={()=>{}} onRetryMedia={()=>{}}
  mediaEnabled serverSaving={false} serverStatus="" storageError={null} restored resumeReview={false}
  onRetryStorage={()=>{}} onExit={()=>{}} registerBack={()=>{}}/>;
}
createRoot(document.getElementById("root")!).render(<QA/>);
