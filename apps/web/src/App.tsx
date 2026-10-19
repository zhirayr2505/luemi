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
type State = "connecting" | "outside-telegram" | "authorized" | "error";
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
        if (!response.ok) throw new Error("Telegram authorization failed");
        const body = (await response.json()) as BootstrapResponse;
        setName(body.user.firstName);
        setState("authorized");
        webApp?.ready?.();
        webApp?.expand?.();
      } catch (error) {
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
        <p className="eyebrow">LUEMI · FOUNDATION 01</p>
        <h1>{state === "authorized" ? `Привет, ${name}!` : "Твоя история начинается здесь"}</h1>
        {state === "connecting" && <p>Подключаем защищённую сессию Telegram…</p>}
        {state === "outside-telegram" && <p>Откройте LUEMI через Telegram-бота, чтобы подтвердить вход. Демонстрационных анкет здесь нет.</p>}
        {state === "authorized" && <p>Telegram подтвердил вход. Регистрация и знакомства появятся после отдельного этапа разработки и модерации.</p>}
        {state === "error" && <p role="alert">Не удалось подтвердить вход. Откройте приложение заново через Telegram.</p>}
        <div className="stage" aria-label="Статус разработки"><span className="dot" /> Этап 01: безопасное подключение</div>
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
