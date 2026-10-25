/** LUEMI architecture guard: discover unreachable runtime modules from AST graph.
 * No dynamic eval; never deletes files. Intentional QA and REM feature modules
 * are explicit exceptions, so stale code is not silently normalized as active.
 */
import ts from "typescript";
import {readFileSync,readdirSync,existsSync} from "node:fs";
import path from "node:path";

const root=process.cwd(),ext=[".ts",".tsx",".css"];
const paths=[];
function walk(dir){
 if(!existsSync(dir))return;
 for(const ent of readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,ent.name);
  if(ent.isDirectory()){walk(file);continue;}
  if(ent.isFile()&&ext.some(s=>file.endsWith(s)))paths.push(path.relative(root,file).replaceAll(path.sep,"/"));
 }
}
walk(path.join(root,"apps/web/src"));
walk(path.join(root,"apps/api/src"));
walk(path.join(root,"packages/contracts/src"));
const all=new Set(paths),graph=new Map();
function resolve(file,spec){
 if(spec==="@luemi/contracts")return "packages/contracts/src/index.ts";
 if(!spec.startsWith("."))return null;
 const from=path.posix.dirname(file),name=path.posix.normalize(path.posix.join(from,spec));
 // NodeNext TypeScript imports intentionally use .js specifiers in .ts files.
 const base=name.replace(/\.(?:m?js|cjs)$/,"");
 return [name,base,...ext.map(e=>base+e),...["index.ts","index.tsx"].map(e=>base+"/"+e)]
  .find(v=>all.has(v))??null;
}
for(const file of paths){
 if(file.endsWith(".css")){graph.set(file,[]);continue;}
 const data=readFileSync(path.join(root,file),"utf8");
 const source=ts.createSourceFile(file,data,ts.ScriptTarget.Latest,true,
  file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const imports=new Set();
 const add=str=>{const target=resolve(file,str);if(target)imports.add(target)};
 const visit=node=>{
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&
    node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))add(node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&
    node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]))add(node.arguments[0].text);
  ts.forEachChild(node,visit);
 };
 visit(source);
 graph.set(file,[...imports]);
}
const roots=["apps/web/src/main.tsx","apps/api/src/server.ts"];
const qaRoots=paths.filter(p=>/\/(?:profile-qa|rem-\d+[a-z]?(?:-[\w-]+)?-qa)\.tsx?$/.test(p));
const intentional={
 "apps/api/src/rem05e-telegram-rotation.ts":"standalone operator CLI; not a boot-time server import",
 "apps/api/src/real-erasure-worker.ts":"security-sensitive manually invoked worker, intentionally not reachable from HTTP startup",
 "apps/api/src/erasure-runner.ts":"explicitly gated maintenance CLI; never imported by web server",
 "apps/api/src/beta-invite-operator.ts":"standalone allowlist operator; never imported by HTTP app",
 "apps/api/src/human-moderation.ts":"isolated human moderator; imported only by operator CLI",
 "apps/api/src/human-review-runner.ts":"explicitly authorized private review CLI, not an HTTP route",
 "apps/api/src/safety-operator.ts":"isolated safety role operations, only imported by operator CLI",
 "apps/api/src/safety-runner.ts":"explicitly gated safety operator CLI, never available via HTTP",
 "apps/api/src/private-storage-probe.ts":"standalone synthetic Storage round-trip verifier, never live HTTP",
 "apps/api/src/private-storage-probe-runner.ts":"explicitly gated LUEMI-only Storage operator CLI",
 "apps/web/src/discovery/bliki-media-lifecycle.ts":"future Bliki readiness state machine, kept for accepted REM-05F work"
};
function reach(entries){
 const done=new Set(),todo=[...entries];while(todo.length){
  const p=todo.pop();if(!all.has(p)||done.has(p))continue;done.add(p);
  for(const next of graph.get(p)||[])todo.push(next);
 }
 return done;
}
const prod=reach(roots),qa=reach(qaRoots);

