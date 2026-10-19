import type {RegistrationDraft} from "../registration/model";
export type MainTab="discover"|"likes"|"chats"|"profile";
export type DiscoveryTab="feed"|"for-you"|"nearby";
export type DemoKind="save"|"pass"|"like"|"special";
export interface DemoPhoto {id:string;src:string;fallback?:string}
export interface DemoPerson {
 id:string;name:string;age:number;gender:"woman"|"man"|"other";city:string;country:string;countryCode:string;
 goal:Exclude<RegistrationDraft["goal"],"">;interests:string[];languages:string[];
 about:string;photos:DemoPhoto[];premium?:boolean;
}
export interface DiscoveryFilter {
 audience:"everyone"|"women"|"men";minAge:number;maxAge:number;
 scope:"radius"|"country"|"world";radius:number;goal:"all"|DemoPerson["goal"];language:string;commonOnly:boolean;
}
export const defaultFilters:DiscoveryFilter={audience:"everyone",minAge:18,maxAge:80,scope:"world",radius:5000,goal:"all",language:"all",commonOnly:false};
export function commonInterests(person:DemoPerson,draft:RegistrationDraft):string[]{
 return person.interests.filter(id=>draft.interests.includes(id));
}
export function demoDistanceKm(person:DemoPerson,draft:RegistrationDraft):number|null{
 // Illustrative fixtures are NEVER evidence of actual user coordinates.
 if(!draft.city)return null;
 const key=person.id+"::"+draft.city.toLocaleLowerCase("ru");
 let hash=0;for(let i=0;i<key.length;i++)hash=(hash*31+key.charCodeAt(i))>>>0;
 return person.city===draft.city?8:20+hash%4800;
}
export function filterDemoPeople(people:DemoPerson[],filter:DiscoveryFilter,draft:RegistrationDraft):DemoPerson[]{
 return people.filter(p=>{
  if(p.age<filter.minAge||p.age>filter.maxAge)return false;
  if(filter.audience==="women"&&p.gender!=="woman")return false;
  if(filter.audience==="men"&&p.gender!=="man")return false;
  if(filter.goal!=="all"&&p.goal!==filter.goal)return false;
  if(filter.language!=="all"&&!p.languages.includes(filter.language))return false;
  if(filter.commonOnly&&!commonInterests(p,draft).length)return false;
  if(filter.scope==="country"&&draft.countryCode&&draft.countryCode!==p.countryCode)return false;
  if(filter.scope==="radius"&&draft.city){
   const distance=demoDistanceKm(p,draft);if(distance!==null&&distance>filter.radius)return false;
  }
  return true;
 });
}
export interface DemoHistory {index:number;kind:DemoKind;profileId:string;wasSaved:boolean;wasLiked:boolean}
export interface DemoFeedState {index:number;saved:string[];liked:string[];history:DemoHistory[];lastKind:DemoKind|null}
export const freshDemoState=():DemoFeedState=>({index:0,saved:[],liked:[],history:[],lastKind:null});
function setMembership(before:string[],id:string,has:boolean){return has?[...new Set([...before,id])]:before.filter(x=>x!==id);}
export function demoAct(state:DemoFeedState,ids:string[],kind:DemoKind):DemoFeedState{
 const id=ids[state.index];if(!id)return state;
 const wasSaved=state.saved.includes(id),wasLiked=state.liked.includes(id);
 const next={...state,saved:state.saved,liked:state.liked,
  history:[...state.history,{index:state.index,kind,profileId:id,wasSaved,wasLiked}].slice(-40),lastKind:kind};
 if(kind==="save")return {...next,saved:setMembership(state.saved,id,!wasSaved)};
 if(kind==="like"||kind==="special")next.liked=setMembership(state.liked,id,true);
 return {...next,index:Math.min(ids.length,state.index+1)};
}
export function demoUndo(state:DemoFeedState):DemoFeedState{
 const history=state.history.at(-1);
 if(!history)return state;
 return {...state,index:history.index,history:state.history.slice(0,-1),
   saved:setMembership(state.saved,history.profileId,history.wasSaved),
   liked:setMembership(state.liked,history.profileId,history.wasLiked),lastKind:null};
}
