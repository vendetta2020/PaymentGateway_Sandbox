# Payment Gateway: Merchant Dashboard Design System (Stitch V2.5)

This document serves as the **authoritative visual source of truth** for the Payment Gateway frontend implementation. It translates the approved Stitch V2.5 visual references into a strict set of implementation rules.

> **CRITICAL INVARIANT**: This document describes *visual presentation* only. It does not dictate backend architecture, database schema, or financial calculation logic. The backend API remains the 100% authoritative source for all data, states, and financial amounts. Do not invent features or mock data not supported by the backend.

---

## 1. Global Aesthetic (Functional Brutalism)
The UI follows a Functional Web Brutalism approach. It avoids soft, generic SaaS aesthetics in favor of a technical, high-reliability financial infrastructure look.
- **Zero/Minimal Border Radius**: UI elements (cards, buttons, inputs) must have `0px` or a maximum of `2px` border radius (`rounded-none` or `rounded-sm`).
- **No Drop Shadows**: Avoid diffuse drop shadows (`shadow-md`, `shadow-xl`). Surfaces are defined by 1px solid borders, not shadows.
- **High Contrast Borders**: Use crisp 1px borders (`border-gray-200` or `border-gray-300`) to separate sections and table rows.

## 2. Layout Structure
- **Sidebar (Left)**: Fixed width, light gray background (`bg-gray-50`). Contains the merchant switcher and navigation links. Active links have a darker gray background highlight.
- **Top Header**: Contains global search, environment badge ("TEST ENVIRONMENT"), simulator connection status, and user profile. Border bottom 1px solid.
- **Main Content**: Pure white background (`bg-white`). Content is constrained to a readable max-width or full-width with generous padding (`p-6` or `p-8`).

## 3. Typography System
Typography is used structurally to differentiate types of information:
- **Primary Text (Sans-Serif)**: Use a clean, grotesque sans-serif (e.g., Inter, Roboto, or system sans) for standard UI text, headers, and navigation.
- **Technical Identifiers (Serif)**: **CRITICAL DISTINCTION**. Transaction IDs (`pay_01...`), Order IDs, and technical reference strings must use a **Serif font** (e.g., Georgia, Times New Roman, or UI serif). This provides a distinct document/ledger feel.
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
  - **Succeeded / Matched**: Light Indigo/Blue background with matching dark dot and text.
  - **Failed / Discrepancy / Timeout**: Light Red/Crimson background with red dot and text (e.g., `text-red-700`).
  - **Pending / Refunded / Revoked**: Light Gray background with gray dot and text.

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
