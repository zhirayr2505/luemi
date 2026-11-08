import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const feed=read("apps/web/src/discovery/FeedCard.tsx");
const css=read("apps/web/src/discovery/feed-v2.css");
const oldGlass=read("apps/web/src/discovery/feed-glass-v1.css");
const header=read("apps/web/src/discovery/GlobalHeader.tsx");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
const real=read("apps/web/src/discovery/RealDiscoveryHome.tsx");

test("Moonstone feed keeps the original registration raster, rendered white on the left",()=>{
 assert.match(header,/wordmark_original_raster_alpha_W06\\.webp/);
 assert.match(oldGlass,/\\.lh-browse \\.lh-island img\\{filter:brightness\\(0\\) invert\\(1\\)\\}/);
 assert.match(oldGlass,/\\.lh-browse \\.lh-browse-controls\\{top:var\\(--brand-top\\)/);
 assert.ok(header.indexOf('onClick={onFilters}')<header.indexOf('onClick={onSaved}'),
  "filters must precede notifications on the right");
 assert.doesNotMatch(oldGlass,/\\.discovery-app \\.feed-v2-glass/);
});

test("feed card is a centered, parallel deck with original photo carousel",()=>{
 assert.match(feed,/<PhotoCarousel ref=\\{photo\\}/);
 assert.match(css,/\\.discovery-deck-stage::before/);
 assert.match(css,/\\.discovery-deck-stage::after/);
 assert.match(css,/\\.deck-queued\\{inset:9px 5px 17px/);
 assert.match(css,/object-fit:cover/);
 assert.doesNotMatch(css,/skew\\(|perspective\\(/);
});

test("actions remain reject / centered heart / special, with direction-matched exits",()=>{
 const pass=feed.indexOf('["pass","Пропустить",X]');
 const like=feed.indexOf('["like","Нравится",Heart]');
 const star=feed.indexOf('["special","Особенная симпатия",Star]');
 assert.ok(pass>0&&like>pass&&star>like);
 assert.match(css,/\\.discovery-action\\.discovery-like\\{--diameter:clamp\\(68px,19vw,78px\\)/);
 assert.match(css,/@keyframes feed-v2-pass\\{to\\{transform:translate3d\\(-115%/);
 assert.match(css,/@keyframes feed-v2-like\\{to\\{transform:translate3d\\(115%/);
 assert.match(css,/@keyframes feed-v2-special\\{to\\{transform:translate3d\\(0,-115%/);
 assert.match(real,/feed-v2-pass/);
 assert.match(feed,/onClick=\\{\\(\\)=>onAction\\(kind\\)\\}/);
});

test("only selected photo changes the soft ambient lighting, not the app palette",()=>{
 assert.match(feed,/ambientPhoto=person\\.photos\\[activePhotoIndex\\]/);
 assert.match(feed,/className="feed-v2-photo-ambient"/);
 assert.match(feed,/onIndexChange=\\{setActivePhotoIndex\\}/);
 assert.match(carousel,/onIndexChange\\?\\.\\(target\\)/);
 assert.match(carousel,/onIndexChange\\?\\.\\(i\\)/);
 assert.match(css,/\\.feed-v2-photo-ambient img\\{/);
 assert.match(css,/filter:blur\\(24px\\)/);
 assert.match(css,/mask-image:radial-gradient/);
 assert.doesNotMatch(css,/#[0-9a-fA-F]{6}[^;]*glow/);
});

test("biography, goal and interests stay semantic and legible on the glass",()=>{
 assert.match(feed,/className="feed-v2-about"/);
 assert.match(feed,/О СЕБЕ/);
 assert.match(feed,/person\\.interests\\.length-2/);
 assert.ok(feed.indexOf('className="feed-v2-about"')<feed.indexOf('className="feed-v2-interests"'));
 assert.match(css,/font-family:Inter,ui-sans-serif,system-ui/);
 assert.match(css,/\\.discovery-app \\.feed-v2-glass/);
});

test("existing gesture RAF stays compositor-only, no live blur on moving photo cards",()=>{
 const begin=feed.indexOf(" const paint=(value:number)=>{");
 const end=feed.indexOf("\\n const flushFinger=",begin);
 assert.ok(begin>0&&end>begin);
 const paint=feed.slice(begin,end);
 assert.match(paint,/style\\.transform=/);
 assert.match(paint,/style\\.opacity=/);
 assert.doesNotMatch(paint,/style\\.(?:height|width|top|bottom|left|right)=/);
 assert.doesNotMatch(paint,/getComputedStyle|offsetWidth|clientHeight|scrollHeight|backdropFilter/);
 assert.match(feed,/ResizeObserver/);
 assert.doesNotMatch(css,/backdrop-filter:blur\\(/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/prefers-reduced-transparency:reduce/);
 assert.doesNotMatch(oldGlass,/\\.discovery-app \\.feed-v2-card/);
});
