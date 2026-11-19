import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const card=read("apps/web/src/discovery/FeedCard.tsx");
const styles=read("apps/web/src/discovery/card-deck-edition.css");
const ambient=read("apps/web/src/discovery/photo-ambient-edition.css");
const real=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
test("the real and QA feed use an inset rounded profile card, not a fullscreen photo",()=>{
 assert.match(real,/import "\.\/real-discovery-layout-repair\.css";[\s\S]*?import "\.\/card-deck-edition\.css";/);
 const start=card.indexOf('className="moonstone-person-card"');
 const photo=card.indexOf('className="moonstone-photo"',start);
 const summary=card.indexOf('className="moonstone-compact-info"',photo);
 const drawer=card.indexOf('className="moonstone-profile-drawer"',summary);
 const actions=card.indexOf('className="moonstone-actions moonstone-actions-vivid"',drawer);
 assert.ok(start>=0&&photo>start&&summary>photo&&drawer>summary&&actions>drawer);
 assert.match(styles,/--luemi-card-top:calc\(var\(--top-safe,0px\) \+ 99px\)/);
 assert.match(styles,/--luemi-card-bottom:calc\(var\(--moon-actions-bottom\) \+ var\(--moon-actions-height\) \+ 13px\)/);
 assert.match(styles,/\.moonstone-person-card\{[\s\S]*?border-radius:25px/);
 assert.match(styles,/\.moonstone-person-card \.moonstone-photo\{[\s\S]*?bottom:0/);
});
test("sharp photo fills the card without distortion, duplicated images or internal blur",()=>{
 assert.doesNotMatch(styles,/carousel-photo-bleed/);
 assert.match(ambient,/\.discovery-photo-ambient-next/);
 assert.match(styles,/\.feed-carousel-photo,[\s\S]*?\[data-photo-fit="full"\] \.feed-carousel-photo\{/);
 assert.match(ambient,/object-fit:cover;object-position:center center/);
 assert.match(styles,/-webkit-mask-image:none;mask-image:none/);
 assert.match(styles,/filter:none/);
 assert.match(styles,/\.moonstone-photo-shade\{[\s\S]*?box-shadow:none/);
 assert.doesNotMatch(styles,/filter:blur\(|backdrop-filter:blur\(/);
 assert.match(carousel,/const cyclic=loop&&photos\.length>1/);
});
test("footer information and five existing actions stay interactive and outside photo",()=>{
 assert.match(ambient,/\.moonstone-compact-info\{[\s\S]*?background:linear-gradient/);
 assert.match(styles,/\.moonstone-profile-drawer\{[\s\S]*?top:calc\(var\(--luemi-card-top\) \+ 1px\)/);
 assert.match(card,/onPointerDownCapture=\{down\} onPointerMoveCapture=\{move\}/);
 assert.match(card,/onAction\("undo"\)/);
 assert.match(card,/performAction\("pass"\)/);
 assert.match(card,/performAction\("special"\)/);
 assert.match(card,/onAction\("save"\)/);
 assert.match(card,/aria-label=\{expanded\?"Свернуть анкету":"Раскрыть анкету"\}/);
});
test("safe area sizing works for the Galaxy A55 and shorter screens",()=>{
 assert.match(styles,/@media\(max-height:710px\)/);
 assert.match(styles,/--luemi-card-footer-height:124px/);
 assert.match(styles,/@media\(max-height:560px\) and \(orientation:landscape\)/);
 assert.doesNotMatch(styles,/rgba\(110,62,255/);
});
