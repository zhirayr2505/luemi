import assert from "node:assert/strict";
import test from "node:test";
import {localSearch,normalizeGeoapify} from "../src/geo-data.js";
test("verified demo search has no free text garbage result",()=>{
  assert.equal(localSearch("Краснодарчик").length,0);
  assert.equal(localSearch("Yerevan")[0]?.id,"offline:am:yerevan");
  assert.equal(localSearch("Ереван")[0]?.countryCode,"AM");
});
test("Geoapify parser keeps only cities with real IDs and country codes",()=>{
  const actual=normalizeGeoapify({results:[
    {place_id:"abc123",city:"Երևան",country:"Armenia",country_code:"am",result_type:"city"},
    {place_id:"street",city:"fake",country:"Armenia",country_code:"am",result_type:"street"}
  ]});
  assert.equal(actual.length,1);
  assert.equal(actual[0].id,"geo:abc123");
  assert.equal(actual[0].countryCode,"AM");
});
