---
name: ui-ux-design-system
description: "Enforce disciplined design-system workflows, design tokens, typography scales, spacing, interaction states, accessibility, and design.md governance for the Merchant Dashboard."
---

# Skill: UI/UX Design System

## Purpose
Establish a disciplined, consistent, and maintainable design-system workflow for the Payment Gateway Merchant Dashboard. This skill ensures that visual design decisions are systematic, accessible, semantic, and governed by design tokens.

---

## Core Enforcements

### 1. Design Tokens
- Maintain a single source of truth for design tokens (colors, spacing, typography, borders, shadows).
- Utilize standard CSS variables or Tailwind CSS theme tokens for all design values.
- Three-layer token architecture:
  - **Primitive tokens**: Raw values (e.g., `#0F172A`, `#22C55E`, `8px`).
  - **Semantic tokens**: Contextual meaning (e.g., `--color-surface`, `--color-status-success`, `--spacing-card-pad`).
  - **Component tokens**: Component-level mapping (e.g., `--btn-primary-bg: var(--color-primary)`).

### 2. Typography Hierarchy
- Clear, readable typography scale:
  - Display/Page Titles: 24px–32px (bold/black, tight tracking)
  - Section Headers: 18px–20px (semibold)
  - Subsections / Table Headers: 13px–14px (uppercase, tracking-wider, semibold)
  - Body Text: 14px–15px (regular, legible line-height 1.5)
  - Metadata / Captions: 12px (medium/muted)
  - Financial Amounts & IDs: Monospaced font (`font-mono`) with tabular figures (`tabular-nums`) for vertical numeral alignment.

### 3. Spacing & Layout System
- Strictly adhere to an 8-point / 4-point spacing scale (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- Use CSS Grid and Flexbox for predictable, aligned layouts.
- Avoid arbitrary, one-off spacing values (e.g., `margin-top: 13px`).

### 4. Color System
- Functional and high-contrast color palette:
  - Backgrounds: Clean neutral tones (pure white `#FFFFFF`, off-white `#F8FAFC`, dark `#09090B`).
  - Surfaces / Borders: Stark, well-defined contrast borders.
  - Text: High contrast primary text (`#0F172A` or `#FAFAFA`), muted secondary text (`#64748B` or `#A1A1AA`).
  - Semantic Status Colors:
    - **Success** (`SUCCEEDED`, `SETTLED`): Emerald / Green (`#16A34A` / `#22C55E`)
    - **Pending / Processing** (`PENDING`, `PROCESSING`): Amber / Yellow (`#D97706` / `#F59E0B`)
    - **Failed / Discrepancy** (`FAILED`, Mismatch): Crimson / Red (`#DC2626` / `#EF4444`)
    - **Neutral / Expired** (`EXPIRED`): Slate / Gray (`#64748B` / `#71717A`)

### 5. Component Consistency & Reusability
- Reusable components must be created only when there is a real, demonstrated reuse case across multiple pages (e.g., `<Button>`, `<Badge>`, `<DataTable>`, `<Modal>`, `<MetricCard>`).
- Do not create premature abstractions for single-use UI sections.
- Ensure visual and behavioral consistency across buttons, inputs, tables, and dialogs.

### 6. Interaction & UI States
Every interactive component and data view must explicitly support:
- **Default State**: Clear affordance and readable styling.
- **Hover State**: Subtle, purposeful feedback (e.g., background shift, border highlight).
- **Active / Pressed State**: Tactile visual feedback.
- **Focus State**: Prominent keyboard focus outline (`outline: 2px solid`, `focus-visible`).
- **Disabled State**: Reduced opacity (`opacity: 0.5`), `cursor: not-allowed`, `pointer-events: none` where appropriate.
- **Loading State**: Skeleton loaders matching final layout or clear loading indicators with `aria-busy="true"`.
- **Empty State**: Informative explanation of why data is empty, paired with actionable next steps (e.g., "No payments recorded yet. Trigger a simulated payment to test.").
- **Error State**: Clear, human-readable error messaging with recovery guidance and accessible role (`role="alert"`).

### 7. Accessibility & Semantic HTML
- Use semantic HTML tags (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<table>`, `<button>`).
- Full keyboard navigation support (Tab order, Enter/Space activation, Escape to dismiss modals).
- WCAG 2.1 AA compliant color contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text and UI components).
- Accessible forms with explicit `<label htmlFor="...">`, `aria-describedby` for error messages, and `aria-invalid`.

---

## Governance Rules
1. **Reuse Existing Decisions**: Never invent an arbitrary visual pattern if an existing design-system rule or component already exists.
2. **`design.md` as Single Source of Truth**: Once created, the project's `design.md` document is the primary visual and architectural design authority. Never override or contradict `design.md` without explicit user instruction.
3. **No Unjustified Abstractions**: Build what is needed for the current screen; do not architect elaborate design-system frameworks before screens exist.
4. **Backend Non-Mutation**: If a design element requires data not present in the backend API, do NOT invent fake data or mutate the backend without reporting and consulting first.
