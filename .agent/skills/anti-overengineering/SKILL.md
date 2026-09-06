---
name: anti-overengineering
description: "Prevent unnecessary complexity: reject unneeded third-party libraries, premature abstractions, mega-components, unnecessary state management libraries, and micro-frontends in favor of simple, explicit code."
---

# Skill: Anti-Overengineering

## Purpose
Prevent coding agents, architects, and developers from introducing unnecessary complexity, architectural bloat, premature abstractions, or dependency sprawl into the frontend of this educational Payment Gateway project.

---

## Core Rules & Invariants

### 1. Minimalist Dependency Policy
- **Do NOT add an external library** unless it solves a concrete, demonstrable technical problem that cannot be reasonably solved using the existing stack (Next.js, React, Tailwind CSS, native browser APIs).
- **Prefer Native Platform Capabilities**:
  - Currency and number formatting $\rightarrow$ use native `Intl.NumberFormat('id-ID', ...)` instead of `currency.js` or `numeral`.
  - Date and time formatting $\rightarrow$ use native `Intl.DateTimeFormat` or native `Date` instead of `moment.js` or `date-fns`.
  - HTTP requests $\rightarrow$ use native `fetch` with standard TypeScript wrappers instead of `axios`.
  - State management $\rightarrow$ use React Server Components, `useState`, and React Context instead of adding `Redux`, `Zustand`, `Recoil`, or `MobX`.
  - Component library $\rightarrow$ use clean semantic HTML with Tailwind CSS instead of bloated UI libraries like `Material UI`, `Chakra UI`, or `Ant Design`.

### 2. The Dependency Justification Protocol
Before proposing or installing any third-party npm package, you MUST explicitly document:
1. **What concrete problem does this package solve?**
2. **Why can the existing stack / native platform APIs NOT solve it?**
3. **Why is this specific dependency appropriate and minimal for this project?**
If any of these three answers is weak or speculative, the dependency must be rejected.

### 3. Avoid Premature Abstractions
- **Rule of Three**: Write code inline until a pattern repeats at least three times across distinct screens before extracting it into a generic helper or component.
- **No Mega-Props Generic Components**: Do not build a single "super-component" that accepts 30 optional props, polymorphic render functions, and complex configuration objects to handle every hypothetical use case. Prefer two separate, simple, readable components.
- **No Abstraction for Single Trivial Usage**: Do not create a wrapper component or custom hook for a one-line standard React or HTML element.

### 4. Architectural Simplicity
- **No Micro-Frontends**: This is a cohesive educational merchant dashboard. Monolithic Next.js is the chosen, optimal architecture.
- **No Unnecessary Design-System Frameworks**: Do not install Storybook, complex theme engines, or token generators unless specifically mandated.
- **No Unrelated Refactoring**: Do not re-architect, move, or rename unrelated files or backend folders while implementing frontend screens.
- **Explicit over Clever**: Choose obvious, readable code that a junior developer can inspect and understand immediately over clever metaprogramming, complex currying, or deep inheritance.

---

## Conflict & Alignment Protocol

If a visual mockup, feature request, or design decision appears to demand extreme architectural complexity or conflicts with an existing backend constraint:
1. **DO NOT silently introduce complexity** to work around the issue.
2. **DO NOT modify the backend silently**.
3. **Report the conflict clearly** to the user, identify the trade-offs, and propose the simplest viable path forward.
