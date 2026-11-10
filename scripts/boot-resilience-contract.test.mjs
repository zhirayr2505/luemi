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
test("Telegram SDK is a first-party asset, not a network-critical CDN",()=>{
 const html=read("apps/web/index.html");
 assert.ok(html.includes('<meta name="theme-color" content="#1B2025"'));
 assert.ok(html.includes('id="luemi-boot"'));
 assert.ok(html.includes('wordmark_original_raster_alpha_W06.webp'));
 assert.ok(html.includes('<script defer src="/telegram-web-app.js"></script>'));
 assert.ok(!html.includes('src="https://telegram.org/js/telegram-web-app.js"'));
 assert.ok(html.includes('<script src="/boot-recovery.js"></script>'));
 const vendor=read("scripts/vendor-telegram-sdk.mjs");
 const pkg=read("package.json");
 assert.ok(vendor.includes('https://telegram.org/js/telegram-web-app.js?65'));
 assert.ok(pkg.includes('node scripts/vendor-telegram-sdk.mjs'));
 const fallback=read("apps/web/public/boot-recovery.js");
 assert.ok(fallback.includes('MutationObserver'));
 assert.ok(fallback.includes('window.setTimeout(showRecovery, 10000)'));
 assert.ok(fallback.includes('window.location.replace'));
 assert.doesNotMatch(fallback,/localStorage|indexedDB/);
});
test("HTML and startup scripts are never served from stale cache",()=>{
 const server=read("apps/api/src/server.ts");
 assert.ok(server.includes('app.addHook("onSend"'));
 assert.ok(server.includes('no-store, max-age=0'));
 for(const path of ['index.html','boot-recovery.js','telegram-web-app.js']){
  assert.ok(server.includes('path === "/'+path+'"'));
 }
});
