import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadRuntimeConfig } from './lib/config.ts';

// Global error handler — shows a fallback UI if React fails to mount
function showFatalError(error: unknown) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:system-ui,sans-serif">
        <div style="text-align:center;max-width:28rem">
          <div style="font-size:2rem;margin-bottom:1rem">⚠️</div>
          <h1 style="font-size:1.25rem;font-weight:600;margin-bottom:0.5rem">Une erreur est survenue</h1>
          <p style="font-size:0.875rem;color:#6b7280;margin-bottom:1rem">L'application a rencontré une erreur inattendue. Veuillez réessayer.</p>
          <button onclick="window.location.href='/'" style="padding:0.5rem 1rem;border-radius:0.375rem;background:#2563eb;color:white;border:none;cursor:pointer;font-size:0.875rem">Retour à l'accueil</button>
        </div>
      </div>`;
  }
  console.error('Fatal initialization error:', error);
}

// Load runtime configuration and render the app
function initializeApp() {
  // Prerendered blog pages are served as pure static HTML for SEO.
  // Intentionally skip React mounting so the crawler-facing markup stays
  // lightweight and self-contained — no client-side hydration needed.
  if (
    document
      .querySelector('meta[name="prerender-static-page"]')
      ?.getAttribute('content') === 'blog'
  ) {
    return;
  }

  // Render the app IMMEDIATELY — don't block on config loading.
  // Config will be loaded in the background and picked up when ready.
  try {
    createRoot(document.getElementById('root')!).render(<App />);
  } catch (error) {
    showFatalError(error);
    return;
  }

  // Load runtime config in the background (non-blocking)
  loadRuntimeConfig()
    .then(() => console.log('Runtime configuration loaded successfully'))
    .catch((error) =>
      console.warn('Failed to load runtime configuration, using defaults:', error)
    );
}

// Initialize the app
initializeApp();
