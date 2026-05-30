---
name: fintr-dark-mode
description: >-
Fintr dashboard and authenticated UI use **dark mode**. Marketing pages (`/`, `/pricing`, etc.) stay **light** — see `theme-routes.ts`. When building or styling dashboard UI in apps/fintr-fe, apply dark tokens. Use when creating new features, pages, forms, modals, lists, cards, inputs, buttons, charts, or any frontend work in the Fintr app; when the user mentions dark mode, theme colors, or dashboard styling; or when replacing bg-white, bg-gray-50, or border-gray-* utilities. Do not apply dark-mode overrides to marketing/landing page components unless explicitly requested.
---

# Fintr dark mode (frontend)

Fintr authenticated UI is **dark-first**. Marketing pages force **light** theme. Before writing or reviewing dashboard UI in `apps/fintr-fe`, read [DARK_MODE.md](../../../apps/fintr-fe/docs/DARK_MODE.md) and follow it. Skip dark-mode changes on landing-page components.

## Quick rules

1. **Tokens over hex** — `bg-background`, `bg-card`, `bg-muted`, `bg-input/30`, `text-foreground`, `text-muted-foreground`, `text-primary-dark-mode`, `border-border`.
2. **Form controls** — borderless in dark: `dark:border-0 dark:bg-input/30 dark:shadow-none`. Reuse shared components (`Input`, `Select`, `comboboxInputClassName`, `ExpandableTextarea`, `NotesAutocomplete`).
3. **Surface hierarchy** — page `background` → section `card` → nested `muted` → fields `input/30`. Stat tiles inside cards use `dark:bg-background` (`statTileSurfaceClassName`).
4. **Interactive blue text** — `dark:text-primary-dark-mode` on dark surfaces (not navy `primary`).
5. **Money semantics** — income `dark:text-teal-500`, expense `dark:text-red-700`; see doc for chip backgrounds.
6. **No light leaks** — never ship `bg-white`, `bg-gray-50`, or `border-gray-200` in dashboard code without a `dark:` counterpart.

## Reuse before inventing

| Need | Import from |
| --- | --- |
| Combobox trigger styling | `comboboxInputClassName` → `@/components/ui/combobox` |
| Summary / budget stat tile | `statTileSurfaceClassName` → `@/components/dashboard/insights/summary-stat-tile` |
| Grid picker tiles | constants in `@/components/dashboard/forms/GridPicker` |
| Logo on dark | `<FintrLogo />` → `@/components/brand/fintr-logo` |

## Workflow for new UI

1. Read [DARK_MODE.md](../../../apps/fintr-fe/docs/DARK_MODE.md) — especially **Surface hierarchy** and **Component patterns**.
2. Match the closest existing component (grep `dark:bg-` in the same tab or form).
3. Prefer extending shared UI primitives over one-off classes.
4. If you introduce a repeated class string (3+ uses), extract a named constant next to the feature or in the shared component file.
5. After implementation, grep changed files for `bg-white`, `bg-gray-`, `border-gray-` without paired `dark:` classes.

## Native sync

If you change `--background`, `--card`, or `--primary` in `globals.css`, update `apps/fintr-fe/src/lib/theme-colors.ts` for Capacitor status bar / splash.

## Full reference

Element-by-element mapping, token hex table, and anti-patterns: [apps/fintr-fe/docs/DARK_MODE.md](../../../apps/fintr-fe/docs/DARK_MODE.md)
