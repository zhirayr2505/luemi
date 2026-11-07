/* Runs after the Telegram SDK but before the React bundle and first paint.
 * Fullscreen must start before the cinematic poster is composited.
 * The App retains activated-event retry support for already-open Mini Apps. */
(function () {
  const app = window.Telegram && window.Telegram.WebApp;
  if (!app) return;
  try { if (typeof app.ready === "function") app.ready(); } catch (_) {}
  try { if (typeof app.expand === "function") app.expand(); } catch (_) {}
  try {
    if (typeof app.disableVerticalSwipes === "function") app.disableVerticalSwipes();
  } catch (_) {}
  if (typeof app.requestFullscreen !== "function" || app.isFullscreen) return;
  try {
    if (typeof app.isVersionAtLeast === "function" && !app.isVersionAtLeast("8.0")) return;
    window.__luemiEarlyFullscreenRequested = true;
    app.requestFullscreen();
  } catch (_) {
    window.__luemiEarlyFullscreenRequested = false;
  }
})();