// Report strongly connected groups of modules. This is diagnostic until
// type-only imports are classified separately: a TypeScript type cycle does
// not necessarily imply a runtime initialization loop.
function dependencyCycles(active){
 const ids=new Map(),low=new Map(),stack=[],inStack=new Set(),groups=[];
 let serial=0;
 const visit=p=>{
  ids.set(p,serial);low.set(p,serial++);stack.push(p);inStack.add(p);
  for(const to of graph.get(p)||[]){
   if(!active.has(to))continue;
   if(!ids.has(to)){visit(to);low.set(p,Math.min(low.get(p),low.get(to)))}
   else if(inStack.has(to))low.set(p,Math.min(low.get(p),ids.get(to)));
  }
  if(low.get(p)===ids.get(p)){
   const group=[];let to;
   do{to=stack.pop();inStack.delete(to);group.push(to)}while(to!==p);
   if(group.length>1||(graph.get(p)||[]).includes(p))
    groups.push(group.sort());
  }
 };
 for(const p of active)if(!ids.has(p))visit(p);
 return groups.sort((a,b)=>a[0].localeCompare(b[0]));
}
const productionImportCycles=dependencyCycles(prod);

const unused=paths.filter(p=>!prod.has(p)&&!qa.has(p)&&!(p in intentional));
const ignored=Object.keys(intentional).filter(p=>!all.has(p));
// Guard against reintroducing old helpers as new parallel motion paths.
// TypeScript AST identifiers ignore comments, which can document historical code.
const retired=new Set(["animateValue","createGuardedCompletion",
 "createProfileMotionControllers","gestureCapabilities",
 "blockedNative","blocksNative"]);
const retiredUsages=[],retiredFlags=[];
for(const file of paths){
 const code=readFileSync(path.join(root,file),"utf8");
 if(code.includes("data-route-revealing")||code.includes("route-reveal")||code.includes("pm-blik-viewer"))
  retiredFlags.push(file);
 if(file.endsWith(".css"))continue;
 const source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,
  file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const scan=node=>{
  if(ts.isIdentifier(node)&&retired.has(node.text))
   retiredUsages.push(file+":"+node.text);
  ts.forEachChild(node,scan);
 };
 scan(source);
}
// Additional diagnostic, NOT a deletion gate: find exported symbols absent from
// other tracked TypeScript/JS sources. Barrels, dynamic consumers, package APIs
// and test fixtures can produce false positives; each candidate needs proof.
const codeFiles=[...paths.filter(p=>!p.endsWith(".css"))];
function scriptWalk(dir){
 if(!existsSync(dir))return;
 for(const ent of readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,ent.name);
  if(ent.isDirectory()){scriptWalk(full);continue;}
  if(ent.isFile()&&/\.(?:[cm]?js|[cm]?ts|tsx)$/.test(ent.name))
   {const rel=path.relative(root,full).replaceAll(path.sep,"/");
    if(!codeFiles.includes(rel))codeFiles.push(rel);}
 }
}
scriptWalk(path.join(root,"scripts"));
scriptWalk(path.join(root,"apps/api/test"));
scriptWalk(path.join(root,"apps/api/secure-tests"));
scriptWalk(path.join(root,"apps/web"));
const content=new Map(codeFiles.map(file=>[file,readFileSync(path.join(root,file),"utf8")]));
const suspectedUnusedExports=[];
for(const file of paths.filter(p=>/\.[jt]sx?$/.test(p))){
 const source=ts.createSourceFile(file,content.get(file),ts.ScriptTarget.Latest,true,
  file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 for(const node of source.statements){
  const mods=ts.canHaveModifiers(node)?ts.getModifiers(node)??[]:[];
  if(!mods.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)||
    mods.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword))continue;
  const names=[];
  if(ts.isVariableStatement(node)){
   for(const decl of node.declarationList.declarations)
    if(ts.isIdentifier(decl.name))names.push(decl.name.text);
  }else if(("name" in node)&&node.name&&ts.isIdentifier(node.name))
   names.push(node.name.text);
  for(const name of names){
   // Whole identifier boundaries avoid counting 'foo' merely inside 'foobar'.
   const token=new RegExp("(?<![\\w$])"+name+"(?![\\w$])");
   if(!codeFiles.some(p=>p!==file&&token.test(content.get(p))))
    suspectedUnusedExports.push({file,name});
  }
 }
}

const view={files:paths.length,production:prod.size,qa:qa.size,roots,qaRoots,
 suspectedUnusedExports,
 productionImportCycles,
 retiredUsages,retiredFlags,
 intentional:Object.entries(intentional).map(([path,reason])=>({path,reason})),
 unreachable:unused,staleExemptions:ignored};
console.log("LUEMI_ARCHITECTURE_AUDIT "+JSON.stringify(view));
if(process.argv.includes("--strict")&&(unused.length||ignored.length||retiredUsages.length||retiredFlags.length||productionImportCycles.length)){
 console.error("ARCHITECTURE_AUDIT_FAIL: unreachable modules, dependency cycles or retired gesture/motion paths require removal.");
 process.exitCode=1;
}
