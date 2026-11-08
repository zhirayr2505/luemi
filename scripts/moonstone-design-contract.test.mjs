import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync,existsSync} from "node:fs";
import {join} from "node:path";

const read=path=>readFileSync(path,"utf8");
const styles=read("apps/web/src/ui/luemi-v5.css");
const app=read("apps/web/src/App.tsx");
const markup=read("apps/web/index.html");
const dirs=["apps/web/src"];
function filesUnder(path){
 return readdirSync(path,{withFileTypes:true}).flatMap(entry=>{
  const item=join(path,entry.name);
  return entry.isDirectory()?filesUnder(item):entry.name.endsWith(".css")?[item]:[];
 });
}
const files=dirs.flatMap(filesUnder);
const forbiddenOld=/#(?:211725|1c1424|191322|302236|35283d|413249|574359|745777|ac87b3|d5a2c8|faf4fb|c7bacd|9e8fa7)\b/i;
const hex=(id)=>{
 const m=styles.match(new RegExp("--"+id+":(#[0-9A-F]{6})","i"));
 assert.ok(m,"Moonstone token missing: "+id);
 return m[1];
};
function contrast(a,b){
 const rgb=v=>[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 const lum=v=>rgb(v).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
 const x=lum(a),y=lum(b);
 return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
test("Moonstone V6 owns a single cool graphite/lavender palette",()=>{
 assert.equal(hex("luemi-bg").toUpperCase(),"#1B2025");
 assert.equal(hex("luemi-bg-deep").toUpperCase(),"#171B20");
 assert.equal(hex("luemi-surface").toUpperCase(),"#2B3037");
 assert.equal(hex("luemi-glass").toUpperCase(),"#3A4149");
 assert.equal(hex("luemi-lavender").toUpperCase(),"#B6A4C8");
 assert.equal(hex("luemi-rose").toUpperCase(),"#D5C8DD");
 assert.equal(hex("luemi-text").toUpperCase(),"#F2F3F5");
 assert.ok(contrast(hex("luemi-text"),hex("luemi-bg"))>=7,"primary text is accessible on Moonstone");
 assert.ok(contrast(hex("luemi-text-secondary"),hex("luemi-surface"))>=4.5,"subtle text is legible");
 assert.ok(contrast(hex("luemi-ink-on-accent"),hex("luemi-lavender"))>=4.5,"accent CTA is legible");
});
test("all rendered CSS is free of legacy V5 plum literals and malformed rgba",()=>{
 assert.ok(files.length>=22,"audit must include every style module");
 for(const path of files){
  const css=read(path);
  assert.doesNotMatch(css,forbiddenOld,"outdated V5 hardcoded brand color: "+path);
  assert.doesNotMatch(css,/rgba?\([^)]*,\s*,/i,"malformed RGBA literal: "+path);
  assert.doesNotMatch(css,/MOONSTONE_FALLBACK_\d+_END/,"unresolved replacement marker: "+path);
 }
});
test("true backdrop sampling is restricted to static chrome, moving profiles stay compositor-only",()=>{
 assert.match(styles,/\.discovery-app \.discovery-bottom-nav/);
 assert.match(styles,/backdrop-filter:blur\(15px\) saturate\(135%\)/);
 assert.match(styles,/--luemi-glass-shine:radial-gradient/);
 assert.match(styles,/--moonstone-x/);
 assert.match(styles,/prefers-reduced-transparency:reduce/);
 assert.match(styles,/prefers-reduced-motion:reduce/);
 const hot=read("apps/web/src/discovery/feed-v2.css");
 assert.doesNotMatch(hot,/backdrop-filter:\s*blur\(/,"no hot-path photos sampling on Android");
 const optics=read("apps/web/src/ui/moonstone-optics.ts");
 assert.match(optics,/requestAnimationFrame/);
 assert.match(optics,/pointercancel/);
 assert.doesNotMatch(optics,/setInterval\(/);
});
test("Telegram system chrome and entire app share same Moonstone theme",()=>{
 assert.match(app,/getComputedStyle\(document.documentElement\)/);
 assert.match(app,/getPropertyValue\("--luemi-bg"\)/);
 assert.match(app,/installMoonstoneOptics\(document\)/);
 assert.match(markup,/name="theme-color" content="#1B2025"/);
 assert.match(app,/wordmark_original_raster_alpha_W06\.webp/);
 assert.ok(existsSync("apps/web/public/assets/brand/wordmark_original_raster_alpha_W06.webp"),
  "original LUEMI logo must remain unchanged and bundled");
});
