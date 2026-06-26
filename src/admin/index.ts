/**
 * Solar PV Q&A — Admin Dashboard
 *
 * Mounts a full admin UI with login, file browser, markdown editor,
 * FAQ cache viewer, and token budget tracker.
 */

import {
  login,
  listFiles,
  readFile,
  saveFile,
  createFile,
  deleteFile,
  getTokenBudget,
  getCacheEntries,
  regenerateCache,
  ingestData,
  ingestFile,
  saveIngested,
  clearPassword,
  isAuthenticated,
  type FileEntry,
  getSettings,
  saveSettings,
} from './api.js';
import { createEditor, setEditorContent, getEditorContent } from './editor.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = ['products', 'schemes', 'company', 'basics'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  products: 'Products',
  schemes: 'Schemes',
  company: 'Company',
  basics: 'Basics',
};
const TOKEN_LIMIT = 40000;

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const ICONS = {
  file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  save: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  logout: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  sun: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" fill="#F59E0B"/><g stroke="#F59E0B" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g></svg>`,
  menu: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  upload: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  chevronDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevronRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  discard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function el(tag: string, className?: string, innerHTML?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (innerHTML !== undefined) node.innerHTML = innerHTML;
  return node;
}

function escapeHtml(s: string): string {
  const span = document.createElement('span');
  span.textContent = s;
  return span.innerHTML;
}

/* ---- Toast notifications ---- */

let toastContainer: HTMLDivElement | null = null;

function ensureToastContainer(): HTMLDivElement {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.style.cssText =
    'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  const bg =
    type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6';
  toast.style.cssText = `pointer-events:auto;padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);background:${bg};transform:translateX(120%);transition:transform 0.3s ease;max-width:360px;word-break:break-word;`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  });

  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ---- Category from path ---- */

function categoryOf(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? parts[0] : 'uncategorized';
}

function filenameOf(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/* ------------------------------------------------------------------ */
/*  Login screen                                                       */
/* ------------------------------------------------------------------ */

function renderLogin(container: HTMLElement, onLogin: () => void): void {
  container.innerHTML = '';

  const wrapper = el('div');
  wrapper.style.cssText =
    'display:flex;align-items:center;justify-content:center;height:100vh;background:#F9FAFB;';

  const card = el('div');
  card.style.cssText =
    'background:#fff;border-radius:12px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);width:100%;max-width:380px;text-align:center;';

  card.innerHTML = `
    <div style="margin-bottom:24px">${ICONS.sun}</div>
    <h1 style="font-size:1.25rem;font-weight:700;color:#1F2937;margin:0 0 4px">Solar PV Admin</h1>
    <p style="font-size:0.875rem;color:#6B7280;margin:0 0 24px">Enter your admin password to continue.</p>
    <div id="login-error" style="color:#EF4444;font-size:0.8rem;margin-bottom:12px;min-height:20px"></div>
  `;

  const form = document.createElement('form');
  form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = 'Admin password';
  input.style.cssText =
    'padding:10px 14px;border:1px solid #E5E7EB;border-radius:8px;font-size:0.875rem;outline:none;transition:border-color 0.15s;';
  input.addEventListener('focus', () => {
    input.style.borderColor = '#F59E0B';
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = '#E5E7EB';
  });

  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.textContent = 'Log in';
  btn.style.cssText =
    'padding:10px 14px;background:#F59E0B;color:#fff;border:none;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;transition:background 0.15s;';
  btn.addEventListener('mouseenter', () => (btn.style.background = '#D97706'));
  btn.addEventListener('mouseleave', () => (btn.style.background = '#F59E0B'));

  form.append(input, btn);
  card.appendChild(form);
  wrapper.appendChild(card);
  container.appendChild(wrapper);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = card.querySelector('#login-error') as HTMLElement;
    errEl.textContent = '';

    const pw = input.value.trim();
    if (!pw) {
      errEl.textContent = 'Password is required.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Logging in...';

    const ok = await login(pw);
    if (ok) {
      onLogin();
    } else {
      errEl.textContent = 'Invalid password. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Log in';
    }
  });

  input.focus();
}

/* ------------------------------------------------------------------ */
/*  Main dashboard                                                     */
/* ------------------------------------------------------------------ */

