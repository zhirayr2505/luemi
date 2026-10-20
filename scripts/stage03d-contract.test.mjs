import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../apps/web/src/discovery/for-you-ranking.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const m=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const draft={goal:"relationship",interests:["музыка","кофе"],languages:["ru"],countryCode:"ru",city:"Краснодар"};
const p=(id,interest,goal,country="ru",city="Краснодар")=>({
 id,interests:interest,goal,countryCode:country,city,languages:["ru"]
});
const a=p("a",["музыка","кофе"],"relationship");
const b=p("b",["кино"],"dates");
assert.equal(m.evidence(a,draft).score,12);
assert.deepEqual(m.evidence(a,draft).interests,["музыка","кофе"]);
assert.equal(m.evidence(b,draft).score,2);
assert.deepEqual(m.rankDemonstrations([b,a],draft).map(p=>p.id),["a","b"]);
assert.equal(m.collectionDefinitions.length,8);
assert.equal(m.membersFor("online",[a],draft,{scope:"radius"}).length,0);
assert.equal(m.membersFor("new",[a],draft,{scope:"radius"}).length,0);
assert.deepEqual(m.membersFor("common",[a,b],draft,{scope:"radius"}).map(x=>x.id),["a"]);
assert.deepEqual(m.membersFor("goals",[a,b],draft,{scope:"radius"}).map(x=>x.id),["a"]);
assert.equal(m.membersFor("nearby",[a],draft,{scope:"world"}).length,0);
assert.equal(m.membersFor("nearby",[a],draft,{scope:"radius"}).length,1);
assert.equal(m.membersFor("international",[a,p("c",[],"dates","am")],draft,{scope:"world"}).length,1);
assert.equal(m.membersFor("travel",[p("t",["путешествия"],"dates")],draft,{scope:"world"}).length,1);
console.log("✓ Stage 03D evidence-only recommendation and eight-collection contracts");
