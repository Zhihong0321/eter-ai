/**
 * Deterministic, server-side renderer for the "Premium Package Card".
 *
 * This replaces the live LLM call for package-explanation questions. The card
 * is built directly from the invoice's package description and pricing, so the
 * response is instant (no model latency) and always reflects the customer's
 * actual invoice — including package price and discount.
 *
 * Output uses ONLY the whitelisted `ans-premium` component classes so it
 * survives the front-end DOMPurify sanitiser unchanged.
 */

import type { InvoicePackageContext } from './context.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a RM amount: thousands separators, drop trailing ".00". */
function formatRm(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasCents = Math.abs(rounded % 1) > 0.005;
  const formatted = rounded.toLocaleString('en-MY', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `RM ${formatted}`;
}

/* ------------------------------------------------------------------ */
/*  Line-item parsing                                                 */
/* ------------------------------------------------------------------ */

interface LineItem {
  code: string;
  title: string;
  body: string;
}

/** Ordered keyword rules — first match wins. */
const ITEM_RULES: Array<{ test: RegExp; code: string; body: string }> = [
  { test: /design/i, code: 'DES', body: 'System architecture & electrical design' },
  { test: /survey/i, code: 'SRV', body: 'Roof and on-site surveying' },
  { test: /install/i, code: 'INS', body: 'Professional roof panel installation' },
  { test: /electrical\s*(work|job)|wiring/i, code: 'ELE', body: 'Full electrical works and wiring' },
  { test: /skylift|sky\s*lift|scaffold|\blift\b|access\s*equipment/i, code: 'LFT', body: 'Safe motorised rooftop access equipment' },
  { test: /seda|atap/i, code: 'APP', body: 'Government solar scheme application — handled for you' },
  { test: /tnb|smart\s*meter|net\s*meter|\bmeter\b/i, code: 'MTR', body: 'Bidirectional smart-meter application submitted on your behalf' },
  { test: /inverter|saj/i, code: 'INV', body: 'Converts DC solar power into usable AC electricity' },
  { test: /panel|jinko|tiger\s*neo|topcon|\bpv\b/i, code: 'PNL', body: 'N-type TOPCon solar panels for the core PV array' },
];

/**
 * Turn a free-text package description (newline-separated line items) into
 * structured cards. Defensive against stray "Discount"/"Payment" lines that
 * sometimes appear in raw invoice-item text.
 */
function parseLineItems(packageDescription: string): LineItem[] {
  return packageDescription
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^discount\b|^payment\s*\d|^total\b/i.test(line))
    .map((line) => {
      // Normalise a leading quantity like "11X" / "1x" into "11 ×".
      const title = line.replace(/^(\d+)\s*[xX]\s*/, '$1 × ');
      const rule = ITEM_RULES.find((r) => r.test.test(line));
      return {
        code: rule?.code ?? 'PKG',
        title,
        body: rule?.body ?? '',
      };
    });
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                           */
/* ------------------------------------------------------------------ */

interface PriceView {
  net: number;
  discountAmount: number;
  listPrice: number;
  discountPercent: number;
  voucherCodes: string[];
}

/**
 * Derive a display-ready price view. `total_amount` is the NET price the
 * customer pays (confirmed against invoice line items). The list/original
 * price is reconstructed by adding the discount back on.
 */
function buildPriceView(context: InvoicePackageContext): PriceView | null {
  if (context.priceNet === null || context.priceNet <= 0) return null;

  const net = context.priceNet;
  let discountAmount = 0;

  if (context.discountFixed > 0) {
    discountAmount = context.discountFixed;
  } else if (context.discountPercent > 0 && context.discountPercent < 100) {
    // Net is after the percentage was removed, so reconstruct the discount.
    discountAmount = Math.round((net * context.discountPercent) / (100 - context.discountPercent));
  }

  const voucherCodes = context.voucherCode
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);

  return {
    net,
    discountAmount,
    listPrice: net + discountAmount,
    discountPercent: context.discountPercent,
    voucherCodes,
  };
}

function renderPriceBlock(price: PriceView): string {
  const tags: string[] = [];

  if (price.discountAmount > 0) {
    tags.push(
      `<span class="ans-premium__price-tag ans-premium__price-tag--save">You save ${escapeHtml(formatRm(price.discountAmount))}</span>`,
    );
  }
  if (price.discountPercent > 0) {
    tags.push(
      `<span class="ans-premium__price-tag">${escapeHtml(String(price.discountPercent))}% off</span>`,
    );
  }
  for (const code of price.voucherCodes) {
    tags.push(
      `<span class="ans-premium__price-tag ans-premium__price-tag--voucher">${escapeHtml(code)}</span>`,
    );
  }

  const wasLine =
    price.discountAmount > 0
      ? `<span class="ans-premium__price-was">${escapeHtml(formatRm(price.listPrice))}</span>`
      : '';

  return [
    '<div class="ans-premium__price">',
    '<div class="ans-premium__price-main">',
    '<span class="ans-premium__price-label">Package Price</span>',
    `<span class="ans-premium__price-value">${escapeHtml(formatRm(price.net))}</span>`,
    wasLine,
    '</div>',
    tags.length ? `<div class="ans-premium__price-tags">${tags.join('')}</div>` : '',
    '</div>',
  ].join('');
}

/* ------------------------------------------------------------------ */
/*  Static blocks                                                     */
/* ------------------------------------------------------------------ */

