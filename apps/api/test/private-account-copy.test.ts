import test from "node:test";
import assert from "node:assert/strict";
import {safeOwnerAbout} from "../../web/src/registration/private-account-copy.js";

test("owner profile preserves ordinary multilingual bio and punctuation",()=>{
 const value="Привет! Люблю армянскую музыку, кофе ☕ и ночные прогулки.";
 assert.deepEqual(safeOwnerAbout(value),{text:value,containsCredential:false});
});
test("owner card never displays a credential-looking bio in a screenshot",()=>{
 const fake="987654321:TEST_"+("A".repeat(40));
 const original="Привет, "+fake+" передал сюда по ошибке\n"+fake;
 const result=safeOwnerAbout(original);
 assert.equal(result.containsCredential,true);
 assert(!result.text.includes(fake));
 assert(!result.text.includes("Привет"));
 assert.match(result.text,/Описание скрыто/);
});
test("long but nonsecret user input is left unchanged and styled to wrap",()=>{
 const safe="МногоДлинныхСлов".repeat(120);
 const result=safeOwnerAbout(safe);
 assert.equal(result.containsCredential,false);
 assert.equal(result.text,safe);
});
