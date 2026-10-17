---
name: erix-ui
description: >
  Design and build UI for ERIX and ECODrIx products and client sites: ERIX
  dashboard screens (CRM, Connect, Flow), vertical apps for clinics and real
  estate, landing pages, pricing sections, onboarding, forms, and components
  in Next.js 15 + Tailwind + shadcn/ui. Makes it look human-designed, not
  AI-template, and fit Indian SMB users (mobile-first, low-end Android, Indian
  formats, multilingual). Use whenever the user asks to design, build,
  restyle, or review any ECODrIx/ERIX screen, page, or component.
---

# erix-ui

Design lead at a studio known for distinct, crafted interfaces. Every choice specific to the brief and its users.

## 0. Ground it in the users

Name before designing: who uses this screen, on what device, doing what job, under what pressure.
- Clinic front desk: shared desktop, rushed, phone in other hand. Fast lookup, big targets, no clutter.
- Real estate broker: phone, outdoors, patchy 4G. Thumb reach, offline-tolerant, WhatsApp handoff.
- SMB owner (ERIX admin): checks numbers at night on phone. Clear money, clear next action.

Use ERIX design tokens if they exist in the repo (`tailwind.config`, `globals.css`, design-system package). Never invent a parallel token set.

## 1. Plan pass (before code)

Write a compact plan:
- Palette: 4-6 named hex values, each with a job.
- Type: 1-2 families, roles, scale. Must render Devanagari/Tamil/Telugu if UI is multilingual (e.g. Noto Sans family fallbacks).
- Layout: one-line concept + ASCII wireframe for mobile and desktop.
- Spacing scale: one scale (4/8 based), named, applied consistently.
- The one memorable element.

Then review the plan: does any part look like the default you'd produce for any SaaS? Revise it and say what changed.

## 2. Avoid AI-template tells

- Same rounded card + same soft grey shadow on everything. Vary radius and elevation by hierarchy.
- Gradient washes as decoration. Default Tailwind indigo/violet as brand.
- Cream bg + serif + terracotta; black bg + acid-green accent.
- ALL-CAPS eyebrow above every heading. One italic/colored word in a headline. `→` appended to every link. "A · B · C" meta strings.
- Numbered 01/02/03 markers on content that is not a sequence.
- Fade-up animation on every section; hover lift on every card.
- Big number + small label + gradient as the automatic hero.

## 3. Craft details (where "human-designed" comes from)

- **Spacing:** deliberate rhythm; more space between groups than within. Section padding scales with viewport (`clamp`).
- **Widths:** body text 45-75 characters. Forms max ~480 px. Tables can go wide, inside their own scroll container.
- **Elevation:** 2-3 shadow levels, layered (ambient + key), tinted to the surface color. Flat where nothing floats.
- **Cards:** only when content is a discrete object. Header/body/footer alignment, consistent internal padding, real content density.
- **Type:** clear hierarchy by size and weight, not color alone. Tabular numbers for money and tables (`font-variant-numeric: tabular-nums`).
- **States:** design empty, loading (skeletons matching layout), error, success, offline, permission-denied for every screen.
- **Motion:** only in response to user action, short (150-250 ms), respects `prefers-reduced-motion`.

## 4. India-ready by default

- Money: `₹1,50,000` via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`. Lakh/crore wording where users expect it.
- Dates: `17 Oct 2026` or `dd/mm/yyyy`. Never mm/dd. Times in IST unless user's zone known.
- Phone: `+91 98765 43210` display, E.164 storage, numeric keypad (`inputMode="tel"`), accept pasted spaces/dashes.
- Names/addresses: single "Full name" field, no forced first/last. PIN code 6 digits auto-fills city/state when possible.
- Payments: UPI first, then cards/netbanking.
- WhatsApp as primary contact action where relevant.
- Performance: test on a low-end Android profile. Ship small JS; lazy-load heavy charts; images in AVIF/WebP with sizes.

## 5. Copy inside the UI

- Name things by what users do: "Follow up", not "Trigger workflow".
- Buttons say exactly what happens: "Send reminder", "Save lead". Same verb through the flow ("Publish" → "Published").
- Errors: what happened + how to fix, no apology, no vagueness.
- Empty states invite the first action.
- Plain words. Short. Sentence case.

## 6. Build rules (ECODrIx stack)

- Next.js 15 App Router, Tailwind, shadcn/ui as base primitives, restyled to our tokens (don't ship stock shadcn look).
- Data only via `@ecodrix/erix-api` + TanStack Query. No raw fetch to our backend.
- Accessibility floor: keyboard reachable, visible focus, labels on inputs, contrast AA, touch targets ≥ 44 px, `lang` set per locale.
- Avoid CSS specificity fights: one spacing system, utility-first, no competing section/element selectors.
- For modern CSS/HTML APIs, consult the `modern-web-guidance` skill when available.

## 7. Critique pass

Screenshot at 360 px and 1280 px (Playwright or browser). Check: hierarchy readable in 3 seconds? One memorable element? Anything decorative that serves nothing? Remove one accessory.

---
Adapted from anthropics/skills `frontend-design` (Apache-2.0) for ERIX / ECODrIx.
