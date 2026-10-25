/** REG01K: one synthetic PNG round trip, operator-only. Never pass real photos.
 * A successful REST response is not enough: require exact bytes then verify
 * external deletion, including after any unexpected intermediate failure. */
import {randomBytes,randomUUID} from "node:crypto";
import type {PrivateObjectStore} from "./rem05d-private.js";
import {makeSyntheticPng} from "./rem05d-image.js";

const NS=/^[a-z0-9:_-]{1,96}$/i;
export type PrivateStorageProbeResult={
 status:"passed";bytes:number;objectCleaned:true;
};
export class PrivateStorageProbeError extends Error{
 constructor(
  public readonly code:"probe_failed_cleaned"|"cleanup_unconfirmed",
  /** Synthetic path only. An operator can recover an incomplete cleanup. */
  public readonly recoveryObjectKey:string
 ){
  super(code);this.name="PrivateStorageProbeError";
 }
}
export type PublicExposureCheck=(key:string)=>Promise<"denied"|"accessible">;
export async function probePrivateStorage(
 store:PrivateObjectStore,namespace:string,checkPublic:PublicExposureCheck
):Promise<PrivateStorageProbeResult>{
 if(typeof checkPublic!=="function"||!NS.test(namespace)||!namespace.startsWith("ci_"))
  throw new Error("invalid_private_probe_namespace");
 // Entirely random synthetic owner, upload and opaque hash. The probe NEVER
 // queries or reuses existing LUEMI user IDs or existing private media paths.
 const key="private/"+namespace+"/"+randomUUID()+"/"+randomUUID()+"/"+
   randomBytes(24).toString("hex")+"/sanitized";
 const png=makeSyntheticPng(2,2);
 let removedAndChecked=false;
 const clean=async()=>{
  await store.delete(key);
  if(await store.get(key)!==null)throw new Error("private_storage_cleanup_unconfirmed");
  removedAndChecked=true;
 };
 try{
  if(await store.get(key)!==null)throw new Error("private_storage_collision");
  await store.put(key,png);
  // Private bucket status alone is insufficient: an unauthenticated public
  // download of THIS synthetic object must be explicitly denied.
  if(await checkPublic(key)!=="denied")
   throw new Error("private_storage_publicly_readable");
  const fetched=await store.get(key);
  if(!fetched||!fetched.equals(png))throw new Error("private_storage_readback_mismatch");
  await clean();
  return{status:"passed",bytes:png.length,objectCleaned:true};
 }catch{
  if(!removedAndChecked){
   try{await clean();}catch{/* never report success if remote deletion is uncertain */}
  }
  throw new PrivateStorageProbeError(
   removedAndChecked?"probe_failed_cleaned":"cleanup_unconfirmed",key
  );
 }
}
