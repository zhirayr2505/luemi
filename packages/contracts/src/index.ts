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
export interface SessionV2Response {
  mode: "session_v2";
  user: { id: string; firstName: string };
  csrfToken: string;
  expiresAt: string;
}
export interface SessionV2Me {
  id: string;
  capabilities: {draftSync:false;publish:false;mediaUpload:false;matches:false;chats:false;bliki:false;payments:false};
}
export interface ApiError {
  error: "invalid_init_data" | "service_unavailable" | "not_found" | "unauthorized" | "forbidden" | "account_unavailable" | "session_limit";
}

export type ChatDeliveryState = "queued" | "sending" | "sent" | "delivered" | "read" | "failed";
export type ChatMediaState = "pending" | "ready" | "failed";
export interface ChatMediaContract {
  id:string;
  messageId:string|null;
  mimeType:"image/jpeg"|"image/png"|"image/webp";
  byteSize:number;
  width:number|null;
  height:number|null;
  state:ChatMediaState;
  url:string|null;
}
export interface ChatMessageContract {
  id:string;
  conversationId:string;
  senderId:string;
  clientId:string;
  body:string;
  createdAt:string;
  editedAt:string|null;
  deletedAt:string|null;
  deliveredAt:string|null;
  readAt:string|null;
  media:ChatMediaContract[];
}
export interface ChatConversationContract {
  id:string;
  matchId:string;
  peerId:string;
  peerProfileId:string;
  peerName:string;
  peerPhotoUrl:string|null;
  lastMessage:string|null;
  lastActivityAt:string;
  unreadCount:number;
  access:"active"|"blocked"|"unmatched"|"profile_unavailable";
}
export interface ChatPageContract<T> {items:T[];nextCursor:string|null;}
export interface ChatApiFailure {error:string;retryAfterMs?:number;}
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
 const candidate=value.trim();
 return /^[a-zA-Z]{2}$/.test(candidate)?candidate.toUpperCase():null;
}
