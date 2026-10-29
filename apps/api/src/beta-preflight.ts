// Preflight logging contains ONLY names of missing variables, never values.
// Requires an explicit operator opt-in, and cannot turn on any feature.
export function describeRealBetaPrerequisites(env:NodeJS.ProcessEnv){
 const required=[
  "REM05B_SESSIONS_ENABLED",
  "REM06_PRIVATE_DRAFT_ENABLED",
  "REM06_MEDIA_ENABLED",
  "REM06_PUBLICATION_ENABLED",
  "REM06_OPEN_SIGNUPS_ENABLED",
  "REM06_OPEN_SIGNUPS_APPROVED",
  "REM06_INSTANT_PUBLICATION_ENABLED",
  "REM06_INSTANT_PUBLICATION_OWNER_ACCEPTED",
  "REM06_PRIVACY_APPROVED",
  "LUEMI_CHATS_V1_ENABLED",
  "LUEMI_CHATS_POLICY_APPROVED",
  "LUEMI_MATCHES_V1_ENABLED",
  "LUEMI_MATCHES_POLICY_APPROVED",
  "REM06_EARLY_BETA_ENABLED",
  "VITE_LUEMI_REAL_ONLY",
  "VITE_LUEMI_AUTH_V2",
  "VITE_LUEMI_PRIVATE_DRAFT_UI",
  "VITE_LUEMI_PRIVATE_MEDIA_UI",
  "VITE_LUEMI_OPEN_SIGNUPS_UI",
  "VITE_LUEMI_INSTANT_PUBLICATION_UI"
 ] as const;
 // Pending switches are advisory in the dry run, since no features will be
 // activated until the underlying secrets are confirmed present.
 const flagOff=required.filter(key=>env[key]!=="1");
 const credentials=[
  "REM05B_AUTH_DATABASE_URL",
  "REM05B_REQUEST_DATABASE_URL",
  "REM05B_SESSION_PEPPER",
  "REM06_MEDIA_WORKER_DATABASE_URL",
  "REM06_PUBLISHER_DATABASE_URL",
  "REM06_DISCOVERY_DATABASE_URL",
  "LUEMI_CHATS_DATABASE_URL",
  "LUEMI_MATCHES_DATABASE_URL",
  "REM06_SUPABASE_PROJECT_REF",
  "REM06_SUPABASE_STORAGE_SECRET",
  "REM06_CONSENT_VERSION",
  "VITE_LUEMI_CONSENT_VERSION",
  "TELEGRAM_BOT_TOKEN"
 ] as const;
 const missingCredentials=credentials.filter(key=>!env[key]);
 const conflicts=[
  "REM06_BETA_INVITES_ENABLED",
  "REM06_FRIENDS_TEST_ENABLED",
  "REM06_SELF_SERVICE_BETA_ENABLED",
  "STAGING_BOOTSTRAP_ONLY",
  "VITE_LUEMI_FRIENDS_TEST_MODE"
 ].filter(key=>env[key]==="1");
 const earlyBetaCap=Number(env.REM06_EARLY_BETA_MAX_ACCOUNTS??"10");
 const capValid=Number.isSafeInteger(earlyBetaCap)&&
   earlyBetaCap>=2&&earlyBetaCap<=50;
 return {event:"LUEMI_REAL_BETA_PREFLIGHT",secretValuesLogged:false,
  missingCredentialNames:missingCredentials,disabledFlagNames:flagOff,
  conflictingEnabledFlags:conflicts,capValid,
  consentVersionsMatch:!!env.REM06_CONSENT_VERSION&&
    env.REM06_CONSENT_VERSION===env.VITE_LUEMI_CONSENT_VERSION,
  profileBucketCorrect:env.REM06_MEDIA_BUCKET==="luemi-profile-private",
  chatBucketCorrect:env.LUEMI_CHATS_MEDIA_BUCKET==="luemi-chat-private",
  blikiEnabled:false,
  // This is config presence only, NOT a database/storage/Telegram E2E result.
  verification:"configuration_presence_only"} as const;
}
