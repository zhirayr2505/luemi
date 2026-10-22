import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../apps/web/src/viewport/viewport-model.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const m=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const insets={top:0,right:0,bottom:0,left:0};
const fixture=(patch={})=>({
 layoutWidth:393,layoutHeight:800,visualWidth:393,visualHeight:800,
 visualOffsetTop:0,visualOffsetLeft:0,telegramHeight:800,telegramStableHeight:800,
 orientation:"portrait",focusedEditable:false,safeInsets:insets,contentInsets:insets,...patch
});
let state=m.reduceViewport(null,fixture(),"initial");
assert.equal(state.shellHeight,800);assert.equal(state.keyboardState,"closed");
assert.equal(state.revision,1);
state=m.reduceViewport(state,fixture({layoutHeight:660,visualHeight:660,telegramStableHeight:800}),"window");
assert.equal(state.shellHeight,660,"same width window reduction must not be pinned to old 800px");
assert.equal(state.stableHeight,660);
console.log("REM01D_MODEL_PASS same-width genuine height reduction");
state=m.reduceViewport(state,fixture({layoutHeight:800,visualHeight:680,telegramHeight:680,telegramStableHeight:680}),"telegram-stable");
assert.equal(state.shellHeight,680);assert.equal(state.stableHeight,680);
assert.equal(state.keyboardState,"closed");
assert.equal(state.acceptedStableHeight,680);
console.log("REM01D_MODEL_PASS Telegram fullscreen exit stable event at unchanged width");
state=m.reduceViewport(state,fixture({visualHeight:435,telegramHeight:435,telegramStableHeight:680,focusedEditable:true}),"visual");
assert.equal(state.shellHeight,435);assert.equal(state.keyboardState,"open");
assert.equal(state.keyboardOverlap,245);
assert.equal(state.stableHeight,680);
console.log("REM01D_MODEL_PASS keyboard open without mutating fullscreen baseline");
state=m.reduceViewport(state,fixture({visualHeight:435,telegramHeight:435,telegramStableHeight:680}),"blur");
assert.equal(state.shellHeight,435);assert.equal(state.keyboardState,"uncertain");
assert.equal(state.keyboardOverlap,0);
state=m.reduceViewport(state,fixture({visualHeight:680,telegramHeight:680,telegramStableHeight:680}),"visual");
assert.equal(state.keyboardState,"closed");assert.equal(state.shellHeight,680);
console.log("REM01D_MODEL_PASS blur before native IME hides, then restore");
state=m.reduceViewport(state,fixture({layoutWidth:840,layoutHeight:390,visualWidth:840,visualHeight:390,
 orientation:"landscape",telegramStableHeight:680}),"orientation");
assert.equal(state.shellHeight,390);assert.equal(state.stableHeight,390);
assert.equal(state.acceptedStableHeight,null);
console.log("REM01D_MODEL_PASS rotation discards stale portrait Telegram height");
state=m.reduceViewport(null,fixture({layoutHeight:800,visualHeight:720,telegramStableHeight:undefined,telegramHeight:undefined}),"initial");
assert.equal(state.shellHeight,720);assert.equal(state.keyboardState,"closed");
state=m.reduceViewport(state,fixture({layoutHeight:800,visualHeight:540,visualOffsetTop:35,
 telegramStableHeight:undefined,telegramHeight:undefined,focusedEditable:true}),"visual");
assert.equal(state.shellTop,35);assert.equal(state.shellHeight,540);
assert.equal(state.keyboardState,"open");
assert.equal(state.keyboardOverlap,260);
console.log("REM01D_MODEL_PASS browser without Telegram and iOS visualViewport offset");
state=m.reduceViewport(null,fixture({visualHeight:800,
 safeInsets:{top:23,right:0,bottom:26,left:0},
 contentInsets:{top:17,right:0,bottom:21,left:0}}),"initial");
assert.equal(state.safeInsets.top,23);assert.equal(state.contentInsets.top,17);
assert.equal(state.safeInsets.bottom,26);assert.equal(state.contentInsets.bottom,21);
console.log("REM01D_MODEL_PASS separate safe and content insets for CSS MAX");
state=m.reduceViewport(null,fixture(),"initial");
state=m.reduceViewport(state,fixture({focusedEditable:true,visualHeight:730}),"visual");
assert.equal(state.keyboardState,"uncertain","small focus-related shrink is not definitive keyboard");
state=m.reduceViewport(state,fixture({focusedEditable:true,visualHeight:800}),"visual");
assert.equal(state.keyboardState,"closed","focus alone never proves keyboard");
console.log("REM01D_MODEL_PASS ambiguous focus does not falsely assert open");
console.log("REM-01D REDUCER QA PASS");
