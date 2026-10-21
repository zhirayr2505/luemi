// REM-00B: explicit, reviewable debt ledger for pre-existing exhaustive-deps diagnostics.
// An unknown issue or any rules-of-hooks violation fails the gate. No file or rule is disabled.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {relative,sep} from "node:path";
import {ESLint} from "eslint";

const ledger=JSON.parse(readFileSync(new URL("../qa/react-hooks-baseline.json",import.meta.url),"utf8"));
assert.equal(ledger.schemaVersion,1);
assert.ok(Array.isArray(ledger.allowed));
const eslint=new ESLint();
const results=await eslint.lintFiles(["apps/web/src/**/*.{ts,tsx}"]);
const issues=results.flatMap(result=>result.messages.filter(x=>x.ruleId?.startsWith("react-hooks/")).map(x=>({
  file:relative(process.cwd(),result.filePath).split(sep).join("/"),
  rule:x.ruleId,
  line:x.line,
  column:x.column,
  message:x.message
}))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
console.log("LUEMI_REM00B_HOOKS_CANDIDATES_JSON="+JSON.stringify(issues));
const key=x=>JSON.stringify([x.file,x.rule,x.line,x.column,x.message]);
const allowed=new Set(ledger.allowed.map(key));
assert.equal(allowed.size,ledger.allowed.length,"baseline contains duplicate entries");
assert.ok(ledger.allowed.every(x=>x.rule==="react-hooks/exhaustive-deps"),"only bounded exhaustive-deps debt is permitted");
const current=new Set(issues.map(key));
const unknown=issues.filter(x=>!allowed.has(key));
const resolved=ledger.allowed.filter(x=>!current.has(key));
for(const x of unknown)console.error("NEW HOOK DIAGNOSTIC",x);
for(const x of resolved)console.error("BASELINE REQUIRES CLEANUP",x);
assert.deepEqual(unknown,[],"new React hooks diagnostics require a code review");
assert.deepEqual(resolved,[],"remove obsolete hook debt fingerprints from ledger");
console.log("React Hooks baseline gate PASS: "+issues.length+" acknowledged historical exhaustive-deps diagnostics; no new violations.");
