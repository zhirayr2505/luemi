import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const code=name=>readFileSync(new URL("../apps/web/src/discovery/"+name,import.meta.url),"utf8");
const compile=src=>ts.transpileModule(src,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX
}}).outputText;
const asUri=s=>"data:text/javascript;base64,"+Buffer.from(s).toString("base64");
const stateUri=asUri(compile(code("photo-viewer-state.ts")));
const state=await import(stateUri);
const readinessCode=compile(code("photo-readiness.ts")).replace(
 /from ["']\.\/photo-viewer-state["']/,"from "+JSON.stringify(stateUri));
const media=await import(asUri(readinessCode));
const a={id:"A",src:"a.png",status:"published",addedAt:"2026-01-02"},
 b={id:"B",src:"b.png",status:"published",addedAt:"2026-02-03"},
 c={id:"C",src:"c.png",status:"published",addedAt:"2026-03-04"};
const photos=[a,b,c];
assert.equal(state.photoIndex(photos,"B"),1);
assert.equal(state.reconcilePhotoId("B",photos.map(p=>p.id),[c,b,a]),"B");
assert.equal(state.reconcilePhotoId("B",photos.map(p=>p.id),[a,c]),"C");
assert.equal(state.reconcilePhotoId("C",photos.map(p=>p.id),[a,b]),"B");
assert.equal(state.reconcilePhotoId("A",photos.map(p=>p.id),[]),null);
assert.equal(state.requestNavigation("B",photos,{direction:1}),"C");
assert.equal(state.requestNavigation("B",photos,{direction:-1}),"A");
assert.equal(state.requestNavigation("B",photos,{photoId:"C"}),"C");
assert.equal(state.requestNavigation("A",photos,{direction:-1}),null);
assert.equal(state.requestNavigation("B",photos,{photoId:"foreign"}),null);
assert.notEqual(state.resourceIdentity(b),state.resourceIdentity({...b,version:"v2"}));
assert.notEqual(state.resourceIdentity(b),state.resourceIdentity({...b,src:"other.png"}));
const el={isConnected:true,dataset:{photoId:"B"}};
const source={photoId:"B",contextId:"profile-1",resourceKey:state.resourceIdentity(b),resolveElement:()=>el};
assert.equal(state.sourceMatches(source,"B","profile-1",state.resourceIdentity(b)),true);
assert.equal(state.sourceMatches(source,"A","profile-1",state.resourceIdentity(a)),false);
assert.equal(state.sourceMatches(source,"B","profile-2",state.resourceIdentity(b)),false);
assert.equal(state.sourceMatches(source,"B","profile-1",state.resourceIdentity({...b,src:"changed"})),false);
el.dataset.photoId="A";assert.equal(state.sourceMatches(source,"B","profile-1",state.resourceIdentity(b)),false);
console.log("REM03A_UNIT_PASS photoId identity, reorder/removal, resource version, source binding and navigation");

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const instances=[];
class FakeImage{
 onload=null;onerror=null;_src="";naturalWidth=0;naturalHeight=0;
 constructor(){instances.push(this);}
 set src(v){
  this._src=v;
  if(!v)return;
  queueMicrotask(()=>{
   if(!this._src)return;
   if(v.includes("broken")){this.onerror?.(new Error("failed"));return;}
   this.naturalWidth=v.includes("zero")?0:720;
   this.naturalHeight=v.includes("zero")?0:960;
   this.onload?.();
  });
 }
 get src(){return this._src;}
 removeAttribute(name){if(name==="src")this._src="";}
 decode(){return this._src.includes("reject-decode")?Promise.reject(Error("decode failed")):Promise.resolve();}
}
let signals=0;
const cache=new media.PhotoReadiness(()=>signals++,()=>new FakeImage());
cache.updateWindow(photos,"B");
assert.equal(cache.size(),3,"only previous/current/next");
await tick();await tick();
assert.equal(cache.read(b).phase,"ready");
assert.equal(cache.read(b).width,720);
cache.updateWindow([a,b,c,{id:"D",src:"d.png",status:"published"}],"D");
assert.equal(cache.size(),2,"release outside current/neighbor window");
assert.equal(cache.read(a),null);
const oldSignal=signals;
cache.updateWindow([a,b,c],"A");
cache.updateWindow([a,b,c],"C");
await tick();await tick();
assert.equal(cache.read(a),null);
assert.ok(signals>=oldSignal);
const fall={id:"fallback",src:"broken-primary",fallback:"good-fallback",status:"published"};
cache.updateWindow([fall],"fallback");
await tick();await tick();await tick();
assert.equal(cache.read(fall).phase,"ready");
assert.equal(cache.read(fall).fallback,true);
assert.equal(cache.read(fall).src,"good-fallback");
const no={id:"error",src:"broken-no-fallback",status:"published"};
cache.updateWindow([no],"error");await tick();await tick();
assert.equal(cache.read(no).phase,"error");
assert.equal(cache.retry(no),true);await tick();await tick();
assert.equal(cache.read(no).phase,"error","manual retry never loops");
const badDecode={id:"bad",src:"reject-decode",status:"published"};
cache.updateWindow([badDecode],"bad");await tick();await tick();
assert.equal(cache.read(badDecode).phase,"error","decode reject is not ready");
const zero={id:"zero",src:"zero-size",status:"published"};
cache.updateWindow([zero],"zero");await tick();await tick();
assert.equal(cache.read(zero).phase,"error","positive decoded dimensions required");
const real={id:"real",src:"good-pixels",fallback:"broken-fallback",status:"published"};
cache.updateWindow([real],"real");await tick();await tick();
cache.reportDisplayFailure(real,"dom-decode-failed");await tick();await tick();
assert.equal(cache.read(real).phase,"error","displayed DOM decode failure cannot be called ready");
const count=signals;
cache.dispose();cache.dispose();await tick();
assert.equal(signals,count,"stale decode after dispose cannot publish");
assert.equal(cache.size(),0);
assert.ok(instances.every(img=>!img.onload&&!img.onerror),"all abandoned Image listeners released");
console.log("REM03A_UNIT_PASS bounded load/decode, positive dimensions, fallback once, retry, DOM gate and disposal");
