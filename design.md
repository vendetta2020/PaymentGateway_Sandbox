# Payment Gateway: Merchant Dashboard Design System (Stitch V2.5)

This document serves as the **authoritative visual source of truth** for the Payment Gateway frontend implementation. It translates the approved Stitch V2.5 visual references into a strict set of implementation rules.

> **CRITICAL INVARIANT**: This document describes *visual presentation* only. It does not dictate backend architecture, database schema, or financial calculation logic. The backend API remains the 100% authoritative source for all data, states, and financial amounts. Do not invent features or mock data not supported by the backend.

---

## 1. Global Aesthetic (Functional Brutalism)
The UI follows a Functional Web Brutalism approach. It avoids soft, generic SaaS aesthetics in favor of a technical, high-reliability financial infrastructure look.
- **Restrained Border Radius**: Border radius should be used deliberately. Major structural surfaces (cards, large panels) should generally remain sharp (`rounded-none` or `rounded-sm`). Small controls (buttons, inputs, badges) may use a minimal preferred radius (`rounded-md`) when useful for ergonomics. Avoid excessive rounded UI (`rounded-2xl`, `rounded-full`) and pill-shaped components unless strictly necessary.
- **No Drop Shadows**: Avoid diffuse drop shadows (`shadow-md`, `shadow-xl`). Surfaces are defined by 1px solid borders, not shadows.
- **High Contrast Borders**: Use crisp 1px borders (`border-gray-200` or `border-gray-300`) to separate sections and table rows.

## 2. Layout Structure
- **Sidebar (Left)**: Fixed width, light gray background (`bg-gray-50`). Contains the merchant switcher and navigation links. Active links have a darker gray background highlight.
- **Top Header**: Contains global search, environment badge ("TEST ENVIRONMENT"), simulator connection status, and user profile. Border bottom 1px solid.
- **Main Content**: Pure white background (`bg-white`). Content is constrained to a readable max-width or full-width with generous padding (`p-6` or `p-8`).

## 3. Typography System
Typography is used structurally to differentiate types of information:
- **Primary Text (Sans-Serif)**: Use a clean, grotesque sans-serif (e.g., Inter, Roboto, or system sans) for standard UI text, headers, and navigation.
- **Technical Identifiers (Monospace)**: **CRITICAL DISTINCTION**. Transaction IDs (`pay_01...`), Order IDs, provider references, credential IDs, idempotency keys, and webhook IDs must use a **Monospace font** (e.g., `font-mono`). This ensures technical strings are highly readable and prevents character ambiguity (e.g., `O` vs `0`).
- **Financial Amounts**: Large, bold sans-serif with tight tracking (`tracking-tight`). Must use tabular numerals (`tabular-nums`) to ensure vertical alignment in tables.
- **Table Headers / Eyebrows**: Small, uppercase, bold, with wide letter spacing (`text-xs uppercase tracking-wider text-gray-500`).

## 4. Color Palette
- **Surfaces**: 
  - Main App: White `#FFFFFF`
  - Sidebar & Data Blocks (e.g., Timeline, Spec boxes): Very light gray `#F9FAFB` (`gray-50`).
- **Primary Actions**: 
  - Main buttons (e.g., "Create API key", "Resolve discrepancy"): Solid Black `#000000` with white text.
  - Secondary buttons: Light gray background or transparent with 1px border.
- **Status Colors** (Background / Text & Dot):
  - **Succeeded / Matched**: Light Indigo/Blue (or Emerald/Green) background with matching dark dot and text.
  - **Pending / Processing**: Light Amber/Yellow background with amber dot and text.
  - **Failed / Discrepancy / Timeout**: Light Red/Crimson background with red dot and text (e.g., `text-red-700`).
  - **Refunded / Revoked**: Light Slate/Gray background with dark gray dot and text.

## 5. Components & Elements

### 5.1 Tables
- Full width.
- Columns aligned strictly (numbers/amounts aligned right, text aligned left).
- Bottom border on rows (1px solid `gray-100` or `gray-200`).
- Alternating row colors are NOT used; rely on borders and whitespace.
- Row actions (e.g., `...` menu or "Rotate/Revoke") aligned to the far right.

### 5.2 Status Badges
- Shape: Rectangular with minimal rounding (`rounded-sm`).
- Layout: Small solid colored dot (e.g., `w-2 h-2 rounded-full`) followed by status text.
- Padding: Tight padding (`px-2 py-1 text-sm`).

### 5.3 Data Blocks & Panels
- Group related metadata into clearly defined rectangular blocks with a light gray background (`bg-gray-50`). 
- Example: The "Payment Specifications" and "Activity Timeline" on the detail page.

### 5.4 Activity Timeline
- Vertical line connecting events.
- Circular node for each event (filled or hollow depending on status).
- Left-aligned timestamp, bold event title, and gray descriptive text.

### 5.5 Alerts & Discrepancies
- Highlight financial discrepancies (e.g., Settlement mismatches) with explicit red text borders and red labels (`Missing in provider`, `Amount mismatch`).

## 6. Developer & Technical Elements
- **Code Snippets / JSON**: Rendered in dark mode blocks (`bg-gray-900 text-gray-100`) using monospace fonts. Includes a subtle "Copy" action.
- **API Keys**: Masked by default (`sk_test_••••••••3f8a`).

## 7. Spacing Rules
- Use a strict 4pt/8pt grid.
- Section gaps: `32px` (`gap-8` or `mb-8`).
- Component internal padding: `16px` (`p-4`) or `24px` (`p-6`).

## 8. Responsive Intent
- **Desktop**: Full multi-column layout (Sidebar + Main Content). Left/Right splits for detail pages.
- **Mobile/Tablet**: 
  - Sidebar collapses into a hamburger menu.
  - Detail page splits (e.g., Specs vs Timeline) stack vertically.
  - Tables allow horizontal scrolling (`overflow-x-auto`).

## 9. Iconography
- **Functional, Restrained Usage**: Icons must only be used where they provide immediate cognitive value (e.g., navigation menus, status indicators, explicit actions).
- **No Decorative Overload**: Do not place icons next to every text label. Avoid illustrative or cartoonish icons. Stick to a simple, consistent, professional icon set (e.g., Lucide or Heroicons).

## 10. Accessibility (A11y)
- **WCAG AA Contrast**: Ensure all text, including placeholders and disabled states, meets the 4.5:1 contrast ratio.
- **Keyboard Navigation**: All interactive elements must be reachable via the `Tab` key.
- **Visible Focus States**: Display a clear, visible focus ring (`focus-visible:ring` or `outline: 2px solid`) when navigating via keyboard.
- **Accessible Names**: Use `aria-label` or visually hidden text for icon-only buttons to ensure screen readers can announce them.
- **Status Not Communicated by Color Alone**: Status must never be indicated solely by color. Always include text labels or distinct icons (e.g., the text "Failed" alongside the red dot).
- **Readable Table Structure**: Use semantic `<th>` and scope attributes (`scope="col"`, `scope="row"`).
- **Explicit States**: Always provide explicit and accessible loading, empty, and error states.

## 11. Backend Authority
- **Strict Separation of Concerns**: The frontend must never become the source of truth for business logic.
- **No Financial Calculations**: The frontend must not calculate financial values, payment lifecycle states, refund balances, settlement totals, reconciliation outcomes, or provider states.
- **Display Only**: The frontend simply displays what the backend API provides. If a value needs to be computed, it must be computed in the backend and returned via the API.
