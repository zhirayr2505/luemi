/** Domain validation — does not trust the client for production authorisation. */
export function validName(value: string): boolean {
  const name = value.trim();
  return name.length >= 2 && name.length <= 40 && /^[\p{L}][\p{L} '\u2019-]*[\p{L}]$/u.test(name);
}
export function birthDate(value: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = +match[1], month = +match[2], year = +match[3];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}
export function adult(value: string, now = new Date()): boolean {
  const date = birthDate(value);
  if (!date) return false;
  const cutOff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return date <= cutOff && date.getUTCFullYear() >= 1900;
}
export const validPhotoCount = (count: number): boolean => Number.isInteger(count) && count >= 3 && count <= 6;
export const validInterestCount = (count: number): boolean => Number.isInteger(count) && count >= 1 && count <= 15;
