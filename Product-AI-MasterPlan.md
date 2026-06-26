# Product Q&A AI Chatbot — Master Plan

> **Status:** Design / specification. This document defines *what to build and why*. It is the source of truth for the implementing agent. It does not contain final production code — it describes the architecture, decisions, and methods precisely enough to build from cold.

---

## 1. Vision

Build a **Product Q&A AI Chatbot** that does not merely return text — it returns **professionally formatted answers**: clean HTML, tables, comparison cards, step-by-step guides, and even slide-style showcases, rendered inside a custom web app we control.

The product sells **residential/commercial Solar PV in Malaysia**. The bot must answer questions about:

- Solar PV (how it works, basics)
- Malaysia Solar Scheme terms & conditions (e.g. NEM / SelCo)
- Jinko Solar Tiger Neo 3 advantages
- Why choose our company

The experience goal: a prospect asks a question and gets back something that looks like it was prepared by a professional sales engineer — not a wall of chatbot text. Short questions get short clean answers; complex questions get rich visual layouts.

### Design principles

1. **Right-sized intelligence.** The dataset is small and grows slowly with a known ceiling. Do **not** build RAG, vector databases, or embeddings. Architect for the data we actually have, with a clean, earned upgrade path.
2. **Format follows complexity.** A 2-sentence answer is plain text. A comparison is a table. A process is steps. A pitch is a slide. The AI decides, guided by explicit rules.
3. **Constrain, don't free-style.** The AI composes from a *fixed component library*, not arbitrary HTML. This guarantees consistent visual quality, speed, and safety.
4. **Pre-generate the predictable.** Most questions about a fixed product set are predictable. Cache polished answers; reserve live generation for the long tail.
5. **Editable by non-engineers.** Knowledge lives in Markdown files anyone can edit, version-controlled. An admin dashboard provides a UI for this — no terminal required.

---

## 2. Scope

### In scope (v1)
- Custom web chat UI (our own app).
- **Admin dashboard** for managing knowledge base (CRUD Markdown files, view token budget, regenerate FAQ cache).
- AI generates answers as **constrained HTML** using a defined component library.
- Markdown-based knowledge base with a manifest.
- "Load everything into context" knowledge strategy (no retrieval).
- Pre-generated/cached answers for common questions (FAQ cache).
- Client-side HTML sanitization before render.
- Streaming responses for perceived speed.

### Out of scope (v1 — explicitly do NOT build)
- Vector database / embeddings / chunk-based RAG.
- Keyword-to-document routing maps.
- Multi-step classifier pipelines (format is decided inside the single generation call).
- User accounts / auth (unless required by the host app separately).
- Multi-language UI framework (the model handles EN/Malay mixing natively; no i18n system needed).

---

## 3. The data reality (drives every decision)

The knowledge base is **small and grows slowly with a ceiling**. We design around a token budget, not document count.

Rule of thumb: ~1 page of text ≈ 500–800 tokens. Modern model context windows are ~200k tokens. Knowledge is the only major consumer of context (a Q&A bot has little chat history).

| Knowledge size | Meaning | Strategy | Build now? |
|---|---|---|---|
| **0–40k tokens** (~50–70 pages) | Today + years of growth | **Load everything** into system prompt | ✅ Yes |
| **40k–120k tokens** (~150 pages) | Large catalog | **Section-level loading** (load whole files by topic match) | ⏳ Earn later |
| **120k+ tokens** | Not expected to reach | RAG / embeddings | ❌ Do not build |

**Decision:** Build for band 1. Structure files so the upgrade to band 2 is a ~1-day change reusing the same files and manifest — never a rewrite.

---

## 4. Architecture overview

```
┌──────────────────────────────────────────────────────────┐
│  WEB APP  (custom chat UI)                                 │
│   - sends user question                                    │
│   - renders sanitized HTML components                      │
│   - streams assistant output                               │
└───────────────┬──────────────────────────────────────────┘
                │ question
                ▼
        ┌───────────────────┐
        │ [1] FAQ Cache      │  hit ──▶  return pre-generated HTML (instant)
        │     lookup         │
        └───────┬───────────┘
                │ miss
                ▼
        ┌─────────────────────────────────────────────┐
        │ [2] Single LLM call                          │
        │     system prompt =                          │
        │        • ALL knowledge (concatenated .md)    │
        │        • component library spec              │
        │        • format-selection rules             │
        │        • brand/tone rules                    │
        │     user prompt = the question               │
        │     → STREAMS constrained HTML               │
        └───────┬─────────────────────────────────────┘
                │ raw HTML
                ▼
        ┌───────────────────┐
        │ [3] Sanitize       │  whitelist tags + our component classes
        │     (DOMPurify)    │
        └───────┬───────────┘
                ▼
            render in chat

┌──────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD  (/admin)                                 │
│   - manage knowledge .md files (CRUD)                      │
│   - view token budget                                      │
│   - manage FAQ cache                                       │
│   - protected by ADMIN_PASSWORD                            │
└───────────────┬──────────────────────────────────────────┘
                │ writes
                ▼
        ┌───────────────────┐
        │ /knowledge/*.md    │  ← auto-rebuilds manifest.json
        │ manifest.json      │
        └───────────────────┘
```

