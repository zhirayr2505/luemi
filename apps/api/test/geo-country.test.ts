import assert from "node:assert/strict";
import {test} from "node:test";
import {normalizeCountryCode} from "@luemi/contracts";
import {normalizeGeoapify,localSearch} from "../src/geo-data.js";
test("LU-17 API normalized Geoapify country_code",()=>{
 const x=normalizeGeoapify({results:[
  {result_type:"city",place_id:"id1",city:"Краснодар",country:"Россия",country_code:" ru "},
  {result_type:"city",place_id:"id2",city:"Ереван",country:"Армения",country_code:"am"},
  {result_type:"city",place_id:"id3",city:"City",country:"C",country_code:"RUS"},
  {result_type:"city",place_id:"id4",city:"City",country:"C",country_code:null}
 ]});
 assert.deepEqual(x.map(i=>i.countryCode),["RU","AM"]);
 assert.equal(normalizeCountryCode("zz"),"ZZ");
 assert.equal(normalizeCountryCode(""),null);
 assert.equal(localSearch("краснодар")[0]?.countryCode,"RU");
});
