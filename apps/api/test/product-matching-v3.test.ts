import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const sql=readFileSync(new URL("../../../db/chats-v4-product-matching.sql",import.meta.url),"utf8");
const preferences=readFileSync(new URL("../../../infra/migrations/0011_discovery_preferences.sql",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/matches-api.ts",import.meta.url),"utf8");
const publication=readFileSync(new URL("../src/real-publication.ts",import.meta.url),"utf8");

test("legacy published profiles keep discovery access after preference migration",()=>{
 assert.match(preferences,/INSERT INTO luemi_private\.discovery_preferences/);
 assert.match(preferences,/FROM luemi_private\.public_profiles/);
 assert.match(preferences,/WHERE publication_status='published'/);
 assert.match(publication,/data\.audience\?\?"everyone"/);
 assert.match(publication,/data\.ageMin\?\?18/);
 assert.match(publication,/data\.ageMax\?\?80/);
 assert.match(publication,/WHERE NOT EXISTS\(SELECT 1 FROM luemi_private\.discovery_preferences/);
 assert.match(publication,/pref\.owner_gender IS NULL OR p\.audience='everyone'/);
});

test("weekly and purchased superlikes are physically separate and weekly-first",()=>{
 assert.match(sql,/weekly_remaining smallint/);
 assert.match(sql,/purchased_remaining integer/);
 assert.match(api,/weekly_remaining>0 THEN weekly_remaining-1/);
 assert.match(api,/weekly_remaining>0 THEN purchased_remaining ELSE purchased_remaining-1/);
 assert.match(api,/date_trunc\('week',timezone\('UTC'/);
});

test("mutual like creates a match without eagerly creating a chat",()=>{
 const like=api.split('app.post<{Body:{targetId?:unknown;kind?:unknown}}>("/api/v4/matches/like"')[1]
  ?.split('app.get("/api/v4/matches/incoming"')[0]??"";
 assert.match(like,/INSERT INTO luemi_chats\.matches/);
 assert.doesNotMatch(like,/INSERT INTO luemi_chats\.conversations/);
 const open=api.split('app.post<{Params:{id:string}}>("/api/v4/matches/:id/open"')[1]??"";
 assert.match(open,/INSERT INTO luemi_chats\.conversations/);
});

test("free incoming visibility keeps all superlikes plus three ordinary likes",()=>{
 assert.match(api,/incoming_like_reveals/);
 assert.match(api,/LIMIT greatest\(0,3-/);
 assert.match(api,/\[\.\.\.special,\.\.\.ordinary\]/);
 assert.match(api,/hiddenCount/);
 assert.match(api,/kind==="super"/);
});
