/* Request fullscreen before React paints, but DO NOT signal Telegram readiness here.
 * App.tsx calls WebApp.ready() after its first React render; an early ready()
 * dismisses the Telegram loader while the document is still blank. */
(function () {
  const app = window.Telegram && window.Telegram.WebApp;
  if (!app) return;
  try { if (typeof app.expand === "function") app.expand(); } catch (_) {/* Older Telegram clients may omit gesture controls. */}
  try {
    if (typeof app.disableVerticalSwipes === "function") app.disableVerticalSwipes();
  } catch (_) {/* Telegram mini apps that lack this API stay usable. */}
  if (typeof app.requestFullscreen !== "function" || app.isFullscreen) return;
  try {
    if (typeof app.isVersionAtLeast === "function" && !app.isVersionAtLeast("8.0")) return;
    window.__luemiEarlyFullscreenRequested = true;
    app.requestFullscreen();
  } catch (_) {
    window.__luemiEarlyFullscreenRequested = false;
  }
})();
