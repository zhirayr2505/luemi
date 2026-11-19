import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync("apps/web/src/discovery/owner-profile/owner-premium-profile.css","utf8");
const component=readFileSync("apps/web/src/discovery/owner-profile/OwnerPremiumProfile.tsx","utf8");
const catalog=readFileSync("apps/web/src/ui/InterestCatalog.tsx","utf8");

assert.match(css,/\.owner-profile-content\s*\{[^}]*border-radius:2[0-9]px 2[0-9]px 0 0/s,
 "content sheet must overlap the image through its rounded upper corners");
assert.match(css,/\.owner-profile-photo-pager\s*\{[^}]*right:2[0-9]px/s,
 "photo pager must be right aligned, not centered under the identity");
assert.match(css,/\.owner-profile-tabs::after\s*\{/,
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
assert.match(component,/\.owner-profile-avatar-glow/,
 "compact photo must have its subtle image-based glow");
assert.match(component,/ownerElastic/,
 "photo and content must have one bounded overpull amount");
assert.match(component,/movePhotoTrack\(available\?dx:dx\*\.2/,
 "existing photo carousel direct tracking remains intact");
assert.match(component,/gestures\.claim\(owner,current\.serial\)/,
 "existing gesture arbiter remains the only gesture owner");
console.log("PROFILE_V4_1_UI_CONTRACT_PASS rounded sheet, tabs, flag, glow, elasticity and canonical interests");
