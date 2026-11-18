import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const real=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const fix=read("apps/web/src/discovery/real-discovery-layout-repair.css");
const base=read("apps/web/src/discovery/moonstone-discovery.css");
const nav=read("apps/web/src/ui/LuemiV5.tsx");
test("Vivid Matte repair loads after lazy Moonstone instead of only at entry",()=>{
 const old=real.indexOf('import "./moonstone-discovery.css";');
 const repair=real.indexOf('import "./real-discovery-layout-repair.css";');
 assert.ok(old>=0&&repair>old);
 assert.match(fix,/\.real-discovery-home\[data-feed-visible="true"\] \.discovery-top-tabs>button\.active\{/);
 assert.match(fix,/border-radius:999px/);
});
test("empty feed stays beneath header and above dock on fullscreen Android",()=>{
 assert.match(real,/className="real-discovery-empty"/);
 assert.match(real,/title="Пока нет анкет"/);
 assert.match(fix,/\.real-discovery-deck \.discovery-deck-layer>\.real-discovery-empty\{/);
 assert.match(fix,/top:calc\(var\(--top-safe,0px\) \+ 105px\)/);
 assert.match(fix,/bottom:calc\(var\(--bottom-safe,0px\) \+ 102px\)/);
 assert.match(fix,/justify-content:center/);
 assert.match(fix,/\.lh-header \.lh-island::before/);
});
test("labels and active rose are not overridden by old purple nav",()=>{
 assert.match(base,/\.discovery-nav-item span\{display:none\}/);
 assert.match(fix,/\.discovery-bottom-nav \.discovery-nav-item span\{[\s\S]*?display:block/);
 assert.match(fix,/\.discovery-bottom-nav \.discovery-nav-item\.active\{[\s\S]*?background:#B84261/);
 assert.match(nav,/\{item\.label\}/);
});
test("private preview stays server-verified and cannot leak into real feed",()=>{
 assert.match(real,/setQaAllowed\(result\?\.allowed===true\)/);
 assert.match(real,/demoMode&&qaAllowed\?<DemoFeedSandbox/);
 assert.match(real,/onTryDemo=\{\(\)=>\{if\(qaAllowed\)setDemoMode\(true\)/);
});
