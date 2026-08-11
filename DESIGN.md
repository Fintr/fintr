---
name: Fintr
description: Save more. Spend smarter. Afford the life you want.
colors:
  primary: "oklch(34.88% 0.082 246.06)"
  primary-dark-mode: "oklch(0.93 0.03 246.06)"
  primary-foreground: "oklch(0.984 0.003 247.858)"
  marketing-navy: "#0A2540"
  marketing-teal: "#0D9488"
  marketing-cream: "#FAF9F7"
  background: "oklch(98.2% 0.004 91.45)"
  background-dark: "oklch(0.129 0.042 264.695)"
  foreground: "oklch(0.129 0.042 264.695)"
  foreground-dark: "oklch(0.984 0.003 247.858)"
  card: "oklch(1 0 0)"
  card-dark: "oklch(0.208 0.042 265.755)"
  muted: "oklch(0.968 0.007 247.896)"
  muted-dark: "oklch(0.279 0.041 260.031)"
  muted-foreground: "oklch(0.554 0.046 257.417)"
  muted-foreground-dark: "oklch(0.704 0.04 256.788)"
  border: "oklch(0.929 0.013 255.508)"
  border-dark: "oklch(1 0 0 / 10%)"
  input-fill: "oklch(1 0 0 / 15%)"
  destructive: "oklch(39.6% 0.141 25.723)"
  destructive-dark: "#f986a3"
  income: "#0D9488"
  expense: "#991B1B"
typography:
  display:
    fontFamily: "League Spartan, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(40px, 5.5vw, 64px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-1.5px"
  headline:
    fontFamily: "League Spartan, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(32px, 4vw, 44px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-1px"
  title:
    fontFamily: "League Spartan, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "League Spartan, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "League Spartan, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.09375em"
rounded:
  sm: "calc(0.625rem - 4px)"
  md: "calc(0.625rem - 2px)"
  lg: "0.625rem"
  xl: "calc(0.625rem + 4px)"
  card: "0.75rem"
  pill: "9999px"
spacing:
  form-control-height: "2.5rem"
  form-control-padding-x: "0.75rem"
  form-control-padding-y: "0.5rem"
  card-padding: "1.5rem"
  section-y: "2.5rem"
  section-y-md: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  button-outline:
    backgroundColor: "{colors.input-fill}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  button-outline-hover:
    backgroundColor: "{colors.muted-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  input-default:
    backgroundColor: "{colors.input-fill}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.lg}"
    padding: "{spacing.form-control-padding-y} {spacing.form-control-padding-x}"
    height: "{spacing.form-control-height}"
  card-default:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
---

# Design System: Fintr

## Overview

**Creative North Star: "The Trusted Coach"**

Fintr should feel like a capable money coach — confident and modern without the cold sterility of a bank. The interface earns trust through clarity: readable numbers, calm surfaces, and semantic color that tells you what matters at a glance. AI-forward energy shows up in precise accents and purposeful emphasis, not flashy decoration.

The product operates in **two documented visual worlds**. The **marketing world** is warm, light, and editorial — cream backgrounds, deep navy headlines, teal proof points. The **dashboard world** defaults to dark mode with tonal layering: background → card → muted → input fill. Both worlds share League Spartan typography and the navy primary brand, but they must not bleed patterns into each other.

**Key Characteristics:**

- Tonal flat depth — hierarchy through surface color, not shadows
- Semantic money colors (teal income, red expense, blue transfer)
- Borderless dark form controls with translucent input fills
- Primary blue for prominent headers and CTAs (`text-primary` on light; `text-primary-dark-mode` on dark)
- Mobile-first with native safe-area handling (Capacitor)
- Radix + Shadcn component primitives with Fintr-specific surface constants

## Colors

A navy-forward fintech palette with teal as the marketing accent and light-blue readability remapping on dark surfaces.

### Primary

- **Deep Navy Brand** (`oklch(34.88% 0.082 246.06)` / `#0A3D62`): Filled primary buttons, active nav pills, selected grid tiles, marketing CTA fills (`#0A2540` on landing pages — same family, slightly deeper for editorial contrast).
- **Readable Blue** (`oklch(0.93 0.03 246.06)`): Links, labels, icons, and emphasis text on dark backgrounds. Automatically remapped when using `text-primary` inside `.dark`.

### Secondary

- **Signal Teal** (`#0D9488`): Marketing eyebrow labels, proof-point dots, hero accents, income/positive money values. Not the dashboard primary — use sparingly as an accent in app UI.

### Neutral

