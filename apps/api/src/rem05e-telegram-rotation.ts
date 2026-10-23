import type { ApiConfig } from "./config.js";
import { buildApp } from "./app.js";

/**
 * REM-05E: deliberately MOCK-ONLY. This module has no production Bot API
 * transport, CLI, server route or startup integration. A live cutover needs
 * new, separate owner authorization and a reviewed transport implementation.
 *
 * Generation labels are metadata, NOT Telegram attestations. In particular,
 * getWebhookInfo never returns the currently configured secret_token.
 */
export type RotationState =
  | "refused"
  | "duplicate_synthetic_proof"
  | "telegram_update_acknowledged_synthetic"
  | "end_to_end_synthetic_proof"
  | "partial_menu_applied"
  | "telegram_state_unknown"
  | "synthetic_delivery_failed";

export type RotationReason =
  | "invalid_authorization" | "invalid_environment" | "invalid_credentials"
  | "invalid_generation" | "compromised_generation_forbidden"
  | "bot_identity_mismatch" | "foreign_webhook" | "foreign_menu"
  | "bot_api_unconfirmed" | "bot_api_unavailable"
  | "delivery_unconfirmed" | "none";

export interface RotationRequest {
  mode: "isolated-mock-only";
  explicitOwnerApproval: boolean;
  environment: "staging";
  previousGeneration: string;
  candidateGeneration: string;
  candidateSecret: string;
  /** Per-mock-call timeout, bounded to 10..10000ms. */
  transportTimeoutMs?: number;
  /** Bounded total receiver verification, including optional untrusted veto; 10..10000ms. */
  proofTimeoutMs?: number;
  knownExposedGenerations?: readonly string[];
  /**
   * Legacy optional untrusted veto/fault-injection hook; returned booleans
   * NEVER establish verification. Only internal Fastify inject does that.
   */
  verifiedSyntheticGeneration?: string;
  syntheticReceiverProof?: () => Promise<{
    candidateAccepted: boolean;
    previousRejected: boolean;
  }>;
}

export interface MockBotTransport {
  request(method: "getMe" | "getWebhookInfo" | "getChatMenuButton" |
    "setChatMenuButton" | "setWebhook", body?: Record<string, unknown>):
    Promise<unknown>;
}

export interface RotationResult {
  state: RotationState;
  reason: RotationReason;
  destination: "unknown" | "expected" | "foreign" | "missing";
  secretGeneration: "unknown" | "synthetic_metadata_only" |
    "telegram_ack_unverified" | "end_to_end_synthetic_only";
  operations: string[];
  /** Number of trusted isolated Fastify HTTP probes completed, 0..4. */
  receiverChecks: number;
  liveTelegramVerified: false;
}

const STAGE_ORIGIN = "https://luemi-stage01.onrender.com";
const HOOK = STAGE_ORIGIN + "/api/telegram/webhook";
const LABEL = /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/;
const TOKEN = /^[A-Za-z0-9_-]{24,256}$/;
// Explicit synthetic test credential namespace. A live Telegram token fails
// before any transport calls, even if a caller supplies a transport.
const SYNTHETIC_BOT = /^123456:(?:fake|test|synthetic)[A-Za-z0-9_-]{8,}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function menuMatches(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.origin === STAGE_ORIGIN &&
      parsed.pathname === "/" && !parsed.search && !parsed.hash;
  } catch { return false; }
}


/**
 * Trusted mock-only receiver evidence. Builds an isolated local Fastify app;
 * no port listening, network, Telegram, production DB or user traffic.
 * Untrusted callback values cannot supply a successful HTTP response.
 */
