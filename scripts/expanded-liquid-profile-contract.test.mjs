import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const card=read("apps/web/src/discovery/FeedCard.tsx");
const styles=read("apps/web/src/discovery/expanded-liquid-profile.css");
const home=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const flag=read("apps/web/src/ui/Flag.tsx");
const lang=read("apps/web/src/ui/Languages.ts");
test("expanded profile is the active photo blurred within the rounded card",()=>{
 assert.match(home,/import "\.\/photo-ambient-edition\.css";[\s\S]*?import "\.\/expanded-liquid-profile\.css";/);
 assert.match(card,/const activePhoto=person\.photos\[activePhotoIndex\]/);
 assert.match(card,/--profile-photo/);
 assert.match(card,/data-expanded=\{expanded\} style=\{detailPhotoStyle\}/);
 assert.match(styles,/\.moonstone-person-card::after\{[\s\S]*?background-image:var\(--profile-photo,none\)/);
 assert.match(styles,/filter:blur\(17px\) brightness\(\.68\)/);
 assert.match(styles,/\.moonstone-profile-drawer::after\{[\s\S]*?content:none/);
 assert.doesNotMatch(styles,/position:fixed|filter:blur\(70px\)|\.discovery-photo-ambient-current/);
});
test("header is pinned over scrolling detail, photo dots and old handle vanish",()=>{
 assert.match(card,/const paint=\(next:number\)=>/);
 assert.match(card,/--profile-info-y/);
 assert.match(card,/aria-label=\{expanded\?"Свернуть анкету":"Раскрыть анкету"\}/);
 assert.match(styles,/\.moonstone-compact-info::before\{[\s\S]*?opacity:calc\(1 - var\(--profile-p\)\)/);
 assert.match(styles,/\.moonstone-compact-info::after\{[\s\S]*?content:none/);
 assert.match(styles,/\.moonstone-profile-scroll\{[\s\S]*?padding:calc\(var\(--profile-detail-top,172px\) \+ 0px\)/);
 assert.match(styles,/\.moonstone-photo-indicator\{[\s\S]*?opacity:clamp\(0,calc\(1 - var\(--profile-p\) \* 3\),1\)/);
 assert.match(styles,/\.moonstone-profile-gesture-zone\{[\s\S]*?display:none/);
 assert.doesNotMatch(card,/moonstone-profile-gesture-zone"><span/);
});
test("pink quotation rule and seven low-saturation interest colors",()=>{
 assert.match(styles,/\.moonstone-about-quote::before\{[\s\S]*?background:linear-gradient\(180deg,#F4A2B4,#E96A86/);
 assert.match(card,/orderedInterests\.map\(\(id,index\)=>/);
 assert.match(card,/tone-"\+\(index%7\)/);
 const tones=[...styles.matchAll(/\.moonstone-interest-pill\.tone-(\d+)\{/g)].map(m=>Number(m[1]));
 assert.deepEqual(tones,[0,1,2,3,4,5,6]);
 assert.match(styles,/\.moonstone-interest-pill \.interest-chip\{[\s\S]*?background:var\(--interest-bg\)/);
 assert.match(styles,/box-shadow:inset 0 1px rgba\(255,255,255,\.07\)/);
});
test("all country/territory SVG flags are supported without native emoji",()=>{
 assert.match(card,/import \{Flag\} from "\.\.\/ui\/Flag";/);
 assert.match(card,/<Flag code=\{language\.flag\} size=\{26\}/);
 assert.doesNotMatch(card,/flagEmoji|String\.fromCodePoint/);
 assert.match(flag,/hatscripts\.github\.io\/circle-flags\/flags\//);
 assert.match(flag,/\.svg"/);
 assert.match(flag,/hosted\.has\(country\)/);
 assert.match(flag,/onError=\{\(\)=>setBroken\(true\)\}/);
 assert.match(flag,/Globe2/);
 assert.match(styles,/\.moonstone-language-flag \.round-flag\{[\s\S]*?border-radius:50%/);
 for(const code of ["am","ru","gb","ge","fr","de","us"]){
  assert.ok(existsSync("apps/web/public/assets/flags/"+code+".svg"),code);
 }
 assert.match(lang,/"id": "hy"[\s\S]*?"flag": "am"/);
});
test("gesture handling and action row are unchanged",()=>{
 assert.match(card,/onPointerDownCapture=\{down\} onPointerMoveCapture=\{move\} onPointerUpCapture=\{event=>finish\(event\)\}/);
 assert.match(card,/const scheduleFinger=\(value:number\)=>/);
 assert.match(card,/const settle=\(next:0\|1\)=>/);
 assert.match(card,/\{!preview&&<div className="moonstone-actions/);
 assert.match(styles,/@media\(prefers-reduced-transparency:reduce\)/);
});

test("expanded profile is one uninterrupted glass sheet with a thin pinned divider",()=>{
 assert.match(card,/<span className="moonstone-profile-divider" aria-hidden="true"\/>/);
 assert.match(styles,/\.moonstone-profile-divider\{[\s\S]*?height:1px/);
 assert.match(styles,/\.moonstone-profile-divider\{[\s\S]*?opacity:var\(--profile-p\)/);
 assert.match(styles,/\.moonstone-compact-info\{[\s\S]*?background:transparent;[\s\S]*?border:0;[\s\S]*?border-radius:0/);
 assert.match(styles,/\.moonstone-profile-drawer\{[\s\S]*?background:transparent;[\s\S]*?border:0/);
 assert.match(styles,/\.moonstone-profile-drawer::before,[\s\S]*?\.moonstone-profile-drawer::after\{[\s\S]*?content:none/);
 assert.match(styles,/\.moonstone-person-card::after\{[\s\S]*?opacity:var\(--profile-p\)/);
 assert.match(styles,/\.moonstone-profile-scroll\{[\s\S]*?inset:0/);
 assert.match(styles,/\.moonstone-compact-info::before\{[\s\S]*?backdrop-filter:none/);
 assert.doesNotMatch(styles,/rgba\(43,37,49,\.88\)/);
});

test("expanded header has no top black band or second glass block",()=>{
 assert.match(styles,/\.moonstone-person-card::after\{[\s\S]*?box-shadow:inset 0 0 0 999px rgba\(15,17,25,\.20\)/);
 assert.match(styles,/\.moonstone-compact-info::after\{[\s\S]*?content:none/);
 assert.match(styles,/\.moonstone-profile-drawer\{[\s\S]*?top:var\(--luemi-card-top\)/);
 assert.match(styles,/\.moonstone-profile-drawer\{[\s\S]*?padding:0/);
 assert.match(styles,/\.moonstone-profile-divider\{/);
 assert.match(card,/className="moonstone-profile-toggle"/);
 assert.doesNotMatch(styles,/rgba\(20,23,34,\.69\)/);
});