No vector DB. No router. No multi-step pipeline. Three stages for chat; separate admin path for knowledge management.

---

## 5. Knowledge layer

### 5.1 File structure

```
/knowledge
  /products
    jinko-tiger-neo-3.md
    [future-panel-x].md
  /schemes
    malaysia-solar-scheme.md
    [future-nem-3.0].md
  /company
    why-choose-us.md
  /basics
    solar-pv.md
  manifest.json
```

**Rules:**
- One topic per file. Keep files small and focused.
- Never write a single mega-file — the file is the future unit of retrieval.
- Categories are folders, so growth stays organized.

### 5.2 `manifest.json`

Carries per-file metadata. Used today only to concatenate; carries the data band-2 retrieval will need later.

```json
{
  "files": [
    {
      "path": "basics/solar-pv.md",
      "topic": "solar-pv",
      "title": "Solar PV Basics",
      "summary": "How solar panels generate electricity; system components.",
      "tokens": 0,
      "loadOrder": 10
    }
  ]
}
```

- `summary` is what band-2 section-level loading will show the model to pick files.
- `tokens` is filled by the budget script (below).
- `loadOrder` controls concatenation order (basics first, pitch last, etc.).

### 5.3 Knowledge injector
- Today: read manifest → concatenate all files in `loadOrder` → inject as a single knowledge block in the system prompt.
- Implementation should isolate this in **one module** (e.g. `buildKnowledgeContext()`) so the band-2 upgrade swaps only the file-selection step.

### 5.4 Token-budget guardrail (build now)
- A small script that sums `tokens` across the manifest.
- Warns (CI log / console) when total **> 35k tokens**.
- That warning is the signal to flip to section-level loading. Likely never fires, but it removes the guesswork.

### 5.5 Future upgrade path (do NOT build now — documented for continuity)
When total knowledge crosses ~40k tokens:
1. Send the model only the `summary` list from the manifest.
2. Model selects the 3–4 relevant `topic`s.
3. Load only those files' full content, then generate.
This is **section-level retrieval** — reuses identical files + manifest. No embeddings, no vector DB.

---

## 6. Answer formatting layer (the heart of the product)

### 6.1 Component library (the "master template")

The AI must **not** emit arbitrary HTML. It composes from a fixed set of components. Our web app ships the CSS that makes them beautiful; the AI only chooses *which component fits* and fills content. This guarantees consistency, speed, and safety.

Define a component spec (this is what goes into the system prompt). Minimum v1 set:

| Component | Class / tag | Use for |
|---|---|---|
| Text | `<p>` | Short answers, ≤2 sentences |
| Heading | `<h3 class="ans-h">` | Section titles in long answers |
| List | `<ul class="ans-list">` | Simple enumerations |
| Callout | `<div class="ans-callout ans-callout--info\|warn">` | Highlights, warnings, key terms |
| Card | `<div class="ans-card">` | A single highlighted fact/feature |
| Comparison table | `<table class="ans-compare">` | "Jinko vs others", spec comparisons |
| Steps | `<ol class="ans-steps">` | Processes (e.g. how the scheme works) |
| Slide | `<section class="ans-slide">` | Pitch/showcase answers ("why choose us") |
| CTA | `<a class="ans-cta">` | Call-to-action (e.g. "Get a quote") |

**The implementing agent must produce:**
1. A **CSS design system** implementing every class above, on-brand, responsive, looking professional.
2. A **machine-readable spec** of these components (names, exact markup, when to use) that is injected verbatim into the system prompt so the model knows the contract.

> Keep the two in sync. The CSS and the prompt spec describe the same component set. Adding a component = update both.

### 6.2 Format-selection rules (in the system prompt)

The model decides format inline — **no separate classifier call** (that only adds latency). The prompt instructs, roughly:

