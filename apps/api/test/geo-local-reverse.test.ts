import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type {FastifyRequest} from "fastify";
import {localReverseCity} from "../src/geo-data.js";
import {registerGeography} from "../src/geo-routes.js";

test("a known nearby city resolves without external coordinates disclosure",()=>{
 assert.deepEqual(localReverseCity(45.032778,38.976944),{
  id:"offline:ru:krasnodar",city:"Краснодар",
  country:"Россия",countryCode:"RU",region:"Краснодарский край"
 });
 assert.equal(localReverseCity(45.09,39.01)?.city,"Краснодар");
 assert.equal(localReverseCity(55.753930,37.620795)?.city,"Москва");
 assert.equal(localReverseCity(40.1792,44.4991)?.city,"Ереван");
});
test("offline reverse never assigns a distant or malformed coordinate to a city",()=>{
 for(const coords of [[0,0],[52.5,13.4],[45.9,38.9],[91,37],[NaN,38],[45,Infinity]]){
  assert.equal(localReverseCity(coords[0],coords[1]),null);
 }
});
test("authenticated explicit limited reverse works without provider key or budget",async()=>{
 const app=Fastify({logger:false});
 const authenticate=async(request:FastifyRequest)=>{
  request.authActor={actorId:"11111111-1111-4111-8111-111111111111",
   sessionId:"22222222-2222-4222-8222-222222222222",hash:Buffer.alloc(32),
   firstName:"Tester",expiresAt:new Date(Date.now()+60_000).toISOString()};
 };
 const guard={read:authenticate,geoRead:authenticate,mutation:authenticate};
 registerGeography(app,{enabled:true,providerEnabled:false,localReverseEnabled:true,providerKey:""},guard);
 try{
  const reverse=await app.inject({method:"POST",url:"/api/v2/geo/reverse",
   headers:{"content-type":"application/json"},payload:{lat:45.032778,lon:38.976944}});
  assert.equal(reverse.statusCode,200);
  assert.equal(reverse.json().result.id,"offline:ru:krasnodar");
  assert.equal(reverse.json().result.lat,undefined);
  const unmatched=await app.inject({method:"POST",url:"/api/v2/geo/reverse",
   headers:{"content-type":"application/json"},payload:{lat:52.5,lon:13.4}});
  assert.equal(unmatched.statusCode,404);
  assert.deepEqual(unmatched.json(),{error:"city_not_found"});
  const invalid=await app.inject({method:"POST",url:"/api/v2/geo/reverse",
   headers:{"content-type":"application/json"},payload:{lat:92,lon:13.4}});
  assert.equal(invalid.statusCode,400);
  const list=await app.inject({method:"GET",url:"/api/v2/geo/search?q=%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B4%D0%B0%D1%80"});
  assert.equal(list.statusCode,200);
  assert.equal(list.json().coverage,"limited");
 }finally{await app.close();}
});
test("legacy mode stays denied for reverse without explicit opt-in",async()=>{
 const app=Fastify({logger:false});
 const authenticate=async(request:FastifyRequest)=>{
  request.authActor={actorId:"11111111-1111-4111-8111-111111111111",
   sessionId:"22222222-2222-4222-8222-222222222222",hash:Buffer.alloc(32),
   firstName:"Tester",expiresAt:new Date(Date.now()+60_000).toISOString()};
 };
 const guard={read:authenticate,geoRead:authenticate,mutation:authenticate};
 registerGeography(app,{enabled:true,providerEnabled:false,providerKey:""},guard);
 try{
  const response=await app.inject({method:"POST",url:"/api/v2/geo/reverse",
   headers:{"content-type":"application/json"},payload:{lat:45.032778,lon:38.976944}});
  assert.equal(response.statusCode,503);
 }finally{await app.close();}
});
