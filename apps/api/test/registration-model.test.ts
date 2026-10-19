import assert from "node:assert/strict";
import test from "node:test";
import { birthDateValid, newDraft, validateStep } from "../../web/src/registration/model.js";

test("accepts real adult dates and rejects underage, future and invalid calendar dates",()=>{
  const now=new Date("2026-10-19T12:00:00Z");
  assert.equal(birthDateValid("19","10","2008",now),true);
  assert.equal(birthDateValid("20","10","2008",now),false);
  assert.equal(birthDateValid("31","02","1995",now),false);
  assert.equal(birthDateValid("29","02","2000",now),true);
  assert.equal(birthDateValid("29","02","2001",now),false);
});
test("enforces steps 1 and 2, while unfinished photo draft still permits preview",()=>{
  const today=new Date("2026-10-19T00:00:00Z");
  const d=newDraft("Тест");
  assert.equal(validateStep(d,1,0,today),"Подтверди условия тестового режима.");
  d.trialConsent=true;
  assert.equal(validateStep(d,1,0,today),null);
  d.day="19";d.month="10";d.year="2008";d.gender="man";
  assert.equal(validateStep(d,2,0,today),null);
  d.year="2009";
  assert.notEqual(validateStep(d,2,0,today),null);
  assert.equal(validateStep(d,7,0,today),null);
});
test("interest limit and age boundaries validated",()=>{
  const d=newDraft("Тест");
  d.interests=Array.from({length:16},(_,i)=>String(i));
  assert.notEqual(validateStep(d,5,0),null);
  d.interests=d.interests.slice(0,15);
  assert.equal(validateStep(d,5,0),null);
  d.audience="everyone";d.goal="relationship";d.ageMin=50;d.ageMax=30;
  assert.notEqual(validateStep(d,4,0),null);
});
