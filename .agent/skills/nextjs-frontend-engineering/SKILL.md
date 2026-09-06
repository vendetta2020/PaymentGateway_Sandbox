---
name: nextjs-frontend-engineering
description: "Enforce Next.js and TypeScript engineering standards: strict mode, explicit component architecture, typed API contracts, server/client component boundaries, accessibility, and zero backend leakage."
---

# Skill: Next.js Frontend Engineering

## Purpose
Establish high-standard engineering practices, architecture patterns, and conventions for the Next.js frontend application in this educational Payment Gateway repository.

---

## Technical Standards

### 1. TypeScript Strictness
- Strict mode enabled (`"strict": true` in `tsconfig.json`).
- Zero tolerance for untyped `any`. All API response payloads, component props, and state values must have explicit, strongly typed interfaces.
- Share data contracts or replicate backend OpenAPI / DTO structures directly into frontend type definitions (e.g., `src/types/payment.ts`, `src/types/settlement.ts`).

### 2. Component Architecture
- **Keep Components Focused & Small**: Avoid monolithic components exceeding ~150-200 lines. Break views into focused subcomponents (e.g., `PaymentTable`, `PaymentRow`, `PaymentStatusBadge`, `PaymentFilterBar`).
- **Separation of Concerns**:
  - Presentation components: Pure rendering, styling, and accessible markup.
  - Container / Page components: Route parameters, data fetching, and state integration.
  - API Client services: Isolated HTTP calls with centralized error handling.
- **Do Not Duplicate UI Logic**: Reusable utilities (e.g., currency formatting, date helpers, status badge maps) must live in `lib/` or `utils/`.

### 3. Server vs. Client Components Boundary
- By default, pages and layout components in the Next.js App Router (`app/`) should remain **React Server Components (RSC)** for optimal performance, zero client bundle overhead, and secure server-side fetching.
- Mark a component with `"use client"` **ONLY** when strictly necessary:
  - Requires React hooks (`useState`, `useEffect`, `useReducer`, `useCallback`).
  - Requires browser event listeners (`onClick`, `onChange`, `onSubmit`).
  - Uses browser APIs (`localStorage`, `navigator.clipboard`, `window`).
- Keep Client Components at the leaves of the component tree to minimize client bundle size.

### 4. Centralized API Communication
- Centralize all backend API communication in a typed API client service (e.g., `lib/api-client.ts`).
- Automatically attach necessary authentication headers (e.g., `Authorization: Bearer <token_or_key>`) and standard `Content-Type: application/json`.
- Handle standard HTTP error responses (400, 401, 403, 404, 409, 500) uniformly, transforming them into user-friendly error objects with actionable messages.

### 5. Form Validation & Submissions
- Validate form inputs before submission (e.g., required fields, minimum refund amounts, valid UUIDs).
- Disable submit buttons during pending requests to prevent duplicate user submissions.
- Always attach the `Idempotency-Key` header for financial mutation endpoints (creating payments, processing refunds, triggering settlements).

### 6. Semantic HTML, Accessibility & Responsiveness
- Always use semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`, `<button>`).
- Do not replace `<button>` with `<div onClick={...}>`.
- Implement responsive behavior using Tailwind CSS grid and flexbox (`grid grid-cols-1 md:grid-cols-3`, `hidden sm:table-cell`).
- Ensure full keyboard accessibility (focus rings, modal trap, escape key closing).

---

## Boundary Discipline & Architectural Constraints

1. **Do NOT Rewrite Backend Code**: The backend NestJS application and PostgreSQL schema are authoritative and complete up to Phase 10. Do not modify backend endpoints or business logic during frontend implementation.
2. **Do NOT Duplicate Backend Business Rules**: State transitions, balance deduction, and payment execution happen solely on the backend.
3. **Do NOT Introduce Unnecessary Dependencies**: Use native browser APIs (`fetch`, `Intl`) and Tailwind CSS before reaching for external NPM packages.
