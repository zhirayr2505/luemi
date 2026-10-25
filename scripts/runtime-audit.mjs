/**
 * LUEMI runtime reachability + style inventory audit.
 * Conservative: reports candidates instead of deleting dynamic modules/assets.
 * Runs without network or third-party dependencies.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root=process.cwd(),allowed=[".tsx",".ts",".js",".jsx",".css"];
const normalize=p=>path.relative(root,p).replaceAll(path.sep,"/");
const sourceRoots=["apps/web/src","apps/api/src","packages/contracts/src"];
const code=[];
function walk(dir){
 if(!fs.existsSync(dir))return;
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const loc=path.join(dir,item.name);
  if(item.isDirectory())walk(loc);
  else if(allowed.some(ext=>loc.endsWith(ext)))code.push(path.resolve(loc));
 }
}
sourceRoots.forEach(p=>walk(path.join(root,p)));
const all=new Set(code);
const reachable=new Set(),missing=[];
function resolve(from,relative){
 const base=path.resolve(path.dirname(from),relative);
 // NodeNext TypeScript sources intentionally import their compiled .js names.
 const sourceBase=base.endsWith(".js")?base.slice(0,-3):base;
 for(const f of [
  base,sourceBase+".ts",sourceBase+".tsx",
  ...allowed.map(ext=>base+ext),
  ...allowed.map(ext=>path.join(base,"index"+ext))
 ]){
  if(all.has(f))return f;
 }
 return null;
}
function visit(file){
 if(reachable.has(file)||!all.has(file))return;
 reachable.add(file);
 if(!/\.(?:[jt]sx?|jsx)$/.test(file))return;
 const text=fs.readFileSync(file,"utf8");
 const matcher=/\bfrom\s*["'](\.[^"']+)["']|\bimport\s*["'](\.[^"']+)["']|\bimport\s*\(\s*["'](\.[^"']+)["']/g;
 for(const m of text.matchAll(matcher)){
  const relative=m[1]||m[2]||m[3];
  const target=resolve(file,relative);
  if(target)visit(target);else missing.push(normalize(file)+" -> "+relative);
 }
}
// All HTML QA entries are explicit isolated Vite entrypoints. Parse them
// instead of misclassifying their source modules as abandoned production code.
const webDir=path.join(root,"apps/web");
const qaEntries=fs.readdirSync(webDir).filter(name=>name.endsWith(".html"))
 .flatMap(name=>{
  const html=fs.readFileSync(path.join(webDir,name),"utf8");
  return [...html.matchAll(/<script\\b[^>]*\\bsrc=["']\\/?(src\\/[^"']+\\.[jt]sx?)["']/g)]
   .map(match=>path.join(webDir,match[1]));
 });
for(const entry of [
 path.join(root,"apps/web/src/main.tsx"),
 path.join(root,"apps/api/src/server.ts"),
 path.join(root,"packages/contracts/src/index.ts"),
 ...qaEntries
])visit(entry);
const orphan=[...all].filter(f=>!reachable.has(f)).map(normalize).sort();
// Two explicitly separated, non-production utilities, not app import orphans:
// secret rotation is CLI-only; the Bliki lifecycle is a dormant future feature.
const documentedDormant=new Set([
 "apps/api/src/rem05e-telegram-rotation.ts",
 "apps/web/src/discovery/bliki-media-lifecycle.ts"
]);
const unexplained=orphan.filter(file=>!documentedDormant.has(file));
const appJS=code.filter(f=>/\.tsx?$/.test(f)).map(f=>fs.readFileSync(f,"utf8")).join("\n");
const css=code.filter(f=>f.endsWith(".css"));
const unusedSelectors=[];
for(const file of css){
 const contents=fs.readFileSync(file,"utf8");
 const classes=[...new Set([...contents.matchAll(/\.([a-z][a-z0-9_-]+)(?=[\s:{>,.#])/gi)].map(m=>m[1]))];
 for(const name of classes){
  if(!appJS.includes(name)&&!["active","selected","hidden","current","disabled"].includes(name))
   unusedSelectors.push(normalize(file)+": ."+name);
 }
}
console.log("LUEMI runtime code audit");
console.log("Analyzed modules:",code.length,"reachable:",reachable.size);
console.log("Potential unreachable source files:",JSON.stringify(orphan));
console.log("Potential CSS selectors without literal JSX reference:",JSON.stringify(unusedSelectors));
console.log("Unresolved relative imports:",JSON.stringify(missing));
console.log("Dormant, approved non-entry modules:",JSON.stringify(orphan.filter(f=>documentedDormant.has(f))));
console.log("Undocumented unreachable modules:",JSON.stringify(unexplained));
assert.deepEqual(unexplained,[],"new unreachable module: remove dead code or explicitly document why it must be retained");
assert.deepEqual(missing,[],"runtime imports must resolve locally");
console.log("PASS: runtime import graph has no unresolved local imports");