- If the answer is ≤2 sentences → reply with a single `<p>`. Do **not** decorate simple answers.
- If comparing options/specs → `ans-compare` table.
- If explaining a process/sequence → `ans-steps`.
- If presenting a pitch / "why us" / showcase → `ans-slide`.
- If highlighting a warning, eligibility rule, or key term → `ans-callout`.
- Otherwise → `<p>` + minimal structure.
- Never invent classes or inline styles. Only use the listed components.
- Match brand tone (defined in §6.4).

### 6.3 Generation call
- **One** LLM call per uncached question.
- System prompt = knowledge block + component spec + format rules + tone.
- **Stream** the output for perceived speed.
- Output is raw constrained HTML (no JSON wrapper needed in v1 — simpler; the constrained component set is the safety boundary).

### 6.4 Brand & tone (to be filled by stakeholders)
- Voice: professional, confident, helpful sales engineer. Not salesy-spammy.
- Always factual to the knowledge base; if unknown, say so and offer to connect a human / collect contact.
- Define: company name, brand colors, logo, CTA targets. *(Placeholder — implementing agent should expose these as config.)*

---

## 7. Pre-generated FAQ cache

Because the product set is fixed and small, most questions are predictable.

- Maintain a list of the **top ~30 common questions**.
- Pre-generate their polished HTML answers (using the same component library) and store them.
- On each request, do a cache lookup **first**; on hit, return instantly.
- On miss, fall through to live generation (§6.3).
- Cache match can be simple in v1 (normalized question text / curated intent list). It does **not** need semantic search — keep it simple; expand only if needed.
- Value grows as data grows (more content → more predictable common questions).

**Cache invalidation:** when a knowledge `.md` file changes, flag/clear the affected pre-generated answers for regeneration. Keep this manual-friendly in v1 (a regenerate script).

---

## 8. Safety & rendering

Rendering AI-produced HTML is an **XSS risk**. Two layers of defense:

1. **Constraint** — the AI only emits the known component set (no `<script>`, no arbitrary tags, no inline event handlers).
2. **Sanitization** — before rendering, run output through **DOMPurify** (or equivalent) configured to a **whitelist**: allowed tags + our `ans-*` classes only. Strip everything else.

Never render model output as raw `innerHTML` without sanitization. This is mandatory, not optional.

---

## 9. Model

- The project already runs **MiniMax-M2** (used by the existing WhatsApp agent; key managed in Railway env). Reusing it means one model/key to operate.
- For **user-facing formatted HTML**, quality matters more than for internal automation. The implementing agent should keep the model behind a thin interface so we can **A/B against a stronger model** for answer quality without rewiring.
- **Decision deferred:** start with MiniMax-M2; evaluate output quality on the component-formatted answers; switch if quality is insufficient. Keep model choice as config.

---

## 10. Web app (chat UI) requirements

- Clean chat interface; renders sanitized component HTML inline in assistant bubbles.
- Streaming display of assistant output.
- Mobile-responsive (prospects will use phones).
- Loading / typing indicator.
- Graceful error state ("Something went wrong, try again / talk to a human").
- Optional v1: lead capture CTA wired to the `ans-cta` component.
- The component CSS (§6.1) lives here and is the single styling authority.

---

## 11. Admin dashboard (knowledge management)

The admin dashboard lets non-engineers manage the knowledge base without touching files directly. It is a **separate route/page** in the same web app (e.g. `/admin`), protected by a simple password or environment-gated access.

### 11.1 Features

| Feature | Description |
|---|---|
| **File browser** | List all knowledge files grouped by category (`/products`, `/schemes`, `/company`, `/basics`). Shows filename, title, summary, token count. |
| **Markdown editor** | Edit any `.md` file in-browser with a Markdown editor (e.g. EasyMDE, Monaco, or simple textarea with preview). Save writes the file to disk and auto-updates `manifest.json`. |
| **Add / delete files** | Create new files in any category (prompts for filename, title, summary). Delete removes the file and its manifest entry. |
| **Token budget dashboard** | Visual bar showing total tokens used vs. the 35k warning threshold. Per-file breakdown. |
| **Manifest viewer** | Read-only view of `manifest.json` — shows load order, topics, token counts. Auto-regenerated on any file change. |
| **FAQ cache management** | List cached FAQ entries. Button to regenerate all (or individual) cached answers. Shows last-generated timestamp. |
| **Preview** | Optional: send a test question through the generation pipeline and see the rendered answer without leaving admin. |

### 11.2 Technical notes

