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


test("Moonstone ships one dark shell, not a dormant legacy light palette",()=>{
 const shell=read("apps/web/src/styles.css");
 assert.match(shell,/--bg:var\(--luemi-bg\)/,"base shell must use Moonstone tokens before route hydration");
 assert.doesNotMatch(shell,/--bg:\s*#|--ink:\s*#|--lavender:\s*#|--pink:\s*#/i,
  "hardcoded parallel light/dark palettes cannot re-enter the global shell");
 assert.doesNotMatch(shell,/@keyframes mist-one|@keyframes mist-two|@keyframes intro-glow/,
  "retired decorative animation loops must be physically removed");
 assert.doesNotMatch(shell,/\.luemi-shell\[data-theme=dark\]\s*\{/,
  "the old dark-theme override must not duplicate the Moonstone source of truth");
});
test("deleted registration language flow and artificial photo cropping stay deleted",()=>{
 const steps=read("apps/web/src/registration/Steps.tsx");
 const form=read("apps/web/src/registration/v2/RealRegistration.tsx");
 const focus=read("apps/web/src/registration/use-field-focus.ts");
 assert.equal(existsSync("apps/web/src/registration/LanguagePicker.tsx"),false,
  "retired language picker must not be left as dormant reachable JSX");
 assert.doesNotMatch(steps,/LanguagePicker|personalityPart/);
 assert.doesNotMatch(form,/personalityPart/);
 assert.doesNotMatch(focus,/language-focus-shell|language-results-max-height|flagsMutation/);
 for(const file of files){
  const css=read(file);
  assert.doesNotMatch(css,/\.language-(?:option|results|focus-shell|selected|picker)\b/,
   "dead language selection CSS in "+file);
  assert.doesNotMatch(css,/\.carousel-track\s+img:nth-child\(2\)/,
   "demo-only photo crop would distort real second photos in "+file);
 }
 const prototype=read("apps/web/src/discovery/profile-v3/rendering/ProfileMorphSurface.css");
 assert.match(prototype,/\.v3-sheet\{[^}]*background:var\(--luemi-surface,#2B3037\)/,
  "even isolated V3 previews must use Moonstone rather than white UI");
});


test("dead light/dark switch and center toolbar cannot reappear",()=>{
 const header=read("apps/web/src/discovery/GlobalHeader.tsx");
 const headerCss=read("apps/web/src/discovery/global-header.css");
 const visitor=read("apps/web/src/discovery/VisitorProfileRoute.tsx");
 const registration=read("apps/web/src/registration/v2/RealRegistration.tsx");
 assert.doesNotMatch(header,/onTheme|theme:"light"/);
 assert.doesNotMatch(headerCss,/\\.lh-tools|\\.lh-profile-theme|\\.lh-tool-/);
 assert.doesNotMatch(visitor,/onTheme|theme:\s*"light"/);
 assert.doesNotMatch(registration,/onTheme|p\\.theme/);
 assert.doesNotMatch(app,/ThemeChoice|changeTheme|theme=\\{theme\\}/);
 assert.equal(existsSync("scripts/theme-switch-mobile-qa.mjs"),false);
});

test("For You hero uses Moonstone at source without a competing light base",()=>{
 const css=read("apps/web/src/discovery/for-you.css");
 assert.match(css,/\.fy-hero\{[^}]*background:linear-gradient\(130deg,var\(--luemi-surface-raised\)/s);
 assert.match(css,/\.fy-hero-copy\{[^}]*color:var\(--luemi-text\)/s);
 assert.doesNotMatch(css,/\.luemi-shell\[data-theme=dark\] \.fy-hero(?:\{|::before|\s)/,
  "Do not resurrect the obsolete dark overlay for a white For You hero");
});
test("real account and private owner screens do not load the old white theme",()=>{
 const css=read("apps/web/src/registration/real-home.css");
 assert.match(css,/\.luemi-real-home\{[^}]*background:linear-gradient\(165deg,var\(--luemi-bg\),var\(--luemi-bg-deep\)\)/s);
 assert.match(css,/\.luemi-real-account\{[^}]*display:flex;flex-direction:column/s);
 assert.match(css,/\.luemi-private-card\{[^}]*background:var\(--luemi-surface\)/s);
 assert.match(css,/\.luemi-private-edit-bar>button\{[^}]*color:var\(--luemi-ink-on-accent\)/s);
 assert.doesNotMatch(css,/\.luemi-shell\[data-theme="dark"\] \.luemi-(?:private|real)/,
  "owner screen must not have a second competing dark-theme stylesheet");
 assert.doesNotMatch(css,/background:\s*#(?:fff(?:fff)?|fffbff|f6f5f9)\b/i,
  "old white account surfaces must be deleted, not covered");
});


test("retired registration controls leave no dormant CSS or old light backgrounds",()=>{
 const base=read("apps/web/src/styles.css");
 const runtime=read("apps/web/src/registration/v2/runtime.css");
 for(const [file,css] of [["styles.css",base],["registration/v2/runtime.css",runtime]]){
  assert.doesNotMatch(css,/\\.(?:optional-profile-(?:details|toggle|screen|screen-head|screen-body|screen-foot)|optional-field-row|optional-input-wrap|optional-choice-grid|optional-facts|scope-control|scope-options|geo-mode-toggle|geo-location-primary|geo-scope|photo-make-main|branded-slider|radius-control|age-caption)\\b/,
   "dead legacy registration selector: "+file);
  assert.doesNotMatch(css,/@keyframes luemi-details-(?:in|out)\\b/,
   "unmounted optional-profile transitions must not occupy the production bundle");
  assert.equal((css.match(/\\{/g)||[]).length,(css.match(/\\}/g)||[]).length,
   "balanced CSS blocks: "+file);
 }
 assert.match(base,/\\.double-age-range input\\[type=range\\]/,
  "active two-thumb age range must retain its styles");
 assert.match(base,/\\.photo-drag-handle\\{/,
  "active photo reorder handles must retain touch geometry");
 assert.match(runtime,/\\.v2-runtime \\.city-focus-shell \\.geo-results/,
  "working city autocomplete must keep its scroll and focus styling");
 assert.match(runtime,/\\.v2-runtime \\.geo-results button:active\\{/,
  "city search selection feedback must remain after deleting old scope selector");
});
