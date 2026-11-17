import assert from "node:assert/strict";
import {isDeepStrictEqual} from "node:util";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json"));
const same=(a,b)=>isDeepStrictEqual(a,b);
function assertWorkspaceLock(manifest,locked){
 assert.equal(locked.lockfileVersion,3,"npm lock v3 required");
 assert.equal(locked.name,manifest.name);
 assert.ok(same(locked.packages[""].workspaces,manifest.workspaces),"root workspaces differ");
 assert.ok(same(locked.packages[""].devDependencies,manifest.devDependencies),"lockfile does not match root dev dependencies");
 assert.ok(same(locked.packages[""].engines,manifest.engines),"lockfile does not match Node/npm engines");
 for(const name of ["@luemi/api","@luemi/web","@luemi/contracts"]){
  const ws=Object.values(locked.packages).find(x=>x.name===name);
  assert.ok(ws,"missing workspace "+name);
 }
 assert.equal(locked.packages["node_modules/playwright"].version,manifest.devDependencies.playwright);
 assert.equal(locked.packages["node_modules/eslint-plugin-react-hooks"].version,manifest.devDependencies["eslint-plugin-react-hooks"]);
}
assertWorkspaceLock(pkg,lock);
const api=JSON.parse(read("apps/api/package.json"));
assert.equal(api.dependencies["@fastify/static"],"^10.1.11","static plugin must stay on a patched Fastify 5-compatible line");
assert.equal(lock.packages["apps/api"].dependencies["@fastify/static"],api.dependencies["@fastify/static"],"API static package range differs from lockfile");
const staticPlugin=lock.packages["node_modules/@fastify/static"];
assert.ok(staticPlugin,"@fastify/static must exist in package lock");
const [staticMajor,staticMinor,staticPatch]=String(staticPlugin.version).split(".").map(Number);
const staticPatched=staticMajor>10||(staticMajor===10&&(staticMinor>1||(staticMinor===1&&staticPatch>=11)));
assert.ok(staticPatched,"@fastify/static "+staticPlugin.version+" is below the 10.1.11 security floor (GHSA-83w8-p2f5-377r and related advisories)");
assert.equal(staticPlugin.resolved,"https://registry.npmjs.org/@fastify/static/-/static-"+staticPlugin.version+".tgz","static package tarball must match its locked version");
assert.ok(/^sha512-[A-Za-z0-9+/]+=*$/.test(staticPlugin.integrity??""),"static package lock must retain SHA-512 integrity");
const web=JSON.parse(read("apps/web/package.json"));
assert.equal(web.dependencies.vite,"^6.4.6","Vite workspace range must stay on the patched 6.4 line");
assert.equal(lock.packages["apps/web"].dependencies.vite,web.dependencies.vite,"workspace Vite range differs from lockfile");
const lockedVite=lock.packages["node_modules/vite"];
assert.ok(lockedVite,"Vite must be present in the npm lockfile");
const versionTuple=String(lockedVite.version).split(".").map(Number);
assert.equal(versionTuple.length,3,"locked Vite version must be a stable semver release");
const [viteMajor,viteMinor,vitePatch]=versionTuple;
const patched=viteMajor>6||(viteMajor===6&&(viteMinor>4||(viteMinor===4&&vitePatch>=6)));
assert.ok(patched,"Vite "+lockedVite.version+" is below the 6.4.6 security floor (GHSA-p4f5-76q4-ffq7)");
assert.equal(lockedVite.resolved,"https://registry.npmjs.org/vite/-/vite-"+lockedVite.version+".tgz","Vite lockfile tarball must match its locked version");
assert.ok(/^sha512-[A-Za-z0-9+/]+=*$/.test(lockedVite.integrity??""),"Vite lockfile must retain SHA-512 integrity");
assert.throws(()=>assertWorkspaceLock({...pkg,devDependencies:{...pkg.devDependencies,playwright:"0.0.0"}},lock),/lockfile does not match|playwright/,"mismatched package manifest must fail");
assert.equal(pkg.packageManager,"npm@10.9.2");
assert.equal(read(".node-version").trim(),"22.16.0");
const foundation=read(".github/workflows/rebuild-ci.yml");
const visual=read(".github/workflows/stage03g3-visual.yml");
for(const [name,config] of [["foundation",foundation],["visual",visual]]){
 for(const s of ["pull_request:","      - main","      - 'staging/**'","      - 'remediation/**'","permissions:","  contents: read","node-version-file: .node-version","cache-dependency-path: package-lock.json","npm ci --no-audit --no-fund","persist-credentials: false"]){
  assert.ok(config.includes(s),name+" missing "+s);
 }
 assert.ok(!config.includes("npm install --no-save"),name+" must not install unpinned QA tooling");
 assert.ok(!config.includes("pull_request_target"),name+" must not execute privileged PR code");
}
for(const s of ["fail-fast: false","ci-infrastructure","lint-hooks","type-contracts","source-marker-contracts","api-isolated","build","local-smoke"]){
 assert.ok(foundation.includes(s),"missing isolated required gate "+s);
}
assert.ok(visual.includes("npx --no-install playwright install chromium --with-deps"));
assert.ok(visual.includes("if: always()"),"diagnostics must persist after failure");
assert.ok(!foundation.includes("continue-on-error"),"foundation gates must never ignore failure");
const debt=JSON.parse(read("qa/react-hooks-baseline.json"));
assert.equal(debt.schemaVersion,1);
assert.ok(Array.isArray(debt.allowed));
assert.ok(debt.allowed.every(x=>x.rule==="react-hooks/exhaustive-deps"),"only explicitly audited hooks debt may be grandfathered");
console.log("REM-00B CI infra contracts PASS: manifest/lock equality, patched Vite >=6.4.6 and @fastify/static >=10.1.11 security floors, negative mismatch fixture, PR/main/staging triggers, bounded lanes, pinned browser, no global skip.");
