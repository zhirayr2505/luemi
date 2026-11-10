/* Standalone, tiny entry safeguard. Never accesses Telegram initData or user storage.
 * If the main JS bundle fails before React paints, avoid a permanent blank screen. */
(function () {
  const root = document.getElementById("root");
  const boot = document.getElementById("luemi-boot");
  const retry = document.getElementById("luemi-boot-retry");
  const status = document.getElementById("luemi-boot-status");
  if (!root || !boot || !retry || !status) return;

  let settled = false;
  let watchdog = 0;
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
    // The recovery screen is now visible. Dismiss Telegram's native loader.
    try { window.Telegram?.WebApp?.ready?.(); } catch (_) { /* optional SDK */ }
  };

  observer.observe(root, { childList: true });
  watchdog = window.setTimeout(showRecovery, 10000);
  window.addEventListener("error", event => {
    if (event.target !== window && event.target?.tagName === "SCRIPT") showRecovery();
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
