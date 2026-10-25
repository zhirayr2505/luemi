import type { FastifyServerOptions } from "fastify";
import type { Rem05bOptions } from "./rem05b-session.js";
import type { GeoRuntime } from "./geo-routes.js";
import type { EmbeddingPolicy } from "./rem05c-headers.js";
import {memoryPrivateStore} from "./rem05d-private.js";
import {createDurablePrivateStore} from "./real-private-storage.js";
import type {PublicationOptions} from "./real-publication.js";
import type {Rem05dOptions} from "./rem05d-private.js";
import type {RealRegistrationOptions} from "./real-registration-drafts.js";
export interface ApiConfig {
  port: number;
  origin: string;
  botToken: string;
  healthKey: string;
  webhookSecret: string;
  stagingOnly?: boolean;
  serveWeb?: boolean;
  expectedBotUsername?: string;
  setupOnStart?: boolean;
  logger: FastifyServerOptions["logger"];
  rem05b?: Rem05bOptions;
  rem05d?: Rem05dOptions;
  realRegistration?: RealRegistrationOptions;
  realPublication?: PublicationOptions;
  rem05c?: {geo?:GeoRuntime;embedding?:EmbeddingPolicy};
}
export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const port = Number(env.PORT ?? "3001");
  const origin = env.APP_ORIGIN ?? "";
  const stagingOnly = env.STAGING_BOOTSTRAP_ONLY === "1";
  const setupOnStart = env.TELEGRAM_SETUP_ON_START === "1" && !stagingOnly;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  if (!origin || origin === "*" || !/^https?:\/\//.test(origin))
    throw new Error("APP_ORIGIN must be an explicit origin");
  // APP_ORIGIN is an exact trust boundary, never a URL with credentials,
  // path, query, fragment or a confusing port/hostname normalization.
  // Reject alternate spellings rather than silently normalizing CORS.
  let parsedOrigin:URL;
  try{parsedOrigin=new URL(origin);}
  catch{throw new Error("APP_ORIGIN must be an exact HTTP(S) origin");}
  if(!["http:","https:"].includes(parsedOrigin.protocol)||parsedOrigin.origin!==origin||
    parsedOrigin.username||parsedOrigin.password||parsedOrigin.pathname!=="/"||
    parsedOrigin.search||parsedOrigin.hash)
    throw new Error("APP_ORIGIN must be an exact HTTP(S) origin");
  if (env.NODE_ENV === "production" && !origin.startsWith("https://"))
    throw new Error("Production APP_ORIGIN must use HTTPS");
  if (!stagingOnly && (!env.TELEGRAM_BOT_TOKEN || !/^\d+:[\w-]+$/.test(env.TELEGRAM_BOT_TOKEN)))
    throw new Error("TELEGRAM_BOT_TOKEN required");
  if (!stagingOnly && (!env.HEALTH_CHECK_KEY || env.HEALTH_CHECK_KEY.length < 24))
    throw new Error("HEALTH_CHECK_KEY must contain at least 24 characters");
  if (setupOnStart && (
    env.APP_ORIGIN !== "https://luemi-stage01.onrender.com" ||
    env.EXPECTED_TELEGRAM_BOT_USERNAME?.toLowerCase() !== "luemiappbot" ||
    !/^[a-zA-Z0-9_-]{24,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET ?? "")
  )) throw new Error("Telegram auto-setup requires verified LUEMI staging configuration");
  // Deliberately OFF for all existing Render deployments until separately authorized.
  const v2Enabled = env.REM05B_SESSIONS_ENABLED === "1";
  const rem05b: Rem05bOptions | undefined = v2Enabled ? {
    enabled: true,
    issuerDatabaseUrl: env.REM05B_AUTH_DATABASE_URL ?? "",
    requestDatabaseUrl: env.REM05B_REQUEST_DATABASE_URL ?? "",
    pepper: env.REM05B_SESSION_PEPPER ?? "",
    namespace: env.REM05B_BOT_NAMESPACE ?? "",
    origin,
    botToken: env.TELEGRAM_BOT_TOKEN ?? "",
    // PROVISIONAL local/CI policy: NOT approved for real users.
    idleMs: 12 * 60 * 60 * 1000,
    absoluteMs: 7 * 24 * 60 * 60 * 1000,
    maxSessions: 5
  } : undefined;
  // No opt-in flags are set in existing deployments. Key presence alone NEVER
  // activates a charged upstream call.
  const geoEnabled=env.REM05C_ENABLED==="1";
  const providerEnabled=geoEnabled&&env.REM05C_GEO_PROVIDER_ENABLED==="1";
  const geo:GeoRuntime={enabled:geoEnabled,providerEnabled,
    providerKey:providerEnabled?(env.GEOAPIFY_API_KEY??""):"",
    budget:providerEnabled?{
      databaseUrl:env.REM05C_BUDGET_DATABASE_URL??"",
      namespace:env.REM05B_BOT_NAMESPACE??"",
      actorSearchPerDay:Number(env.REM05C_SEARCH_DAILY??30),
      actorReversePerDay:Number(env.REM05C_REVERSE_DAILY??10),
      globalDailyCap:Number(env.REM05C_GLOBAL_DAILY_CAP??0),
      vendorDailyQuota:Number(env.REM05C_VENDOR_DAILY_QUOTA??0),
      maxInFlight:Number(env.REM05C_MAX_INFLIGHT??3)
    }:undefined};
  if(providerEnabled&&(!v2Enabled||!geo.providerKey||!geo.budget?.databaseUrl||
    !Number.isSafeInteger(geo.budget.globalDailyCap)||geo.budget.globalDailyCap<1))
    throw new Error("REM-05C charged geo gate requires v2 identity and approved durable budget");
  const embeddingEnabled=env.REM05C_TELEGRAM_WEB_EMBED_ENABLED==="1";
  const embedding:EmbeddingPolicy={enabled:embeddingEnabled,
    ancestors:embeddingEnabled?(env.REM05C_EMBED_ANCESTORS??"").split(",").map(x=>x.trim()):[]};
  // Never activate from an existing Supabase/Storage key or remote Render flag.
  // No persistent storage adapter exists in 05D; only isolated NODE_ENV=test
  // can intentionally instantiate synthetic private in-memory storage.
  const dFlag=env.REM05D_PRIVATE_ENABLED==="1";
  if(dFlag&&(env.NODE_ENV!=="test"||!v2Enabled))
    throw new Error("REM-05D is unavailable outside explicit isolated tests");
  let rem05d:Rem05dOptions|undefined=dFlag?{
    enabled:true,testOnly:true,namespace:env.REM05B_BOT_NAMESPACE??"",
    requestDatabaseUrl:env.REM05B_REQUEST_DATABASE_URL??"",
    workerDatabaseUrl:env.REM05D_TEST_WORKER_DATABASE_URL??"",
    consentVersion:env.REM05D_TEST_CONSENT_VERSION??"",
    storage:memoryPrivateStore()
  }:undefined;
  // REAL-REG-01 is explicit opt-in, independent of the synthetic media prototype.
  const regEnabled=env.REM06_PRIVATE_DRAFT_ENABLED==="1";
  if(regEnabled&&(!v2Enabled||stagingOnly||env.REM06_PRIVACY_APPROVED!=="1"||
    !env.REM06_CONSENT_VERSION||!env.REM05B_REQUEST_DATABASE_URL))
    throw new Error("REAL-REG-01 requires v2 sessions and approved privacy/DB gates");
  const realRegistration:RealRegistrationOptions|undefined=regEnabled?{
    enabled:true,requestDatabaseUrl:env.REM05B_REQUEST_DATABASE_URL??"",
    namespace:env.REM05B_BOT_NAMESPACE??"",consentVersion:env.REM06_CONSENT_VERSION??""
  }:undefined;
  // Real private media is an independent opt-in; never activated merely by
  // installing Storage credentials. No live state or storage is touched at boot.
  const mediaEnabled=env.REM06_MEDIA_ENABLED==="1";
  if(mediaEnabled){
   if(dFlag||!regEnabled||!v2Enabled||stagingOnly||
     env.REM06_PRIVACY_APPROVED!=="1"||
     !env.REM06_MEDIA_WORKER_DATABASE_URL||
     env.REM06_MEDIA_BUCKET!=="luemi-profile-private"||
     !env.REM06_SUPABASE_PROJECT_REF||!env.REM06_SUPABASE_STORAGE_SECRET)
    throw new Error("REAL-REG-01C requires approved private draft, worker and storage gates");
   rem05d={
    enabled:true,durablePrivateOnly:true,
    namespace:env.REM05B_BOT_NAMESPACE??"",
    consentVersion:env.REM06_CONSENT_VERSION??"",
    requestDatabaseUrl:env.REM05B_REQUEST_DATABASE_URL??"",
    workerDatabaseUrl:env.REM06_MEDIA_WORKER_DATABASE_URL,
    storage:createDurablePrivateStore({
      projectRef:env.REM06_SUPABASE_PROJECT_REF,
      namespace:env.REM05B_BOT_NAMESPACE??"",
      bucket:"luemi-profile-private",
      secret:env.REM06_SUPABASE_STORAGE_SECRET
    })
   };
  }
  const publicationEnabled=env.REM06_PUBLICATION_ENABLED==="1";
  if(publicationEnabled&&(!mediaEnabled||!rem05d?.durablePrivateOnly||
    env.REM06_MODERATION_OPERATIONAL_APPROVED!=="1"||
    !env.REM06_PUBLISHER_DATABASE_URL||!env.REM06_DISCOVERY_DATABASE_URL||
    env.REM06_PUBLISHER_DATABASE_URL===env.REM06_DISCOVERY_DATABASE_URL))
    throw new Error("REG01D requires private media, independent DB roles and accepted moderation");
  const realPublication:PublicationOptions|undefined=publicationEnabled?{
    enabled:true,requestDatabaseUrl:env.REM05B_REQUEST_DATABASE_URL??"",
    publisherDatabaseUrl:env.REM06_PUBLISHER_DATABASE_URL??"",
    discoveryDatabaseUrl:env.REM06_DISCOVERY_DATABASE_URL??"",
    namespace:env.REM05B_BOT_NAMESPACE??"",consentVersion:env.REM06_CONSENT_VERSION??"",
    storage:rem05d!.storage
  }:undefined;
  if(env.REM05D_PUBLICATION_ENABLED==="1")
    throw new Error("REM-05D publication is HARD DISABLED");
  return {
    rem05b,rem05d,realRegistration,realPublication,
    rem05c:{geo,embedding},
    port,
    origin,
    stagingOnly,
    setupOnStart,
    expectedBotUsername: env.EXPECTED_TELEGRAM_BOT_USERNAME,
    serveWeb: env.NODE_ENV === "production",
    botToken: stagingOnly ? "" : (env.TELEGRAM_BOT_TOKEN ?? ""),
    healthKey: env.HEALTH_CHECK_KEY ?? "",
    webhookSecret: stagingOnly ? "" : (env.TELEGRAM_WEBHOOK_SECRET ?? ""),
    logger: env.NODE_ENV !== "test"
  };
}