- **Backend routes** for file CRUD: `GET/POST/PUT/DELETE /api/admin/knowledge/:category/:file`.
- On any file save/delete, auto-run the manifest builder (`buildManifest()`) to keep `manifest.json` in sync.
- On any file change, flag affected FAQ cache entries as stale (visual indicator in admin).
- Token counting: reuse the same counter as the budget guardrail script.
- **Auth**: simple env-variable password (`ADMIN_PASSWORD`) checked via a login page or HTTP header. No user accounts in v1.

### 11.3 Suggested stack

- Same frontend framework as the chat UI (shared component library, routing).
- A lightweight Markdown editor component (EasyMDE is 45kb gzipped, has preview built in).
- Backend API endpoints alongside the chat API (same server).

---

## 12. Build phases (for the implementing agent)

**Phase 1 — Knowledge foundation**
- Create `/knowledge` folder structure + the four seed `.md` files (content from stakeholders).
- Create `manifest.json` with metadata.
- Build `buildKnowledgeContext()` injector (load-everything).
- Build the token-budget guardrail script (warn > 35k).

**Phase 2 — Component design system**
- Build the CSS for every component in §6.1, on-brand, responsive, professional.
- Build the machine-readable component spec for the system prompt.
- Produce a static demo page rendering every component with sample content (visual sign-off before AI is wired).

**Phase 3 — Generation pipeline**
- Assemble the system prompt: knowledge + component spec + format rules + tone.
- Implement the single streaming LLM call behind a model-agnostic interface.
- Implement DOMPurify sanitization with the component whitelist.

**Phase 4 — Web chat app**
- Build the chat UI, wire streaming + sanitized rendering.
- Mobile responsive, loading/error states.

**Phase 5 — FAQ cache**
- Curate top ~30 questions; pre-generate answers; implement cache-first lookup.
- Build a regenerate script for when knowledge changes.

**Phase 6 — Admin dashboard**
- Build `/admin` route with password protection (`ADMIN_PASSWORD` env var).
- File browser: list knowledge files by category with metadata.
- Markdown editor: edit `.md` files in-browser with live preview.
- Add/delete file UI with auto manifest rebuild.
- Token budget dashboard: visual bar + per-file breakdown.
- FAQ cache management: list entries, regenerate button, stale indicators.
- Backend API routes for all CRUD operations.

**Phase 7 — Polish & evaluate**
- Evaluate answer quality (format correctness, accuracy to knowledge, tone).
- A/B model if needed.
- Tune format-selection rules based on real outputs.

---

## 13. Definition of done (v1)

- A prospect can ask any of the four topic areas and get an accurate, professionally formatted answer.
- Short questions return plain text; complex questions return correct rich components.
- Common questions return instantly from cache.
- All rendered HTML is sanitized; no XSS vector.
- Knowledge is editable via Markdown by a non-engineer; adding a file requires no code change.
- Token-budget guardrail is in place.
- Admin dashboard is accessible at `/admin` with password protection.
- Admin can view, edit, add, and delete knowledge files; manifest auto-updates.
- Admin can view token budget and manage FAQ cache.

---

## 14. Decisions log (rationale, so future agents don't "improve" them by mistake)

| Decision | Why |
|---|---|
| Admin dashboard in v1 | Non-engineers need to manage knowledge without touching files or terminal. |
| No RAG / vector DB | Data fits in context; retrieval adds complexity and failure modes for zero benefit at this scale. |
| No keyword→doc routing map | Breaks on synonyms, EN/Malay mixing, multi-topic questions; the LLM already does this for free when it sees all docs. |
| Load everything into context | Simplest, most accurate strategy within the token budget. |
| Fixed component library, not free HTML | Consistency, speed, and XSS safety. |
| Format decided in one call, no classifier | Avoids latency of a separate step; the model is capable of the judgment. |
| Pre-generated FAQ cache | Fixed product set → predictable questions → instant, perfect answers. |
| File-per-topic + manifest | Makes the eventual band-2 upgrade a config change, not a rewrite. |
| Sanitize before render | Mandatory XSS defense. |

---

## 15. Open items for stakeholders

- Final knowledge content for the four seed `.md` files.
- Brand assets: company name, colors, logo, tone guidelines.
- CTA targets (quote form? WhatsApp? phone?).
- Confirm hosting/runtime for the web app and generation backend.
- Confirm model choice after Phase 7 evaluation (MiniMax-M2 vs alternative).
- Confirm admin dashboard access method (simple password vs IP whitelist vs other).
```
