# UPDATE-CHAT-RESPONSE-DESIGN.MD

## Purpose

This document explains how the AI chat response design system works and how to update, upgrade, or add new components. It is written for the next AI Agent or developer who needs to change what the chatbot's HTML responses look like.

---

## How the System Works

When a user asks a question, the server builds an LLM prompt that instructs the model to return **raw HTML using a specific set of CSS class names**. That HTML arrives in the browser, is sanitized for safety, and is injected into the chat message DOM where the pre-loaded CSS renders it.

There are **three files that must stay in sync at all times**. Changing one without the others will break rendering or security:

```
server/knowledge/prompt.ts        ← tells the LLM which classes exist and how to use them
src/chat/sanitize.ts              ← DOMPurify whitelist: classes the browser will allow
src/styles/components.css         ← the actual visual styles for each class
```

Any new or renamed component must be updated in all three files.

---

## File Responsibilities

### 1. `server/knowledge/prompt.ts`

Contains two key constants:

- **`COMPONENT_SPEC`** — verbatim HTML snippets showing the LLM exactly what markup to emit.
- **`FORMAT_RULES`** — numbered rules telling the LLM which component to pick based on question type.

The LLM never invents classes. It copies from this spec. If a class is missing here, the LLM will not use it.

### 2. `src/chat/sanitize.ts`

Uses DOMPurify with a strict whitelist. Any class not in `ALLOWED_CLASSES` is silently stripped before the HTML touches the DOM. Any tag not in `ALLOWED_TAGS` is removed entirely.

Current allowed HTML tags:
`p`, `h3`, `ul`, `ol`, `li`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `div`, `section`, `a`, `span`, `strong`, `em`, `br`, `hr`

Current allowed attributes: `class`, `href`, `target`, `rel`

Forbidden regardless: `script`, `style`, `iframe`, `object`, `embed`, `form`, `input`, `textarea`, and any event attributes (`onclick`, `onload`, etc.)

### 3. `src/styles/components.css`

Defines all CSS custom properties (design tokens) under `:root` and the styles for every `ans-*` component. This is the only file that controls visual appearance.

---

## Existing Components

All components use the `ans-` prefix. Here is every component, its class, its HTML pattern, and when to use it.

---

### `ans-h` — Section Heading

```html
<h3 class="ans-h">Section Title</h3>
```

- Amber left border (`4px solid #F59E0B`)
- `font-size: 1.5rem` (mobile), `1.875rem` (desktop)
- Use for: topic headers, section dividers, question categories

---

### `ans-list` — Bulleted List

```html
<ul class="ans-list">
  <li>First item</li>
  <li><strong>Bold label</strong> — supporting text</li>
</ul>
```

- Green dot bullets (`#10B981`)
- `<strong>` inside `<li>` renders in bold dark text
- Use for: feature lists, benefits, unordered facts

---

### `ans-callout` — Info / Warning Box

```html
<!-- Info variant -->
<div class="ans-callout ans-callout--info">
  <p>Important context or key-term explanation.</p>
</div>

<!-- Warning variant -->
<div class="ans-callout ans-callout--warn">
  <p>Caution, eligibility restriction, or risk notice.</p>
</div>
```

- Info: blue left border, light blue background, prepends ℹ️ emoji automatically via CSS `::before`
- Warn: red left border, light red background, prepends ⚠️ emoji automatically via CSS `::before`
- Use for: important caveats, eligibility rules, definitions, risk notices

---

### `ans-card` — Fact Card

```html
<div class="ans-card">
  <p class="ans-card__title">Card Title</p>
  <p class="ans-card__body">Supporting detail text.</p>
</div>
```

- White card, subtle border and shadow, hover lifts shadow
- Title: `font-size: 1.125rem`, semibold, dark
- Body: `font-size: 0.875rem` (mobile) / `1rem` (desktop), secondary gray
- Use for: single standout fact, product spec highlight, key metric

---

### `ans-compare` — Comparison Table

```html
<div class="ans-compare">
  <table>
    <thead>
      <tr>
        <th>Feature</th>
        <th>Option A</th>
        <th>Option B</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Row label</td>
        <td>Value A</td>
        <td>Value B</td>
      </tr>
    </tbody>
  </table>
</div>
```