- **Warm Cream** (`#FAF9F7` / `oklch(98.2% 0.004 91.45)`): Marketing page canvas, light-mode app background.
- **Midnight Shell** (`oklch(0.129 0.042 264.695)` / `#151921`): Dark dashboard page background, inset stat tiles.
- **Elevated Card** (`oklch(0.208 0.042 265.755)` / `#1e2433`): Cards, modals, list rows, search fields on dark.
- **Nested Muted** (`oklch(0.279 0.041 260.031)`): Grid picker tiles, switch rows, inline forms, skeleton placeholders.
- **Translucent Input Fill** (`oklch(1 0 0 / 15%)`): Borderless inputs, selects, comboboxes, ghost triggers on dark.
- **Muted Text** (`oklch(0.704 0.04 256.788)` on dark): Labels, placeholders, secondary copy.
- **Hairline Border** (`oklch(1 0 0 / 10%)` on dark): Dividers when borders are kept; many dark controls omit borders entirely.

### Named Rules

**The Surface Step Rule.** A child surface must be exactly one step lighter or darker than its parent in the hierarchy (`background` → `card` → `muted` → `input/30`). Never place the same surface token on parent and child unless the layout is intentionally flat.

**The Dual World Rule.** Marketing cream/teal patterns stay in `landing-page/*` and public routes. Dashboard forms never inherit hardcoded `#FAF9F7`, `bg-white`, or `text-gray-*` without dark semantic equivalents.

**The Readable Blue Rule.** On any dark surface, interactive text and icons use `text-primary-dark-mode` (or rely on the `.dark .text-primary` remap). Never place deep navy primary text on dark backgrounds.

## Typography

**Display Font:** League Spartan (Google Fonts, `--font-league-spartan`)
**Body Font:** League Spartan (same family throughout app)
**Accent Font:** Garet (CDN, `.font-garet` utility — available but secondary to League Spartan)

**Character:** Geometric, confident sans-serif with tight display tracking. Marketing headlines are bold and editorial; dashboard copy is compact and scannable at 14px body.

### Hierarchy

- **Display** (700, `clamp(40px, 5.5vw, 64px)`, 1.08): Marketing hero headlines only. Use `.font-landing-title`.
- **Headline** (700, `clamp(32px, 4vw, 44px)`, 1.12): Marketing section titles, major page headers.
- **Title** (600, 18px, 1.25): Card titles, modal headers, prominent section labels. Use `text-primary` on light backgrounds; `text-primary` remaps on dark.
- **Body** (400, 14px, 1.5): Default UI copy, form labels, transaction descriptions. Max ~65ch for long prose.
- **Label** (600, 13px, uppercase, 1.5px tracking): Marketing eyebrows ("AI-POWERED PERSONAL FINANCE ASSISTANT"), filter chips, category tags.

### Named Rules

**The Primary Header Rule.** Prominent headers that introduce a page section, modal, sheet, or card region use `text-primary` (not black, `text-gray-900`, or bare default heading color). Destructive/warning titles excepted.

**The Landing Title Rule.** Marketing display type uses `.font-landing-title` with negative letter-spacing. Dashboard UI uses default League Spartan without the landing tracking values.

## Layout

**Grid model:** Marketing pages use a centered `max-w-[1200px]` container with `px-6 sm:px-10 lg:px-12`. Dashboard uses full-width mobile shell with bottom navigation and drawer on larger breakpoints.

**Density:** Dashboard is compact — 40px (`h-10`) form controls, tight list rows, minimal vertical padding between transaction groups. Marketing is airy — `landing-section-y` (`py-10 md:py-12`) between sections.

**Responsive:** Mobile-first. Bottom nav and safe-area padding (`pt-safe-top`, `pb-safe-bottom`) on native. Inputs use `font-size: 16px` on mobile to prevent iOS zoom. `100dvh` for fullscreen mobile layouts.

**Spacing rhythm:** 4px base grid via Tailwind. Cards use `gap-6` internal spacing, `px-2 sm:px-6` horizontal padding. Form fields share `px-3 py-2` via `formControlPaddingClassName`.

## Elevation & Depth

Fintr uses **tonal layering, not shadow depth**, on the dashboard. Surfaces differentiate through background token steps. Cards carry `shadow-sm` in the component default but dark-mode inputs explicitly use `dark:shadow-none`. Marketing pages use subtle border hover states rather than lift.

### Shadow Vocabulary

- **Card rest** (`shadow-sm`): Light elevation on `Card` component in light contexts only.
- **Input focus** (`ring-[3px] ring-ring/50`): Focus rings replace shadows for interactive affordance on dark.
- **Toast** (180ms transition): Sonner toasts use short transitions, not dramatic elevation.

### Named Rules

**The Flat-By-Default Rule.** Dark form controls are borderless with translucent fills. Shadows do not communicate depth on dashboard surfaces — surface tokens do.

