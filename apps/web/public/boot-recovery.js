/* Lightweight first-paint safeguard. Never reads Telegram initData or user storage.
 * Telegram's own white loader must not outlive LUEMI's already-painted brand shell,
 * even if React, a JS chunk or authentication is slow/unavailable. */
(function () {
  const root = document.getElementById("root");
  const boot = document.getElementById("luemi-boot");
  const retry = document.getElementById("luemi-boot-retry");
  const status = document.getElementById("luemi-boot-status");
  if (!root || !boot || !retry || !status) return;

  let settled = false;
  let nativeReady = false;
  let watchdog = 0;

  // This script executes before Vite's module entry. The branded, self-hosted
  // HTML shell is already in the DOM. Tell Telegram to hide its native white
  // spinner after the shell has had an opportunity to paint; React startup and
  // a cold /api connection must not hold Telegram's overlay open.
  const releaseNativeLoader = () => {
    if (nativeReady) return;
    const webApp = window.Telegram?.WebApp;
    if (typeof webApp?.ready !== "function") return;
    try {
      webApp.ready();
      nativeReady = true;
    } catch (_) { /* A bridge that is not ready can be retried safely. */ }
  };
  const releaseAfterPaint = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(releaseNativeLoader);
    });
    // Android WebView may throttle animation frames under Telegram's overlay.
    window.setTimeout(releaseNativeLoader, 350);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", releaseAfterPaint, { once: true });
  } else {
    releaseAfterPaint();
  }
  window.addEventListener("load", releaseAfterPaint, { once: true });
  // On slow Telegram SDK initialization, never wait for React to call ready().
  window.setTimeout(releaseNativeLoader, 1600);

  const observer = new MutationObserver(() => {
    if (settled || !root.firstElementChild) return;
    settled = true;
    window.clearTimeout(watchdog);
    observer.disconnect();
    window.requestAnimationFrame(() => boot.remove());
  });

  const showRecovery = () => {
    if (settled || root.firstElementChild) return;
    status.textContent = "Не удалось загрузить интерфейс. Попробуй открыть ещё раз.";
    retry.hidden = false;
    releaseNativeLoader();
  };

  observer.observe(root, { childList: true });
  window.setTimeout(() => {
    if (!settled && !root.firstElementChild) {
      status.textContent = "Подключаемся к LUEMI…";
    }
  }, 3500);
  watchdog = window.setTimeout(showRecovery, 10000);
  window.addEventListener("error", event => {
    if (!root.firstElementChild && (event.target === window ||
        event.target?.tagName === "SCRIPT")) showRecovery();
  }, true);
  window.addEventListener("unhandledrejection", () => {
    if (!root.firstElementChild) showRecovery();
  });
  retry.addEventListener("click", () => {
    // A different document URL bypasses stale Telegram WebView HTML caches.
    const target = new URL(window.location.href);
    target.searchParams.set("_luemi_reload", String(Date.now()));
    window.location.replace(target.toString());
  });
})();
