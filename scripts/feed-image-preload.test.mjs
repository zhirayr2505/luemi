/** V11.1 · preloader must wait for decode even for synchronous browser cache hits.
 * Uses a deterministic fake Image: no web access, GPU heuristics or timing guesses. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("../apps/web/src/discovery/feed-image-preload.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const waiting=new Map(),counts=new Map();
globalThis.window={location:{href:"https://luemi.test/"},setTimeout,clearTimeout};
globalThis.Image=class MockImage {
 complete=false;
 naturalWidth=0;
 onload=null;
 onerror=null;
 set src(url){
  this.url=url;
  this.complete=true;
  this.naturalWidth=720;
  queueMicrotask(()=>this.onload?.());
 }
 decode(){
  counts.set(this.url,(counts.get(this.url)??0)+1);
  return new Promise((resolve,reject)=>waiting.set(this.url,{resolve,reject}));
 }
};
const {preloadFeedImage,isFeedImageDecoded}=await import(
 "data:text/javascript;base64,"+Buffer.from(compiled).toString("base64")
);
async function nextDecode(url) {
 for(let i=0;i<15&&!waiting.has(url);i++)await Promise.resolve();
 assert(waiting.has(url),"image decode began for "+url);
 return waiting.get(url);
}
const url="https://luemi.test/already-cached.jpg";
let settled=false;
const pending=preloadFeedImage(url).then(value=>{settled=true;return value;});
const first=await nextDecode(url);
assert.equal(settled,false,"complete=true is not sufficient to mark a photo ready");
assert.equal(isFeedImageDecoded(url),false,"not ready before decode completes");
assert.equal(counts.get(url),1,"sync complete + later onload must not double-decode");
first.resolve();
assert.equal(await pending,true,"successful decode completes preloading");
assert.equal(isFeedImageDecoded(url),true,"decoded source enters bounded ready cache");
assert.equal(await preloadFeedImage(url),true,"subsequent cache hits reuse decoded readiness");
assert.equal(counts.get(url),1,"decoded image is not decoded twice");

const bad="https://luemi.test/decode-failed.jpg";
const rejected=preloadFeedImage(bad);
const second=await nextDecode(bad);
second.reject(new Error("decode failed"));
assert.equal(await rejected,false,"failed decode cannot claim readiness");
assert.equal(isFeedImageDecoded(bad),false,"failed image never poisons decoded cache");
console.log("FEED_V11_PRELOAD_PASS cached decode gate, no duplicate decoding, rejection safe");
