/**
 * Solar PV Q&A — Chat UI Module
 *
 * Renders a complete chat interface into a given container element.
 */

import { streamChat } from './streaming.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SUGGESTIONS = [
  'How does solar work?',
  'Jinko Tiger Neo 3 specs',
  'Malaysia solar scheme',
  'Why choose us?',
];

const WELCOME_TEXT = 'Hi! Ask me anything about solar PV in Malaysia.';

const SUN_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="12" cy="12" r="5" fill="currentColor"/>
  <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </g>
</svg>`;

const SEND_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const RETRY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M1 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const GOOD_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M7 10v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3Zm0 10h9.2a2 2 0 0 0 1.9-1.37l2.67-8A2 2 0 0 0 18.87 8H14l.74-3.7A2.75 2.75 0 0 0 12.04 1L7 10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
</svg>`;

const BAD_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M7 14V4H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3Zm0-10h9.2a2 2 0 0 1 1.9 1.37l2.67 8A2 2 0 0 1 18.87 16H14l.74 3.7A2.75 2.75 0 0 1 12.04 23L7 14Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
</svg>`;

const SUN_LINE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/>
  <g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <line x1="12" y1="2" x2="12" y2="4"/>
    <line x1="12" y1="20" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/>
    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="4" y2="12"/>
    <line x1="20" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/>
    <line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>
  </g>
</svg>`;

const MOON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SEARCH_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/>
  <path d="m20 20-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Create an element with optional class(es) and innerHTML. */
function el(
  tag: string,
  className?: string,
  innerHTML?: string,
): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (innerHTML !== undefined) node.innerHTML = innerHTML;
  return node;
}

/** Format current time as HH:MM. */
function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Scroll a container to its bottom smoothly. */
function scrollToBottom(container: HTMLElement): void {
  requestAnimationFrame(() => {
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  });
}

