import React, { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './logo.css';
import './profileMotion.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-frame error-fallback">
        <h1>Не удалось открыть LUEMI</h1>
        <p>Попробуй перезагрузить приложение. Сохранённый черновик останется на устройстве.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Попробовать ещё раз
        </button>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