## Shapes

**Corner radius:** Base `--radius: 0.625rem` (10px). Cards use `rounded-xl` (12px). Buttons and inputs use `rounded-md` (~8px). Marketing CTAs use `rounded-[10px]` or `rounded-lg`. Badges and toggle pills use `rounded-full`.

**Borders:** Light mode uses `border` token on cards. Dark mode form controls drop borders (`dark:border-0`) in favor of fill contrast. Marketing uses warm stone borders (`#E8E6E3`, `#D6D3D1`).

**Form language:** Single-line controls are 40px tall (`h-10 min-h-10`). Grid picker tiles are square-ish with muted fills. Toggle pills switch between `bg-input/30` (inactive) and `bg-primary` (active).

## Components

### Buttons

- **Shape:** Gently rounded (10px / `rounded-md`), 40px default height
- **Primary:** Navy fill (`bg-primary text-primary-foreground`), subtle `shadow-xs`, hover at 90% opacity
- **Outline:** Borderless muted fill on dark (`formControlFillClassName` — `bg-input/30`, hover `bg-input/50`)
- **Ghost:** Transparent with `hover:bg-accent/50` on dark
- **Destructive:** Red fill; dark mode uses `dark:bg-red-800`
- **Header secondary (dashboard):** `bg-card text-primary hover:bg-primary hover:text-white` — inverts on hover
- **Marketing CTA:** `bg-[#0A2540] text-white rounded-lg`, opacity hover

### Chips / Badges

- **Style:** `rounded-full`, `text-xs font-semibold`, `px-2.5 py-0.5`
- **Default:** Primary fill. **Secondary:** muted fill. **Outline:** border only.
- **Money chips:** Semantic backgrounds — `dark:bg-teal-950/40` (income), `dark:bg-red-950/40` (expense), `dark:bg-blue-950/40` (transfer)

### Cards / Containers

- **Corner Style:** `rounded-xl` (12px)
- **Background:** `bg-card` (semantic; `#1e2433` on dark)
- **Shadow Strategy:** `shadow-sm` at rest; prefer tonal inset (`dark:bg-background` stat tiles inside `bg-card` parents) for nested data
- **Border:** Default `border` token; often overridden to `border-0` on dashboard
- **Internal Padding:** `py-6`, content `px-2 sm:px-6`

### Inputs / Fields

- **Style:** Borderless on dark, `bg-input/30`, `rounded-md`, 40px height, 14px text
- **Focus:** `focus-visible:ring-[3px] ring-ring/50`, transparent border
- **Error:** `aria-invalid:ring-destructive/20` (light), `/40` (dark)
- **Shared constants:** Import from `form-control-surface.ts` — never duplicate combobox/input classes

### Navigation

- **Marketing nav:** Fixed top, cream background (`#FAF9F7`), stone border, navy CTA button
- **Dashboard:** Bottom mobile nav (`bg-card`), drawer on desktop, active state uses primary fill
- **Links on dark:** `text-primary-dark-mode`, underline on hover for `link` variant buttons

### Grid Picker (signature component)

Category/account selection modal with tiled grid. Default tile: `dark:bg-muted dark:text-primary-dark-mode`. Selected: `bg-primary text-primary-foreground`. Trigger: ghost button with `bg-input/30`. Modal shell: `dark:bg-card`.

## Do's and Don'ts

### Do:

- **Do** use semantic tokens (`bg-card`, `text-muted-foreground`, `bg-input/30`) instead of raw grays or `bg-white`.
- **Do** step surface hierarchy one level at a time on dark (`background` → `card` → `muted` → `input`).
- **Do** use `text-primary` for prominent section headers and `text-primary-dark-mode` for emphasis on dark surfaces.
- **Do** apply semantic money colors: teal for income, red for expense, blue for transfer.
- **Do** export repeated class strings as named constants (see `form-control-surface.ts`, `summary-stat-tile.tsx`, `GridPicker.tsx`).
- **Do** keep `theme-colors.ts` in sync when changing `background`, `primary`, or `card` tokens (native Capacitor chrome).
- **Do** use `font-size: 16px` minimum on mobile inputs to prevent iOS zoom.

### Don't:

- **Don't** use `bg-white`, `bg-gray-50`, or `text-gray-700` in dashboard UI without dark semantic equivalents.
- **Don't** copy marketing cream/stone patterns into authenticated dashboard forms.
- **Don't** place deep navy `text-primary` on dark backgrounds without the dark-mode remap.
- **Don't** duplicate combobox or input surface classes — import shared constants.
- **Don't** add shadows to dark form controls (`dark:shadow-none` is the default pattern).
- **Don't** use black or near-black (`text-gray-900`) for hero-style dashboard headers.
