import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/aura.css';
import './styles/app.css';

// Offline shell for the home-screen app (hosted builds only; the claude.ai artifact has no service-worker scope).
if (import.meta.env.PROD && 'serviceWorker' in navigator && !(window as unknown as { claude?: unknown }).claude) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => undefined); });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
