import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const feed=read("apps/web/src/discovery/FeedCard.tsx");
const css=read("apps/web/src/discovery/feed-v2.css");
const oldGlass=read("apps/web/src/discovery/feed-glass-v1.css");
const header=read("apps/web/src/discovery/GlobalHeader.tsx");

test("approved B card renders original logo and cinematic portrait, never a copied wordmark",()=>{
 assert.match(header,/wordmark_original_raster_alpha_W06\.webp/);
 assert.match(feed,/<PhotoCarousel ref=\{photo\}/);
 assert.match(css,/\.feed-v2-card::after/);
 assert.match(css,/object-fit:cover/);
 assert.doesNotMatch(oldGlass,/Cinematic photo card, with an inset rounded rectangular glass sheet/);
 assert.doesNotMatch(oldGlass,/\.discovery-app \.feed-v2-glass/);
});

test("buttons follow the approved 01 sequence: reject, centered heart, special star",()=>{
 const pass=feed.indexOf('["pass","Пропустить",X]');
 const like=feed.indexOf('["like","Нравится",Heart]');
 const star=feed.indexOf('["special","Особенная симпатия",Star]');
 assert.ok(pass>0&&like>pass&&star>like);
 assert.match(css,/\.discovery-action\.discovery-like\{--diameter:clamp\(72px,20vw,82px\)/);
 assert.match(feed,/onClick=\{\(\)=>onAction\(kind\)\}/);
});

test("approved 03 editorial bio retains semantic labels and readable interests",()=>{
 assert.match(feed,/className="feed-v2-about"/);
 assert.match(feed,/О СЕБЕ/);
 assert.match(css,/border-left:2px solid rgba\(220,145,224,.9\)/);
 assert.match(css,/font-family:Georgia,"Times New Roman",serif;font-style:italic/);
 assert.ok(feed.indexOf('className="feed-v2-about"')<feed.indexOf('className="feed-v2-interests"'));
 assert.match(feed,/person\.interests\.length-2/);
});

test("pointer RAF paints only composited transform and opacity, not changing layout geometry",()=>{
 const begin=feed.indexOf(" const paint=(value:number)=>{");
 const end=feed.indexOf("\n const flushFinger=",begin);
 assert.ok(begin>0&&end>begin);
 const paint=feed.slice(begin,end);
 assert.match(paint,/style\.transform=/);
 assert.match(paint,/style\.opacity=/);
 assert.doesNotMatch(paint,/style\.(?:height|width|top|bottom|left|right)=/);
 assert.doesNotMatch(paint,/getComputedStyle|offsetWidth|clientHeight|scrollHeight|backdropFilter/);
 assert.match(feed,/ResizeObserver/);
 assert.doesNotMatch(css,/backdrop-filter:blur\(/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test("legacy overrides are removed instead of being layered behind new CSS",()=>{
 assert.doesNotMatch(oldGlass,/\.discovery-app \.feed-v2-card/);
 assert.doesNotMatch(oldGlass,/\.discovery-app \.feed-v2 \.discovery-action/);
 assert.match(css,/\.feed-v2-meta-row/);
 assert.match(feed,/canUndo&&<button/);
 assert.match(feed,/real\?<button type="button"/);
 assert.match(feed,/onOpenProfile/);
});