function renderShowcase(): string {
  return [
    '<div class="ans-premium__showcase">',
    '<p class="ans-premium__showcase-title">Premium Equipment Included</p>',
    '<div class="ans-premium__logo-grid">',
    '<div class="ans-premium__logo-tile ans-premium__logo-tile--image">',
    '<img class="ans-premium__logo-img" src="/logo/jinko-logo.svg" alt="JinkoSolar" loading="lazy">',
    '<span class="ans-premium__logo-mark">TIGER NEO 3.0</span>',
    '<span class="ans-premium__logo-detail">N-type TOPCon panels</span>',
    '</div>',
    '<div class="ans-premium__logo-tile ans-premium__logo-tile--image">',
    '<img class="ans-premium__logo-img" src="/logo/saj-logo.jpg" alt="SAJ" loading="lazy">',
    '<span class="ans-premium__logo-mark">SAJ Inverter</span>',
    '<span class="ans-premium__logo-detail">String inverter</span>',
    '</div>',
    '<div class="ans-premium__logo-tile ans-premium__logo-tile--image">',
    '<img class="ans-premium__logo-img" src="/logo/seda-malaysia.png" alt="SEDA" loading="lazy">',
    '<span class="ans-premium__logo-mark">SEDA ATAP</span>',
    '<span class="ans-premium__logo-detail">Application included</span>',
    '</div>',
    '</div>',
    '</div>',
  ].join('');
}

function renderItems(items: LineItem[]): string {
  return items
    .map((item) =>
      [
        '<div class="ans-premium__card">',
        `<span class="ans-premium__mini-mark">${escapeHtml(item.code)}</span>`,
        '<div class="ans-premium__item-copy">',
        `<p class="ans-premium__card__title">${escapeHtml(item.title)}</p>`,
        item.body ? `<p class="ans-premium__card__body">${escapeHtml(item.body)}</p>` : '',
        '</div>',
        '</div>',
      ].join(''),
    )
    .join('');
}

const WARRANTY_METRICS = [
  { value: '30 yr', title: 'Panel Power', body: 'JinkoSolar linear guarantee' },
  { value: '10 yr', title: 'Inverter', body: 'SAJ product warranty' },
  { value: '3 yr', title: 'Workmanship', body: '+ 1-yr roof-leak cover' },
];

function renderMetrics(): string {
  const cells = WARRANTY_METRICS.map((m) =>
    [
      '<div class="ans-premium__metric">',
      `<span class="ans-premium__metric__value">${escapeHtml(m.value)}</span>`,
      `<p class="ans-premium__metric__title">${escapeHtml(m.title)}</p>`,
      `<p class="ans-premium__metric__body">${escapeHtml(m.body)}</p>`,
      '</div>',
    ].join(''),
  ).join('');
  return `<div class="ans-premium__metrics">${cells}</div>`;
}

function renderAgent(context: InvoicePackageContext): string {
  if (!context.agentWhatsAppUrl) return '';
  const name = context.agentName || 'Your Eternalgy Consultant';
  const initials = (context.agentName || 'EG')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'EG';

  return [
    '<div class="ans-premium__agent">',
    `<span class="ans-premium__agent-avatar">${escapeHtml(initials)}</span>`,
    '<div class="ans-premium__agent-info">',
    `<span class="ans-premium__agent-name">${escapeHtml(name)}</span>`,
    '<span class="ans-premium__agent-role">Your Eternalgy Solar Consultant</span>',
    '</div>',
    '<div class="ans-premium__agent-cta">',
    `<a class="ans-cta ans-cta--sm" href="${escapeHtml(context.agentWhatsAppUrl)}" target="_blank" rel="noopener">WhatsApp</a>`,
    '</div>',
    '</div>',
  ].join('');
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Render the full premium package card for an invoice. Pure string output —
 * no I/O, no LLM — so it returns in microseconds.
 */
export function renderInvoicePackageCard(context: InvoicePackageContext): string {
  const items = parseLineItems(context.packageDescription);
  const price = buildPriceView(context);

  const lead =
    'Your complete rooftop solar package — premium equipment, all government applications, system design, installation, and electrical works, with full warranty and insurance protection included.';

  return [
    '<section class="ans-premium ans-premium--value">',
    '<div class="ans-premium__glow"></div>',
    '<div class="ans-premium__brand-row">',
    '<img class="ans-premium__brand-logo" src="/logo/eternalgy.png" alt="Eternalgy Solar" loading="lazy">',
    '<span class="ans-premium__eyebrow">Your Solar Package</span>',
    '</div>',
    `<h2 class="ans-premium__title">${escapeHtml(context.packageName)}</h2>`,
    `<p class="ans-premium__lead">${escapeHtml(lead)}</p>`,
    price ? renderPriceBlock(price) : '',
    renderShowcase(),
    items.length ? `<div class="ans-premium__cards">${renderItems(items)}</div>` : '',
    renderMetrics(),
    '<div class="ans-premium__note">',
    '<span class="ans-premium__note-mark">i</span>',
    '<p><strong>3-Year MSIG All-Risk Insurance</strong> — full system coverage from day one. Also includes 12-year JinkoSolar product warranty. Final coverage follows your signed proposal.</p>',
    '</div>',
    renderAgent(context),
    '</section>',
  ].join('');
}