- Horizontally scrollable on mobile (min-width 480px)
- Zebra striped rows (even rows get `#F9FAFB` background)
- Hover row highlight: `#FEF3C7` (light amber)
- The `<div class="ans-compare">` wrapper is required — do not put `class="ans-compare"` directly on `<table>`
- Use for: product comparisons, plan comparisons, spec sheets

---

### `ans-steps` — Numbered Step List

```html
<ol class="ans-steps">
  <li><strong>Step Title.</strong> What happens in this step.</li>
  <li><strong>Step Title.</strong> What happens in this step.</li>
</ol>
```

- Amber numbered circles (CSS counter, no manual numbering needed)
- Connecting vertical line between circles
- `<strong>` renders as a block-level label above the description text
- Use for: processes, installation sequences, how-to guides, timelines

---

### `ans-slide` — Showcase / Pitch Section

```html
<section class="ans-slide">
  <h3 class="ans-slide__title">Headline</h3>
  <p class="ans-slide__body">
    Compelling paragraph with <span class="ans-slide__highlight">key highlights</span>.
  </p>
</section>
```

- Amber gradient background (`#FFFBEB` → `#FEF3C7` → `#FDE68A`)
- Decorative radial glow in top-right corner
- `ans-slide__highlight`: `color: #D97706` (dark amber), bold
- Use for: "why choose us", sales pitches, key value propositions, closing statements

---

### `ans-cta` — Call-to-Action Button

```html
<!-- Primary (amber gradient) -->
<a class="ans-cta" href="https://example.com" target="_blank" rel="noopener">Get a Free Quote</a>

<!-- Secondary (green gradient) -->
<a class="ans-cta ans-cta--secondary" href="https://example.com" target="_blank" rel="noopener">Compare Plans</a>
```

- Primary: amber gradient, white text, amber glow shadow
- Secondary: green gradient, same shape
- Hover: lifts 1px and deepens shadow
- Both require `href`, `target="_blank"`, `rel="noopener"` for external links
- Use for: consultation bookings, quote requests, contact links

---

## Design Tokens (CSS Custom Properties)

All values live under `:root` in `src/styles/components.css`. Edit here to change the whole system at once.

```css
/* Brand palette */
--color-primary:        #F59E0B   /* amber — headings, step circles, CTA */
--color-primary-light:  #FCD34D
--color-primary-dark:   #D97706   /* slide highlight, CTA gradient end */
--color-secondary:      #10B981   /* green — list bullets, secondary CTA */
--color-secondary-dark: #059669
--color-info:           #3B82F6   /* blue — callout--info */
--color-warn:           #EF4444   /* red — callout--warn */

/* Neutrals */
--color-bg:             #F9FAFB
--color-text:           #1F2937
--color-text-secondary: #6B7280
--color-card-bg:        #FFFFFF
--color-border:         #E5E7EB

/* Spacing (4px base) */
--sp-1 through --sp-16

/* Radii */
--radius-sm: 6px  --radius-md: 8px  --radius-lg: 12px  --radius-full: 9999px

/* Shadows */
--shadow-sm / --shadow-md / --shadow-lg
```

---

## How to Add a New Component

Follow these steps in order. Do not skip any.

### Step 1 — Add CSS to `src/styles/components.css`

Add the component's styles. Name the class with the `ans-` prefix. Include the component name in the base reset block at the top of the file:

```css
.ans-h,
.ans-list,
/* ... existing ... */
.ans-mynew {           /* ← add here */
  font-family: var(--font-sans);
  color: var(--color-text);
  line-height: var(--leading-normal);
  box-sizing: border-box;
}
```

Then write the component block:

```css
/* ============================================================
   .ans-mynew — Short description
   ============================================================ */
.ans-mynew {
  /* your styles using design tokens */
}
```

Add `break-inside: avoid;` for the new class in the `@media print` block at the bottom.

### Step 2 — Add the class to `src/chat/sanitize.ts`

In the `ALLOWED_CLASSES` set, add every class name the component uses (including modifiers and element classes):

```ts
const ALLOWED_CLASSES: ReadonlySet<string> = new Set([
  // ...existing...
  'ans-mynew',
  'ans-mynew__title',   // add sub-element classes too
  'ans-mynew--variant', // add modifier classes too
]);
```

If your component needs a new HTML tag (e.g. `figure`, `blockquote`), add it to `ALLOWED_TAGS` as well.

