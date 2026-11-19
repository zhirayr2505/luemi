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

test("approved card keeps the sharp gallery under its translucent information overlay",()=>{
 const cardCss=read("apps/web/src/discovery/card-deck-edition.css");
 assert.match(card,/className="moonstone-person-card"/);
 assert.match(card,/className="moonstone-photo"/);
 assert.match(card,/gpuSafe adaptive loop ambientActive=\{active\} onCoverReady=\{onCoverReady\}/);
 assert.match(cardCss,/\.moonstone-person-card \.moonstone-photo\{[\s\S]*?bottom:0/);
 assert.match(css,/\.carousel-slide-adaptive \.feed-carousel-photo\{[\s\S]*?object-fit:contain/);
 assert.doesNotMatch(carousel,/syncAdaptiveSlide|carousel-photo-bleed/);
 assert.match(real,/visibleRows\.slice\(page,page\+2\)/);
 // Queued cards load only the cover; active cards may also warm the next photo.
 assert.match(carousel,/const load=!gpuSafe\|\|i===0\|\|\(i===1&&prioritize\)/);
 assert.match(carousel,/src=\{load\?p\.src:undefined\}/);
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

test("one progress drives overlay copy stages and gradient without React pointer renders",()=>{
 assert.match(card,/--profile-p/);
 assert.match(card,/scheduleFinger\(current\.startProgress-dy\/travel\.current\)/);
 assert.doesNotMatch(card,/moonstone-blur-photo|onResolvedSource|adaptiveFullscreen/);
 assert.doesNotMatch(css,/\.moonstone-blur-photo\{/);
 assert.match(css,/\.moonstone-photo-shade\{/);
 assert.doesNotMatch(css,/\.moonstone-photo::after\{[\s\S]*?backdrop-filter/);
 assert.match(card,/--profile-scrim-p/);
 assert.match(css,/opacity:var\(--profile-p\)/);
 // Profile summary and detail sections share the same RAF displacement,
 // instead of the old independent 38px easing that made text overlap on Android.
 assert.match(card,/--profile-detail-y/);
 assert.match(card,/\(value-1\)\*infoShift\.current/);
 assert.match(css,/transform:translate3d\(0,calc\(var\(--profile-detail-y,0px\) \+ var\(--profile-elastic-y\)\),0\)/);
 assert.match(css,/\.moonstone-compact-info\{[\s\S]*?transition:none/);
 assert.match(css,/\.moonstone-profile-drawer\{[\s\S]*?transition:none/);
 assert.doesNotMatch(css,/\.moonstone-actions,\.moonstone-demo-label,\.moonstone-profile-drawer\{/);
 assert.doesNotMatch(css,/\.moonstone-reveal-text\{[^}]*transform:/);
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

test("expanded profile keeps the photo sharp with clickable identity and no rectangular sheet",()=>{
 assert.doesNotMatch(css,/\.moonstone-blur-photo\{/);
 assert.match(css,/\.moonstone-profile-drawer\{[\s\S]*?background:transparent/);
 assert.match(card,/className="moonstone-name"[\s\S]*?onClick=\{onOpenProfile\}/);
 assert.match(card,/moonstone-goal-mark/);
 assert.match(css,/\.moonstone-goal-mark\{/);
 assert.match(css,/\.moonstone-compact-info\{[\s\S]*?opacity:1;transform:translate3d\(0,calc\(var\(--profile-info-y\) \+ var\(--profile-elastic-y\)\),0\)/);
 assert.doesNotMatch(card,/moonstone-drawer-name/);
 assert.match(card,/moonstone-language-flag/);
 assert.match(css,/\.moonstone-language-chip\{/);
});

test("expanded details scroll only within the sheet; common interests and optional data are stable",()=>{
 assert.match(real,/viewerInterestIds=\{draft\.interests\}/);
 assert.match(card,/commonInterestIds/);
 assert.match(card,/orderedInterests/);
 assert.match(card,/moonstone-about-quote/);
 assert.match(card,/profileFacts\.length>0/);
 assert.match(card,/profileAnswers\.length>0/);
 assert.match(card,/startScrollFling/);
 assert.match(card,/current\.scrollStart-dy/);
 assert.match(card,/stopScrollFling\(\)/);
 assert.match(css,/\.moonstone-interest-pill\.is-shared/);
 assert.match(css,/\.moonstone-language-flag\{[^}]*border-radius:50%/);
 assert.doesNotMatch(css,/\.moonstone-reveal-text\{[^}]*transform:/);
});

test("reactions paint centered feedback and superlike has a live release burst",()=>{
 assert.match(card,/moonstone-action-feedback/);
 assert.match(card,/is-\$\{actionFeedback\.kind\}/);
 assert.match(css,/@keyframes moonstone-action-symbol/);
 assert.match(card,/is-super-committing/);
 assert.match(css,/@keyframes moonstone-super-release/);
});

test("five real circular actions and the labeled navigation use the matte theme",()=>{
 for(const cls of ["moonstone-undo-button","moonstone-pass-button","moonstone-special-button","moonstone-like-button","moonstone-save-button"])
  assert.ok(card.includes(cls),cls);
 const matte=read("apps/web/src/ui/vivid-discovery.css");
 assert.match(matte,/\.moonstone-actions-vivid/);
 assert.match(matte,/\.discovery-app>\.discovery-bottom-nav \.discovery-nav-item span/);
 assert.match(card,/onAction\("undo"\)/);
 assert.match(card,/onAction\("save"\)/);
 assert.match(card,/performAction\("special"\)/);
});

test("refined chrome keeps independent tabs, a borderless nav and the 20 percent smaller and slightly higher safe wordmark",()=>{
 assert.match(css,/\.discovery-app\[data-feed-visible="true"\] \.discovery-tab-underline::after\{[^}]*width:22px/s);
 assert.doesNotMatch(css,/\.discovery-app\[data-feed-visible="true"\] \.discovery-top-tabs>button\.active\{[^}]*background:/s);
 assert.match(css,/\.discovery-app>\.discovery-bottom-nav\{[^}]*border:0/s);
 assert.match(css,/\.discovery-app\[data-feed-visible="true"\] \.lh-center\{[^}]*width:88px/s);
 assert.match(css,/\.discovery-app\[data-feed-visible="true"\] \.lh-center\{[^}]*top:max\(2px,calc\(var\(--top-safe\) - 6px\)\)/s);
});

test("old feed implementation is physically removed",()=>{
 assert.equal(existsSync(new URL("../apps/web/src/discovery/feed-v2.css",import.meta.url)),false);
 assert.equal(existsSync(new URL("../apps/web/src/discovery/feed-glass-v1.css",import.meta.url)),false);
 assert.doesNotMatch(card,/feed-v2-|discovery-action/);
});
