import test from "node:test";
import assert from "node:assert/strict";
import {RegistrationMediaSync} from "../../web/src/registration/background-photo-sync.ts";
import type {PhotoItem} from "../../web/src/registration/PhotoSorter.tsx";

const make=(id:string):PhotoItem=>({id,src:"",file:{} as File,status:"ready"});
const ids=["11111111-1111-4111-8111-111111111111",
 "22222222-2222-4222-8222-222222222222",
 "33333333-3333-4333-8333-333333333333"];
const digest=async(id:string)=>"hash-"+id;
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));

test("photo background sync never uploads before consent and preserves real order",async()=>{
 let selected=ids.map(make),prepared=0;
 const assets=new Map<string,{id:string;state:string;clientDigest:string|null}>();
 const events:string[]=[],errors:string[]=[];
 const sync=new RegistrationMediaSync({
  getPhotos:()=>selected,ensureDraft:async()=>{prepared++;},
  upload:async photo=>{events.push("uploaded:"+photo.id);const asset="asset-"+photo.id;
   assets.set(asset,{id:asset,state:"approved",clientDigest:await digest(photo.id)});
   return asset;},
  remove:async asset=>{events.push("deleted:"+asset);assets.delete(asset);},
  manifest:async()=>[...assets.values()],digest,
  order:async order=>{events.push("ordered:"+order.join(","));},
  onState:(id,state)=>events.push(state+":"+id),
  onError:error=>errors.push(error)
 });
 sync.schedule();await sync.idle();
 assert.equal(assets.size,0,"no consent means no upload");
 sync.setAllowed(true);sync.schedule();await sync.idle();
 assert.equal(assets.size,3);
 assert.equal(prepared,1,"consented server draft saved once");
 assert.deepEqual(await sync.flush(),ids.map(x=>"asset-"+x));
 assert.equal(errors.length,0);
 selected=[selected[2],selected[0],selected[1]];
 sync.syncOrder();await sync.idle();
 assert(events.some(x=>x==="ordered:"+[ids[2],ids[0],ids[1]].map(x=>"asset-"+x).join(",")));
});

test("removing a photo mid-upload deletes server bytes after receipt even when consent toggles off",async()=>{
 const photos=ids.map(make);
 let selected=[...photos],finish:((id:string)=>void)|undefined;
 const assets=new Map<string,{id:string;state:string;clientDigest:string|null}>();
 const deleted:string[]=[];
 const sync=new RegistrationMediaSync({
  getPhotos:()=>selected,ensureDraft:async()=>{},
  upload:photo=>new Promise(resolve=>{
   const asset="asset-"+photo.id;
   assets.set(asset,{id:asset,state:"approved",clientDigest:"hash-"+photo.id});
   finish=()=>resolve(asset);
  }),
  remove:async asset=>{deleted.push(asset);assets.delete(asset);},
  manifest:async()=>[...assets.values()],digest,
  order:async()=>{},onState:()=>{},onError:()=>{}
 });
 sync.setAllowed(true);sync.schedule();
 await tick();
 assert.ok(finish,"first upload running");
 selected=selected.slice(1);
 sync.removePhoto(ids[0]);sync.setAllowed(false);
 finish!("done");
 await sync.idle();
 assert(deleted.includes("asset-"+ids[0]));
 assert(!assets.has("asset-"+ids[0]));
});

test("new browser session adopts existing uploaded receipts and removes stale unselected images before publishing",async()=>{
 let selected=ids.map(make),uploads=0;
 const assets=new Map<string,{id:string;state:string;clientDigest:string|null}>();
 for(const id of ids)assets.set("asset-"+id,
  {id:"asset-"+id,state:"approved",clientDigest:"hash-"+id});
 assets.set("orphan",{id:"orphan",state:"approved",clientDigest:"old-photo"});
 const removed:string[]=[],ordered:string[][]=[];
 const sync=new RegistrationMediaSync({
  getPhotos:()=>selected,ensureDraft:async()=>{},
  upload:async photo=>{uploads++;return "asset-"+photo.id;},
  remove:async id=>{removed.push(id);assets.delete(id);},
  manifest:async()=>[...assets.values()],digest,
  order:async ids=>{ordered.push([...ids]);},onState:()=>{},onError:()=>{}
 });
 sync.setAllowed(true);
 const receipt=await sync.flush();
 assert.deepEqual(receipt,ids.map(id=>"asset-"+id));
 assert.equal(uploads,0,"no duplicate blobs after a browser restart");
 assert.deepEqual(removed,["orphan"]);
 assert.deepEqual(ordered[0],receipt);
 assert.equal(assets.size,3);
});