/**
 * Solar PV Q&A — Application Entry Point
 *
 * Routes:
 *   /          → Chat UI
 *   /admin     → Admin dashboard
 *   /admin/*   → Admin dashboard (deep links)
 */

import { mountChat } from './chat/index.js';
import { mountAdmin } from './admin/index.js';

/* Import styles so Vite bundles them */
import './styles/components.css';
import './styles/chat.css';
import './styles/admin.css';

/* ---- SPA router ---- */

function route(app: HTMLElement): void {
  const path = window.location.pathname;

  // Clear previous content
  app.innerHTML = '';

  if (path.startsWith('/admin')) {
    mountAdmin(app);
  } else {
    mountChat(app);
  }
}

/* ---- Navigation helpers ---- */

function navigateTo(url: string): void {
  window.history.pushState({}, '', url);
  const app = document.getElementById('app');
  if (app) route(app);
}

// Expose for use by admin/chat modules
(window as any).__navigateTo = navigateTo;

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');

  if (!app) {
    console.error('#app element not found.');
    return;
  }

  route(app);

  // Handle browser back/forward
  window.addEventListener('popstate', () => route(app));

  // Intercept link clicks for SPA navigation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Only intercept same-origin admin/chat links
    if (href.startsWith('/admin') || href === '/') {
      e.preventDefault();
      navigateTo(href);
    }
  });
});
