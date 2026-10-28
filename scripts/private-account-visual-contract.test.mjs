/** App-only source guards for the owner private beta screen.
 * No screenshots/JS runtime; production Android WebView still needs QA. */
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";

const css=readFileSync("apps/web/src/registration/real-home.css","utf8");
const app=readFileSync("apps/web/src/App.tsx","utf8");
const view=readFileSync("apps/web/src/registration/PrivateAccountView.tsx","utf8");
const checks=[
 ["standalone private page selector",/\.luemi-real-home\[data-account-mode="private"\]/],
 ["Telegram top safe area",/\[data-telegram-ui="true"\]\s+\.luemi-real-home-top\s*\{[^}]*padding-top:max\(/s],
 ["in-flow scroll body",/\.luemi-real-home\[data-account-mode="private"\]\s+\.luemi-real-home-main\s*\{/],
 ["one gallery image",/\.luemi-private-hero>img\s*\{[^}]*object-fit:cover/s],
 ["small interactive photo thumbnails",/\.luemi-private-thumb\.is-active/],
 ["full wrapping bio",/\.luemi-private-about p\s*\{[^}]*overflow-wrap:anywhere/s],
 ["sticky anchored edit footer",/\.luemi-private-edit-bar\s*\{[^}]*flex:none/s],
 ["dark theme cards",/\.luemi-shell\[data-theme="dark"\]\s+\.luemi-private-card/]
];
for(const [name,pattern] of checks)assert.match(css,pattern,name);
assert.match(app,/data-account-mode=\{!realFeedPilot\.enabled&&remoteDraftPilot\.enabled\?"private":"standard"\}/);
assert.match(app,/<PrivateAccountView draft=\{draft\} photos=\{readyPhotos\}/);
assert.match(app,/className="luemi-private-edit-bar"/);
assert.doesNotMatch(view,/approve|verified=true|publishMyProfile|uploadPrivatePhotos|service_role/);
assert.match(view,/safeOwnerAbout\(draft\.about\.trim\(\)\)/);
assert.match(view,/aria-pressed=\{p\.id===selected\?\.id\}/);
assert.match(view,/Фото только на устройстве/);
console.log("Private account premium UI source contract: PASS ("+checks.length+" selectors)");
