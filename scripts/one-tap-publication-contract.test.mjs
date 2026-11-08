import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=load("apps/web/src/App.tsx");
const journey=load("apps/web/src/registration/PublicationJourney.tsx");
const v2=load("apps/web/src/registration/v2/RealRegistration.tsx");
const warm=load("apps/web/src/registration/recommendation-warmup.ts");
const reg=load("apps/web/src/discovery/RealDiscoveryHome.tsx");
const media=load("apps/api/src/rem05d-private.ts");
test("photo preview is separate from final authenticated publication",()=>{
 assert.match(v2,/id:"about"/);
 assert.match(v2,/id:"review"/);
 assert.doesNotMatch(v2,/id:"languages"|id:"personality"/);
 assert.match(v2,/else nav\(index\+1\)/);
 assert.match(v2,/case "review":p\.onSave\(\);return/);
 assert.match(v2,/Посмотреть анкету/);
 assert.match(v2,/Редактировать/);
 assert.match(v2,/Создать анкету/);
 assert.doesNotMatch(v2,/photoServerCount|photoSyncBusy|onRetryPhotoSync|setServerConsent/);
 assert.match(app,/onSave=\{\(\)=>\{void \(realFeedPilot.enabled\?confirmRealRegistration\(\)/);
});
test("incomplete upload never opens a fake registration dashboard",()=>{
 const start=app.indexOf('const confirmRealRegistration=async()=>');
 const end=app.indexOf('const resumePublication=async()=>',start);
 assert(start>0&&end>start);
 const submit=app.slice(start,end);
 assert.match(submit,/const uploadedIds=await syncChosenPhotos\(true\)/);
 assert.doesNotMatch(submit,/existing.approved<photos.length\|\|existing.pending>0\|\|existing.other>0/);
 assert.match(submit,/readConfirmedPrivateMediaCount\(photos.length,uploadedIds\)/);
 assert.match(submit,/await reconcilePrivatePhotos\(uploadedIds\)/);
 assert.match(submit,/await readConfirmedPrivateMediaCount\(photos.length,uploadedIds\)/);
 assert.match(submit,/media.approved<photos.length\|\|media.pending!==0\|\|media.other!==0/);
 assert.match(submit,/confirmed.state!=="published"/);
 assert.match(submit,/setJourney\("error"\)/);
 assert.doesNotMatch(submit,/setRealHome\(true\)/);
 assert.match(app,/setRealHome\(false\);setPhase\("form"\)/);
});
test("all progress labels reflect actual work; failures allow retry",()=>{
 for(const text of ["Подготавливаем вашу анкету","Учитываем ваши интересы",
   "Ищем подходящие анкеты рядом","Загружаем первую ленту","Всё готово 💜"])
  assert(journey.includes(text));
 assert.match(journey,/onRetry/);assert.match(journey,/onBack/);
 assert.match(journey,/is-leaving/);assert.match(journey,/onComplete/);
 assert.match(app,/await warmPublishedRecommendations/);
 assert.match(app,/setRealHomeTab\("feed"\);setRealHome\(true\);setJourney\("complete"\)/);
 assert.match(app,/\{journeyOverlay\}<\/>/);
});
test("first pictures cached only in RAM with bounded signed endpoint fetch",()=>{
 assert.match(warm,/const MAX_IMAGES=6/);
 assert.match(warm,/MAX_IMAGE_BYTES=1_500_000/);
 assert.match(warm,/fetch\(url,\{credentials:"same-origin",cache:"no-store",signal\}\)/);
 assert.match(warm,/URL.createObjectURL/);
 assert.match(warm,/URL.revokeObjectURL/);
 assert.doesNotMatch(warm.slice(warm.indexOf("export async function")),
  /(?:window|globalThis)\.(?:localStorage|indexedDB|sessionStorage)/);
 assert.match(reg,/initialFeed=\{scopeOverride\?null:initialFeed\}/);
 assert.match(reg,/Пока нет анкет/);
 assert.match(reg,/className="discovery-bottom-nav"/);
});
test("server resumes same expired media intent without new asset",()=>{
 assert.match(media,/existing.rows\[0\].state==="reserved"/);
 assert.match(media,/expires_at=clock_timestamp\(\)\+interval '1 hour'/);
 assert.match(media,/idempotency_digest=\$3/);
 assert.match(media,/return\{assetId:existing.rows\[0\].asset_id,state:existing.rows\[0\].state/);
});

test("registration reconciles durable photo identities before allocating slots",()=>{
 assert.match(media,/"\/api\/v2\/media\/plan"/);
 assert.match(media,/idempotency_digest=ANY\(\$3::text\[\]\)/);
 assert.match(media,/staleAssetIds/);
 assert.match(app,/await planPrivatePhotos\(ready\)/);
 assert.match(app,/for\(const assetId of plan\.staleAssetIds\)/);
 assert.match(app,/await deletePrivatePhoto\(assetId\)/);
});

test("recommendation warmup preserves global server-ranked order instead of re-sorting just page one",()=>{
 assert.match(warm,/const page=source/);
 assert.doesNotMatch(warm,/rankPublishedRecommendations|\.sort\(/,
  "local rank changes can displace better matches from pages that were not fetched");
 assert.match(app,/warmPublishedRecommendations\(controller\.signal,phase=>setJourney\(phase\),draft\)/);
 assert.doesNotMatch(warm,/navigator\.geolocation|latitude|longitude|localStorage/);
});