async function renderDashboard(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  /* ---- State ---- */
  let allFiles: FileEntry[] = [];
  let activeFile: { category: string; file: string } | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let editorInstance: any = null;
  type TabId = 'files' | 'cache' | 'tokens' | 'ingest' | 'settings';
  let currentTab: TabId = 'files';

  /* ---- Root layout ---- */
  const root = el('div', 'admin-container');

  /* ---- Sidebar ---- */
  const sidebar = el('aside', 'admin-sidebar');
  sidebar.innerHTML = `
    <div class="admin-sidebar__header">
      ${ICONS.sun}
      <span class="admin-sidebar__logo">Admin</span>
      <span class="admin-sidebar__version">v1.0</span>
    </div>
  `;

  const fileList = el('div', 'file-list');
  sidebar.appendChild(fileList);

  // New file button area
  const sidebarFooter = el('div');
  sidebarFooter.style.cssText = 'padding:12px 20px;border-top:1px solid #1F2937;';
  const newFileBtn = document.createElement('button');
  newFileBtn.innerHTML = `${ICONS.plus} <span>New File</span>`;
  newFileBtn.style.cssText =
    'display:flex;align-items:center;gap:6px;width:100%;padding:8px 12px;background:#1F2937;color:#D1D5DB;border:1px solid #374151;border-radius:6px;font-size:0.8rem;cursor:pointer;transition:background 0.12s;';
  newFileBtn.addEventListener('mouseenter', () => (newFileBtn.style.background = '#374151'));
  newFileBtn.addEventListener('mouseleave', () => (newFileBtn.style.background = '#1F2937'));
  sidebarFooter.appendChild(newFileBtn);
  sidebar.appendChild(sidebarFooter);

  root.appendChild(sidebar);

  /* ---- Sidebar overlay (mobile) ---- */
  const overlay = el('div', 'admin-sidebar-overlay');
  root.appendChild(overlay);

  /* ---- Main area ---- */
  const main = el('div', 'admin-main');

  /* ---- Header ---- */
  const header = el('div', 'admin-header');
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <button class="admin-sidebar-toggle" id="sidebar-toggle" aria-label="Toggle sidebar">${ICONS.menu}</button>
      <h1 class="admin-header__title">Knowledge Base</h1>
    </div>
    <div class="admin-header__actions">
      <div id="token-badge" style="font-size:0.75rem;color:#6B7280"></div>
      <button class="admin-upload-btn" id="quick-upload-btn">${ICONS.upload} Upload &amp; Ingest</button>
      <button class="admin-logout-btn" id="logout-btn">${ICONS.logout} Logout</button>
    </div>
  `;
  main.appendChild(header);

  /* ---- Tabs ---- */
  const tabBar = el('div');
  tabBar.style.cssText =
    'display:flex;gap:0;border-bottom:1px solid #E5E7EB;background:#fff;padding:0 20px;';

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'files', label: 'Knowledge Files' },
    { id: 'cache', label: 'FAQ Cache' },
    { id: 'tokens', label: 'Token Budget' },
    { id: 'ingest', label: 'Ingest Data' },
    { id: 'settings', label: 'Settings' },
  ];

  const tabButtons: Record<string, HTMLButtonElement> = {};
  for (const t of tabs) {
    const btn = document.createElement('button');
    btn.textContent = t.label;
    btn.style.cssText =
      'padding:10px 16px;font-size:0.8rem;font-weight:500;color:#6B7280;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:color 0.15s,border-color 0.15s;';
    btn.addEventListener('click', () => switchTab(t.id));
    tabButtons[t.id] = btn;
    tabBar.appendChild(btn);
  }
  main.appendChild(tabBar);

  /* ---- Content area ---- */
  const content = el('div', 'admin-content');
  main.appendChild(content);

  root.appendChild(main);
  container.appendChild(root);

  /* ---- Sidebar toggle (mobile) ---- */
  const toggleBtn = header.querySelector('#sidebar-toggle') as HTMLButtonElement;
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('admin-sidebar--open');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('admin-sidebar--open');
  });

  /* ---- Direct local-file upload ---- */
  const quickUploadBtn = header.querySelector('#quick-upload-btn') as HTMLButtonElement;
  quickUploadBtn.addEventListener('click', () => {
    switchTab('ingest');
    const fileInput = content.querySelector(
      'input[type="file"][aria-label="Choose a local file to ingest"]',
    ) as HTMLInputElement | null;
    fileInput?.click();
  });

  /* ---- Logout ---- */
  const logoutBtn = header.querySelector('#logout-btn') as HTMLButtonElement;
  logoutBtn.addEventListener('click', () => {
    clearPassword();
    if (editorInstance) {
      (editorInstance as any).toTextArea?.();
      editorInstance = null;
    }
    renderLogin(container, () => renderDashboard(container));
  });

  /* ---- Tab switching ---- */
  function switchTab(id: TabId): void {
    currentTab = id;
    for (const [tid, btn] of Object.entries(tabButtons)) {
      const active = tid === id;
      btn.style.color = active ? '#F59E0B' : '#6B7280';
      btn.style.borderBottomColor = active ? '#F59E0B' : 'transparent';
      btn.style.fontWeight = active ? '600' : '500';
    }
    renderContent();
  }

  /* ---- Render content by tab ---- */
  function renderContent(): void {
    // Clean up editor if switching away from files
    if (currentTab !== 'files' && editorInstance) {
      (editorInstance as any).toTextArea?.();
      editorInstance = null;
      activeFile = null;
      clearActiveFileItem();
    }

    content.innerHTML = '';

    switch (currentTab) {
      case 'files':
        renderFilesTab();
        break;
      case 'cache':
        renderCacheTab();
        break;
      case 'tokens':
        renderTokensTab();
        break;
      case 'ingest':
        renderIngestTab();
        break;
      case 'settings':
        renderSettingsTab();
        break;
    }
  }

  /* ================================================================ */
  /*  FILES TAB                                                        */
  /* ================================================================ */

  function renderFilesTab(): void {
    if (activeFile) {
      renderEditor(activeFile.category, activeFile.file);
    } else {
      const placeholder = el('div');
      placeholder.style.cssText =
        'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#9CA3AF;';
      placeholder.innerHTML = `
        <div style="margin-bottom:16px;opacity:0.4">${ICONS.file}</div>
        <p style="font-size:0.95rem;font-weight:600;color:#4B5563;margin:0 0 6px">Manage your knowledge vault</p>
        <p style="font-size:0.825rem;margin:0 0 18px">Select an existing file, or upload a file from this PC.</p>
      `;
      const emptyUploadBtn = document.createElement('button');
      emptyUploadBtn.className = 'admin-upload-btn';
      emptyUploadBtn.innerHTML = `${ICONS.upload} Browse PC &amp; Ingest File`;
      emptyUploadBtn.addEventListener('click', () => quickUploadBtn.click());
      placeholder.appendChild(emptyUploadBtn);
      content.appendChild(placeholder);
    }
  }

  async function renderEditor(category: string, file: string): Promise<void> {
    content.innerHTML = '';

    // Toolbar
    const toolbar = el('div');
    toolbar.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';

    const titleEl = el('span');
    titleEl.style.cssText = 'font-size:0.875rem;font-weight:600;color:#1F2937;';
    titleEl.textContent = `${category}/${file}`;

    const actions = el('div');
    actions.style.cssText = 'display:flex;gap:8px;';

    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = `${ICONS.save} Save`;
    saveBtn.style.cssText =
      'display:flex;align-items:center;gap:6px;padding:6px 14px;background:#10B981;color:#fff;border:none;border-radius:6px;font-size:0.8rem;font-weight:500;cursor:pointer;transition:background 0.15s;';
    saveBtn.addEventListener('mouseenter', () => (saveBtn.style.background = '#059669'));
    saveBtn.addEventListener('mouseleave', () => (saveBtn.style.background = '#10B981'));

    const delBtn = document.createElement('button');
    delBtn.innerHTML = `${ICONS.trash} Delete`;
    delBtn.style.cssText =
      'display:flex;align-items:center;gap:6px;padding:6px 14px;background:none;color:#EF4444;border:1px solid #FCA5A5;border-radius:6px;font-size:0.8rem;font-weight:500;cursor:pointer;transition:background 0.15s;';
    delBtn.addEventListener('mouseenter', () => (delBtn.style.background = '#FEF2F2'));
    delBtn.addEventListener('mouseleave', () => (delBtn.style.background = 'none'));

    actions.append(saveBtn, delBtn);
    toolbar.append(titleEl, actions);
    content.appendChild(toolbar);

    // Editor container
    const editorContainer = el('div', 'editor-area');
    content.appendChild(editorContainer);

    // Load content
    try {
      const fileContent = await readFile(category, file);

      editorInstance = (await createEditor(editorContainer, handleSave)) as any;
      setEditorContent(editorInstance as any, fileContent);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to load file.',
        'error',
      );
      return;
    }

    // Save handler
    async function handleSave(newContent: string): Promise<void> {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        await saveFile(category, file, newContent);
        showToast('File saved. Manifest rebuilt.', 'success');
        await refreshSidebar();
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Save failed.',
          'error',
        );
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${ICONS.save} Save`;
      }
    }

    saveBtn.addEventListener('click', () => {
      if (editorInstance) {
        handleSave(getEditorContent(editorInstance as any));
      }
    });

    // Delete handler
    delBtn.addEventListener('click', async () => {
      const confirmed = confirm(
        `Delete ${category}/${file}? This cannot be undone.`,
      );
      if (!confirmed) return;

      try {
        await deleteFile(category, file);
        showToast('File deleted.', 'success');
        activeFile = null;
        if (editorInstance) {
          (editorInstance as any).toTextArea?.();
          editorInstance = null;
        }
        clearActiveFileItem();
        await refreshSidebar();
        renderContent();
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Delete failed.',
          'error',
        );
      }
    });
  }

  /* ================================================================ */
  /*  INGEST TAB                                                       */
  /* ================================================================ */

  function renderIngestTab(): void {
    let ingestSourceMode: 'file' | 'url' | 'text' = 'file';
    let selectedCategory = 'products';
    let ingestResult: Awaited<ReturnType<typeof ingestData>> | null = null;
    let rawCollapsed = true;

    function draw(): void {
      content.innerHTML = '';

      /* ---- Top section: source + category ---- */
      const topSection = el('div');
      topSection.style.cssText =
        'background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:24px;margin-bottom:16px;';

      const heading = el('h2');
      heading.textContent = 'Ingest New Content';
      heading.style.cssText = 'font-size:1rem;font-weight:700;color:#1F2937;margin:0 0 20px;';
      topSection.appendChild(heading);

      /* -- Source mode toggle -- */
      const modeRow = el('div');
      modeRow.style.cssText = 'display:flex;gap:8px;margin-bottom:20px;';

      const modes: Array<{ id: 'file' | 'url' | 'text'; label: string; icon: string }> = [
        { id: 'file', label: 'Upload File', icon: ICONS.upload },
        { id: 'url', label: 'Paste URL', icon: ICONS.link },
        { id: 'text', label: 'Paste Text', icon: ICONS.edit },
      ];

      const modeButtons: Record<string, HTMLButtonElement> = {};
      for (const m of modes) {
        const btn = document.createElement('button');
        btn.innerHTML = `<span>${m.icon}</span> <span>${m.label}</span>`;
        btn.style.cssText =
          'display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:0.8rem;font-weight:500;cursor:pointer;transition:background 0.15s,border-color 0.15s;';
        btn.addEventListener('click', () => {
          ingestSourceMode = m.id;
          ingestResult = null;
          draw();
        });
        modeButtons[m.id] = btn;
        modeRow.appendChild(btn);
      }
      topSection.appendChild(modeRow);

      function styleModeButtons(): void {
        for (const [id, btn] of Object.entries(modeButtons)) {
          const active = id === ingestSourceMode;
          btn.style.background = active ? '#F59E0B' : '#fff';
          btn.style.color = active ? '#fff' : '#374151';
          btn.style.border = active ? '1px solid #F59E0B' : '1px solid #E5E7EB';
        }
      }
      styleModeButtons();

      /* -- Source input area -- */
      const inputArea = el('div');
      inputArea.style.cssText = 'margin-bottom:20px;';

      let fileInputEl: HTMLInputElement | null = null;
      let urlInputEl: HTMLInputElement | null = null;
      let textAreaEl: HTMLTextAreaElement | null = null;

      if (ingestSourceMode === 'file') {
        const dropZone = el('div');
        dropZone.style.cssText =
          'border:2px dashed #D1D5DB;border-radius:10px;padding:32px;text-align:center;cursor:pointer;transition:border-color 0.15s,background 0.15s;';
        dropZone.innerHTML = `
          <div style="margin-bottom:8px;color:#9CA3AF">${ICONS.upload}</div>
          <p style="font-size:0.875rem;color:#6B7280;margin:0 0 4px">Click to browse or drag a file here</p>
          <p style="font-size:0.75rem;color:#9CA3AF;margin:0">PDF, DOCX, images, XLSX, PPTX, HTML, TXT</p>
          <p id="ingest-file-name" style="font-size:0.8rem;color:#F59E0B;margin:8px 0 0;min-height:20px"></p>
        `;

        fileInputEl = document.createElement('input');
        fileInputEl.type = 'file';
        fileInputEl.setAttribute('aria-label', 'Choose a local file to ingest');
        fileInputEl.accept = '.pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.pptx,.ppt,.html,.htm,.txt,.md,.csv';
        fileInputEl.style.cssText =
          'display:block;margin:12px auto 0;max-width:100%;font-size:0.8rem;color:#4B5563;';

        dropZone.addEventListener('click', () => fileInputEl!.click());
        dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.style.borderColor = '#F59E0B';
          dropZone.style.background = '#FFFBEB';
        });
        dropZone.addEventListener('dragleave', () => {
          dropZone.style.borderColor = '#D1D5DB';
          dropZone.style.background = '';
        });
        dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.style.borderColor = '#D1D5DB';
          dropZone.style.background = '';
          if (e.dataTransfer?.files.length) {
            fileInputEl!.files = e.dataTransfer.files;
            const nameEl = dropZone.querySelector('#ingest-file-name') as HTMLElement;
            nameEl.textContent = e.dataTransfer.files[0].name;
          }
        });

        fileInputEl.addEventListener('change', () => {
          if (fileInputEl!.files?.length) {
            const nameEl = dropZone.querySelector('#ingest-file-name') as HTMLElement;
            nameEl.textContent = fileInputEl!.files[0].name;
          }
        });

        inputArea.append(dropZone, fileInputEl);
      } else if (ingestSourceMode === 'url') {
        const label = el('label');
        label.textContent = 'URL (including YouTube links)';
        label.style.cssText = 'display:block;font-size:0.8rem;font-weight:500;color:#374151;margin-bottom:6px;';

        urlInputEl = document.createElement('input');
        urlInputEl.type = 'url';
        urlInputEl.placeholder = 'https://example.com/article or https://youtube.com/watch?v=...';
        urlInputEl.style.cssText =
          'width:100%;padding:10px 14px;border:1px solid #E5E7EB;border-radius:8px;font-size:0.875rem;outline:none;box-sizing:border-box;transition:border-color 0.15s;';
        urlInputEl.addEventListener('focus', () => (urlInputEl!.style.borderColor = '#F59E0B'));
        urlInputEl.addEventListener('blur', () => (urlInputEl!.style.borderColor = '#E5E7EB'));

        inputArea.append(label, urlInputEl);
      } else {
        const label = el('label');
        label.textContent = 'Paste raw text or Markdown';
        label.style.cssText = 'display:block;font-size:0.8rem;font-weight:500;color:#374151;margin-bottom:6px;';

        textAreaEl = document.createElement('textarea');
        textAreaEl.placeholder = '# Paste your content here...\n\nYou can use Markdown formatting.';
        textAreaEl.rows = 10;
        textAreaEl.style.cssText =
          'width:100%;padding:10px 14px;border:1px solid #E5E7EB;border-radius:8px;font-size:0.85rem;font-family:monospace;resize:vertical;outline:none;box-sizing:border-box;transition:border-color 0.15s;';
        textAreaEl.addEventListener('focus', () => (textAreaEl!.style.borderColor = '#F59E0B'));
        textAreaEl.addEventListener('blur', () => (textAreaEl!.style.borderColor = '#E5E7EB'));

        inputArea.append(label, textAreaEl);
      }

      topSection.appendChild(inputArea);

      /* -- Category selector -- */
      const catRow = el('div');
      catRow.style.cssText = 'display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;';

      const catWrapper = el('div');
      catWrapper.style.cssText = 'flex:1;min-width:200px;';
      const catLabel = el('label');
      catLabel.textContent = 'Category';
      catLabel.style.cssText = 'display:block;font-size:0.8rem;font-weight:500;color:#374151;margin-bottom:6px;';

      const catSelect = document.createElement('select');
      catSelect.style.cssText =
        'width:100%;padding:10px 14px;border:1px solid #E5E7EB;border-radius:8px;font-size:0.875rem;outline:none;background:#fff;cursor:pointer;box-sizing:border-box;';

      const catOptions: Array<{ value: string; label: string }> = [
        { value: 'products', label: 'Products (solar panels, inverters, equipment)' },
        { value: 'basics', label: 'Basics (solar general knowledge)' },
        { value: 'company', label: 'Company (Eternalgy info)' },
        { value: 'schemes', label: 'Schemes (Malaysia government schemes)' },
      ];
      for (const opt of catOptions) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        catSelect.appendChild(o);
      }
      catSelect.value = selectedCategory;
      catSelect.addEventListener('change', () => {
        selectedCategory = catSelect.value;
      });

      catWrapper.append(catLabel, catSelect);
      catRow.appendChild(catWrapper);

      /* -- Ingest button -- */
      const ingestBtn = document.createElement('button');
      ingestBtn.innerHTML = `${ICONS.upload} Ingest`;
      ingestBtn.style.cssText =
        'display:flex;align-items:center;gap:6px;padding:10px 24px;background:#F59E0B;color:#fff;border:none;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;transition:background 0.15s;height:fit-content;';
      ingestBtn.addEventListener('mouseenter', () => (ingestBtn.style.background = '#D97706'));
      ingestBtn.addEventListener('mouseleave', () => (ingestBtn.style.background = '#F59E0B'));

      catRow.appendChild(ingestBtn);
      topSection.appendChild(catRow);

      /* -- Status area -- */
      const statusArea = el('div');
      statusArea.style.cssText = 'margin-top:16px;min-height:24px;';
      topSection.appendChild(statusArea);

      content.appendChild(topSection);

      /* -- Ingest button handler -- */
      ingestBtn.addEventListener('click', async () => {
        statusArea.innerHTML = '';
        let contentValue = '';
        let selectedFile: File | null = null;

        if (ingestSourceMode === 'file') {
          if (!fileInputEl?.files?.length) {
            statusArea.innerHTML = '<span style="color:#EF4444;font-size:0.85rem;">Please select a file.</span>';
            return;
          }
          selectedFile = fileInputEl.files[0];
        } else if (ingestSourceMode === 'url') {
          contentValue = urlInputEl?.value.trim() ?? '';
          if (!contentValue) {
            statusArea.innerHTML = '<span style="color:#EF4444;font-size:0.85rem;">Please enter a URL.</span>';
            return;
          }
        } else {
          contentValue = textAreaEl?.value.trim() ?? '';
          if (!contentValue) {
            statusArea.innerHTML = '<span style="color:#EF4444;font-size:0.85rem;">Please paste some text.</span>';
            return;
          }
        }

        ingestBtn.disabled = true;
        ingestBtn.textContent = 'Converting to Markdown...';
        statusArea.innerHTML = '<span style="color:#6B7280;font-size:0.85rem;">Converting to Markdown...</span>';

        try {
          // Brief delay to show the first progress message
          await new Promise((r) => setTimeout(r, 400));
          ingestBtn.textContent = 'AI is distilling content...';
          statusArea.innerHTML = '<span style="color:#6B7280;font-size:0.85rem;">AI is distilling content...</span>';

          const result = selectedFile
            ? await ingestFile(selectedFile, selectedCategory)
            : await ingestData(ingestSourceMode as 'url' | 'text', contentValue, selectedCategory);
          ingestResult = result;
          rawCollapsed = true;
          statusArea.innerHTML = '<span style="color:#10B981;font-size:0.85rem;font-weight:500;">Done! Review the results below.</span>';
          draw(); // re-draw to show result preview
        } catch (err) {
          statusArea.innerHTML = `<span style="color:#EF4444;font-size:0.85rem;">${escapeHtml(err instanceof Error ? err.message : 'Ingestion failed.')}</span>`;
        } finally {
          ingestBtn.disabled = false;
          ingestBtn.innerHTML = `${ICONS.upload} Ingest`;
        }
      });

      /* ---- Result preview section ---- */
      if (!ingestResult) return;

      const resultSection = el('div');
      resultSection.style.cssText =
        'background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:24px;margin-bottom:16px;';

      const resultHeading = el('h3');
      resultHeading.textContent = 'Ingestion Results';
      resultHeading.style.cssText = 'font-size:0.95rem;font-weight:700;color:#1F2937;margin:0 0 16px;';
      resultSection.appendChild(resultHeading);

      /* -- Collapsible raw markdown -- */
      const rawToggle = document.createElement('button');
      rawToggle.style.cssText =
        'display:flex;align-items:center;gap:6px;background:none;border:none;padding:6px 0;font-size:0.8rem;font-weight:600;color:#6B7280;cursor:pointer;margin-bottom:8px;';
      function updateRawToggle(): void {
        rawToggle.innerHTML = `${rawCollapsed ? ICONS.chevronRight : ICONS.chevronDown} Raw Markdown (${ingestResult!.rawMarkdown.length.toLocaleString()} chars)`;
      }
      updateRawToggle();
      rawToggle.addEventListener('click', () => {
        rawCollapsed = !rawCollapsed;
        updateRawToggle();
        rawContent.style.display = rawCollapsed ? 'none' : 'block';
      });
      resultSection.appendChild(rawToggle);

      const rawContent = el('div');
      rawContent.style.display = rawCollapsed ? 'none' : 'block';
      const rawPre = document.createElement('pre');
      rawPre.style.cssText =
        'background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:12px;font-size:0.75rem;font-family:monospace;max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:0 0 16px;';
      rawPre.textContent = ingestResult.rawMarkdown;
      rawContent.appendChild(rawPre);
      resultSection.appendChild(rawContent);

      /* -- Distilled markdown (editable) -- */
      const distilledLabel = el('label');
      distilledLabel.textContent = 'Distilled Markdown (editable)';
      distilledLabel.style.cssText = 'display:block;font-size:0.8rem;font-weight:600;color:#374151;margin-bottom:6px;';
      resultSection.appendChild(distilledLabel);

      const distilledArea = document.createElement('textarea');
      distilledArea.value = ingestResult.distilledMarkdown;
      distilledArea.rows = 12;
      distilledArea.style.cssText =
        'width:100%;padding:10px 14px;border:1px solid #E5E7EB;border-radius:8px;font-size:0.8rem;font-family:monospace;resize:vertical;outline:none;box-sizing:border-box;margin-bottom:20px;';
      resultSection.appendChild(distilledArea);

      /* -- Editable metadata fields -- */
      const metaGrid = el('div');
      metaGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;';

      const metaFields: Array<{ id: string; label: string; value: string; fullWidth?: boolean }> = [
        { id: 'ingest-filename', label: 'Filename', value: ingestResult.suggestedFilename },
        { id: 'ingest-title', label: 'Title', value: ingestResult.title },
        { id: 'ingest-summary', label: 'Summary', value: ingestResult.summary, fullWidth: true },
      ];

      for (const f of metaFields) {
        const wrapper = el('div');
        if (f.fullWidth) wrapper.style.gridColumn = '1 / -1';

        const lbl = el('label');
        lbl.textContent = f.label;
        lbl.style.cssText = 'display:block;font-size:0.8rem;font-weight:500;color:#374151;margin-bottom:4px;';

        const inp = document.createElement('input');
        inp.id = f.id;
        inp.value = f.value;
        inp.style.cssText =
          'width:100%;padding:8px 12px;border:1px solid #E5E7EB;border-radius:6px;font-size:0.85rem;outline:none;box-sizing:border-box;';

        wrapper.append(lbl, inp);
        metaGrid.appendChild(wrapper);
      }
      resultSection.appendChild(metaGrid);

      /* -- Action buttons -- */
      const actionRow = el('div');
      actionRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

      const discardBtn = document.createElement('button');
      discardBtn.innerHTML = `${ICONS.discard} Discard`;
      discardBtn.style.cssText =
        'display:flex;align-items:center;gap:6px;padding:8px 20px;background:none;color:#6B7280;border:1px solid #E5E7EB;border-radius:8px;font-size:0.85rem;font-weight:500;cursor:pointer;transition:background 0.15s;';
      discardBtn.addEventListener('mouseenter', () => (discardBtn.style.background = '#F3F4F6'));
      discardBtn.addEventListener('mouseleave', () => (discardBtn.style.background = 'none'));

      const saveBtn = document.createElement('button');
      saveBtn.innerHTML = `${ICONS.save} Save to Knowledge Base`;
      saveBtn.style.cssText =
        'display:flex;align-items:center;gap:6px;padding:8px 20px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;transition:background 0.15s;';
      saveBtn.addEventListener('mouseenter', () => (saveBtn.style.background = '#059669'));
      saveBtn.addEventListener('mouseleave', () => (saveBtn.style.background = '#10B981'));

      actionRow.append(discardBtn, saveBtn);
      resultSection.appendChild(actionRow);

      /* -- Save status area -- */
      const saveStatus = el('div');
      saveStatus.style.cssText = 'margin-top:12px;min-height:20px;';
      resultSection.appendChild(saveStatus);

      content.appendChild(resultSection);

      /* -- Button handlers -- */
      discardBtn.addEventListener('click', () => {
        ingestResult = null;
        draw();
      });

      saveBtn.addEventListener('click', async () => {
        const filename = (resultSection.querySelector('#ingest-filename') as HTMLInputElement).value.trim();
        const title = (resultSection.querySelector('#ingest-title') as HTMLInputElement).value.trim();
        const summary = (resultSection.querySelector('#ingest-summary') as HTMLInputElement).value.trim();
        const mdContent = distilledArea.value;

        if (!filename) {
          saveStatus.innerHTML = '<span style="color:#EF4444;font-size:0.85rem;">Filename is required.</span>';
          return;
        }
        if (!filename.endsWith('.md')) {
          saveStatus.innerHTML = '<span style="color:#EF4444;font-size:0.85rem;">Filename must end with .md</span>';
          return;
        }
        if (!mdContent.trim()) {
          saveStatus.innerHTML = '<span style="color:#EF4444;font-size:0.85rem;">Content cannot be empty.</span>';
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          const result = await saveIngested(selectedCategory, filename, title, summary, mdContent);
          showToast(`Saved to ${result.path}`, 'success');
          ingestResult = null;
          await refreshSidebar();
          openFile(selectedCategory, filename);
        } catch (err) {
          saveStatus.innerHTML = `<span style="color:#EF4444;font-size:0.85rem;">${escapeHtml(err instanceof Error ? err.message : 'Save failed.')}</span>`;
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${ICONS.save} Save to Knowledge Base`;
        }
      });
    }

    draw();
  }

  /* ================================================================ */
  /*  CACHE TAB                                                        */
  /* ================================================================ */

  async function renderCacheTab(): Promise<void> {
    content.innerHTML =
      '<div style="text-align:center;padding:40px;color:#9CA3AF">Loading cache entries...</div>';

    try {
      const entries = await getCacheEntries();
      content.innerHTML = '';

      if (entries.length === 0) {
        content.innerHTML =
          '<div style="text-align:center;padding:40px;color:#9CA3AF">No FAQ cache entries found.</div>';
        return;
      }

      // Regenerate button
      const topBar = el('div');
      topBar.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
      const countLabel = el('span');
      countLabel.style.cssText = 'font-size:0.875rem;color:#6B7280;';
      const staleCount = entries.filter((e) => e.stale).length;
      countLabel.textContent = `${entries.length} entries (${staleCount} stale)`;

      const regenBtn = document.createElement('button');
      regenBtn.innerHTML = `${ICONS.refresh} Mark All Stale`;
      regenBtn.style.cssText =
        'display:flex;align-items:center;gap:6px;padding:6px 14px;background:#F59E0B;color:#fff;border:none;border-radius:6px;font-size:0.8rem;font-weight:500;cursor:pointer;transition:background 0.15s;';
      regenBtn.addEventListener('mouseenter', () => (regenBtn.style.background = '#D97706'));
      regenBtn.addEventListener('mouseleave', () => (regenBtn.style.background = '#F59E0B'));

      regenBtn.addEventListener('click', async () => {
        regenBtn.disabled = true;
        try {
          const result = await regenerateCache();
          showToast(`Marked ${result.staleCount} entries as stale.`, 'success');
          renderCacheTab();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'Regeneration failed.',
            'error',
          );
        } finally {
          regenBtn.disabled = false;
        }
      });

      topBar.append(countLabel, regenBtn);
      content.appendChild(topBar);

      // FAQ list
      const list = el('div', 'faq-list');

      for (const entry of entries) {
        const item = el('div', 'faq-item');

        const itemContent = el('div', 'faq-item__content');
        const question = el('p', 'faq-item__question');
        question.textContent = entry.question;

        const preview = el('p', 'faq-item__preview');
        preview.textContent = `Topic: ${entry.topic}`;

        itemContent.append(question, preview);

        const meta = el('div', 'faq-item__meta');
        const badge = el('span');
        badge.className = `status-badge ${entry.stale ? 'status-badge--stale' : 'status-badge--active'}`;
        badge.textContent = entry.stale ? 'Stale' : 'Active';

        const date = el('span', 'faq-item__date');
        try {
          date.textContent = new Date(entry.generatedAt).toLocaleDateString();
        } catch {
          date.textContent = entry.generatedAt;
        }

        meta.append(badge, date);
        item.append(itemContent, meta);
        list.appendChild(item);
      }

      content.appendChild(list);
    } catch (err) {
      content.innerHTML = `<div style="text-align:center;padding:40px;color:#EF4444">${escapeHtml(err instanceof Error ? err.message : 'Failed to load cache.')}</div>`;
    }
  }

  /* ================================================================ */
  /*  TOKENS TAB                                                       */
  /* ================================================================ */

  async function renderTokensTab(): Promise<void> {
    content.innerHTML =
      '<div style="text-align:center;padding:40px;color:#9CA3AF">Loading token data...</div>';

    try {
      const budget = await getTokenBudget();
      content.innerHTML = '';

      // Progress bar
      const budgetSection = el('div', 'token-budget');
      const pct = Math.min((budget.total / TOKEN_LIMIT) * 100, 100);
      const zone =
        budget.total < 25000 ? 'green' : budget.total < 35000 ? 'yellow' : 'red';

      budgetSection.innerHTML = `
        <div class="token-budget__header">
          <span class="token-budget__label">Total Token Usage</span>
          <span class="token-budget__value">${budget.total.toLocaleString()} / ${TOKEN_LIMIT.toLocaleString()} tokens</span>
        </div>
        <div class="token-budget__bar">
          <div class="token-budget__fill token-budget__fill--${zone}" style="width:${pct}%"></div>
        </div>
        <div class="token-budget__zones">
          <span>0</span>
          <span>25k (green)</span>
          <span>35k (yellow)</span>
          <span>${TOKEN_LIMIT.toLocaleString()}</span>
        </div>
      `;
      content.appendChild(budgetSection);

      // Per-file table
      if (budget.files.length > 0) {
        const table = document.createElement('table');
        table.style.cssText =
          'width:100%;border-collapse:collapse;font-size:0.8rem;margin-top:24px;';

        table.innerHTML = `
          <thead>
            <tr style="border-bottom:2px solid #E5E7EB;text-align:left">
              <th style="padding:8px 12px;color:#6B7280;font-weight:600">File</th>
              <th style="padding:8px 12px;color:#6B7280;font-weight:600;text-align:right">Tokens</th>
              <th style="padding:8px 12px;color:#6B7280;font-weight:600;width:40%">Share</th>
            </tr>
          </thead>
        `;

        const tbody = document.createElement('tbody');

        const sorted = [...budget.files].sort((a, b) => b.tokens - a.tokens);
        for (const f of sorted) {
          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid #F3F4F6';

          const sharePct = budget.total > 0 ? (f.tokens / budget.total) * 100 : 0;
          const shareZone =
            sharePct > 40 ? '#EF4444' : sharePct > 25 ? '#F59E0B' : '#10B981';

          tr.innerHTML = `
            <td style="padding:8px 12px;font-family:monospace;color:#1F2937">${escapeHtml(f.path)}</td>
            <td style="padding:8px 12px;text-align:right;color:#6B7280;font-weight:500">${f.tokens.toLocaleString()}</td>
            <td style="padding:8px 12px">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden">
                  <div style="width:${sharePct}%;height:100%;background:${shareZone};border-radius:3px"></div>
                </div>
                <span style="font-size:0.7rem;color:#9CA3AF;min-width:36px;text-align:right">${sharePct.toFixed(1)}%</span>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        content.appendChild(table);
      }
    } catch (err) {
      content.innerHTML = `<div style="text-align:center;padding:40px;color:#EF4444">${escapeHtml(err instanceof Error ? err.message : 'Failed to load token data.')}</div>`;
    }
  }

  /* ================================================================ */
  /*  SIDEBAR FILE BROWSER                                             */
  /* ================================================================ */

  async function refreshSidebar(): Promise<void> {
    try {
      allFiles = await listFiles();
    } catch {
      allFiles = [];
    }
    renderSidebar();
    updateTokenBadge();
  }

  function renderSidebar(): void {
    fileList.innerHTML = '';

    const grouped: Record<string, FileEntry[]> = {};
    for (const cat of CATEGORIES) {
      grouped[cat] = [];
    }

    for (const f of allFiles) {
      const cat = categoryOf(f.path);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(f);
    }

    for (const cat of CATEGORIES) {
      const files = grouped[cat];
      const section = el('div', 'file-category');

      const label = el('div', 'file-category__label');
      label.innerHTML = `${CATEGORY_LABELS[cat] ?? cat}
        <button data-cat="${cat}" class="sidebar-new-btn" title="New file in ${cat}"
          style="float:right;background:none;border:none;color:#6B7280;cursor:pointer;padding:0 4px;font-size:12px;transition:color 0.12s;">${ICONS.plus}</button>`;
      section.appendChild(label);

      for (const f of files) {
        const fname = filenameOf(f.path);
        const btn = document.createElement('button');
        btn.className = 'file-item';
        btn.dataset.path = f.path;
        btn.innerHTML = `
          <span class="file-item__icon">${ICONS.file}</span>
          <span class="file-item__name" title="${escapeHtml(fname)}">${escapeHtml(fname)}</span>
          <span class="file-item__badge">${f.tokens}</span>
        `;
        btn.addEventListener('click', () => openFile(cat, fname));
        section.appendChild(btn);
      }

      fileList.appendChild(section);
    }

    // Wire up "new file" buttons
    fileList.querySelectorAll('.sidebar-new-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = (btn as HTMLElement).dataset.cat;
        if (cat) showNewFileDialog(cat);
      });
    });

    // Also wire up the footer button
    newFileBtn.onclick = () => {
      // Default to first category or prompt
      showNewFileDialog('basics');
    };
  }

  function clearActiveFileItem(): void {
    fileList.querySelectorAll('.file-item--active').forEach((el) => {
      el.classList.remove('file-item--active');
    });
  }

  async function openFile(category: string, file: string): Promise<void> {
    clearActiveFileItem();

    const item = fileList.querySelector(`[data-path="${category}/${file}"]`);
    if (item) item.classList.add('file-item--active');

    // Close sidebar on mobile
    sidebar.classList.remove('admin-sidebar--open');

    activeFile = { category, file };
    switchTab('files');
  }

  /* ---- New file dialog ---- */

  function showNewFileDialog(category: string): void {
    // Simple modal
    const backdrop = el('div');
    backdrop.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:200;display:flex;align-items:center;justify-content:center;';

    const modal = el('div');
    modal.style.cssText =
      'background:#fff;border-radius:12px;padding:28px;width:100%;max-width:440px;box-shadow:0 8px 32px rgba(0,0,0,0.15);';

    modal.innerHTML = `
      <h2 style="font-size:1rem;font-weight:700;color:#1F2937;margin:0 0 20px">New File in ${CATEGORY_LABELS[category] ?? category}</h2>
    `;

    const form = document.createElement('form');
    form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    const fields: Array<{ id: string; label: string; placeholder: string }> = [
      { id: 'nf-filename', label: 'Filename', placeholder: 'my-topic.md' },
      { id: 'nf-title', label: 'Title', placeholder: 'My Topic Title' },
      { id: 'nf-summary', label: 'Summary', placeholder: 'Short description' },
    ];

    for (const f of fields) {
      const wrapper = el('div');
      const lbl = el('label');
      lbl.textContent = f.label;
      lbl.style.cssText = 'display:block;font-size:0.8rem;font-weight:500;color:#374151;margin-bottom:4px;';
      (lbl as HTMLLabelElement).htmlFor = f.id;

      const inp = document.createElement('input');
      inp.id = f.id;
      inp.placeholder = f.placeholder;
      inp.style.cssText =
        'width:100%;padding:8px 12px;border:1px solid #E5E7EB;border-radius:6px;font-size:0.85rem;outline:none;box-sizing:border-box;';

      wrapper.append(lbl, inp);
      form.appendChild(wrapper);
    }

    // Content textarea
    const contentWrapper = el('div');
    const contentLabel = el('label');
    contentLabel.textContent = 'Content (Markdown)';
    contentLabel.style.cssText = 'display:block;font-size:0.8rem;font-weight:500;color:#374151;margin-bottom:4px;';

    const contentArea = document.createElement('textarea');
    contentArea.placeholder = '# My Topic\n\nWrite your content here...';
    contentArea.rows = 8;
    contentArea.style.cssText =
      'width:100%;padding:8px 12px;border:1px solid #E5E7EB;border-radius:6px;font-size:0.85rem;font-family:monospace;resize:vertical;outline:none;box-sizing:border-box;';

    contentWrapper.append(contentLabel, contentArea);
    form.appendChild(contentWrapper);

    // Error line
    const errLine = el('div');
    errLine.style.cssText = 'color:#EF4444;font-size:0.8rem;min-height:18px;';
    form.appendChild(errLine);

    // Buttons
    const btnRow = el('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:4px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText =
      'padding:8px 16px;background:none;border:1px solid #E5E7EB;border-radius:6px;font-size:0.85rem;cursor:pointer;';

    const createBtn = document.createElement('button');
    createBtn.type = 'submit';
    createBtn.textContent = 'Create File';
    createBtn.style.cssText =
      'padding:8px 16px;background:#F59E0B;color:#fff;border:none;border-radius:6px;font-size:0.85rem;font-weight:600;cursor:pointer;';

    btnRow.append(cancelBtn, createBtn);
    form.appendChild(btnRow);
    modal.appendChild(form);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    cancelBtn.addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errLine.textContent = '';

      const filename = (form.querySelector('#nf-filename') as HTMLInputElement).value.trim();
      const title = (form.querySelector('#nf-title') as HTMLInputElement).value.trim();
      const summary = (form.querySelector('#nf-summary') as HTMLInputElement).value.trim();
      const content = contentArea.value;

      if (!filename) {
        errLine.textContent = 'Filename is required.';
        return;
      }
      if (!filename.endsWith('.md')) {
        errLine.textContent = 'Filename must end with .md';
        return;
      }
      if (!content.trim()) {
        errLine.textContent = 'Content is required.';
        return;
      }

      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';

      try {
        await createFile(category, filename, title, summary, content);
        showToast(`Created ${category}/${filename}`, 'success');
        backdrop.remove();
        await refreshSidebar();
        openFile(category, filename);
      } catch (err) {
        errLine.textContent = err instanceof Error ? err.message : 'Creation failed.';
        createBtn.disabled = false;
        createBtn.textContent = 'Create File';
      }
    });

    (form.querySelector('#nf-filename') as HTMLInputElement).focus();
  }

  /* ---- Token badge in header ---- */

  async function updateTokenBadge(): Promise<void> {
    const badge = header.querySelector('#token-badge') as HTMLElement;
    try {
      const budget = await getTokenBudget();
      const pct = Math.round((budget.total / TOKEN_LIMIT) * 100);
      const zone = budget.total < 25000 ? '#10B981' : budget.total < 35000 ? '#F59E0B' : '#EF4444';
      badge.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${zone};margin-right:4px"></span>${budget.total.toLocaleString()} tokens (${pct}%)`;
    } catch {
      badge.textContent = '';
    }
  }

  /* ---- Boot ---- */
  switchTab('files');
  await refreshSidebar();
}

/* ------------------------------------------------------------------ */
/*  Public mount function                                              */
/* ------------------------------------------------------------------ */

/**
 * Mount the admin dashboard into the given container.
 */
export function mountAdmin(container: HTMLElement): void {
  if (isAuthenticated()) {
    renderDashboard(container);
  } else {
    renderLogin(container, () => renderDashboard(container));
  }
}