async function verifyIsolatedFastifyReceiver(
  config: ApiConfig, candidate: string, previous: string
): Promise<{ verified: boolean; checks: number }> {
  const app = buildApp({
    ...config, logger: false, webhookSecret: candidate,
    // Never touch remote persistence or optional real providers during a proof.
    rem05b: undefined, rem05c: undefined, rem05d: undefined
  });
  const payload = { message: { text: "/start", chat: { id: 13579, type: "private" } } };
  let checks = 0;
  try {
    async function probe(token?: string) {
      const response = await app.inject({
        method: "POST", url: "/api/telegram/webhook", payload,
        headers: token === undefined ? {} : { "x-telegram-bot-api-secret-token": token }
      });
      checks++;
      const body: unknown = response.json();
      return { status: response.statusCode, body };
    }
    const candidateResponse = await probe(candidate);
    const previousResponse = await probe(previous);
    const missingResponse = await probe();
    const wrongToken = candidate[0] === "x" ? "y".repeat(32) : "x".repeat(32);
    const wrongResponse = await probe(wrongToken);
    const good = candidateResponse.status === 200 &&
      isRecord(candidateResponse.body) &&
      candidateResponse.body.method === "sendMessage" &&
      candidateResponse.body.chat_id === 13579 &&
      isRecord(candidateResponse.body.reply_markup) &&
      Array.isArray(candidateResponse.body.reply_markup.inline_keyboard);
    const denied = (reply: typeof previousResponse) =>
      reply.status === 404 && isRecord(reply.body) &&
      reply.body.error === "not_found" &&
      !("method" in reply.body) && !("chat_id" in reply.body) &&
      !("reply_markup" in reply.body);
    return { verified: good && denied(previousResponse) &&
      denied(missingResponse) && denied(wrongResponse), checks };
  } finally {
    await app.close();
  }
}

async function withinProofDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("isolated_proof_timeout")), ms);
      })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** No retries; operator must investigate ambiguous acknowledgements. */
