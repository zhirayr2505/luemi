import { useEffect, useRef } from 'react';

type TelegramWebApp = {
  initData: string;
  platform: string;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast: (version: string) => boolean;
  disableVerticalSwipes: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  onEvent: (name: string, callback: () => void) => void;
  offEvent: (name: string, callback: () => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegram() {
  const app = window.Telegram?.WebApp;
  return app && app.platform !== 'unknown' ? app : undefined;
}

/** Stable Telegram subscription; callback updates without hide/show flashes. */
export function useTelegramBridge(full: boolean, onBack: () => void, theme: string) {
  const back = useRef(onBack);
  back.current = onBack;
  const subscribed = useRef(false);

  useEffect(() => {
    const tg = getTelegram();
    const viewport = window.visualViewport;
    let width = window.innerWidth;
    let stableHeight = tg?.viewportStableHeight || window.innerHeight;
    const resize = () => {
      const candidate = tg?.viewportStableHeight || window.innerHeight;
      const focused = document.activeElement;
      const typing =
        focused instanceof HTMLElement &&
        !!focused.closest('input,textarea,[contenteditable="true"]');
      const rotated = window.innerWidth !== width;
      // Browser toolbar animation must not cause a moving profile viewport.
      if (tg || rotated || typing || Math.abs(candidate - stableHeight) > 155) {
        stableHeight = candidate;
        width = window.innerWidth;
      }
      document.documentElement.style.setProperty(
        '--viewport-height',
        `${Math.max(280, stableHeight)}px`,
      );
    };
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes();
      tg.onEvent('viewportChanged', resize);
    }
    resize();
    viewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
      tg?.offEvent('viewportChanged', resize);
    };
  }, []);

  useEffect(() => {
    const tg = getTelegram();
    if (!tg || !tg.isVersionAtLeast('6.1')) return;
    const handleBack = () => back.current();
    tg.BackButton.onClick(handleBack);
    subscribed.current = true;
    return () => {
      if (subscribed.current) tg.BackButton.offClick(handleBack);
      subscribed.current = false;
    };
  }, []);

  useEffect(() => {
    const tg = getTelegram();
    if (!tg || !tg.isVersionAtLeast('6.1')) return;
    if (full) tg.BackButton.show();
    else tg.BackButton.hide();
  }, [full]);

  useEffect(() => {
    const tg = getTelegram();
    if (!tg || !tg.isVersionAtLeast('6.1')) return;
    const color = theme === 'dark' ? '#191422' : '#f8f3fa';
    tg.setHeaderColor(color);
    tg.setBackgroundColor(color);
  }, [theme]);
}
