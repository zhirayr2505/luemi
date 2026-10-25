// Site-wide source audit, not a screenshot substitute. Fail closed for
// duplicate CSS animation names, orphan native event listeners, and multiple
// writers to the white profile sheet. Run on EVERY pull request/main commit.
import {readFileSync,readdirSync} from "node:fs";
import {join,relative,resolve} from "node:path";
import assert from "node:assert/strict";

const root=resolve("apps/web/src");
const list=(dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 const p=join(dir,e.name);
 return e.isDirectory()?list(p):/\.(tsx?|css)$/.test(e.name)?[p]:[];
});
const paths=list(root);
const sources=new Map(paths.map(p=>[relative(root,p).replaceAll("\\","/"),readFileSync(p,"utf8")]));
const get=p=>{const s=sources.get(p);assert.ok(s,"missing audited file "+p);return s;};
assert.ok(paths.length>=75,"unexpectedly reduced motion/gesture audit scope");
const keyframes=new Map();
for(const [path,s] of sources){
 if(!path.endsWith(".css"))continue;
 for(const m of s.matchAll(/@keyframes\s+([\w-]+)/g)){
  const other=keyframes.get(m[1]);
  assert.equal(other,undefined,"duplicate CSS keyframes "+m[1]+" in "+other+" and "+path);
  keyframes.set(m[1],path);
 }
}
// Every native listener owner must carry a paired cleanup path. This is a
// static safety net, not a claim that the lifecycle test is redundant.
const listenerOwners=[];
for(const [path,s] of sources){
 const adds=(s.match(/\.addEventListener\s*\(/g)||[]).length;
 if(!adds)continue;
 const removes=(s.match(/\.removeEventListener\s*\(/g)||[]).length;
 assert.ok(removes>0,"orphan native event listener in "+path);
 listenerOwners.push({path,adds,removes});
}
const p=get("discovery/ProfileMaster.tsx");
const sheet=get("discovery/profile-sheet-motion.ts");
const css=get("discovery/profile-master.css");
assert.ok(p.includes('sheet.current.style.top=next.toFixed(2)+"px"'),"white sheet top must have one DOM writer");
assert.ok(!p.includes("sheetRunner")&&!p.includes("sheetIntent.current"),"old sheet runner must stay removed");
assert.ok(!p.includes("viewport.current.scrollTop="),"native outer sheet scroll must stay disabled");
assert.ok(!p.includes("sheet.current.style.transform="),"no second white sheet transform writer");
assert.ok(p.includes("new ProfileSheetMotion("),"new sheet controller required");
assert.ok(p.includes("new ResizeObserver(scheduleMeasure)")&&
 p.includes('window.addEventListener("resize",scheduleMeasure)')&&
 p.includes('webApp?.onEvent?.("viewportChanged",scheduleMeasure)'),
 "viewport events must coalesce to one frame");
assert.ok(p.includes("cancelAnimationFrame(queuedFrame)")&&p.includes("measureDead=true"),
 "queued viewport callback must be cancelled on unmount");
assert.ok(p.includes("photoSettleCleanup.current()")&&
 p.includes("window.clearTimeout(timer)")&&
 p.includes('track?.removeEventListener("transitionend",ended)'),
 "superseded hero photo transitions must unregister timers/listeners");
assert.ok(p.includes("performance.now()-started>=650"),
 "blur tracking must never poll indefinitely if CSS does not finish");
assert.ok(sheet.includes("private epoch=0")&&sheet.includes("token!==this.epoch"),
 "all stale profile RAF frames must be generation-guarded");
assert.ok(sheet.includes("this.caf(this.frame)")&&sheet.includes("this.destroyed=true"),
 "profile motion disposal must cancel active frames");
const selector=css.match(/\.pm-profile-sheet\s*\{([^}]*)\}/);
assert.ok(selector,"white sheet CSS selector missing");
assert.match(selector[1],/position:absolute/);
assert.match(selector[1],/transition:none/);
assert.doesNotMatch(selector[1],/animation\s*:/);
assert.ok(!css.includes(".pm-sheet-spacer{"),"obsolete nested native scroller spacer");
const authority=get("discovery/profile-motion.ts");
assert.ok(authority.includes("MOTION_PROPERTY_OWNERS[property]")&&authority.includes("conflicting motion writer"),
 "one motion-property authority required across profile/browse/tabs");
const lifecycle=get("ui/motion-lifecycle.ts");
assert.ok(lifecycle.includes('offEvent?.("deactivated",suspend)')&&
 lifecycle.includes('offEvent?.("activated",resume)'),
 "Telegram lifecycle handlers must be unregistered");
console.log("MOTION_AUDIT_PASS "+JSON.stringify({
 scannedFiles:paths.length,cssKeyframes:keyframes.size,nativeListenerOwners:listenerOwners.length,
 whiteSheet:"single absolute-top RAF",
 viewport:"one rebase per frame",
 photoTransitions:"tracked and cancelled",
 blurPolling:"bounded",
 lifecycle:"owned"
}));
