/**
 * Validate Telegram WebApp initData before trusting a user identity.
 * The bot token MUST remain on the server; this is not a client module.
 * Reference: Telegram Mini Apps data-check-string HMAC-SHA256 algorithm.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type TelegramIdentity = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramIdentity | null {
  if (!botToken || initData.length > 8192 || initData.length === 0) return null;
  const parameters = new URLSearchParams(initData);
  const fields = [...parameters.entries()];
  const names = new Set(fields.map(([k]) => k));
  if (names.size !== fields.length) return null; // duplicate hash/key params must be rejected
  const hash = parameters.get('hash') ?? '';
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) return null;
  const rawDate = parameters.get('auth_date') ?? '';
  if (!/^\d{10,12}$/.test(rawDate)) return null;
  const authDate = Number(rawDate);
  if (!Number.isSafeInteger(authDate) || nowSeconds - authDate > 300 || authDate - nowSeconds > 30)
    return null;
  const signed = fields.filter(([key]) => key !== 'hash');
  signed.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const checked = signed.map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checked).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;
  try {
    const value = JSON.parse(parameters.get('user') ?? '');
    if (
      !value ||
      typeof value !== 'object' ||
      !Number.isSafeInteger(value.id) ||
      value.id <= 0 ||
      typeof value.first_name !== 'string' ||
      value.first_name.length < 1 ||
      value.first_name.length > 255 ||
      (value.username !== undefined && typeof value.username !== 'string') ||
      (value.last_name !== undefined && typeof value.last_name !== 'string') ||
      (value.language_code !== undefined && typeof value.language_code !== 'string')
    )
      return null;
    return {
      id: value.id,
      first_name: value.first_name,
      last_name: value.last_name,
      username: value.username,
      language_code: value.language_code,
    };
  } catch {
    return null;
  }
}
