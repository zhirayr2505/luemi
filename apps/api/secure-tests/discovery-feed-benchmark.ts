import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {performance} from "node:perf_hooks";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";
import {memoryPrivateStore} from "../src/rem05d-private.js";
import {encodePublishedFeedCursor} from "../src/real-feed-cursor.js";

const adminUrl=process.env.REG01_ADMIN_DATABASE_URL;
const issuerUrl=process.env.REG01_ISSUER_DATABASE_URL;
const requestUrl=process.env.REG01_REQUEST_DATABASE_URL;
const publisherUrl=process.env.REG01_PUBLISHER_DATABASE_URL;
const readerUrl=process.env.REG01_READER_DATABASE_URL;
if(process.env.FEED_BENCH_CONFIRM_DISPOSABLE!=="1") {
  throw new Error("Refusing to run without FEED_BENCH_CONFIRM_DISPOSABLE=1");
}
if(!adminUrl||!issuerUrl||!requestUrl||!publisherUrl||!readerUrl) {
  throw new Error("Feed benchmark requires the isolated REG01 PostgreSQL roles");
}
const profileCount=Number(process.env.FEED_BENCH_PROFILE_COUNT??"10000");
if(!Number.isSafeInteger(profileCount)||![10000,25000,100000].includes(profileCount)) {
  throw new Error("FEED_BENCH_PROFILE_COUNT must be 10000, 25000 or 100000");
}

const admin=new Pool({connectionString:adminUrl,max:1,connectionTimeoutMillis:3000});
const botToken="123456:synthetic_feed_benchmark_bot";
const origin="https://ci.luemi.invalid";
const namespace="feed_bench_"+Date.now().toString(36);
const consentVersion="ci-feed-benchmark-v1";
const baseTelegramId=(BigInt(Date.now())*1000n).toString();
const viewerTelegramId=Number(BigInt(baseTelegramId)-1n);
let viewerActorId:string|undefined;
let app:ReturnType<typeof buildApp>|undefined;

function signedInitData(id:number):string {
  const data={
    auth_date:String(Math.floor(Date.now()/1000)),
    user:JSON.stringify({id,first_name:"Feed benchmark viewer"})
  };
  const message=Object.entries(data).sort(([a],[b])=>a.localeCompare(b,"en"))
    .map(([key,value])=>key+"="+value).join("\n");
  const secret=createHmac("sha256","WebAppData").update(botToken).digest();
  const hash=createHmac("sha256",secret).update(message).digest("hex");
  return new URLSearchParams({...data,hash}).toString();
}

function percentile(values:number[],p:number):number {
  const sorted=[...values].sort((a,b)=>a-b);
  return Number(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)].toFixed(2));
}

async function sample(url:string,expectedProfiles:number):Promise<number[]> {
  const values:number[]=[];
  for(let i=0;i<10;i++) {
    const started=performance.now();
    const response=await app!.inject({method:"GET",url,headers:{cookie:viewerCookie}});
    const elapsed=performance.now()-started;
    assert.equal(response.statusCode,200,response.body);
    const payload=response.json() as {profiles?:unknown[]};
    assert.ok(Array.isArray(payload.profiles),"Feed response must contain profiles");
    assert.equal(payload.profiles.length,expectedProfiles,
      "Synthetic feed must return the expected 20-profile page");
    values.push(elapsed);
  }
  return values;
}