/** Start long proposal-style answers at their headline on mobile. */
function scrollToMessageStart(
  container: HTMLElement,
  message: HTMLElement,
): void {
  requestAnimationFrame(() => {
    container.scrollTo({
      top: Math.max(0, message.offsetTop - container.offsetTop - 10),
      behavior: 'smooth',
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Theme controller                                                   */
/* ------------------------------------------------------------------ */

type Theme = 'light' | 'dark';

function getTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* storage unavailable — runtime toggle still works */
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
    ?? document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#070a12' : '#f6f8fb';
}

/** Build the header theme-toggle button; keeps its icon/label in sync. */
function createThemeToggle(): HTMLButtonElement {
  const btn = el('button', 'chat-theme-toggle') as HTMLButtonElement;
  btn.type = 'button';

  function sync(): void {
    const theme = getTheme();
    const goingTo = theme === 'dark' ? 'light' : 'dark';
    btn.innerHTML = theme === 'dark' ? SUN_LINE_SVG : MOON_SVG;
    btn.setAttribute('aria-label', `Switch to ${goingTo} mode`);
    btn.setAttribute('title', `Switch to ${goingTo} mode`);
  }

  btn.addEventListener('click', () => {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    sync();
  });

  // Follow OS changes only while the user hasn't set an explicit preference.
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', (e) => {
      if (localStorage.getItem('theme')) return;
      applyTheme(e.matches ? 'dark' : 'light');
      sync();
    });
  } catch {
    /* matchMedia unavailable */
  }

  sync();
  return btn;
}

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */

function createTypingIndicator(): HTMLElement {
  const indicator = el('div', 'typing-indicator');
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-label', 'Assistant is typing');
  indicator.innerHTML = '<span></span><span></span><span></span>';
  return indicator;
}

/* ------------------------------------------------------------------ */
/*  Message rendering                                                  */
/* ------------------------------------------------------------------ */

function appendUserMessage(list: HTMLElement, text: string): void {
  const bubble = el('div', 'message-user');
  bubble.textContent = text;

  const meta = el('div', 'message-meta');
  meta.textContent = timeNow();

  bubble.appendChild(meta);
  list.appendChild(bubble);
  scrollToBottom(list);
}

function createAssistantBubble(): HTMLElement {
  const bubble = el('div', 'message-assistant');
  bubble.setAttribute('aria-live', 'polite');
  return bubble;
}

function appendAssistantMeta(bubble: HTMLElement): void {
  const meta = el('div', 'message-meta');
  meta.textContent = timeNow();
  bubble.appendChild(meta);
}

type FeedbackRating = 'good' | 'bad' | null;

function createResponseId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `response_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function appendFeedbackControls(
  bubble: HTMLElement,
  responseId: string,
  question: string,
  answerHtml: string,
  invoiceUid: string | null,
  messageList: HTMLElement,
): void {
  const feedback = el('div', 'response-feedback');
  feedback.setAttribute('aria-label', 'Rate this AI response');

  const prompt = el('span', 'response-feedback__prompt');
  prompt.textContent = 'Rate this response';

  const goodButton = el(
    'button',
    'response-feedback__rating',
    `${GOOD_SVG}<span>Good</span>`,
  ) as HTMLButtonElement;
  goodButton.type = 'button';
  goodButton.setAttribute('aria-pressed', 'false');

  const badButton = el(
    'button',
    'response-feedback__rating',
    `${BAD_SVG}<span>Bad</span>`,
  ) as HTMLButtonElement;
  badButton.type = 'button';
  badButton.setAttribute('aria-pressed', 'false');

  const commentToggle = el(
    'button',
    'response-feedback__comment-toggle',
    'Add comment',
  ) as HTMLButtonElement;
  commentToggle.type = 'button';
  commentToggle.setAttribute('aria-expanded', 'false');

  const form = el('form', 'response-feedback__form') as HTMLFormElement;
  form.hidden = true;

  const textarea = document.createElement('textarea');
  textarea.className = 'response-feedback__textarea';
  textarea.placeholder = 'What was helpful or what should be improved?';
  textarea.maxLength = 5000;
  textarea.rows = 3;
  textarea.setAttribute('aria-label', 'Comment about this AI response');

  const formActions = el('div', 'response-feedback__form-actions');
  const status = el('span', 'response-feedback__status');
  status.setAttribute('role', 'status');

  const saveButton = el(
    'button',
    'response-feedback__save',
    'Save comment',
  ) as HTMLButtonElement;
  saveButton.type = 'submit';

  formActions.append(status, saveButton);
  form.append(textarea, formActions);
  feedback.append(prompt, goodButton, badButton, commentToggle, form);
  bubble.appendChild(feedback);

  let rating: FeedbackRating = null;
  let saveQueue: Promise<void> = Promise.resolve();

  function updateRatingButtons(): void {
    goodButton.classList.toggle('is-selected', rating === 'good');
    badButton.classList.toggle('is-selected', rating === 'bad');
    goodButton.setAttribute('aria-pressed', String(rating === 'good'));
    badButton.setAttribute('aria-pressed', String(rating === 'bad'));
  }

  function setCommentOpen(open: boolean): void {
    form.hidden = !open;
    commentToggle.setAttribute('aria-expanded', String(open));
    commentToggle.textContent = open ? 'Hide comment' : 'Add comment';
    if (open) {
      textarea.focus();
      scrollToBottom(messageList);
    }
  }

  function save(): Promise<void> {
    const payload = {
      responseId,
      question,
      answerHtml,
      invoiceUid,
      rating,
      comment: textarea.value.trim(),
    };

    status.textContent = 'Saving…';
    feedback.classList.add('is-saving');

    saveQueue = saveQueue
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data.error === 'string' ? data.error : 'Could not save feedback.',
          );
        }
        status.textContent = 'Saved';
      })
      .catch((err: unknown) => {
        status.textContent =
          err instanceof Error ? err.message : 'Could not save feedback.';
      })
      .finally(() => {
        feedback.classList.remove('is-saving');
      });

    return saveQueue;
  }

  goodButton.addEventListener('click', () => {
    rating = 'good';
    updateRatingButtons();
    void save();
  });

  badButton.addEventListener('click', () => {
    rating = 'bad';
    updateRatingButtons();
    setCommentOpen(true);
    void save();
  });

  commentToggle.addEventListener('click', () => {
    setCommentOpen(form.hidden);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (rating === null && textarea.value.trim().length === 0) {
      status.textContent = 'Add a rating or comment first.';
      return;
    }
    void save();
  });
}

/* ------------------------------------------------------------------ */
/*  Error rendering                                                    */
/* ------------------------------------------------------------------ */

function appendErrorMessage(
  list: HTMLElement,
  errorMsg: string,
  onRetry: () => void,
): void {
  const wrapper = el('div', 'error-message');
  wrapper.innerHTML = `<strong>Something went wrong</strong>${escapeText(errorMsg)}`;

  const retryBtn = document.createElement('button');
  retryBtn.className = 'error-retry-btn';
  retryBtn.innerHTML = `${RETRY_SVG} Try again`;
  retryBtn.addEventListener('click', () => {
    wrapper.remove();
    onRetry();
  });
  wrapper.appendChild(retryBtn);

  list.appendChild(wrapper);
  scrollToBottom(list);
}

/** Minimal text escaping for error messages inserted via textContent-style usage. */
function escapeText(s: string): string {
  const span = document.createElement('span');
  span.textContent = s;
  return span.innerHTML;
}

/* ------------------------------------------------------------------ */
/*  Welcome screen                                                     */
/* ------------------------------------------------------------------ */

function renderWelcome(list: HTMLElement, onSuggestion: (q: string) => void): void {
  const wrapper = el('div', 'chat-welcome');

  const icon = el('div', 'chat-welcome__icon', SUN_SVG);
  const heading = el('h2', 'chat-welcome__title', 'Solar PV Q&A');
  const sub = el('p', 'chat-welcome__subtitle', WELCOME_TEXT);

  wrapper.append(icon, heading, sub);

  // Suggestion chips
  const chips = el('div', 'chat-welcome__chips');
  for (const text of SUGGESTIONS) {
    const chip = document.createElement('button');
    chip.className = 'chat-chip';
    chip.textContent = text;
    chip.addEventListener('click', () => onSuggestion(text));
    chips.appendChild(chip);
  }
  wrapper.appendChild(chips);

  list.appendChild(wrapper);
}

/* ------------------------------------------------------------------ */
/*  Main mount function                                                */
/* ------------------------------------------------------------------ */

/**
 * Mount the Solar PV Q&A chat interface into the given container.
 */
export function mountChat(container: HTMLElement): void {
  let invoiceUid =
    new URLSearchParams(window.location.search).get('invoice_uid')?.trim() || null;

  /* ---- Root layout ---- */
  const root = el('div', 'chat-container');

  /* ---- Header ---- */
  const header = el('header', 'chat-header');

  const brand = el('div', 'chat-header__brand');
  brand.innerHTML = `
    <span class="chat-header__mark">${SUN_SVG}</span>
    <span class="chat-header__title">Solar PV Q&amp;A</span>
  `;

  const actions = el('div', 'chat-header__actions');
  const badge = el(
    'span',
    'chat-header__badge',
    invoiceUid ? 'Invoice Package Connected' : 'AI Assistant',
  );
  if (invoiceUid) badge.classList.add('is-connected');

  const invoiceSearchToggle = el(
    'button',
    'chat-invoice-search-toggle',
    `${SEARCH_SVG}<span>Invoice</span>`,
  ) as HTMLButtonElement;
  invoiceSearchToggle.type = 'button';
  invoiceSearchToggle.setAttribute('aria-label', 'Search and apply an invoice');
  invoiceSearchToggle.setAttribute('aria-expanded', 'false');

  const themeToggle = createThemeToggle();

  actions.append(badge, invoiceSearchToggle, themeToggle);
  header.append(brand, actions);

  /* ---- Invoice search panel ---- */
  const invoicePanel = el('section', 'chat-invoice-panel');
  invoicePanel.hidden = true;
  invoicePanel.setAttribute('aria-label', 'Invoice search');

  const invoiceSearchForm = el('form', 'chat-invoice-form') as HTMLFormElement;
  const invoiceSearchInput = document.createElement('input');
  invoiceSearchInput.className = 'chat-invoice-input';
  invoiceSearchInput.type = 'search';
  invoiceSearchInput.placeholder = 'Customer name, invoice number, or UID';
  invoiceSearchInput.setAttribute(
    'aria-label',
    'Customer name, invoice number, or UID',
  );

  const invoiceSearchButton = el(
    'button',
    'chat-invoice-search-btn',
    'Search',
  ) as HTMLButtonElement;
  invoiceSearchButton.type = 'submit';

  const invoiceStatus = el('div', 'chat-invoice-status');
  invoiceStatus.setAttribute('role', 'status');
  const invoiceResults = el('div', 'chat-invoice-results');

  invoiceSearchForm.append(invoiceSearchInput, invoiceSearchButton);
  invoicePanel.append(invoiceSearchForm, invoiceStatus, invoiceResults);

  /* ---- Messages ---- */
  const messages = el('main', 'chat-messages');
  messages.setAttribute('role', 'log');
  messages.setAttribute('aria-label', 'Chat messages');
  messages.setAttribute('aria-live', 'polite');

  /* ---- Input area ---- */
  const inputArea = el('footer', 'chat-input-area');

  const inputBar = el('div', 'chat-input-bar');

  const textarea = document.createElement('textarea');
  textarea.className = 'chat-input';
  textarea.placeholder = 'Ask about solar PV…';
  textarea.setAttribute('rows', '1');
  textarea.setAttribute('aria-label', 'Type your message');

  const sendBtn = el('button', 'chat-send-btn', SEND_SVG) as HTMLButtonElement;
  sendBtn.setAttribute('aria-label', 'Send message');
  sendBtn.type = 'button';

  inputBar.append(textarea, sendBtn);
  inputArea.append(inputBar);
  root.append(header, invoicePanel, messages, inputArea);
  container.appendChild(root);

  /* ---- State ---- */
  let isStreaming = false;

  function syncInvoiceBadge(): void {
    badge.textContent = invoiceUid ? 'Invoice Connected' : 'AI Assistant';
    badge.classList.toggle('is-connected', Boolean(invoiceUid));
  }

  function setInvoicePanelOpen(open: boolean): void {
    invoicePanel.hidden = !open;
    invoiceSearchToggle.setAttribute('aria-expanded', String(open));
    invoiceSearchToggle.classList.toggle('is-active', open);
    if (open) invoiceSearchInput.focus();
  }

  invoiceSearchToggle.addEventListener('click', () => {
    setInvoicePanelOpen(invoicePanel.hidden);
  });

  invoiceSearchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = invoiceSearchInput.value.trim();
    invoiceResults.replaceChildren();

    if (query.length < 2) {
      invoiceStatus.textContent = 'Enter at least 2 characters.';
      invoiceStatus.classList.add('is-error');
      return;
    }

    invoiceStatus.classList.remove('is-error');
    invoiceStatus.textContent = 'Searching invoices…';
    invoiceSearchButton.disabled = true;

    try {
      const response = await fetch(
        `/api/invoices/search?q=${encodeURIComponent(query)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Invoice search failed.',
        );
      }

      const results = Array.isArray(data.results) ? data.results : [];
      invoiceStatus.textContent =
        results.length === 0
          ? 'No matching invoice found.'
          : `${results.length} invoice${results.length === 1 ? '' : 's'} found.`;

      for (const result of results) {
        if (
          typeof result.invoiceUid !== 'string' ||
          typeof result.invoiceNumber !== 'string'
        ) {
          continue;
        }

        const card = el('article', 'chat-invoice-result');
        const details = el('div', 'chat-invoice-result__details');
        const customer = el('div', 'chat-invoice-result__customer');
        customer.textContent =
          typeof result.customerName === 'string'
            ? result.customerName
            : 'Unknown customer';
        const meta = el('div', 'chat-invoice-result__meta');
        meta.textContent = `Invoice: ${result.invoiceNumber}`;
        const packageName = el('div', 'chat-invoice-result__package');
        packageName.textContent =
          typeof result.packageName === 'string'
            ? result.packageName
            : 'Customer solar package';
        details.append(customer, meta, packageName);

        const applyButton = el(
          'button',
          'chat-invoice-apply-btn',
          result.invoiceUid === invoiceUid ? 'Applied' : 'Apply',
        ) as HTMLButtonElement;
        applyButton.type = 'button';
        applyButton.disabled = result.invoiceUid === invoiceUid;
        applyButton.addEventListener('click', () => {
          invoiceUid = result.invoiceUid;
          const url = new URL(window.location.href);
          url.searchParams.set('invoice_uid', invoiceUid);
          window.history.replaceState({}, '', url);
          syncInvoiceBadge();
          setInvoicePanelOpen(false);

          const notice = el('div', 'chat-context-notice');
          notice.textContent = `${customer.textContent} · ${result.invoiceNumber} · ${packageName.textContent}`;
          messages.appendChild(notice);
          scrollToBottom(messages);
        });

        card.append(details, applyButton);
        invoiceResults.appendChild(card);
      }
    } catch (err) {
      invoiceStatus.classList.add('is-error');
      invoiceStatus.textContent =
        err instanceof Error ? err.message : 'Invoice search failed.';
    } finally {
      invoiceSearchButton.disabled = false;
    }
  });

  /* ---- Auto-resize textarea ---- */
  function autoResize(): void {
    textarea.style.height = 'auto';
    const max = 120;
    textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
  }

  textarea.addEventListener('input', autoResize);

  /* ---- Enable / disable send ---- */
  function setSending(busy: boolean): void {
    isStreaming = busy;
    sendBtn.disabled = busy;
    textarea.disabled = busy;
    if (!busy) {
      textarea.focus();
    }
  }

  /* ---- Core send logic ---- */
  function sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Remove welcome screen on first message
    const welcome = messages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    // Reset input
    textarea.value = '';
    textarea.style.height = 'auto';

    // Show user message
    appendUserMessage(messages, trimmed);

    // Show typing indicator
    const typing = createTypingIndicator();
    messages.appendChild(typing);
    scrollToBottom(messages);

    setSending(true);

    // Prepare assistant bubble (hidden until first chunk)
    const assistantBubble = createAssistantBubble();
    const responseId = createResponseId();
    let gotChunk = false;

    streamChat(
      trimmed,
      invoiceUid,
      // onChunk
      (chunk: string) => {
        if (!gotChunk) {
          // First chunk: swap typing indicator for real bubble
          typing.remove();
          messages.appendChild(assistantBubble);
          gotChunk = true;
        }
        // Append raw text during streaming (plain text, not HTML yet)
        assistantBubble.textContent = (assistantBubble.textContent ?? '') + chunk;
        scrollToBottom(messages);
      },
      // onDone
      (fullHtml: string) => {
        if (!gotChunk) {
          typing.remove();
          messages.appendChild(assistantBubble);
        }
        // Replace streaming text with sanitized HTML + timestamp
        assistantBubble.innerHTML = fullHtml;
        appendAssistantMeta(assistantBubble);
        appendFeedbackControls(
          assistantBubble,
          responseId,
          trimmed,
          fullHtml,
          invoiceUid,
          messages,
        );
        if (fullHtml.includes('class="ans-premium')) {
          scrollToMessageStart(messages, assistantBubble);
        } else {
          scrollToBottom(messages);
        }
        setSending(false);
      },
      // onError
      (err: string) => {
        typing.remove();
        if (gotChunk) {
          assistantBubble.remove();
        }
        appendErrorMessage(messages, err, () => sendMessage(trimmed));
        setSending(false);
      },
    );
  }

  /* ---- Event listeners ---- */
  sendBtn.addEventListener('click', () => sendMessage(textarea.value));

  textarea.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(textarea.value);
    }
  });

  /* ---- Suggestion chip handler ---- */
  function handleSuggestion(q: string): void {
    textarea.value = q;
    autoResize();
    sendMessage(q);
  }

  /* ---- Boot ---- */
  renderWelcome(messages, handleSuggestion);
  textarea.focus();
}
