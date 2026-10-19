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
