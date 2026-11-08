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
 ["Moonstone private cards at source",/\.luemi-private-card\{[^}]*background:var\(--luemi-surface\)/s]
];
for(const [name,pattern] of checks)assert.match(css,pattern,name);
assert.doesNotMatch(css,/\.luemi-shell\[data-theme="dark"\] \.(?:luemi-real-home|luemi-private-card)/,
 "The owner screen must no longer rely on a second dark stylesheet");
assert.doesNotMatch(css,/background:\s*#(?:fff(?:fff)?|fffbff|f6f5f9)\b/i,
 "Retired white account surfaces cannot return");
assert.match(css,/\.luemi-real-account\{[^}]*display:flex;flex-direction:column/,
 "Keep the real account page layout after CSS consolidation");
assert.match(app,/data-account-mode=\{!realFeedPilot\.enabled&&remoteDraftPilot\.enabled\?"private":"standard"\}/);
assert.match(app,/<PrivateAccountView draft=\{draft\} photos=\{readyPhotos\}/);
assert.match(app,/className="luemi-private-edit-bar"/);
assert.doesNotMatch(view,/(?<![A-Za-z])(?:approve\s*\(|verified\s*=\s*true|publishMyProfile\s*\(|uploadPrivatePhotos\s*\(|service_role)/);
assert.match(view,/safeOwnerAbout\(draft\.about\.trim\(\)\)/);
assert.match(view,/aria-pressed=\{p\.id===selected\?\.id\}/);
assert.match(view,/Фото только на устройстве/);
console.log("Private account premium UI source contract: PASS ("+checks.length+" selectors)");
