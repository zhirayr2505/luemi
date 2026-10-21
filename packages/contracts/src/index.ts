/** Contract shared between authenticated backend and Mini App. */
export interface HealthResponse {
  status: "ok";
}
export interface BootstrapIdentity {
  id: number;
  firstName: string;
}
export interface BootstrapResponse {
  mode: "bootstrap";
  user: BootstrapIdentity;
}
export interface ApiError {
  error: "invalid_init_data" | "service_unavailable" | "not_found";
}
export const productStages = [
  "00-contracts",
  "01-telegram-bootstrap",
  "02-registration-moderation",
  "03-discovery",
  "04-matches",
  "05-chats",
  "06-closed-beta",
  "07-stars-ledger",
  "08-premium",
  "09-public-release"
] as const;

/** ISO 3166-1 alpha-2 representation at all domain boundaries; null means unspecified/invalid.
 * Never infer a user's country or mutate free-form city/country labels. */
export function normalizeCountryCode(value:unknown):string|null {
 if(typeof value!=="string")return null;
 const candidate=value.trim().toUpperCase();
 return /^[A-Z]{2}$/.test(candidate)?candidate:null;
}