### Step 3 — Add to `server/knowledge/prompt.ts`

**In `COMPONENT_SPEC`**, add a new section with the exact markup the LLM should copy:

```ts
const COMPONENT_SPEC = `...existing...

### My New Component
<div class="ans-mynew">
  <p class="ans-mynew__title">Title here</p>
  <p>Body text here.</p>
</div>`;
```

**In `FORMAT_RULES`**, add a numbered rule telling the LLM when to use it:

```ts
const FORMAT_RULES = `...existing...
9. **[Describe the question type]** → \`<div class="ans-mynew">\`.`;
```

### Step 4 — Add to `public/demo.html`

Add a demo section so you can visually verify the component at `/demo`:

```html
<div class="demo-section" id="section-mynew">
  <span class="demo-section__label">.ans-mynew</span>
  <h2 class="ans-h">My New Component</h2>
  <!-- live example here -->
</div>
```

Add a nav link in the `<nav class="demo-nav">` bar.

---

## How to Update an Existing Component

**Visual changes only** (color, spacing, font size): edit `src/styles/components.css` only. The token variables are the cleanest lever — changing `--color-primary` updates all amber elements at once.

**Adding a new modifier class** (e.g. `ans-card--featured`): add the CSS in `components.css`, add the class name to `ALLOWED_CLASSES` in `sanitize.ts`, add an example to `COMPONENT_SPEC` in `prompt.ts`.

**Renaming a class**: update all three files plus `demo.html`. Search the whole repo for the old name to catch any missed references.

**Adding a new sub-element class** (e.g. `ans-card__icon`): add CSS, add to `ALLOWED_CLASSES`, add to the markup example in `COMPONENT_SPEC`.

---

## How to Change the Brand Colors

All color changes should go through the CSS custom properties in `src/styles/components.css`. Never hardcode colors directly in component rules.

Example — changing the primary brand from amber to indigo:

```css
:root {
  --color-primary:      #6366F1;  /* was #F59E0B */
  --color-primary-light: #A5B4FC; /* was #FCD34D */
  --color-primary-dark:  #4F46E5; /* was #D97706 */
}
```

This will update: heading border, step number circles, CTA button gradient, slide background, and the amber hover highlight on the comparison table. The one hardcoded amber value in the compare hover (`#FEF3C7`) should also be updated manually if changing brand colors.

---

## Combining Components

The LLM can and should combine components for complex answers. The `FORMAT_RULES` section already instructs it to lead with the most important information. Common combinations:

```html
<h3 class="ans-h">System Sizing</h3>
<ul class="ans-list">
  <li>...</li>
</ul>
<div class="ans-callout ans-callout--info">
  <p>Tip: ...</p>
</div>
```

```html
<h3 class="ans-h">Compare Your Options</h3>
<div class="ans-compare">
  <table>...</table>
</div>
<a class="ans-cta" href="...">Book a Consultation</a>
```

---

## What the LLM Must Never Do

These rules are enforced in `FORMAT_RULES` and also in `sanitize.ts` (which silently strips violations):

- No inline `style` attributes (stripped by sanitizer)
- No invented CSS classes (stripped by sanitizer)
- No `<html>`, `<head>`, `<body>`, `<!DOCTYPE>` wrapper
- No markdown fences (` ```html `) — raw HTML only
- No `<script>`, `<style>`, `<iframe>`, `<form>`, `<input>` tags
- No event attributes (`onclick`, `onload`, etc.)

---

## Quick Reference: Three-File Checklist

When adding or changing a component, verify all three files are updated:

| Change | `components.css` | `sanitize.ts` | `prompt.ts` |
|---|---|---|---|
| New component | ✅ Add styles | ✅ Add class to whitelist | ✅ Add to COMPONENT_SPEC + FORMAT_RULES |
| New modifier class | ✅ Add styles | ✅ Add class to whitelist | ✅ Add example in COMPONENT_SPEC |
| Rename class | ✅ Rename | ✅ Rename | ✅ Rename in both constants |
| Visual-only tweak | ✅ Edit only | — | — |
| Change brand color | ✅ Edit `:root` vars | — | — |
| New HTML tag needed | — | ✅ Add to ALLOWED_TAGS | ✅ Use in COMPONENT_SPEC example |
