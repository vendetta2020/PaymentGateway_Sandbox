---
name: brutalist-web-design
description: "Establish the visual language for the Merchant Dashboard using functional Web Brutalism: strong typography, visible borders, sharp geometry, high contrast, and technical financial infrastructure aesthetics."
---

# Skill: Brutalist Web Design

## Purpose
Establish the visual styling and aesthetic guidelines for the Payment Gateway Merchant Dashboard. The design language is **Functional Web Brutalism** (inspired by technical financial infrastructure, terminal utilities, Bloomberg terminals, Stripe CLI, and robust fintech engineering).

---

## Design Direction & Core Attributes

### 1. Visual Philosophy
- **Technical & Financial Infrastructure Aesthetic**: Evoke high-reliability engineering, precision, and institutional stability.
- **Rectangular Geometry**: Sharp, crisp rectangular UI elements (`border-radius: 0` or minimal `2px`). No bubbly cards or round pill buttons.
- **Visible, Crisp Borders**: Explicit 1px or 2px solid borders (`border border-zinc-300 dark:border-zinc-800` or `border-black`). Bounding boxes define layouts clearly.
- **High Contrast**: Stark, legible contrast ratios. Pure deep blacks, stark crisp whites, and sharp slate backgrounds.
- **Strong Typography**: Bold sans-serif or grotesque headings paired with clean monospaced fonts (`font-mono`) for technical data, hashes, references, and amounts.
- **Functional Information Density**: High-utility layouts that maximize screen real estate for financial operators without feeling cluttered.
- **Deliberate Spacing & Alignment**: Rigid grid alignment where lines connect and elements snap to an unyielding structural grid.
- **Intentional Asymmetry**: Asymmetry is permitted only when it serves an ergonomic purpose (e.g., highlighting an active transaction or discrepancy).

---

## What to Strictly Avoid

The following patterns dilute technical integrity and are **forbidden**:
- ❌ **Excessive rounded corners**: No large `rounded-2xl` or `rounded-3xl` cards.
- ❌ **Pill-shaped UI**: No fully rounded pill badges or pill action buttons.
- ❌ **Excessive / diffuse shadows**: No multi-layered blurry drop shadows (`shadow-2xl`). Prefer flat borders or hard-edge brutalist offset drop shadows (`box-shadow: 2px 2px 0px #000`).
- ❌ **Decorative gradients**: No purple/blue/pink mesh gradients or gradient borders.
- ❌ **Glassmorphism**: No `backdrop-blur`, frosted-glass panels, or translucent layers.
- ❌ **Floating blobs & organic shapes**: No decorative SVG squiggles, floating background circles, or wavy dividers.
- ❌ **Meaningless illustrations**: No cartoon 3D hands, isometric vectors, or decorative stock doodles.
- ❌ **Generic SaaS aesthetics**: Avoid looking like a generic template from a component marketplace.

---

## Usability & Professionalism Invariant

> **IMPORTANT**: Web Brutalism does NOT mean making the interface ugly, amateurish, or unusable.

The dashboard interface must remain:
1. **Professional**: Serious, institutional, and dependable.
2. **Readable**: Exceptional typography legibility and WCAG AA contrast.
3. **Accessible**: Flawless keyboard focus rings, screen-reader semantic hierarchy, and explicit interactive affordance.
4. **Consistent**: Uniform border widths, font sizing, and spacing rules across all dashboard views.
5. **Responsive**: Flawlessly adapts from narrow mobile screens to ultrawide monitoring displays.
6. **Purposeful**: Every single border, line, color badge, and container must have a clear functional justification.
