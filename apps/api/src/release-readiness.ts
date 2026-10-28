// Operator-only release status. This deliberately reports CONFIGURATION,
// not proof that database, private Storage or operational moderation work.
// No secret material, SQL queries, network requests or user records are read.
import type {ApiConfig} from "./config.js";

export function describeReleaseConfig(config: ApiConfig){
 const capabilities={
  signedTelegramSessions:config.rem05b?.enabled===true,
  openAdmission:config.rem05b?.enabled===true&&config.rem05b.inviteOnly===false,
  privateDrafts:config.realRegistration?.enabled===true,
  privatePhotos:config.rem05d?.enabled===true&&config.rem05d.durablePrivateOnly===true,
  reviewedPublication:config.realPublication?.enabled===true,
  realMatches:config.matches?.enabled===true,
  realChats:config.chats?.enabled===true,
  accountDeletion:config.realErasure?.enabled===true,
  safetyAppeals:config.safetyAppeal?.enabled===true,
  localGeolocation:config.rem05c?.geo?.localReverseEnabled===true,
  externalGeocoder:config.rem05c?.geo?.providerEnabled===true,
  privacyFlagConfigured:config.releaseOperations?.privacyFlagConfigured===true,
  humanReviewCliConfigured:config.releaseOperations?.humanReviewCliConfigured===true,
  erasureWorkerCliConfigured:config.releaseOperations?.erasureWorkerCliConfigured===true,
  safetyOperatorCliConfigured:config.releaseOperations?.safetyOperatorCliConfigured===true
 };
 // Full end-to-end signoff is necessarily external to a process config.
 const required=["signedTelegramSessions","openAdmission","privateDrafts",
  "privatePhotos","reviewedPublication","realMatches","realChats",
  "accountDeletion","safetyAppeals","privacyFlagConfigured",
  "humanReviewCliConfigured","erasureWorkerCliConfigured",
  "safetyOperatorCliConfigured"] as const;
 const missing=required.filter(k=>!capabilities[k]);
 return{
  state:missing.length===0?"configured_not_verified":"blocked",
  verification:"configuration_only",
  database:"not_probed",
  storage:"not_probed",
  endToEnd:"not_probed",
  privacyAndHumanModeration:"requires_operator_verification",
  legalReview:"unverified",
  armeniaCrossBorderTransfer:"unverified",
  databaseTlsPeerVerification:"unverified",
  // Never claim that configured CLI switches prove human availability,
  // successful account erasure, actual TLS peer verification or legal signoff.
  capabilities,
  missing
 };
}