let viewerCookie="";
try {
  const database=await admin.query<{name:string}>("SELECT current_database() AS name");
  assert.equal(database.rows[0]?.name,"reg01_disposable",
    "Benchmark is restricted to the disposable REG01 CI database");

  // Synthetic-only candidates are isolated by a unique environment and a
  // timestamp-derived Telegram ID range. No storage objects or real accounts
  // are created; Discovery reads only these synthetic metadata rows.
  const seeded=await admin.query(
    `WITH inserted_actors AS (
       INSERT INTO luemi_private.actors(id,environment,telegram_id,first_name,status)
       SELECT gen_random_uuid(),$1,$2::bigint+series.i::bigint,'Feed benchmark','active'
       FROM generate_series(1,$3::integer) AS series(i)
       RETURNING id
     ), inserted_profiles AS (
       INSERT INTO luemi_private.public_profiles(
         owner_id,environment,publication_status,published_revision,
         display_name,city_label,country_code,about,interests,gender,goal,
         languages,birth_date,published_at,audience,preferred_age_min,preferred_age_max
       )
       SELECT id,$1,'published',1,'Benchmark profile','Yerevan','AM',
         'Synthetic load-test profile',ARRAY['music','travel'],'woman','friendship',
         ARRAY[]::text[],DATE '1995-01-01',clock_timestamp(),
         'everyone',18,80
       FROM inserted_actors
       RETURNING owner_id
     )
     INSERT INTO luemi_private.media_assets(
       id,owner_id,environment,original_key,derivative_key,generation,state,
       publication_status,actual_mime,byte_count,width,height,content_sha256,position
     )
     SELECT gen_random_uuid(),p.owner_id,$1,
       'original-'||md5(p.owner_id::text||':'||slots.position::text),
       'derivative-'||md5(p.owner_id::text||':'||slots.position::text),
       1,'approved','published','image/png',1024,64,64,
       md5(p.owner_id::text||':sha-a:'||slots.position::text)||md5(p.owner_id::text||':sha-b:'||slots.position::text),
       slots.position-1
     FROM inserted_profiles p CROSS JOIN generate_series(1,3) AS slots(position)`,
    [namespace,baseTelegramId,profileCount]
  );
  assert.equal(seeded.rowCount,profileCount*3,
    "Each synthetic published profile must have exactly three approved media rows");

  await admin.query("ANALYZE luemi_private.actors");
  await admin.query("ANALYZE luemi_private.public_profiles");
  await admin.query("ANALYZE luemi_private.media_assets");

  app=buildApp({
    port:3001,origin,botToken,webhookSecret:"",healthKey:"synthetic_feed_benchmark_health_key_123",
    logger:false,
    rem05b:{
      enabled:true,issuerDatabaseUrl:issuerUrl,requestDatabaseUrl:requestUrl,
      pepper:"synthetic-feed-benchmark-pepper-12345678901234567890",
      namespace,origin,botToken,idleMs:43200000,absoluteMs:604800000,maxSessions:5
    },
    realPublication:{
      enabled:true,requestDatabaseUrl:requestUrl,publisherDatabaseUrl:publisherUrl,
      discoveryDatabaseUrl:readerUrl,namespace,consentVersion,storage:memoryPrivateStore()
    }
  });

  const auth=await app.inject({
    method:"POST",url:"/api/v2/auth/telegram",
    headers:{origin,"sec-fetch-site":"same-origin"},
    payload:{initData:signedInitData(viewerTelegramId)}
  });
  assert.equal(auth.statusCode,200,auth.body);
  const identity=auth.json() as {user?:{id?:string}};
  assert.ok(identity.user?.id,"Synthetic viewer must receive a server-side actor ID");
  viewerActorId=identity.user.id;
  await admin.query(
    "INSERT INTO luemi_private.private_profile_drafts(owner_id,environment,revision,payload,birth_date,consent_version) VALUES($1,$2,1,'{}'::jsonb,DATE '1995-01-01',$3)",
    [viewerActorId,namespace,consentVersion]
  );
  viewerCookie=String(auth.headers["set-cookie"]??"").split(";")[0];
  assert.match(viewerCookie,/^__Host-luemi_sid=/);

  // Warm the route once, then take ten serial samples for each page position.
  const warmup=await app.inject({
    method:"GET",url:"/api/v3/discovery/feed",headers:{cookie:viewerCookie}
  });
  assert.equal(warmup.statusCode,200,warmup.body);
  assert.equal((warmup.json() as {profiles:unknown[]}).profiles.length,20);

  const firstPage=await sample("/api/v3/discovery/feed",20);
  const deepOffset=Math.min(10000,profileCount-20);
  const deepCursor=encodePublishedFeedCursor({offset:deepOffset});
  const deepPage=await sample("/api/v3/discovery/feed?after="+encodeURIComponent(deepCursor),20);
  const version=await admin.query<{version:string}>("SELECT version() AS version");

  console.log("LUEMI_DISCOVERY_FEED_BENCHMARK "+JSON.stringify({
    database:database.rows[0].name,
    postgres:version.rows[0].version,
    syntheticProfiles:profileCount,
    syntheticApprovedMedia:seeded.rowCount,
    samplesPerPage:10,
    warmupRequests:1,
    firstPageMs:{p50:percentile(firstPage,.5),p95:percentile(firstPage,.95),samples:firstPage.map(x=>Number(x.toFixed(2)))},
    deepPage:{offset:deepOffset,p50:percentile(deepPage,.5),p95:percentile(deepPage,.95),samples:deepPage.map(x=>Number(x.toFixed(2)))},
    note:"End-to-end authenticated API timing against disposable synthetic PostgreSQL data; no latency threshold is asserted."
  }));
} finally {
  if(app) await app.close().catch(()=>{});
  // Delete only the isolated synthetic environment and the single synthetic viewer.
  const lower=BigInt(baseTelegramId),upper=lower+BigInt(profileCount)+1n;
  await admin.query(
    `DELETE FROM luemi_private.media_assets
     WHERE environment=$1 AND owner_id IN (
       SELECT id FROM luemi_private.actors
       WHERE environment=$1 AND telegram_id >= $2::bigint AND telegram_id < $3::bigint
     )`,
    [namespace,lower.toString(),upper.toString()]
  ).catch(()=>{});
  await admin.query(
    `DELETE FROM luemi_private.public_profiles
     WHERE environment=$1 AND owner_id IN (
       SELECT id FROM luemi_private.actors
       WHERE environment=$1 AND telegram_id >= $2::bigint AND telegram_id < $3::bigint
     )`,
    [namespace,lower.toString(),upper.toString()]
  ).catch(()=>{});
  await admin.query(
    "DELETE FROM luemi_private.actors WHERE environment=$1 AND telegram_id >= $2::bigint AND telegram_id < $3::bigint",
    [namespace,lower.toString(),upper.toString()]
  ).catch(()=>{});
  if(viewerActorId) {
    await admin.query("DELETE FROM luemi_private.private_profile_drafts WHERE owner_id=$1 AND environment=$2",[viewerActorId,namespace]).catch(()=>{});
    await admin.query("DELETE FROM luemi_private.sessions WHERE actor_id=$1 AND environment=$2",[viewerActorId,namespace]).catch(()=>{});
    await admin.query("DELETE FROM luemi_private.actors WHERE id=$1 AND environment=$2",[viewerActorId,namespace]).catch(()=>{});
  }
  await admin.end();
}
