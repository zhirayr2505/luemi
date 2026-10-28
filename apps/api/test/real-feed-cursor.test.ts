import test from "node:test";
import assert from "node:assert/strict";
import {encodePublishedFeedCursor,decodePublishedFeedCursor} from "../src/real-feed-cursor.js";

const a={at:"2026-10-28T19:10:23.000Z",id:"00000000-0000-4000-8000-000000000001"};
test("discovery cursor round-trip preserves timestamp and UUID with no private fields",()=>{
 const encoded=encodePublishedFeedCursor(a);
 assert.deepEqual(decodePublishedFeedCursor(encoded),a);
 assert.equal(decodePublishedFeedCursor(undefined),null);
 assert(!encoded.includes("telegram"));
 assert(encoded.length<256);
});
test("discovery refuses noncanonical, malformed, arbitrarily large and forged cursors",()=>{
 const bad:unknown[]=["","?",42,null,[],{}, "a".repeat(500),
  Buffer.from(JSON.stringify(["2026-10-28T19:10:23.000Z"])).toString("base64url"),
  Buffer.from(JSON.stringify(["2026-10-28T19:10:23.000Z",a.id,a.id])).toString("base64url"),
  Buffer.from(JSON.stringify(["invalid",a.id])).toString("base64url"),
  Buffer.from(JSON.stringify([a.at,"not-a-uuid"])).toString("base64url"),
  Buffer.from(JSON.stringify(["2026-10-28T19:10:23Z",a.id])).toString("base64url")
 ];
 for(const raw of bad)assert.throws(()=>decodePublishedFeedCursor(raw),/invalid_public_feed_cursor/);
 assert.throws(()=>encodePublishedFeedCursor({at:"2026-10-28T19:10:23Z",id:a.id}),/invalid/);
});
test("a cursor cannot smuggle SQL, null bytes or another user's authorization",()=>{
 for(const candidate of ["'+OR+1=1--","../../storage","ab===00",
  Buffer.from(JSON.stringify([a.at,"' OR TRUE; DROP TABLE actors;--"])).toString("base64url")])
  assert.throws(()=>decodePublishedFeedCursor(candidate),/invalid/);
});
