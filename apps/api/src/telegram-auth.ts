import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramIdentity {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}
export interface ValidatedInitData {
  user: TelegramIdentity;
  authDate: number;
}

export function validateTelegramInitData(
  raw: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = 3600
): ValidatedInitData | null {
  if (!raw || raw.length > 8192 || !botToken) return null;
  const entries = [...new URLSearchParams(raw).entries()];
  const seen = new Set<string>();
  for (const [key] of entries) {
    if (seen.has(key)) return null;
    seen.add(key);
  }
  const values = new Map(entries);
  const hash = values.get("hash");
  const authDateText = values.get("auth_date");
  const userText = values.get("user");
  if (!hash || !/^[a-f\d]{64}$/i.test(hash) || !authDateText || !/^\d{10}$/.test(authDateText) || !userText)
    return null;
  const authDate = Number(authDateText);
  if (authDate > nowSeconds + 60 || nowSeconds - authDate > maxAgeSeconds) return null;
  const checkString = entries
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  const received = Buffer.from(hash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const user: unknown = JSON.parse(userText);
    if (!user || typeof user !== "object") return null;
    const candidate = user as Record<string, unknown>;
    if (!Number.isSafeInteger(candidate.id) || Number(candidate.id) <= 0 || typeof candidate.first_name !== "string")
      return null;
    if (candidate.first_name.length > 256) return null;
    return { user: { id: candidate.id as number, first_name: candidate.first_name }, authDate };
  } catch {
    return null;
  }
}
