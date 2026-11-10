import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Telegram ready never fires before the React app mounts",()=>{
 const early=read("apps/web/public/telegram-early-fullscreen.js");
 const app=read("apps/web/src/App.tsx");
 assert.doesNotMatch(early,/\bapp\.ready\s*\(/);
 assert.match(app,/webApp\?\.ready\?\.\(\)/);
 assert.match(early,/app\.requestFullscreen\(\)/);
});

test("HTML shows a dark branded, no-JS fallback before module startup",()=>{
 const html=read("apps/web/index.html");
 assert.match(html,/<meta name="theme-color" content="#1B2025"/);
 assert.match(html,/html,body\{min-height:100%;margin:0;background:#1B2025/);
 assert.match(html,/id="luemi-boot"/);
 assert.match(html,/wordmark_original_raster_alpha_W06\.webp/);
 assert.match(html,/script defer src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"/);
 assert.match(html,/script src="\/boot-recovery\.js"/);
 const fallback=read("apps/web/public/boot-recovery.js");
 assert.match(fallback,/MutationObserver/);
 assert.match(fallback,/window\.setTimeout\(showRecovery, 10000\)/);
 assert.match(fallback,/window\.location\.replace/);
 assert.doesNotMatch(fallback,/localStorage|indexedDB/);
});

test("entry HTML and boot scripts are never served from stale WebView cache",()=>{
 const server=read("apps/api/src/server.ts");
 assert.match(server,/app\.addHook\("onSend"/);
 assert.match(server,/no-store, max-age=0/);
 assert.match(server,/path === "\/index\.html"/);
 assert.match(server,/path === "\/boot-recovery\.js"/);
});
