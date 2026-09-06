---
name: anti-ai-slop
description: "Actively reject generic AI-generated frontend slop, cliched SaaS templates, meaningless decorations, fake metrics, purple/blue gradients, floating blobs, and unearned UI elements in favor of purposeful, problem-solving UI."
---

# Skill: Anti AI Slop

## Purpose
Prevent coding agents and designers from producing generic, clichéd, AI-generated frontend aesthetics ("AI-Slop"). This skill actively forces all UI generation to be purpose-driven, restrained, and grounded in real engineering requirements.

---

## Prohibited AI-Slop Patterns

When implementing frontend components, **NEVER** automatically generate or include:

1. **Purple/Blue SaaS Gradients**: No generic linear/radial gradients on headers, buttons, cards, or hero banners.
2. **Gradient Text**: No `bg-clip-text text-transparent bg-gradient-to-r...` text effects.
3. **Glassmorphism**: No frosted glass cards, semi-transparent overlays, or blurred backgrounds.
4. **Excessive Floating Cards**: No cards with giant diffuse drop shadows floating aimlessly over background colors.
5. **Giant Hero Sections**: No massive marketing-style hero banners on internal merchant dashboard pages.
6. **Meaningless Illustrations & Blobs**: No decorative 3D clay graphics, floating vector shapes, cartoon people, or animated blobs.
7. **Excessive Emojis**: No emojis in system labels, navigation links, table headers, or error messages (e.g., `🚀 Dashboard`, `💸 Payments`). Use concise professional text.
8. **Random / Meaningless Icons**: Do not slap icons next to every single piece of text unless it provides unambiguous cognitive value.
9. **Rainbow Status Badges & Pills**: Do not invent ten different neon-colored badges for basic states.
10. **Fake / Hardcoded Charts**: Never render dummy canvas charts or SVG graphs with hardcoded mock curves that do not reflect real backend timeseries data.
11. **Fake Statistics & Vanity Metrics**: No placeholder "99.9% Uptime", "10,000+ Happy Customers", or fabricated activity tickers.
12. **Arbitrary Animations**: No bouncy entry animations, continuous pulsing cards, or jarring hover scaling (`hover:scale-105`) that distracts financial operators.
13. **Generic SaaS Copy**: No "Welcome back, chief!", "Good morning, sunshine!", or generic startup marketing jargon.
14. **Meaningless Visual Decoration**: Do not add dividers, stars, sparkle icons, or abstract borders merely to "fill whitespace".

---

## The Core Gatekeeper Test

Before adding ANY visual element, widget, or layout component, ask:

> **"What specific user or financial problem does this solve?"**

- If the answer is vague (e.g., *"it makes the page look modern"*, *"it fills the empty space"*, *"it looks cooler"*), **DO NOT ADD IT**.
- If the answer is functional (e.g., *"it lets the merchant filter payments by status and date"*, *"it displays the negative net settlement balance that needs clearing"*), **BUILD IT WITH MAXIMUM CLARITY**.

---

## What to Prefer Instead

- **Intentional Typography**: Establish clear hierarchy using scale, weight, and font family rather than colors and boxes.
- **Clear Information Hierarchy**: The most important information (status, amount, ID, error reason) must be immediately visible.
- **Meaningful Spacing & Alignment**: Clean tabular grids and strict margins.
- **Functional Density**: Display dense financial data efficiently without requiring endless vertical scrolling.
- **Real Data Only**: Display what the backend returns. If an endpoint returns 0 items, render a functional empty state, not fake placeholder data.
- **Predictable Interaction**: Standard HTML form controls, clear focus states, and instant responses.
- **Restrained Decoration**: Let content, numbers, and status indicators carry the visual weight.
