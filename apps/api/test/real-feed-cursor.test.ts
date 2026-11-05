import test from "node:test";
import assert from "node:assert/strict";
import {encodePublishedFeedCursor,decodePublishedFeedCursor} from "../src/real-feed-cursor.js";

const a={offset:20};
test("ranked discovery cursor round-trip preserves only a bounded position",()=>{
 const encoded=encodePublishedFeedCursor(a);
 assert.deepEqual(decodePublishedFeedCursor(encoded),a);
 assert.equal(decodePublishedFeedCursor(undefined),null);
 assert(!encoded.includes("telegram"));
 assert(encoded.length<256);
});
test("discovery refuses noncanonical, malformed, arbitrarily large and forged cursors",()=>{
 const bad:unknown[]=["","?",42,null,[],{}, "a".repeat(500),
  Buffer.from(JSON.stringify(["rank-v1"])).toString("base64url"),
  Buffer.from(JSON.stringify(["rank-v1",20,40])).toString("base64url"),
  Buffer.from(JSON.stringify(["invalid",20])).toString("base64url"),
  Buffer.from(JSON.stringify(["rank-v1",0])).toString("base64url"),
  Buffer.from(JSON.stringify(["rank-v1",10001])).toString("base64url")
 ];
 for(const raw of bad)assert.throws(()=>decodePublishedFeedCursor(raw),/invalid_public_feed_cursor/);
 assert.throws(()=>encodePublishedFeedCursor({offset:0}),/invalid/);
});
test("a cursor cannot smuggle SQL, null bytes or another user's authorization",()=>{
 for(const candidate of ["'+OR+1=1--","../../storage","ab===00",
  Buffer.from(JSON.stringify(["rank-v1","' OR TRUE; DROP TABLE actors;--"])).toString("base64url")])
  assert.throws(()=>decodePublishedFeedCursor(candidate),/invalid/);
});
