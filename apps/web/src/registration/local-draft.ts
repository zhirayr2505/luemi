import type {RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import {parseRegistrationDraft,parsePhotos,parseEnvelope,isExpired,DRAFT_TTL_MS,
 type DraftEnvelope,type StoredPhoto} from "./draft-schema";

/** This identifier is ONLY a device-local partition hint extracted from unsigned initData.
 * Server authorization must use verified Telegram initData independently. */
const PREFIX="luemi:registration-draft:v1:";
const DB_NAME="luemi-local-photo-preview-v1",STORE="drafts";
const key=(scope:string)=>"registration-v2:"+scope;
export function localScope():string|null {
 const raw=window.Telegram?.WebApp?.initData;
 if(!raw)return null;
 try {
  const user=new URLSearchParams(raw).get("user");
  const parsed=user?JSON.parse(user) as {id?:unknown}:null;
  return typeof parsed?.id==="number"&&Number.isSafeInteger(parsed.id)&&parsed.id>0
   ?String(parsed.id):null;
 }catch{return null;}
}
export interface LegacyDraft {version:1;step:number;draft:RegistrationDraft;updated:number}
export type StorageCode = "scope"|"unavailable"|"blocked"|"quota"|"abort"|"invalid"|"expired"|"conflict"|"io";
export type StorageFailure = {ok:false;code:StorageCode;retryable:boolean};
export type SaveResult = {ok:true;revision:number} | StorageFailure;
export type LoadResult =
 {ok:true;source:"v2"|"legacy"|"empty"|"expired"|"deleted";snapshot:DraftEnvelope|null} |
 {ok:false;code:StorageCode;retryable:boolean};
const failure=(code:StorageCode,retryable=true):StorageFailure=>({ok:false,code,retryable});
const classify=(error:unknown):StorageCode=>{
 const name=error instanceof DOMException?error.name:"";
 if(name==="QuotaExceededError")return "quota";
 if(name==="AbortError")return "abort";
 if(name==="VersionError"||name==="InvalidStateError")return "blocked";
 return "io";
};
const scopeOk=(scope:string):boolean=>localScope()===scope;
const isObject=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function openDatabase():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(!("indexedDB" in window)||!window.indexedDB){reject(new Error("unavailable"));return;}
  let settled=false;
  const timer=window.setTimeout(()=>done(new Error("blocked")),6000);
  let request:IDBOpenDBRequest;
  const done=(error?:Error,db?:IDBDatabase)=>{
   if(settled){db?.close();return;}
   settled=true;window.clearTimeout(timer);
   if(error)reject(error);else if(db)resolve(db);else reject(new Error("io"));
  };
  try{
   // Stay on database version 1. Older LUEMI still reads its original photos.
   request=indexedDB.open(DB_NAME,1);
   request.onupgradeneeded=()=>{
    if(!request.result.objectStoreNames.contains(STORE))
     request.result.createObjectStore(STORE);
   };
   request.onerror=()=>done(request.error??new Error("io"));
   request.onblocked=()=>done(new Error("blocked"));
   request.onsuccess=()=>{
    const db=request.result;
    db.onversionchange=()=>db.close();
    done(undefined,db);
   };
  }catch(e){done(e instanceof Error?e:new Error("io"));}
 });
}
async function database():Promise<IDBDatabase|StorageFailure>{
 try{return await openDatabase();}
 catch(e){
  if(e instanceof Error&&(e.message==="blocked"||e.message==="unavailable"))
   return failure(e.message,false);
  return failure(classify(e));
 }
}
const isFailure=(db:IDBDatabase|StorageFailure):db is StorageFailure=>!("transaction" in db);
function readKey(db:IDBDatabase,recordKey:string):Promise<{ok:true;value:unknown}|StorageFailure>{
 return new Promise(resolve=>{
  let finished=false,record:unknown;
  const done=(result:{ok:true;value:unknown}|StorageFailure)=>{
   if(finished)return;finished=true;resolve(result);
  };
  try{
   const tx=db.transaction(STORE,"readonly");
   const req=tx.objectStore(STORE).get(recordKey);
   req.onsuccess=()=>{record=req.result;};
   req.onerror=()=>done(failure(classify(req.error)));
   tx.oncomplete=()=>done({ok:true,value:record});
   tx.onerror=()=>done(failure(classify(tx.error)));
   tx.onabort=()=>done(failure("abort"));
  }catch(e){done(failure(classify(e)));}
 });
}
function legacyDraft(scope:string):{ok:true;value:LegacyDraft|null}|StorageFailure{
 let json:string|null;
 try{json=localStorage.getItem(PREFIX+scope);}catch(e){return failure(classify(e));}
 if(!json)return {ok:true,value:null};
 let raw:unknown;
 try{raw=JSON.parse(json);}catch{return failure("invalid",false);}
 if(!isObject(raw)||raw.version!==1||
  typeof raw.updated!=="number"||!Number.isSafeInteger(raw.updated)||
  raw.updated<=0||raw.updated>Date.now()+5*60*1000||
  typeof raw.step!=="number"||!Number.isFinite(raw.step))
  return failure("invalid",false);
 const parsed=parseRegistrationDraft(raw.draft);
 if(!parsed.ok)return failure("invalid",false);
 return {ok:true,value:{version:1,updated:raw.updated,
  step:Math.max(1,Math.min(8,Math.round(raw.step))),draft:parsed.value}};
}
/** Public compatibility read: validated legacy text only; never an authority for new v2. */
export function loadLocalDraft():LegacyDraft|null{
 const scope=localScope();if(!scope)return null;
 const result=legacyDraft(scope);
 return result.ok&&result.value&&!isExpired(result.value.updated)?result.value:null;
}
export async function loadDraftSnapshot(scope=localScope()):Promise<LoadResult>{
 if(!scope||!scopeOk(scope))return failure("scope",false);
 const db=await database();if(isFailure(db))return db;
 try{
  const current=await readKey(db,key(scope));
  if(!current.ok)return current;
  if(current.value!==undefined){
   if(isObject(current.value)&&current.value.schemaVersion===2&&
    current.value.deleted===true&&current.value.scope===scope)
    return {ok:true,source:"deleted",snapshot:null};
   const parsed=parseEnvelope(current.value,scope);
   if(!parsed.ok)return failure("invalid",false);
   if(isExpired(parsed.value.updatedAt))
    return {ok:true,source:"expired",snapshot:null};
   return {ok:true,source:"v2",snapshot:parsed.value};
  }
  const legacy=legacyDraft(scope);
  if(!legacy.ok)return legacy;
  if(!legacy.value)return {ok:true,source:"empty",snapshot:null};
  if(isExpired(legacy.value.updated))return {ok:true,source:"expired",snapshot:null};
  const previous=await readKey(db,scope);
  if(!previous.ok)return previous;
  let photos:StoredPhoto[]=[];
  if(previous.value!==undefined){
   if(!isObject(previous.value)||typeof previous.value.updated!=="number"||
    !Number.isSafeInteger(previous.value.updated)||
    previous.value.updated>legacy.value.updated+5*60*1000||
    isExpired(previous.value.updated)){
    // Retain both originals; never join stale/new photo and text revisions.
    return failure("invalid",false);
   }
   const checked=parsePhotos(previous.value.photos);
   if(!checked.ok)return failure("invalid",false);
   photos=checked.value;
  }
  const updatedAt=legacy.value.updated;
  const imported:DraftEnvelope={
   schemaVersion:2,draftId:crypto.randomUUID(),scope,revision:1,
   step:legacy.value.step,updatedAt,expiresAt:updatedAt+DRAFT_TTL_MS,
   draft:legacy.value.draft,photos
  };
  return {ok:true,source:"legacy",snapshot:imported};
 }finally{db.close();}
}
// One sequence for writes and clear, including failed transactions; scope is captured
// at invocation so a later Telegram account cannot receive an earlier snapshot.
let writes:Promise<unknown>=Promise.resolve();
function serialized<T>(work:()=>Promise<T>):Promise<T>{
 const next=writes.then(work,work);
 writes=next.then(()=>undefined,()=>undefined);
 return next;
}
export function saveDraftSnapshot(
 scope:string,draftId:string,revision:number,draft:RegistrationDraft,step:number,
 photos:PhotoItem[]
):Promise<SaveResult>{
 const checkedDraft=parseRegistrationDraft(draft);
 const manifest=photos.map(({id,file,preview})=>({id,file,preview}));
 const checkedPhotos=parsePhotos(manifest);
 if(!scopeOk(scope))return Promise.resolve(failure("scope",false));
 if(!checkedDraft.ok||!checkedPhotos.ok||!Number.isSafeInteger(revision)||
  revision<1||!Number.isInteger(step)||step<1||step>8||
  !draftId||draftId.length>128)return Promise.resolve(failure("invalid",false));
 const updatedAt=Date.now();
 const snapshot:DraftEnvelope={
  schemaVersion:2,draftId,scope,revision,step,updatedAt,
  expiresAt:updatedAt+DRAFT_TTL_MS,draft:checkedDraft.value,photos:checkedPhotos.value
 };
 return serialized(async()=>{
  if(!scopeOk(scope))return failure("scope",false);
  const db=await database();if(isFailure(db))return db;
  const outcome=await new Promise<SaveResult>(resolve=>{
   let done=false,conflict=false;
   const finish=(r:SaveResult)=>{if(done)return;done=true;resolve(r);};
   try{
    const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);
    const previous=store.get(key(scope));
    previous.onsuccess=()=>{
     const record:unknown=previous.result;
     if(isObject(record)&&record.schemaVersion===2&&
      typeof record.revision==="number"&&record.revision>=revision){
      conflict=true;tx.abort();return;
     }
     if(isObject(record)&&record.schemaVersion===2&&record.deleted!==true&&
      typeof record.updatedAt==="number"&&isExpired(record.updatedAt)){
      // Expired drafts are archived, not silently destroyed by fresh registration.
      store.put(record,key(scope)+":expired:"+String(record.updatedAt));
     }
     store.put(snapshot,key(scope));
    };
    tx.oncomplete=()=>finish({ok:true,revision});
    tx.onerror=()=>finish(failure(classify(tx.error)));
    tx.onabort=()=>finish(conflict?failure("conflict",true):failure(classify(tx.error)));
   }catch(e){finish(failure(classify(e)));}
  });
  if(!outcome.ok){db.close();return outcome;}
  // A committed transaction alone is not enough: verify the active revision.
  const verified=await readKey(db,key(scope));
  db.close();
  if(!verified.ok)return verified;
  if(!isObject(verified.value)||verified.value.revision!==revision||
   verified.value.draftId!==draftId||
   !Array.isArray(verified.value.photos)||
   verified.value.photos.length!==snapshot.photos.length)return failure("io");
  return outcome;
 });
}
export function clearDraftSnapshot(scope:string):Promise<SaveResult>{
 if(!scopeOk(scope))return Promise.resolve(failure("scope",false));
 return serialized(async()=>{
  if(!scopeOk(scope))return failure("scope",false);
  const db=await database();if(isFailure(db))return db;
  const result=await new Promise<SaveResult>(resolve=>{
   let done=false;
   const finish=(r:SaveResult)=>{if(done)return;done=true;resolve(r);};
   try{
    const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);
    // Tombstone prevents any retained legacy text from resurrecting this draft.
    store.put({schemaVersion:2,scope,deleted:true,updatedAt:Date.now()},key(scope));
    store.delete(scope); // User explicitly confirmed photo deletion.
    tx.oncomplete=()=>finish({ok:true,revision:0});
    tx.onerror=()=>finish(failure(classify(tx.error)));
    tx.onabort=()=>finish(failure("abort"));
   }catch(e){finish(failure(classify(e)));}
  });
  db.close();
  if(!result.ok)return result;
  try{localStorage.removeItem(PREFIX+scope);}
  catch(e){return failure(classify(e));}
  return result;
 });
}
