/**
 * DOMPurify sanitization for AI-generated HTML.
 *
 * Whitelist approach: only the component-library tags, classes, and
 * attributes are permitted.  Everything else is stripped.
 */

import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';

/* ------------------------------------------------------------------ */
/*  Allowed values                                                     */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS: string[] = [
  'p',
  'h3',
  'h2',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
  'section',
  'a',
  'span',
  'strong',
  'em',
  'br',
  'hr',
  'img',
  'button',
];

const ALLOWED_CLASSES: ReadonlySet<string> = new Set([
  'ans-h',
  'ans-list',
  'ans-callout',
  'ans-callout--info',
  'ans-callout--warn',
  'ans-card',
  'ans-card__title',
  'ans-card__body',
  'ans-compare',
  'ans-steps',
  'ans-slide',
  'ans-slide__title',
  'ans-slide__body',
  'ans-slide__highlight',
  'ans-cta',
  'ans-cta--secondary',
  'ans-premium',
  'ans-premium--default',
  'ans-premium--company',
  'ans-premium--trust',
  'ans-premium--value',
  'ans-premium--journey',
  'ans-premium--protection',
  'ans-premium--roof',
  'ans-premium--timing',
  'ans-premium--panel',
  'ans-premium--inverter',
  'ans-premium--comparison',
  'ans-premium--suitability',
  'ans-premium--savings',
  'ans-premium--next',
  'ans-premium__glow',
  'ans-premium__eyebrow',
  'ans-premium__title',
  'ans-premium__lead',
  'ans-premium__showcase',
  'ans-premium__showcase-title',
  'ans-premium__showcase-group',
  'ans-premium__showcase-label',
  'ans-premium__logo-grid',
  'ans-premium__logo-tile',
  'ans-premium__logo-tile--image',
  'ans-premium__logo-img',
  'ans-premium__logo-mark',
  'ans-premium__logo-detail',
  'ans-premium__metrics',
  'ans-premium__metric',
  'ans-premium__metric__value',
  'ans-premium__metric__title',
  'ans-premium__metric__body',
  'ans-premium__cards',
  'ans-premium__card',
  'ans-premium__card__value',
  'ans-premium__card__title',
  'ans-premium__card__body',
  'ans-premium__item-copy',
  'ans-premium__mini-mark',
  'ans-premium__timeline',
  'ans-premium__step',
  'ans-premium__step__value',
  'ans-premium__step__title',
  'ans-premium__step__body',
  'ans-premium__flow',
  'ans-premium__flow-step',
  'ans-premium__flow-step__value',
  'ans-premium__flow-step__title',
  'ans-premium__flow-step__body',
  'ans-premium__compare',
  'ans-premium__compare-col',
  'ans-premium__compare-col--muted',
  'ans-premium__compare-col--accent',
  'ans-premium__compare-title',
  'ans-premium__compare-list',
  'ans-premium__note',
  'ans-premium__note-mark',
  'ans-premium__closing',
  // Price block (invoice package card)
  'ans-premium__price',
  'ans-premium__price-main',
  'ans-premium__price-label',
  'ans-premium__price-value',
  'ans-premium__price-was',
  'ans-premium__price-tags',
  'ans-premium__price-tag',
  'ans-premium__price-tag--save',
  'ans-premium__price-tag--voucher',
  'ans-premium__grid',
  'ans-premium__point',
  'ans-premium__mark',
  'ans-premium__point-body',
  // Brand row + agent block
  'ans-premium__brand-row',
  'ans-premium__brand-logo',
  'ans-premium__agent',
  'ans-premium__agent-avatar',
  'ans-premium__agent-info',
  'ans-premium__agent-name',
  'ans-premium__agent-role',
  'ans-premium__agent-cta',
  'ans-cta--sm',
  // Carousel
  'ans-carousel',
  'ans-carousel__track',
  'ans-carousel__slide',
  'ans-carousel__slide--c1',
  'ans-carousel__slide--c2',
  'ans-carousel__slide--c3',
  'ans-carousel__slide--c4',
  'ans-carousel__slide--c5',
  'ans-carousel__slide--c6',
  'ans-carousel__slide--c7',
  'ans-carousel__slide--c8',
  'ans-carousel__slide--c9',
  'ans-carousel__slide--c10',
  'ans-carousel__slide--c11',
  'ans-carousel__slide--c12',
  'ans-carousel__slide-icon',
  'ans-carousel__slide-title',
  'ans-carousel__slide-body',
  'ans-carousel__nav',
  'ans-carousel__prev',
  'ans-carousel__next',
  'ans-carousel__dots',
  'ans-carousel__dot',
  'ans-carousel__dot--active',
]);

const ALLOWED_ATTR: string[] = ['class', 'href', 'target', 'rel', 'src', 'alt', 'loading', 'aria-label', 'type'];

/* ------------------------------------------------------------------ */
/*  DOMPurify config (exported for testing)                            */
/* ------------------------------------------------------------------ */

export const purifyConfig: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // Forbid any tags / attrs not in the whitelist
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'style'],
};

/* ------------------------------------------------------------------ */
/*  Class-filter hook                                                  */
/* ------------------------------------------------------------------ */

let hookRegistered = false;

function ensureHook(): void {
  if (hookRegistered) return;
  hookRegistered = true;

  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'class') {
      const allowed = data.attrValue
        .split(/\s+/)
        .filter((cls: string) => ALLOWED_CLASSES.has(cls));

      if (allowed.length === 0) {
        data.keepAttr = false;
      } else {
        data.attrValue = allowed.join(' ');
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Sanitize AI-generated HTML.
 *
 * Returns a safe HTML string containing only whitelisted tags, classes,
 * and attributes from the answer component library.
 */
export function sanitizeHTML(html: string): string {
  ensureHook();
  return DOMPurify.sanitize(html, purifyConfig);
}
