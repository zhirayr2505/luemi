import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../apps/web/src/discovery/nearby-logic.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const m=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const draft={city:"Краснодар",countryCode:"ru",interests:["музыка"],languages:["ru"]};
const mk=(id,city,countryCode,interests=[])=>({id,city,countryCode,interests,age:25,gender:"woman",goal:"friendship",languages:["ru"]});
const city=mk("a","Краснодар","ru",["музыка"]);
const city2=mk("b","краснодар","ru",[]);
const another=mk("c","Москва","ru",["музыка"]);
const foreign=mk("d","Ереван","am",["музыка"]);
assert.ok(m.sameDeclaredCity(city,draft));
assert.ok(m.sameDeclaredCity(city2,draft),"NFC/lowercase matching");
assert.equal(m.sameDeclaredCity(another,draft),false);
assert.equal(m.sameDeclaredCity(foreign,{...draft,city:"Ереван"}),false,"city alone never overrides country");
assert.deepEqual(m.selectNearbyDemos([another,city2,foreign,city],draft,"radius").map(x=>x.id),["a","b"]);
assert.deepEqual(m.selectNearbyDemos([foreign,another,city2,city],draft,"country").map(x=>x.id),["a","c","b"]);
assert.equal(m.selectNearbyDemos([foreign,another,city2,city],draft,"world").length,4);
assert.equal(m.selectNearbyDemos([city],{...draft,city:""},"radius").length,0);
assert.equal(m.selectNearbyDemos([city],{...draft,countryCode:""},"country").length,0);
assert.equal(m.nearbyTitle("world"),"Люди со всего мира");

const component=readFileSync(new URL("../apps/web/src/discovery/Nearby.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../apps/web/src/discovery/nearby.css",import.meta.url),"utf8");
const discovery=readFileSync(new URL("../apps/web/src/discovery/DiscoveryApp.tsx",import.meta.url),"utf8");
const model=readFileSync(new URL("../apps/web/src/discovery/model.ts",import.meta.url),"utf8");
const feed=readFileSync(new URL("../apps/web/src/discovery/FeedCard.tsx",import.meta.url),"utf8");
assert.ok(component.includes('scope:"world"')&&component.includes("selectNearbyDemos"),"neutralize fake distance while preserving hard filters");
assert.ok(component.includes("draft.interests.find(id=>person.interests.includes(id))"),"only actual shared-interest tags");
assert.ok(component.includes("loading=\"lazy\"")&&component.includes("IntersectionObserver"),"lazy media and bounded incremental rendering");
assert.ok(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),"two-column portrait grid");
assert.ok(css.includes("touch-action:pan-y")&&css.includes("aspect-ratio:4/5"),"vertical scroll from photos, 4:5 geometry");
// Source contract guards ownership boundaries; actual pointer/touch behavior is
// exercised in rem-00c-browser-behavior.mjs (required browser CI lane).
assert.match(discovery, /<Nearby\b[^>]*\bdraft=\{draft\}/, "Nearby must receive real draft with any additional props");
const downSource=discovery.slice(discovery.indexOf("const down="),discovery.indexOf("const move="));
assert.ok(downSource.includes(".nb-card,.nb-location"), "card and location controls retain child gesture ownership");
assert.ok(!downSource.includes(".nb-scroll,.nb-card"), "Nearby background must be eligible for parent pager gesture");

assert.ok(discovery.includes("onSave={toggleForYouSave}")&&discovery.includes("onPerson={setPersonOpen}"),"shared save and existing public profile");
assert.ok(discovery.includes('event.animationName==="luemi-deck-leave"')&&feed.includes("discovery-deck-current"),"Feed motion remains intact");
assert.ok(model.includes("radius:5000"),"existing geography setting unchanged");
assert.ok(!component.includes("demoDistanceKm(")&&!source.includes("demoDistanceKm("),"no synthetic kilometre-based proximity function calls");
console.log("✓ Stage 03E: strict declared location, dual column, gesture safety, savings, Feed/radius locks");

assert.ok(discovery.includes('nearbyPrepared&&<Nearby draft={draft}'),"Nearby prepared only on demand");
assert.ok(discovery.includes("if(bounded===2)setNearbyPrepared(true)")&&discovery.includes("requestIdleCallback"),"Nearby prewarmed only outside the critical For You transition");
