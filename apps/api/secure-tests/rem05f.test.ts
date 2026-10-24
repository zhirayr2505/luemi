import assert from "node:assert/strict";
import test from "node:test";
import {evaluateSyntheticBlik,parseSyntheticBlik,syntheticFireKey,
 type SyntheticBlik,type SyntheticServerFacts,type BlikOperation} from "./rem05f-policy-fixture.js";
import {BlikMediaSession} from "../../web/src/discovery/bliki-media-lifecycle.js";

/* Disposable model only. This file is never registered as an API or HTTP route. */
const DAY=86400000,NOW=1760000000000;
function blik(overrides:Partial<SyntheticBlik>={}):SyntheticBlik {
 return {id:"blink_one",authorId:"author",mediaId:"media_1",mediaVersion:1,
 audience:"public",permissionRevision:1,publication:"published",moderation:"approved",
 publishedAtMs:NOW-1000,expiresAtMs:NOW-1000+DAY,
 revokedAtMs:null,worldOptIn:false,commentsEnabled:false,...overrides};
}
function facts(overrides:Partial<SyntheticServerFacts>={}):SyntheticServerFacts {
 return {viewerId:"viewer",serverNowMs:NOW,permissionRevision:1,
 currentMatchIds:new Set(),blockedIds:new Set(),viewerWorldOpened:false,
 eligible:true,premiumEntitlement:null,playback:null,...overrides};
}
const auth=(p:unknown,f= facts(),op:BlikOperation="viewer")=>evaluateSyntheticBlik(p,f,op);
const deny=(x:ReturnType<typeof auth>)=>{
 assert.equal(x.decision,"DENY");
 assert.equal(x.mediaUrl,null);
 assert.equal(x.publicViewerIdentity,null);
};
test("F02 unknown or incomplete payload denies",()=>{
 for(const p of [null,{},[],{...blik(),moderation:"unknown"},
 {...blik(),mediaVersion:0},{...blik(),audience:"followers"}])deny(auth(p));
});
test("F03 fixtures/local drafts do not inherit published authority",()=>{
 deny(auth(blik({publication:"draft"})));
 deny(auth(blik({publication:"pending"})));
 deny(auth(blik({publication:"hidden"})));
});
test("F04 synthetic id/actor are required and client-provided permission ignored",()=>{
 deny(auth(blik(),facts({viewerId:null})));
 const p={...blik(),permission:"ALLOW",canView:true,activeBlik:true};
 deny(auth(p,facts({viewerId:null})));
});
test("F05 all protected operations deny unauthenticated users",()=>{
 for(const op of ["list","detail","media","viewer","prefetch","view","fire","comment","world","author_viewers"] as const){
  deny(auth(blik({worldOptIn:true,commentsEnabled:true}),facts({viewerId:null}),op));
 }
});
test("F06 matches-only requires current match despite saved/spark/client tags",()=>{
 deny(auth({...blik({audience:"matches"}),spark:true,saved:true,match:true}));
 assert.equal(auth(blik({audience:"matches"}),facts({
  currentMatchIds:new Set(["author"])})).decision,"ALLOW_SYNTHETIC_ONLY");
});
test("F07 block prevents every read/mutation immediately",()=>{
 const f=facts({blockedIds:new Set(["author"])});
 for(const op of ["list","detail","media","viewer","prefetch","view","fire","world"] as const)
  deny(auth(blik({worldOptIn:true}),f,op));
});
test("F08 unmatch re-evaluates audience and denies once relationship removed",()=>{
 const p=blik({audience:"matches"});
 assert.equal(auth(p,facts({currentMatchIds:new Set(["author"])})).decision,"ALLOW_SYNTHETIC_ONLY");
 deny(auth(p,facts({currentMatchIds:new Set()})));
});
test("F09 expiry is enforced on server clock and 24h cap",()=>{
 deny(auth(blik({expiresAtMs:NOW})));
 deny(auth(blik({expiresAtMs:NOW+DAY+1})));
 deny(auth(blik({publishedAtMs:NOW+1,expiresAtMs:NOW+1000})));
});
test("F10 revocation denies new access regardless earlier allow",()=>{
 const p=blik();assert.equal(auth(p).decision,"ALLOW_SYNTHETIC_ONLY");
 deny(auth({...p,revokedAtMs:NOW-1}));
});
test("F11 pending/removed/rejected/unknown moderation fail closed",()=>{
 for(const moderation of ["pending","removed","rejected","unknown"]){
  deny(auth({...blik(),moderation}));
 }
});
test("F12 world requires author opt-in, public audience, and conscious opening",()=>{
 deny(auth(blik(),"world" as never)); // invalid facts must not grant
 deny(auth(blik(),facts(),"world"));
 deny(auth(blik({worldOptIn:true}),facts(),"world"));
 deny(auth(blik({audience:"matches",worldOptIn:true}),
  facts({viewerWorldOpened:true,currentMatchIds:new Set(["author"])}),"world"));
 assert.equal(auth(blik({worldOptIn:true}),facts({viewerWorldOpened:true}),"world").decision,"ALLOW_SYNTHETIC_ONLY");
});
test("F13 client-supplied flags cannot substitute server facts",()=>{
 const injected={...blik({audience:"matches"}),isAllowed:true,serverPermission:"allow",
  activeBlik:{src:"https://example.invalid/file"},entitled:true};
 deny(auth(injected,facts({viewerId:null})));
 deny(auth(injected,facts({viewerId:"viewer"})));
});
test("F14 prefetch never becomes a view event",()=>{
 const p=blik();
 assert.equal(auth(p,facts(),"prefetch").decision,"ALLOW_SYNTHETIC_ONLY");
 deny(auth(p,facts(),"view"));
 assert.equal(auth(p,facts({playback:{userInitiated:true,decodedAndVisible:true}}),"view").decision,"ALLOW_SYNTHETIC_ONLY");
 deny(auth(p,facts({playback:{userInitiated:false,decodedAndVisible:true}}),"view"));
});
test("F15 load and decode are separate; no progress before both",()=>{
 const m=new BlikMediaSession();const g=m.begin("image",6000);
 m.loaded(g);assert.equal(m.snapshot().phase,"loading");
 assert.equal(m.imageReadyToPlay(g,0),false);
 assert.equal(m.progress(3500),0);
 m.decoded(g);assert.equal(m.snapshot().phase,"ready");
 assert.equal(m.imageReadyToPlay(g,4000),true);
 assert.equal(m.progress(5000),1/6);
 m.cleanup();
});
test("F16 hold and background pause image time; video buffering is time-based",()=>{
 const m=new BlikMediaSession();const g=m.begin("image",6000);
 m.loaded(g);m.decoded(g);m.imageReadyToPlay(g,0);
 m.hold(g,true,1000);const frozen=m.progress(1000);
 m.progress(3000);assert.equal(m.progress(),frozen);
 m.hold(g,false,4000);m.visibility(g,false,4500);
 assert.equal(m.snapshot().phase,"paused");assert.equal(m.progress(6000),m.progress());
 const video=new BlikMediaSession(),v=video.begin("video",30000);
 video.videoReady(v,0);video.videoTime(v,10,20);
 assert.equal(video.progress(),.5);video.buffering(v,100);
 assert.equal(video.snapshot().phase,"buffering");
 assert.equal(video.videoTime(v,11,20),false);assert.equal(video.progress(),.5);
 video.hold(v,true,200);video.playing(v,300);assert.equal(video.snapshot().phase,"paused");
 video.visibility(v,false,400);assert.equal(video.snapshot().phase,"paused");
 m.cleanup();video.cleanup();
});
test("F17 load error cannot produce a successful view",()=>{
 const m=new BlikMediaSession();const g=m.begin("image",6000);
 assert.equal(m.error(g),true);assert.equal(m.snapshot().phase,"error");
 assert.equal(m.loaded(g),false);assert.equal(m.decoded(g),false);
 assert.equal(m.imageReadyToPlay(g,500),false);
 m.cleanup();
});
test("F18 old async generation cannot mutate newly mounted media",()=>{
 const m=new BlikMediaSession();const old=m.begin("image",5000),fresh=m.begin("image",5000);
 assert.equal(m.loaded(old),false);assert.equal(m.error(old),false);
 assert.equal(m.decoded(old),false);assert.equal(m.snapshot().phase,"loading");
 assert.equal(m.loaded(fresh),true);m.cleanup();
});
test("F19 cleanup cancels resources exactly once and rejects late callbacks",()=>{
 const m=new BlikMediaSession();const g=m.begin("video",30000);
 let freed=0;
 m.own(g,()=>freed++);m.own(g,()=>freed++);
 m.cleanup();m.cleanup();
 assert.equal(freed,2);assert.equal(m.snapshot().resources,0);
 assert.equal(m.videoReady(g,200),false);
 const next=m.begin("image",6000);
 assert.equal(m.own(g,()=>freed++),false);assert.equal(freed,3);
 m.own(next,()=>freed++);m.revoked(next);assert.equal(freed,4);
 m.cleanup();assert.equal(freed,4);
});
test("F20 unknown future API flags never mint signed URL, tokens or identity",()=>{
 const p={...blik(),authenticated:true,isPremium:true,canFetchMedia:true,
  signedUrl:"https://evil.invalid/?secret=unsafe",canStart:true};
 const decision=auth(p);
 assert.equal(decision.decision,"ALLOW_SYNTHETIC_ONLY");
 assert.equal(decision.mediaUrl,null);assert.equal(decision.publicViewerIdentity,null);
 assert.equal(JSON.stringify(decision).includes("https://"),false);
});
test("F21 fire remains distinct from match and has deterministic idempotency",()=>{
 assert.equal(syntheticFireKey("viewer","blink_one"),"viewer:blink_one");
 assert.equal(syntheticFireKey("viewer","blink_one"),syntheticFireKey("viewer","blink_one"));
 deny(auth(blik(),facts({viewerId:"author"}),"fire"));
});
test("F22 future paid comments need server verified entitlement and moderation",()=>{
 const p=blik({commentsEnabled:true});
 deny(auth(p,facts({premiumEntitlement:{serverVerified:false,active:true}}),"comment"));
 assert.equal(auth(p,facts({premiumEntitlement:{serverVerified:true,active:true}}),"comment").decision,"ALLOW_SYNTHETIC_ONLY");
 deny(auth(blik({commentsEnabled:false}),facts({premiumEntitlement:{serverVerified:true,active:true}}),"comment"));
});
test("F23 owner viewer identities do not leak in general synthetic response",()=>{
 deny(auth(blik(),facts(),"author_viewers"));
 assert.equal(auth(blik(),facts({viewerId:"author"}),"author_viewers").publicViewerIdentity,null);
});
test("F24 end/expiry/revocation are terminal and duplicate ended does not progress",()=>{
 const m=new BlikMediaSession();const g=m.begin("video",30000);
 m.videoReady(g,0);assert.equal(m.endedOnce(g),true);
 assert.equal(m.endedOnce(g),false);assert.equal(m.snapshot().phase,"paused");
 assert.equal(m.progress(),1);
 const h=m.begin("image",6000);assert.equal(m.expired(h),true);
 assert.equal(m.imageReadyToPlay(h,0),false);m.cleanup();
});
test("F25 unknown moderation and stale permission revision fail closed",()=>{
 deny(auth(blik(),facts({permissionRevision:0})));
 deny(auth({...blik(),moderation:"AUTO"}));
 deny(auth(blik({permissionRevision:2}),facts({permissionRevision:1})));
 assert.equal(parseSyntheticBlik({...blik(),mediaVersion:0}),null);
});
