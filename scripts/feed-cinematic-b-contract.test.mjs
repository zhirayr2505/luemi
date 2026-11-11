import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const card=read("apps/web/src/discovery/FeedCard.tsx");
const css=read("apps/web/src/discovery/moonstone-discovery.css");
const haptic=read("apps/web/src/ui/haptic.ts");
const header=read("apps/web/src/discovery/GlobalHeader.tsx");
const real=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");

test("Moonstone Discovery uses the original centered wordmark and no header tool buttons",()=>{
 assert.match(header,/wordmark_original_raster_alpha_W06\.webp/);
 assert.doesNotMatch(header,/Bell|SlidersHorizontal|lh-browse-controls/);
 assert.match(css,/\.discovery-app\[data-feed-visible="true"\] \.lh-center\{[^}]*left:50%/);
});

test("photo is one fullscreen carousel beneath all chrome",()=>{
 assert.match(card,/className="moonstone-photo"/);
 assert.match(card,/gpuSafe onCoverReady=\{onCoverReady\}/);
 assert.match(css,/\.moonstone-photo,\.moonstone-photo>\.carousel-frame\{position:absolute;inset:0/);
 assert.match(css,/object-fit:cover/);
 assert.match(real,/visibleRows\.slice\(page,page\+2\)/);
 // Queued cards load only the cover; active cards may also warm the next photo.
 assert.match(carousel,/src=\{!gpuSafe\|\|i===0\|\|\(i===1&&prioritize\)\?p\.src:undefined\}/);
 // A user-requested gallery image must still load on demand.
 assert.match(carousel,/if\(gpuSafe&&!image\.getAttribute\("src"\)\)image\.src=photos\[i\]\.src/);
});

test("compact state contains only indicator, identity, location and goal",()=>{
 const compact=card.slice(card.indexOf('className="moonstone-compact-info"'),card.indexOf('className="moonstone-profile-drawer"'));
 assert.match(compact,/moonstone-photo-indicator/);
 assert.match(compact,/moonstone-name/);
 assert.match(compact,/moonstone-location/);
 assert.match(compact,/moonstone-goal/);
 assert.doesNotMatch(compact,/О себе|Интересы|Языки/);
});

test("one progress drives overlay copy stages, prepared blur and dim without React pointer renders",()=>{
 assert.match(card,/--profile-p/);
 assert.match(card,/scheduleFinger\(current\.startProgress-dy\/travel\.current\)/);
 assert.match(css,/opacity:calc\(var\(--profile-p\) \* \.96\)/);
 assert.match(css,/opacity:var\(--profile-p\)/);
 assert.match(css,/calc\(\(1 - var\(--profile-p\)\) \* 38px\)/);
 assert.match(card,/--profile-about-p/);
 assert.match(card,/--profile-interests-p/);
 assert.match(css,/border:0;border-radius:0/);
 assert.doesNotMatch(card,/setProgress\(/);
});

test("tap likes and 72 percent right drag superlikes through one control",()=>{
 assert.match(card,/raw>=\.72/);
 assert.match(card,/current\.max\*\.48&&speed>\.72/);
 assert.match(card,/commit\("like"\)/);
 assert.match(card,/commit\("special"\)/);
 assert.match(card,/setPointerCapture/);
 assert.match(card,/--like-slide-p/);
 assert.doesNotMatch(card,/hapticStep=raw>=/);
 assert.match(card,/if\(armed\)impactHaptic\("medium"\)/);
 assert.match(card,/impactHaptic\("medium"\)/);
 assert.match(card,/impactHaptic\("heavy"\)/);
 assert.match(haptic,/impactOccurred/);
 assert.match(css,/--like-scale:calc\(1 \+ var\(--like-slide-p\) \* \.052\)/);
 assert.match(css,/@keyframes moonstone-button-star-burst/);
 assert.match(card,/moonstone-super-particles/);
 assert.match(card,/onPreview=\{paintSuperPreview\}/);
 assert.match(card,/moonstone-super-preview/);
 assert.match(css,/@keyframes moonstone-super-tremble/);
 assert.match(css,/@keyframes moonstone-super-orbit-burst/);
 assert.match(css,/\.moonstone-like-button\.is-armed/);
});

test("holding the photo hides controls while logo and navigation stay mounted",()=>{
 assert.match(card,/host\.dataset\.photoFocus="true"/);
 assert.match(card,/window\.setTimeout\(\(\)=>\{/);
 assert.match(card,/releasePhotoHold/);
 assert.match(css,/data-photo-focus=true/);
 assert.doesNotMatch(css,/data-photo-focus=true[^}]*lh-island/);
 assert.doesNotMatch(css,/data-photo-focus=true[^}]*discovery-bottom-nav/);
 assert.match(css,/transition:opacity \.4s cubic-bezier\(\.22,\.8,\.2,1\)/);
});

test("expanded profile is a full-photo blur with clickable identity and no rectangular sheet",()=>{
 assert.match(css,/filter:blur\(19px\) saturate\(\.78\) brightness\(\.76\)/);
 assert.match(css,/\.moonstone-profile-drawer\{[\s\S]*?background:transparent/);
 assert.match(card,/className="moonstone-name"[\s\S]*?onClick=\{onOpenProfile\}/);
 assert.match(card,/moonstone-goal-mark/);
 assert.match(css,/\.moonstone-goal-mark\{/);
 assert.match(css,/\.moonstone-compact-info\{[\s\S]*?opacity:1;transform:translate3d\(0,var\(--profile-info-y\),0\)/);
 assert.doesNotMatch(card,/moonstone-drawer-name/);
 assert.match(card,/moonstone-language-flag/);
 assert.match(css,/\.moonstone-language-chip\{/);
});

test("reactions paint centered feedback and superlike has a live release burst",()=>{
 assert.match(card,/moonstone-action-feedback/);
 assert.match(card,/is-\$\{actionFeedback\.kind\}/);
 assert.match(css,/@keyframes moonstone-action-symbol/);
 assert.match(card,/is-super-committing/);
 assert.match(css,/@keyframes moonstone-super-release/);
});

test("actions and icon-only navigation match the approved two-button composition",()=>{
 assert.match(card,/className="moonstone-pass-button"/);
 assert.match(card,/className="moonstone-like-button"/);
 assert.doesNotMatch(card,/discovery-save-control|discovery-special/);
 assert.match(css,/\.discovery-nav-item span\{display:none\}/);
 assert.match(css,/width:min\(calc\(100% - 76px\),318px\)/);
});

test("refined chrome keeps independent tabs, a borderless nav and the smaller safe wordmark",()=>{
 assert.match(css,/\.discovery-app\[data-feed-visible="true"\] \.discovery-tab-underline::after\{[^}]*width:22px/s);
 assert.doesNotMatch(css,/\.discovery-app\[data-feed-visible="true"\] \.discovery-top-tabs>button\.active\{[^}]*background:/s);
 assert.match(css,/\.discovery-app>\.discovery-bottom-nav\{[^}]*border:0/s);
 assert.match(css,/\.discovery-app\[data-feed-visible="true"\] \.lh-center\{[^}]*width:110px/s);
 assert.match(css,/\.discovery-app\[data-feed-visible="true"\] \.lh-center\{[^}]*top:max\(2px,calc\(var\(--top-safe\) - 3px\)\)/s);
});

test("old feed implementation is physically removed",()=>{
 assert.equal(existsSync(new URL("../apps/web/src/discovery/feed-v2.css",import.meta.url)),false);
 assert.equal(existsSync(new URL("../apps/web/src/discovery/feed-glass-v1.css",import.meta.url)),false);
 assert.doesNotMatch(card,/feed-v2-|discovery-action/);
});
