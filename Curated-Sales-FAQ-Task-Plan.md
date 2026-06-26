# Curated Sales FAQ — Task Plan

## Objective

Create a library of short, persuasive, prebuilt answers for important questions that help Solar PV proposal recipients trust Eternalgy and make a decision.

The work is divided into two phases:

1. Write and approve the sales FAQ content.
2. Convert approved answers into premium visual HTML responses.

---

## Phase 1 — Write the Sales FAQ Content

### 1. Read the Existing Knowledge Vault

Read:

- `D:\00Product-AI\knowledge\manifest.json`
- Every Markdown file referenced in the manifest
- Especially:
  - `knowledge/company/`
  - `knowledge/products/`
  - `knowledge/schemes/`
  - `knowledge/basics/`

The knowledge vault is the factual source of truth.

### 2. Extract Verified Selling Points

- Use only claims supported by the knowledge vault.
- Do not invent prices, savings, warranties, certifications, statistics, timelines, or product specifications.
- If important evidence is unavailable, flag it instead of guessing.
- Prioritize facts that build trust, demonstrate value, reduce risk, or differentiate Eternalgy.

### 3. Initial Question List

Create approved answers for these decision-related questions:

1. Why should I choose Eternalgy?
2. Can I trust Eternalgy?
3. What makes Eternalgy different?
4. Why is this proposal worth the price?
5. Why should I not simply choose the cheapest quotation?
6. Who will handle my installation?
7. What protection and warranty will I receive?
8. What happens if my roof needs repair?
9. What support will I receive after installation?
10. Why should I install solar now?
11. Why was this solar panel selected?
12. Why was this inverter selected?
13. Is this system suitable for my property?
14. How will solar reduce my electricity bill?
15. What is the next step if I want to proceed?

The list may be refined after reviewing the knowledge vault. Merge questions that require the same answer and add missing high-value decision questions when justified.

### 4. Write the Best-Version Answer

For each question:

- Lead with the main client benefit.
- Use two to four strong, relevant selling points.
- Explain why those points matter to the client.
- Reduce uncertainty and perceived risk.
- Use concrete proof from the knowledge vault.
- End with a gentle decision-driving statement when appropriate.
- Keep the answer factually accurate.

### 5. Sales Tone

The voice should be:

- Confident
- Persuasive
- Professional
- Reassuring
- Helpful rather than aggressive
- Focused on the client's outcome

Use first-person company language:

- “We”
- “Our team”
- “Your system”
- “Your property”

Do not refer to Eternalgy as “they.”

Avoid:

- Unsupported superlatives
- Pushy sales language
- Empty marketing phrases
- Exaggerated guarantees
- Negative attacks on competitors

### 6. Writing Style

- Short, clean, and easy to understand
- Plain English
- Lead with the answer
- Use short paragraphs or concise points
- Make the strongest proof easy to notice
- Avoid jargon unless it is explained
- Avoid repeating the same selling point
- Optimize for quick reading inside a proposal chat

### 7. Add Question Variations

Each curated answer should support several natural versions of the same question.

Example:

```json
{
  "id": "why-choose-eternalgy",
  "questions": [
    "Why should I choose Eternalgy?",
    "Why Eternalgy?",
    "What makes Eternalgy different?",
    "Why should I choose your company?"
  ]
}
```

Question variations must share the same intent. Do not create duplicate answers for minor wording differences.

---

## FAQ Storage

Store approved FAQ source content inside the current knowledge vault:

```text
knowledge/
  faq/
    why-choose-eternalgy.md
    trust-and-credentials.md
    proposal-value.md
    installation-and-support.md
    product-selection.md
```

Do not use `faq-cache/` as the primary source. That directory should remain generated runtime data.

The approved and editable FAQ source should live under `knowledge/faq/`.

### Recommended FAQ File Format

```md
---
id: why-choose-eternalgy
intent: company-selection
questions:
  - Why should I choose Eternalgy?
  - Why Eternalgy?
  - What makes Eternalgy different?
---

# Why Choose Eternalgy?

Approved answer text.

## Supporting Facts

- Verified fact and its knowledge-vault source
- Verified fact and its knowledge-vault source
```

Update `knowledge/manifest.json` only after the FAQ content has been reviewed and approved.

---

## Phase 1 Deliverable

Produce:

- Final curated question list
- Question variations grouped by intent
- One approved plain-text sales answer per intent
- Supporting facts and source-file references
- A list of missing facts that require confirmation

Do not produce HTML, CSS, application code, or repository integration during Phase 1.

---

## Phase 2 — Premium Visual HTML Answers

Begin Phase 2 only after the wording from Phase 1 is approved.

### 1. Design Each Visual Answer

Convert every approved answer into a polished HTML response with:

- A strong headline
- A short client-focused value statement
- Two to four selling-point cards
- Visible proof or trust indicators
- A risk-reversal or reassurance message
- A relevant call to action when appropriate

Avoid displaying the answer as one large paragraph.

### 2. Visual Requirements

- Premium and professional appearance
- Clear visual hierarchy
- Easy to scan
- Mobile and desktop responsive
- Consistent with Eternalgy branding
- Readable inside the existing chat interface
- Reusable components rather than one-off styling

### 3. Technical Integration

Implement the following response flow:

```text
Client question
→ Match a curated FAQ intent
→ If matched, return the approved premium HTML answer
→ If not matched, use the normal knowledge-vault AI response
```

Intent matching should recognize natural question variations and should not depend only on exact text matching.

### 4. Safety and Accuracy

- Keep the approved wording as the source of truth.
- Do not allow styling or generation logic to introduce new claims.
- Escape or sanitize dynamic content.
- Ensure curated HTML uses only supported and safe elements.

---

## Phase 2 Deliverable

Produce:

- Premium HTML for every approved FAQ answer
- Reusable CSS components
- Intent-matching logic
- Curated-answer loading logic
- Normal AI fallback behavior
- Desktop and mobile visual verification
- Tests for question variations and fallback responses

---

## Completion Criteria

The task is complete when:

- Important decision questions have approved persuasive answers.
- Every claim is traceable to the knowledge vault.
- Answers are short, clear, and client-focused.
- Approved FAQs are stored under `knowledge/faq/`.
- Related question variations resolve to the correct answer.
- Curated answers render with premium HTML styling.
- Unmatched questions continue using the normal AI response.
- The final experience helps the client understand value, trust Eternalgy, and confidently take the next step.
