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
const forbiddenOld=/#(?:211725|1c1424|191322|302236|35283d|413249|574359|745777|ac87b3|d5a2c8|faf4fb|c7bacd|9e8fa7|1b2025|171b20|252b32|2b3037|363d45|3a4149|665f74|b6a4c8|d5c8dd|f2f3f5|b3b8c2|9098a4|190e18|24111f|2f1726|351827|482236|542a3d|a74864|df7377|f28b79|ffaa83|ce8495|fff5f2|dcc2c9|b99aa7)\b/i;
const hex=(id)=>{
 const m=styles.match(new RegExp("--"+id+":(#[0-9A-F]{6})","i"));
 assert.ok(m,"Badoo Purple token missing: "+id);
 return m[1];
};
function contrast(a,b){
 const rgb=v=>[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 const lum=v=>rgb(v).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
 const x=lum(a),y=lum(b);
 return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
test("Badoo Purple owns one deep violet/lilac palette",()=>{
 assert.equal(hex("luemi-bg").toUpperCase(),"#1E0F38");
 assert.equal(hex("luemi-bg-deep").toUpperCase(),"#160A2B");
 assert.equal(hex("luemi-surface").toUpperCase(),"#32165F");
 assert.equal(hex("luemi-glass").toUpperCase(),"#4C2787");
 assert.equal(hex("luemi-accent").toUpperCase(),"#6E3EFF");
 assert.equal(hex("luemi-lavender").toUpperCase(),"#BCA8F2");
 assert.equal(hex("luemi-rose").toUpperCase(),"#FFBBD0");
 assert.equal(hex("luemi-text").toUpperCase(),"#F8F5FF");
 assert.ok(contrast(hex("luemi-text"),hex("luemi-bg"))>=7,"primary text is accessible on Badoo Purple");
 assert.ok(contrast(hex("luemi-text-secondary"),hex("luemi-surface"))>=4.5,"subtle text is legible");
 assert.ok(contrast(hex("luemi-text"),hex("luemi-accent"))>=4.5,"accent CTA is legible");
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
 const hot=read("apps/web/src/discovery/moonstone-discovery.css");
 assert.match(hot,/\.discovery-app>\.discovery-bottom-nav/);
 assert.match(hot,/backdrop-filter:blur\(15px\) saturate\(115%\)/);
 assert.doesNotMatch(styles,/\.discovery-app \.discovery-(?:bottom-nav|top-tabs)/);
 assert.match(styles,/--luemi-glass-shine:radial-gradient/);
 assert.match(styles,/--moonstone-x/);
 assert.match(styles,/prefers-reduced-transparency:reduce/);
 assert.match(styles,/prefers-reduced-motion:reduce/);
 const lens=read("apps/web/src/ui/liquid-glass.css");
 const entry=read("apps/web/src/main.tsx");
 assert.match(entry,/import "\.\/ui\/luemi-v5\.css";[\s\S]*?import "\.\/ui\/liquid-glass\.css";/);
 assert.match(lens,/--lg-rim-light:rgba\(255,255,255,\.36\)/);
 assert.match(lens,/--lg-chroma-warm:rgba\(255,187,208,\.26\)/);
 assert.match(lens,/--lg-chroma-cool:rgba\(188,168,242,\.24\)/);
 assert.match(lens,/backdrop-filter:blur\(var\(--lg-blur\)\)/);
 assert.match(lens,/prefers-reduced-transparency:reduce/);
 assert.match(lens,/prefers-reduced-motion:reduce/);
 // Five complementary effects: blur/saturation, real SVG displacement when
 // supported, subtle chromatic rims, pointer-following specular and relief.
 assert.match(lens,/--lg-saturate:145%/);
 assert.match(lens,/filter:url\("\/assets\/glass\/liquid-refraction-v2\.svg/);
 assert.match(lens,/conic-gradient\(from 226deg/);
 assert.match(lens,/--lg-specular:rgba/);
 assert.match(lens,/--lg-relief:var\(--lg-shadow\),inset 0 1px 0 rgba/);
 assert.match(lens,/\.lg--card\{--lg-rim-depth:2px/);
 assert.match(lens,/\.lg--pill\{--lg-rim-depth:1\.5px/);
 assert.match(lens,/opacity:\.46/);
 assert.doesNotMatch(lens,/--lg-rim-depth:14px/);
 assert.doesNotMatch(lens,/border:var\(--lg-rim-width\) solid rgba\(255,255,255,\.63\)/);
 const svg=read("apps/web/public/assets/glass/liquid-refraction-v2.svg");
 assert.match(svg,/<feDisplacementMap/);
 assert.match(svg,/scale="8"/);
 assert.match(svg,/<feTurbulence/);
 const feature=read("apps/web/src/ui/moonstone-optics.ts");
 assert.match(feature,/root\.dataset\.lgOptics=/);
 assert.match(feature,/root\.dataset\.lgNativeRefraction=/);
 assert.match(lens,/data-lg-native-refraction="on"/);
 assert.match(feature,/\/Android\/i\.test\(userAgent\)/);
 assert.match(hot,/\.discovery-app\[data-profile-renderer=android\] \.moonstone-profile-drawer/);
 assert.match(hot,/backdrop-filter:none/);
 assert.match(hot,/\.moonstone-blur-photo\{/);
 assert.match(hot,/\.moonstone-like-button\{/);
 assert.doesNotMatch(hot,/blur\(23px\) saturate\(142%\)|blur\(12px\) saturate\(128%\)/);
 const optics=read("apps/web/src/ui/moonstone-optics.ts");
 assert.match(optics,/requestAnimationFrame/);
 assert.match(optics,/pointercancel/);
 assert.match(optics,/\.moonstone-profile-drawer/);
 assert.match(optics,/\.moonstone-like-button/);
 assert.match(optics,/\.moonstone-pass-button/);
 assert.doesNotMatch(optics,/setInterval\(/);
});
test("Telegram system chrome and entire app share same Badoo Purple theme",()=>{
 assert.match(app,/getComputedStyle\(document.documentElement\)/);
 assert.match(app,/getPropertyValue\("--luemi-bg"\)/);
 assert.match(app,/installMoonstoneOptics\(document\)/);
 assert.match(markup,/name="theme-color" content="#1E0F38"/);
 assert.match(app,/wordmark_original_raster_alpha_W06\.webp/);
 assert.ok(existsSync("apps/web/public/assets/brand/wordmark_original_raster_alpha_W06.webp"),
  "original LUEMI logo must remain unchanged and bundled");
});


test("Badoo Purple ships one dark shell, not a dormant legacy light palette",()=>{
 const shell=read("apps/web/src/styles.css");
 assert.match(shell,/--bg:var\(--luemi-bg\)/,"base shell must use Badoo Purple tokens before route hydration");
 assert.doesNotMatch(shell,/--bg:\s*#|--ink:\s*#|--lavender:\s*#|--pink:\s*#/i,
  "hardcoded parallel light/dark palettes cannot re-enter the global shell");
 assert.doesNotMatch(shell,/@keyframes mist-one|@keyframes mist-two|@keyframes intro-glow/,
  "retired decorative animation loops must be physically removed");
 assert.doesNotMatch(shell,/\.luemi-shell\[data-theme=dark\]\s*\{/,
  "the old dark-theme override must not duplicate the Badoo Purple source of truth");
});
test("square and landscape feed photos become one cached portrait bitmap",()=>{
 const adaptive=read("apps/web/src/discovery/adaptive-feed-photo.ts");
 const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
 const card=read("apps/web/src/discovery/FeedCard.tsx");
 assert.match(adaptive,/const OUTPUT_ASPECT=6\/13/);
 assert.match(adaptive,/needsAdaptiveFeedPhoto/);
 assert.match(adaptive,/context\.filter=`blur\(/);
 assert.match(adaptive,/sharp\.globalCompositeOperation="destination-in"/);
 assert.match(adaptive,/MAX_CACHE_ENTRIES=18/);
 assert.match(carousel,/adaptiveFullscreen/);
 assert.match(carousel,/URL\.revokeObjectURL/);
 assert.match(carousel,/const warmPhoto=/);
 assert.match(card,/gpuSafe onCoverReady=\{onCoverReady\} adaptiveFullscreen/);
 assert.doesNotMatch(adaptive,/requestAnimationFrame|setInterval/,
  "one-time photo preparation must not enter the gesture animation path");
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
 assert.match(prototype,/\.v3-sheet\{[^}]*background:var\(--luemi-surface,#32165F\)/,
  "even isolated V3 previews must use Badoo Purple rather than white UI");
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

test("For You hero uses Badoo Purple at source without a competing light base",()=>{
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
  assert.doesNotMatch(css,/\.(?:optional-profile-(?:details|toggle|screen|screen-head|screen-body|screen-foot)|optional-field-row|optional-input-wrap|optional-choice-grid|optional-facts|scope-control|scope-options|geo-mode-toggle|geo-location-primary|geo-scope|photo-make-main|branded-slider|radius-control|age-caption)(?![\w-])/,
   "dead legacy registration selector: "+file);
  assert.doesNotMatch(css,/@keyframes luemi-details-(?:in|out)\b/,
   "unmounted optional-profile transitions must not occupy the production bundle");
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,
   "balanced CSS blocks: "+file);
 }
 assert.match(base,/\.double-age-range input\[type=range\]/,
  "active two-thumb age range must retain its styles");
 assert.match(base,/\.photo-drag-handle\{/,
  "active photo reorder handles must retain touch geometry");
 assert.match(runtime,/\.v2-runtime \.city-focus-shell \.geo-results/,
  "working city autocomplete must keep its scroll and focus styling");
 assert.match(runtime,/\.v2-runtime \.geo-results button:active\{/,
  "city search selection feedback must remain after deleting old scope selector");
});
