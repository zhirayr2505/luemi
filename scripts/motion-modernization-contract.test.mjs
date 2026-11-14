import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(path)=>readFile(path,"utf8");
const [styles,app,sorter,carousel,realChats,chatsCss,moonstone,cinematic,v2Css,session]=await Promise.all([
  read("apps/web/src/styles.css"),
  read("apps/web/src/App.tsx"),
  read("apps/web/src/registration/PhotoSorter.tsx"),
  read("apps/web/src/ui/PhotoCarousel.tsx"),
  read("apps/web/src/chats/RealChats.tsx"),
  read("apps/web/src/chats/chats.css"),
  read("apps/web/src/discovery/moonstone-discovery.css"),
  read("apps/web/src/registration/cinematic-welcome.css"),
  read("apps/web/src/registration/v2/runtime.css"),
  read("apps/api/src/rem05b-session.ts")
]);

assert.match(styles,/\.progress-track span\{[^}]*transform:scaleX\(0\)/);
assert.match(app,/style=\{\{transform:`scaleX\(\$\{step\/8\}\)`\}\}/);
assert.match(styles,/\.photo-processing-bar span\{[^}]*transform:scaleX\(0\)/);
assert.match(sorter,/scaleX\(\$\{\(photo\.progress\?\?0\)\/100\}\)/);
assert.match(chatsCss,/\.lc-attachment>span\{[^}]*transition:transform/);
assert.match(realChats,/scaleX\(\$\{attachment\.progress\/100\}\)/);

assert.match(styles,/\.carousel-track\.is-dragging\{will-change:transform\}/);
assert.doesNotMatch(styles,/\.carousel-track\{[^}]*will-change:transform/);
assert.match(carousel,/classList\.add\("is-dragging"\)/);
assert.match(carousel,/classList\.remove\("is-dragging"\)/);

assert.match(styles,/transition-property:color,background-color,border-color,outline-color,fill,stroke!important/);
assert.doesNotMatch(styles,/@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important\}/);
assert.match(chatsCss,/\.lc-chat-row\{transition-property:background-color\}/);
assert.match(v2Css,/\.v2-runtime \.v2-feedback\{transition-property:color,background-color,border-color,box-shadow\}/);
assert.match(v2Css,/\.goal-card-label\{[^}]*overflow-wrap:anywhere\}/);
const identityPreflight=session.indexOf("const knownActor=await db.query");
const authUpsert=session.indexOf("INSERT INTO luemi_private.actors");
assert.ok(identityPreflight>=0&&authUpsert>identityPreflight,
 "signed Telegram account state must be read before the auth upsert");
assert.match(session,/set_config\('luemi\.actor_id',\$1,true\)/);
assert.match(session,/account_pending_deletion/);
assert.match(session,/existing\.status!=="active"/);

assert.match(styles,/animation:intro-cursor-blink \.8s steps\(2,end\) 3/);
assert.match(cinematic,/hero-viewport-ready\.hero-image-ready::before\{\s*opacity:1;animation:none;transform:none\}/);
assert.doesNotMatch(cinematic,/luemi-hero-drift|@keyframes luemi-hero-drift/);
assert.match(moonstone,/animation:moonstone-super-spectrum 1\.5s ease-out both/);
assert.match(moonstone,/animation:moonstone-super-tremble \.34s ease-in-out 3 alternate both/);

console.log("Motion modernization contracts passed.");