export async function executeSyntheticWebhookRotation(
  config: ApiConfig,
  request: RotationRequest,
  transport: MockBotTransport
): Promise<RotationResult> {
  const operations: string[] = [];
  let destination: RotationResult["destination"] = "unknown";
  let state: RotationState = "refused";
  let reason: RotationReason = "none";
  let secretGeneration: RotationResult["secretGeneration"] = "unknown";
  let menuApplied = false;
  let webhookAttempted = false;
  let receiverChecks = 0;
  const result = (): RotationResult => ({
    state, reason, destination, secretGeneration,
    operations: [...operations], receiverChecks,
    liveTelegramVerified: false
  });
  if (request.mode !== "isolated-mock-only" || !request.explicitOwnerApproval) {
    reason = "invalid_authorization"; return result();
  }
  if (request.environment !== "staging" || config.stagingOnly ||
      config.origin !== STAGE_ORIGIN ||
      config.expectedBotUsername?.toLowerCase() !== "luemiappbot" ||
      config.setupOnStart === true) {
    reason = "invalid_environment"; return result();
  }
  if (request.transportTimeoutMs !== undefined &&
      (!Number.isSafeInteger(request.transportTimeoutMs) ||
       request.transportTimeoutMs < 10 || request.transportTimeoutMs > 10000)) {
    reason = "invalid_authorization"; return result();
  }
  if (request.proofTimeoutMs !== undefined &&
      (!Number.isSafeInteger(request.proofTimeoutMs) ||
       request.proofTimeoutMs < 10 || request.proofTimeoutMs > 10000)) {
    reason = "invalid_authorization"; return result();
  }
  if (!SYNTHETIC_BOT.test(config.botToken) ||
      !TOKEN.test(config.webhookSecret) ||
      !TOKEN.test(request.candidateSecret) ||
      request.candidateSecret === config.webhookSecret) {
    reason = "invalid_credentials"; return result();
  }
  if (!LABEL.test(request.previousGeneration) ||
      !LABEL.test(request.candidateGeneration)) {
    reason = "invalid_generation"; return result();
  }
  if (request.knownExposedGenerations?.includes(request.candidateGeneration)) {
    reason = "compromised_generation_forbidden"; return result();
  }
  if (request.candidateGeneration === request.previousGeneration) {
    if (request.verifiedSyntheticGeneration === request.candidateGeneration) {
      state = "duplicate_synthetic_proof";
      secretGeneration = "synthetic_metadata_only";
      return result();
    }
    reason = "invalid_generation"; return result();
  }

  type Method = Parameters<MockBotTransport["request"]>[0];
  async function invoke(method: Method, body?: Record<string, unknown>): Promise<unknown> {
    operations.push(method);
    // No error propagation, log, token-bearing URL or raw transport response.
    // Even malformed JSON / HTTP errors become a constant nonsecret reason.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let response: unknown;
    try {
      response = await Promise.race([
        transport.request(method, body),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("synthetic_transport_timeout")),
            request.transportTimeoutMs ?? 10000);
        })
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    if (!isRecord(response) || response.ok !== true || !("result" in response))
      throw new Error("synthetic_api_unconfirmed");
    return response.result;
  }

  try {
    const me = await invoke("getMe");
    if (!isRecord(me) || me.is_bot !== true ||
        typeof me.username !== "string" ||
        me.username.toLowerCase() !== "luemiappbot") {
      reason = "bot_identity_mismatch"; return result();
    }
    const webhook = await invoke("getWebhookInfo");
    if (!isRecord(webhook) || typeof webhook.url !== "string") {
      reason = "bot_api_unconfirmed"; return result();
    }
    if (webhook.url && webhook.url !== HOOK) {
      destination = "foreign"; reason = "foreign_webhook"; return result();
    }
    destination = webhook.url ? "expected" : "missing";
    const menu = await invoke("getChatMenuButton");
    if (!isRecord(menu) || typeof menu.type !== "string") {
      reason = "bot_api_unconfirmed"; return result();
    }
    const existingMenuMatches = menu.type === "web_app" &&
      isRecord(menu.web_app) && menuMatches(menu.web_app.url);
    if (!existingMenuMatches && menu.type !== "commands" && menu.type !== "default") {
      destination = "foreign"; reason = "foreign_menu"; return result();
    }
    if (!existingMenuMatches) {
      menuApplied = true; // Mutation may happen even if the ACK is lost.
      const menuResult = await invoke("setChatMenuButton", {
        menu_button: {
          type: "web_app", text: "Открыть LUEMI 💜",
          web_app: { url: STAGE_ORIGIN }
        }
      });
      if (menuResult !== true) {
        state = "partial_menu_applied";
        reason = "bot_api_unconfirmed"; return result();
      }
    }
    // EXPLICIT operation: same webhook URL does not bypass this call.
    // No pending-update deletion and only the allowed original update class.
    webhookAttempted = true;
    const acknowledged = await invoke("setWebhook", {
      url: HOOK,
      secret_token: request.candidateSecret,
      allowed_updates: ["message"],
      drop_pending_updates: false
    });
    if (acknowledged !== true) {
      state = "telegram_state_unknown"; reason = "bot_api_unconfirmed";
      return result();
    }
    state = "telegram_update_acknowledged_synthetic";
    secretGeneration = "telegram_ack_unverified";
    // ACK is never delivery proof. The caller's booleans are a negative gate
    // only; four real isolated Fastify HTTP probes establish positive evidence.
    if (request.syntheticReceiverProof) {
      try {
        const evidence = await withinProofDeadline((async () => {
          const advisory = await request.syntheticReceiverProof!();
          if (!advisory || advisory.candidateAccepted !== true ||
              advisory.previousRejected !== true) {
            return { verified: false, checks: 0 };
          }
          return verifyIsolatedFastifyReceiver(
            config, request.candidateSecret, config.webhookSecret
          );
        })(), request.proofTimeoutMs ?? 2000);
        receiverChecks = evidence.checks;
        if (evidence.verified === true && evidence.checks === 4) {
          state = "end_to_end_synthetic_proof";
          secretGeneration = "end_to_end_synthetic_only";
        } else {
          state = "synthetic_delivery_failed";
          reason = "delivery_unconfirmed";
        }
      } catch {
        // Once Bot API has ACKed, proof rejection/timeout is NEVER a Bot API
        // failure. Do not retry setWebhook, reveal exceptions or claim success.
        state = "synthetic_delivery_failed";
        reason = "delivery_unconfirmed";
      }
    }
    return result();
  } catch {
    // Network interruption after a mutation may have applied it. No retry.
    state = webhookAttempted ? "telegram_state_unknown" :
      menuApplied ? "partial_menu_applied" : "refused";
    reason = "bot_api_unavailable";
    return result();
  }
}
