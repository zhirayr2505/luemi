import type { FastifyServerOptions } from "fastify";
import type { Rem05bOptions } from "./rem05b-session.js";
import type { GeoRuntime } from "./geo-routes.js";
import type { EmbeddingPolicy } from "./rem05c-headers.js";
import {memoryPrivateStore} from "./rem05d-private.js";
import {createDurablePrivateStore} from "./real-private-storage.js";
import type {PublicationOptions} from "./real-publication.js";
import type {ErasureRequestOptions} from "./real-erasure.js";
import type {SafetyAppealOptions} from "./safety-appeal-api.js";
import type {Rem05dOptions} from "./rem05d-private.js";
import type {ChatOptions} from "./chats-api.js";
import {MemoryChatMediaStorage} from "./features/chats/chat-media.js";
import {createSupabaseChatMediaStorage} from "./features/chats/supabase-chat-storage.js";
import type {MatchOptions} from "./matches-api.js";
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
  realErasure?: ErasureRequestOptions;
  safetyAppeal?: SafetyAppealOptions;
  chats?: ChatOptions;
  matches?: MatchOptions;
  rem05c?: {geo?:GeoRuntime;embedding?:EmbeddingPolicy};
  // Presence of operator-gated CLI configuration ONLY; no connection, legal
  // approval, photo review or erasure has been demonstrated by these booleans.
  releaseOperations?:{
    privacyFlagConfigured:boolean;
    humanReviewCliConfigured:boolean;
    erasureWorkerCliConfigured:boolean;
    safetyOperatorCliConfigured:boolean;
  };
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
    env.APP_ORIGIN !== "https://luemi.onrender.com" ||
    !/^[a-zA-Z0-9_-]{24,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET ?? "")
  )) throw new Error("Telegram auto-setup requires verified LUEMI staging configuration");
  // Two alternative admission policies. Open signups still require verified
  // Telegram initData, adult registration, private media, RLS and consent;
  // they never use the invite table or a client-provided identity.
  const openSignups = env.REM06_OPEN_SIGNUPS_ENABLED==="1";
  const betaInvites = env.REM06_BETA_INVITES_ENABLED==="1";
  // Deliberately OFF for all existing Render deployments until separately authorized.
  const v2Enabled = env.REM05B_SESSIONS_ENABLED === "1";
  // Invite-only private-draft pilot: not public registration, never public media.
  const friendsTest=env.REM06_FRIENDS_TEST_ENABLED==="1";
  if(friendsTest&&(!v2Enabled||stagingOnly||!betaInvites||openSignups||
    env.REM06_PRIVATE_DRAFT_ENABLED!=="1"||
    env.REM06_BETA_INVITES_APPROVED!=="1"||
    env.REM06_FRIENDS_TEST_NOTICE_ACCEPTED!=="1"||
    env.REM06_PUBLICATION_ENABLED==="1"||
    env.REM06_MEDIA_ENABLED==="1"||
    env.LUEMI_CHATS_V1_ENABLED==="1"||
    env.LUEMI_MATCHES_V1_ENABLED==="1"||
    env.REM06_ERASURE_REQUEST_ENABLED==="1"))
    throw new Error("Friends test must be invite-only private drafts with accepted test disclosure");
  const privateDraftDisclosure=env.REM06_PRIVACY_APPROVED==="1"||friendsTest;
  // A partial configuration must never silently make Telegram signup public.
  // Isolated unit tests can still instantiate their deliberately restricted
  // session fixtures without a production admission policy.
  if(env.NODE_ENV==="production"&&v2Enabled&&!openSignups&&!betaInvites)
    throw new Error("Production V2 requires an explicitly approved admission mode");
  if(openSignups&&(!v2Enabled||stagingOnly||betaInvites||
    env.REM06_OPEN_SIGNUPS_APPROVED!=="1"||
    env.REM06_PRIVACY_APPROVED!=="1"))
    throw new Error("Open registration requires approved privacy policy, V2 identity and no invite gate");
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
    maxSessions: 5,
    inviteOnly: betaInvites
  } : undefined;
  if(env.REM06_BETA_INVITES_ENABLED==="1"&&(!v2Enabled||
    env.REM06_BETA_INVITES_APPROVED!=="1"||!privateDraftDisclosure))
    throw new Error("REG01G invite gate requires V2 and explicit test notice or approved privacy policy");
  // No opt-in flags are set in existing deployments. Key presence alone NEVER
  // activates a charged upstream call.
  const geoEnabled=env.REM05C_ENABLED==="1";
  const providerEnabled=geoEnabled&&env.REM05C_GEO_PROVIDER_ENABLED==="1";
  const localReverseEnabled=geoEnabled&&env.REM05C_LOCAL_REVERSE_ENABLED==="1";
  if(localReverseEnabled&&(!v2Enabled||stagingOnly))
    throw new Error("Local reverse geolocation requires authenticated V2 sessions");
  const geo:GeoRuntime={enabled:geoEnabled,providerEnabled,localReverseEnabled,
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
  if(regEnabled&&(!v2Enabled||stagingOnly||!privateDraftDisclosure||
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
  // Discovery is allowed only after ONE approved server-side admission policy.
  // Open registration is not an authorization bypass: it still requires
  // verified Telegram sessions, reviewed private photographs, and independent
  // least-privilege database connections. Legacy beta defaults are unchanged.
  const admissionApproved=(rem05b?.inviteOnly===true&&
     env.REM06_BETA_INVITES_APPROVED==="1")||
    (openSignups&&!betaInvites&&env.REM06_OPEN_SIGNUPS_APPROVED==="1");
  if(publicationEnabled&&(!admissionApproved||
    !mediaEnabled||!rem05d?.durablePrivateOnly||
    env.REM06_MODERATION_OPERATIONAL_APPROVED!=="1"||
    !env.REM06_PUBLISHER_DATABASE_URL||!env.REM06_DISCOVERY_DATABASE_URL||
    env.REM06_PUBLISHER_DATABASE_URL===env.REM06_DISCOVERY_DATABASE_URL))
    throw new Error("REG01D requires approved admission, private media, independent DB roles and accepted moderation");
  const realPublication:PublicationOptions|undefined=publicationEnabled?{
    enabled:true,requestDatabaseUrl:env.REM05B_REQUEST_DATABASE_URL??"",
    publisherDatabaseUrl:env.REM06_PUBLISHER_DATABASE_URL??"",
    discoveryDatabaseUrl:env.REM06_DISCOVERY_DATABASE_URL??"",
    namespace:env.REM05B_BOT_NAMESPACE??"",consentVersion:env.REM06_CONSENT_VERSION??"",
    storage:rem05d!.storage
  }:undefined;
  const eraseEnabled=env.REM06_ERASURE_REQUEST_ENABLED==="1";
  if(eraseEnabled&&(!publicationEnabled||!realPublication||
    env.REM06_ERASURE_POLICY_APPROVED!=="1"||
    !env.REM06_ERASURE_REQUEST_DATABASE_URL||
    [env.REM05B_AUTH_DATABASE_URL,env.REM05B_REQUEST_DATABASE_URL,
     env.REM06_MEDIA_WORKER_DATABASE_URL,env.REM06_PUBLISHER_DATABASE_URL,
     env.REM06_DISCOVERY_DATABASE_URL].includes(env.REM06_ERASURE_REQUEST_DATABASE_URL)))
    throw new Error("REG01F requires independently approved deletion policy and separate erasure role");
  const realErasure:ErasureRequestOptions|undefined=eraseEnabled?{
   enabled:true,databaseUrl:env.REM06_ERASURE_REQUEST_DATABASE_URL??"",
   namespace:env.REM05B_BOT_NAMESPACE??""
  }:undefined;
  const appealsEnabled=env.REM06_SAFETY_APPEALS_ENABLED==="1";
  if(appealsEnabled&&(!publicationEnabled||!realErasure||!admissionApproved||
    env.REM06_SAFETY_POLICY_APPROVED!=="1"||
    !env.REM06_SAFETY_APPEAL_DATABASE_URL||
    [env.REM05B_AUTH_DATABASE_URL,env.REM05B_REQUEST_DATABASE_URL,
     env.REM06_MEDIA_WORKER_DATABASE_URL,env.REM06_PUBLISHER_DATABASE_URL,
     env.REM06_DISCOVERY_DATABASE_URL,env.REM06_ERASURE_REQUEST_DATABASE_URL]
     .includes(env.REM06_SAFETY_APPEAL_DATABASE_URL)))
    throw Error("REG01H requires approved safety appeals and isolated database role");
  const safetyAppeal:SafetyAppealOptions|undefined=appealsEnabled?{
   enabled:true,databaseUrl:env.REM06_SAFETY_APPEAL_DATABASE_URL??"",
   namespace:env.REM05B_BOT_NAMESPACE??"",origin,botToken:env.TELEGRAM_BOT_TOKEN??""
  }:undefined;
  const chatsEnabled=env.LUEMI_CHATS_V1_ENABLED==="1";
  if(chatsEnabled&&(!v2Enabled||stagingOnly||env.REM06_PRIVACY_APPROVED!=="1"||
    env.LUEMI_CHATS_POLICY_APPROVED!=="1"||!env.LUEMI_CHATS_DATABASE_URL||
    [env.REM05B_AUTH_DATABASE_URL,env.REM05B_REQUEST_DATABASE_URL,
     env.REM06_PUBLISHER_DATABASE_URL,env.REM06_DISCOVERY_DATABASE_URL]
     .includes(env.LUEMI_CHATS_DATABASE_URL)))throw new Error("Chats require approved policy and isolated DB role");
  const localChatMedia=env.LUEMI_CHATS_LOCAL_MEDIA==="1";
  const durableChatMedia=env.LUEMI_CHATS_MEDIA_ENABLED==="1";
  if(env.NODE_ENV==="production"&&localChatMedia)
    throw new Error("Local chat media is forbidden in production");
  if(localChatMedia&&durableChatMedia)throw new Error("Chat media providers are mutually exclusive");
  if(durableChatMedia&&(!chatsEnabled||stagingOnly||
    env.LUEMI_CHATS_MEDIA_BUCKET!=="luemi-chat-private"||
    !env.REM06_SUPABASE_PROJECT_REF||!env.REM06_SUPABASE_STORAGE_SECRET))
    throw new Error("Chat private media requires approved chats, a dedicated private bucket and server credentials");
  const chats:ChatOptions|undefined=chatsEnabled?{enabled:true,
   databaseUrl:env.LUEMI_CHATS_DATABASE_URL??"",namespace:env.REM05B_BOT_NAMESPACE??"",
   mediaStore:localChatMedia?new MemoryChatMediaStorage():
    durableChatMedia?createSupabaseChatMediaStorage({
     projectRef:env.REM06_SUPABASE_PROJECT_REF!,
     secret:env.REM06_SUPABASE_STORAGE_SECRET!,
     namespace:env.REM05B_BOT_NAMESPACE??"",
     bucket:"luemi-chat-private"
    }):undefined}:undefined;
  const matchesEnabled=env.LUEMI_MATCHES_V1_ENABLED==="1";
  if(matchesEnabled&&(!chatsEnabled||!publicationEnabled||!v2Enabled||stagingOnly||
    env.REM06_PRIVACY_APPROVED!=="1"||env.LUEMI_MATCHES_POLICY_APPROVED!=="1"||
    !env.LUEMI_MATCHES_DATABASE_URL||
    [env.LUEMI_CHATS_DATABASE_URL,env.REM05B_AUTH_DATABASE_URL,
     env.REM05B_REQUEST_DATABASE_URL,env.REM06_PUBLISHER_DATABASE_URL,
     env.REM06_DISCOVERY_DATABASE_URL].includes(env.LUEMI_MATCHES_DATABASE_URL)))
    throw new Error("Matches require authenticated published profiles and isolated matching database role");
  const matches:MatchOptions|undefined=matchesEnabled?{
    enabled:true,databaseUrl:env.LUEMI_MATCHES_DATABASE_URL??"",
    namespace:env.REM05B_BOT_NAMESPACE??""
  }:undefined;
  if(env.REM05D_PUBLICATION_ENABLED==="1")
    throw new Error("REM-05D publication is HARD DISABLED");
  // CLI-only maintenance is separate from the public HTTP server. Do not
  // interpret a public feature flag as evidence that a real moderator,
  // suspension operator or irreversible erasure worker can actually work.
  const operatorLoginUrls=[
    env.REG01G_MODERATOR_DATABASE_URL,env.REM06_ERASURE_WORKER_DATABASE_URL,
    env.REG01H_SAFETY_OPERATOR_DATABASE_URL
  ];
  const otherLoginUrls=[
    env.REM05B_AUTH_DATABASE_URL,env.REM05B_REQUEST_DATABASE_URL,
    env.REM06_MEDIA_WORKER_DATABASE_URL,env.REM06_PUBLISHER_DATABASE_URL,
    env.REM06_DISCOVERY_DATABASE_URL,env.LUEMI_CHATS_DATABASE_URL,
    env.LUEMI_MATCHES_DATABASE_URL,env.REM05C_BUDGET_DATABASE_URL
  ].filter(Boolean);
  const isolated=(value:string|undefined)=>!!value &&
    !otherLoginUrls.includes(value) &&
    operatorLoginUrls.filter(x=>x===value).length===1;
  const releaseOperations={
    privacyFlagConfigured:env.REM06_PRIVACY_APPROVED==="1"&&
      !!env.REM06_CONSENT_VERSION,
    humanReviewCliConfigured:env.REG01G_HUMAN_REVIEW_ENABLED==="1"&&
      env.REG01G_HUMAN_REVIEW_POLICY_APPROVED==="1"&&
      /^[A-Za-z0-9_-]{3,64}$/.test(env.REG01G_MODERATOR_LABEL??"")&&
      isolated(env.REG01G_MODERATOR_DATABASE_URL),
    erasureWorkerCliConfigured:env.REM06_ERASURE_WORKER_ENABLED==="1"&&
      env.REM06_ERASURE_POLICY_APPROVED==="1"&&
      env.REM06_ERASURE_MAINTENANCE_APPROVED==="1"&&
      isolated(env.REM06_ERASURE_WORKER_DATABASE_URL)&&
      env.REM06_MEDIA_BUCKET==="luemi-profile-private"&&
      !!env.REM06_SUPABASE_PROJECT_REF&&!!env.REM06_SUPABASE_STORAGE_SECRET,
    safetyOperatorCliConfigured:env.REG01H_SAFETY_OPERATOR_ENABLED==="1"&&
      env.REG01H_SAFETY_POLICY_APPROVED==="1"&&
      /^[A-Za-z0-9_-]{3,64}$/.test(env.REG01H_OPERATOR_LABEL??"")&&
      isolated(env.REG01H_SAFETY_OPERATOR_DATABASE_URL)
  };
  return {
    releaseOperations,
    rem05b,rem05d,realRegistration,realPublication,realErasure,safetyAppeal,chats,matches,
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
