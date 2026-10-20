import type {RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";

/** Device-local beta drafts, separated per Telegram account where possible.
 * Not server-side persistence: Telegram clearing web data also removes this draft. */
const PREFIX="luemi:registration-draft:v1:";
export function localScope():string|null {
 const raw=window.Telegram?.WebApp?.initData;
 if(!raw)return null;
 try {
   const json=new URLSearchParams(raw).get("user");
   const user=json?JSON.parse(json) as {id?:unknown}:null;
   return typeof user?.id==="number"&&Number.isSafeInteger(user.id)
     ?String(user.id):null;
 }catch{return null;}
}
export interface StoredDraft {version:1;step:number;draft:RegistrationDraft;updated:number}
export function loadLocalDraft():StoredDraft|null {
 const scope=localScope();if(!scope)return null;
 try {
   const json=localStorage.getItem(PREFIX+scope);
   if(!json)return null;
   const record=JSON.parse(json) as Partial<StoredDraft>;
   if(record.version!==1||typeof record.step!=="number"||!record.draft)return null;
   if(Date.now()-(record.updated??0)>30*24*3600000)return null;
   return {version:1,step:Math.max(1,Math.min(8,Math.round(record.step))),
     draft:record.draft as RegistrationDraft,updated:record.updated??0};
 }catch{return null;}
}
export function saveLocalDraft(draft:RegistrationDraft,step:number):void{
 const scope=localScope();if(!scope)return;
 try{localStorage.setItem(PREFIX+scope,JSON.stringify({version:1,step,draft,updated:Date.now()}));}
 catch{/* Private/incognito mode may disallow local storage. */}
}
const DB_NAME="luemi-local-photo-preview-v1", STORE="drafts";
function database():Promise<IDBDatabase|null>{
 return new Promise(resolve=>{
   if(!("indexedDB" in window)){resolve(null);return;}
   let finished=false;
   const done=(db:IDBDatabase|null)=>{if(finished){db?.close();return;}finished=true;resolve(db);};
   try{
     const request=indexedDB.open(DB_NAME,1);
     request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
     request.onsuccess=()=>done(request.result);
     request.onerror=()=>done(null);
     request.onblocked=()=>done(null);
   }catch{done(null);}
 });
}
interface SavedPhoto {id:string;file:File;preview?:Blob}
export async function loadLocalPhotos():Promise<SavedPhoto[]>{
 const scope=localScope();if(!scope)return [];
 const db=await database();if(!db)return [];
 return await new Promise(resolve=>{
   let done=false;
   const finish=(value:SavedPhoto[])=>{if(done)return;done=true;db.close();resolve(value);};
   try{
     const tx=db.transaction(STORE,"readonly");
     const request=tx.objectStore(STORE).get(scope);
     request.onsuccess=()=>{
       const value=request.result as {photos?:SavedPhoto[]}|undefined;
       finish(Array.isArray(value?.photos)?value.photos.filter(p=>p&&p.id&&p.file instanceof Blob).slice(0,6):[]);
     };
     tx.onerror=()=>finish([]);request.onerror=()=>finish([]);
   }catch{finish([]);}
 });
}
// Serialize photo writes and clears so a slower old save cannot restore deleted data.
let photoWrites:Promise<void>=Promise.resolve();
export function saveLocalPhotos(photos:PhotoItem[]):Promise<void>{
 const scope=localScope();if(!scope)return Promise.resolve();
 const snapshot=photos.map(({id,file,preview})=>({id,file,preview}));
 photoWrites=photoWrites.catch(()=>{}).then(()=>writeLocalPhotos(scope,snapshot));
 return photoWrites;
}
async function writeLocalPhotos(scope:string,photos:SavedPhoto[]):Promise<void>{
 const db=await database();if(!db)return;
 await new Promise<void>(resolve=>{
   try {
     const tx=db.transaction(STORE,"readwrite");
     tx.objectStore(STORE).put({photos,updated:Date.now()},scope);
     tx.oncomplete=()=>{db.close();resolve();};
     tx.onerror=()=>{db.close();resolve();};
     tx.onabort=()=>{db.close();resolve();};
   }catch{db.close();resolve();}
 });
}
export function clearLocalDraft():Promise<void>{
 const scope=localScope();if(!scope)return Promise.resolve();
 try{localStorage.removeItem(PREFIX+scope);}catch{/* storage restricted */}
 photoWrites=photoWrites.catch(()=>{}).then(()=>clearLocalPhotos(scope));
 return photoWrites;
}
async function clearLocalPhotos(scope:string):Promise<void>{
 const db=await database();if(!db)return;
 await new Promise<void>(resolve=>{
   try{
     const tx=db.transaction(STORE,"readwrite");
     tx.objectStore(STORE).delete(scope);
     tx.oncomplete=tx.onerror=tx.onabort=()=>{db.close();resolve();};
   }catch{db.close();resolve();}
 });
}
