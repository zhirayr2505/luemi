/**
 * Telegram WebView can reuse an already-open HTML document after a deploy.
 * A fresh /start message supplies a different URL per Render commit, without
 * changing the bot's permanent menu URL, the trust origin, or stored drafts.
 * Invalid/missing revisions fail closed to the canonical root URL.
 */
export function versionedWebAppUrl(
  origin: string,
  gitCommit: string | undefined,
  route?: "likes" | "chats"
): string {
  if (!["https://luemi-stage01.onrender.com", "https://luemi.onrender.com"].includes(origin)) return origin;
  if (!route && (!gitCommit || !/^[0-9a-f]{40}$/i.test(gitCommit))) return origin;
  const url = new URL(origin);
  if (gitCommit && /^[0-9a-f]{40}$/i.test(gitCommit))
    url.searchParams.set("luemiRelease", gitCommit.slice(0, 12));
  if (route) url.searchParams.set("luemiRoute", route);
  return url.toString();
}
