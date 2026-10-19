import { useEffect, useState } from "react";
import type { BootstrapResponse, HealthResponse } from "@luemi/contracts";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        colorScheme?: "dark" | "light";
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}
type State = "connecting" | "outside-telegram" | "authorized" | "needs-bot" | "error";
export function App() {
  const [state, setState] = useState<State>("connecting");
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const initData = webApp?.initData;
    if (!initData) {
      setState("outside-telegram");
      webApp?.ready?.();
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const live = await fetch("/api/health/live", { signal: controller.signal });
        if (!live.ok || ((await live.json()) as HealthResponse).status !== "ok") throw new Error("API unavailable");
        const response = await fetch("/api/auth/telegram", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }), signal: controller.signal
        });
        if (response.status === 503) { setState("needs-bot"); webApp?.ready?.(); return; }
        if (!response.ok) throw new Error("Telegram authorization failed");
        const body = (await response.json()) as BootstrapResponse;
        setName(body.user.firstName);
        setState("authorized");
        webApp?.ready?.();
        webApp?.expand?.();
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    })();
    return () => controller.abort();
  }, []);
  const active = theme === "system" ? (window.Telegram?.WebApp?.colorScheme ?? "light") : theme;
  return (
    <main className="app" data-theme={active}>
      <div className="mist" aria-hidden="true" />
      <section className="glass" aria-live="polite">
        <p className="eyebrow">LUEMI · TELEGRAM MINI APP</p>
        <img className="wordmark" src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="luemi" width="280" height="105" />
        <h1>{state === "authorized" ? `Привет, ${name}!` : "Твоя история начинается здесь"}</h1>
        {state === "connecting" && <p>Подключаем защищённую сессию Telegram…</p>}
        {state === "outside-telegram" && <p>Открой LUEMI кнопкой в Telegram-боте. Здесь приложение не запрашивает регистрацию вне Telegram.</p>}
        {state === "authorized" && <p>Telegram подтвердил вход. Мы готовим регистрацию и знакомства для закрытой беты.</p>}
        {state === "needs-bot" && <p role="status">Тестовая версия открылась в Telegram. Подтверждение входа подключим после безопасной настройки бота.</p>}
        {state === "error" && <p role="alert">Не удалось подтвердить вход. Открой приложение снова через Telegram.</p>}
        <div className="stage" aria-label="Статус разработки"><span className="dot" /> Stage 01 · Закрытая техническая версия</div>
        <div className="themes" aria-label="Тема интерфейса">
          {(["system","light","dark"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={theme === value}
              onClick={() => setTheme(value)}>{value === "system" ? "Система" : value === "light" ? "Светлая" : "Тёмная"}</button>
          ))}
        </div>
      </section>
    </main>
  );
}
