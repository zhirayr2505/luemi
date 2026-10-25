import assert from "node:assert/strict";
import test from "node:test";
import type {PrivateObjectStore} from "../src/rem05d-private.js";
import {probePrivateStorage,PrivateStorageProbeError} from "../src/private-storage-probe.js";
const namespace="ci_reg01k_disposable";
function inMemory(){
 const objects=new Map<string,Buffer>();
 const events:string[]=[];
 const store:PrivateObjectStore={
  put:async(key,bytes)=>{events.push("put");objects.set(key,Buffer.from(bytes));},
  get:async key=>{events.push("get");return objects.get(key)??null;},
  delete:async key=>{events.push("delete");objects.delete(key);}
 };
 return {store,events,objects};
}
test("REG01K: one synthetic private image round-trip and confirmed deletion",async()=>{
 const {store,events,objects}=inMemory();
 const result=await probePrivateStorage(store,namespace);
 assert.deepEqual(result,{status:"passed",bytes:result.bytes,objectCleaned:true});
 assert.ok(result.bytes>30);
 assert.deepEqual(events,["get","put","get","delete","get"]);
 assert.equal(objects.size,0,"synthetic object must never remain");
});
test("REG01K: reject any attempt to use real or unsanitized namespaces",async()=>{
 const {store,events}=inMemory();
 for(const bad of ["production","main","private","user_123","../ci_bad","ci_bad/path","ci_invalid?",""]){
  await assert.rejects(probePrivateStorage(store,bad),/invalid_private_probe_namespace/);
 }
 assert.equal(events.length,0);
});
test("REG01K: corrupt readback fails, still deletes and verifies synthetic object",async()=>{
 const {store,objects,events}=inMemory();
 const bad:PrivateObjectStore={...store,
  get:async key=>objects.get(key)?Buffer.from([0]):null};
 await assert.rejects(probePrivateStorage(bad,namespace),e=>{
  assert.ok(e instanceof PrivateStorageProbeError);
  assert.equal(e.code,"probe_failed_cleaned");
  assert.match(e.recoveryObjectKey,/^private\/ci_reg01k_disposable\//);
  return true;
 });
 assert.equal(objects.size,0);
 assert.ok(events.includes("delete"));
});
test("REG01K: timed-out PUT that did store data invokes compensating deletion",async()=>{
 const {store,objects}=inMemory();
 const faulty:PrivateObjectStore={...store,
  put:async(key,b)=>{await store.put(key,b);throw Error("secret redacted: simulated timeout");}};
 await assert.rejects(probePrivateStorage(faulty,namespace),e=>{
  assert.ok(e instanceof PrivateStorageProbeError);
  assert.equal(e.code,"probe_failed_cleaned");
  assert.doesNotMatch(e.message,/secret/);
  return true;
 });
 assert.equal(objects.size,0);
});
test("REG01K: storage delete failure is never falsely reported as success",async()=>{
 const {store,objects}=inMemory();
 const fail:PrivateObjectStore={...store,
  delete:async()=>{throw Error("private storage unavailable");}};
 await assert.rejects(probePrivateStorage(fail,namespace),e=>{
  assert.ok(e instanceof PrivateStorageProbeError);
  assert.equal(e.code,"cleanup_unconfirmed");
  assert.match(e.recoveryObjectKey,/^private\/ci_reg01k_disposable\//);
  return true;
 });
 assert.equal(objects.size,1,"requires manual cleanup; never claim success");
 objects.clear();
});
test("REG01K: missing object after upload fails closed even if delete succeeds",async()=>{
 const {store,objects}=inMemory();
 const fail:PrivateObjectStore={...store,get:async()=>null};
 await assert.rejects(probePrivateStorage(fail,namespace),e=>{
  assert.ok(e instanceof PrivateStorageProbeError);
  assert.equal(e.code,"probe_failed_cleaned");
  return true;
 });
 assert.equal(objects.size,0);
});
