import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync("apps/web/src/discovery/owner-profile/owner-premium-profile.css","utf8");
const component=readFileSync("apps/web/src/discovery/owner-profile/OwnerPremiumProfile.tsx","utf8");
const catalog=readFileSync("apps/web/src/ui/InterestCatalog.tsx","utf8");

const motion=readFileSync("apps/web/src/discovery/owner-profile/useOwnerProfileMotion.ts","utf8");

assert.match(css,/\.owner-profile-sheet\s*\{[^}]*border-radius:32px 32px 0 0/s,
 "the rounded cap belongs to the whole sheet");
assert.match(component,/className="owner-profile-sheet"[\s\S]*className="owner-profile-tabs"[\s\S]*className="owner-profile-viewport"/,
 "tabs are kept in the sheet above its independent card scroller");
assert.equal((component.match(/className="owner-profile-photo-mask"/g)??[]).length,1,
 "one mask hosts both the expanded square and the compact circle");
assert.match(motion,/schedulePaint\(current.startedCompact\?Math.max\(0,next\):next\)/,
 "the held finger renders the interactive circle and can continue past it");
assert.match(css,/\[data-morph-state="compact"\] .owner-profile-scroll\{[^}]*overflow:hidden auto/s,
 "card scrolling begins when the profile is compact");
assert.match(css,/\.owner-profile-photo-pager\s*\{[^}]*right:2[0-9]px/s,
 "photo pager must be right aligned, not centered under the identity");
assert.match(css,/\.owner-profile-tab-ink\s*\{/,
 "active tab is indicated by a single sliding underline");
assert.doesNotMatch(css,/\.owner-profile-tabs button\[aria-selected="true"\]\s*\{[^}]*background:/s,
 "selected tab must not have a filled button background");
assert.doesNotMatch(css,/\.owner-profile-interests \.chip\.toned:nth-child/,
 "interest palette must never depend on display order");
assert.match(catalog,/style=\{tint\(info\.colors\)\}/,
 "canonical interest color comes from the catalog");
assert.match(component,/import \{Flag\} from "\.\.\/\.\.\/ui\/Flag";/,
 "country indicator must use the shared circular flag component");
assert.match(component,/countryCode\s*\?\s*<Flag/,
 "country flag must be guarded by an actual code");
assert.match(motion,/ownerRubberPosition\(raw\)\/current.distance/,
 "photo and sheet derive elastic motion from the same pull");
assert.match(component,/photos\[loop\(selectedIndex-direction,photos.length\)\]/,
 "photo paging wraps around the available items");
assert.match(motion,/gestures\.claim\(owner,current\.serial\)/,
 "the shared arbiter remains the only gesture owner");

// Legacy violet/turquoise/yellow gradients were not LUEMI Sunset Cherry.
// Every catalog pigment must be one of the approved muted berry tones; this
// applies to the registration category pills and shared profile interest chips.
const approved=new Set(["#6B344E","#8D435C","#75405B","#925167","#52273E","#6C3C4C"]);
const pigments=[...new Set(catalog.match(/#[0-9a-fA-F]{6}/g)??[])].map(x=>x.toUpperCase());
assert.equal(pigments.length,approved.size,"preserve six distinct tones rather than flattening interests");
assert(pigments.every(color=>approved.has(color)),"all interest catalog colors must use current Vivid Matte rose/berry pigments");
const styles=readFileSync("apps/web/src/styles.css","utf8");
assert.match(styles,/\.chip\.toned\s*\{[^}]*color:var\(--luemi-text,#FAFCFF\)/s,"interest labels must be readable on berry pigments");
assert.match(styles,/\.category-chip\s*\{[^}]*color:var\(--luemi-text,#FAFCFF\)/s,"registration category labels use the same readable light ink");

console.log("PROFILE_V4_1_UI_CONTRACT_PASS rounded sheet, tabs, flag, one photo mask, elasticity and canonical interests");
