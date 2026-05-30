# Fintr Frontend — Dark Mode Design Reference

Fintr dashboard and authenticated UI run in **dark mode by default** (`ThemeProvider` → `defaultTheme="dark"`, `html` has `class="dark"`). New UI should be designed for dark first; keep light-mode classes only where public/marketing pages still need them.

**Source of truth for tokens:** `apps/fintr-fe/src/app/globals.css` (`.dark` block)  
**Native shell hex (Capacitor):** `apps/fintr-fe/src/lib/theme-colors.ts` — keep in sync with CSS vars.

---

## Core palette (dark)

| Token | Hex (approx.) | OKLCH (CSS) | Use for |
| --- | --- | --- | --- |
| `background` | `#151921` | `oklch(0.129 0.042 264.695)` | Page shell, body, inset stat tiles, deepest surfaces |
| `card` | `#1e2433` | `oklch(0.208 0.042 265.755)` | Cards, modals, list rows, header secondary buttons, search fields |
| `muted` | `#3a4150`* | `oklch(0.279 0.041 260.031)` | Nested panels, grid picker tiles, switch rows, inline forms, hover targets |
| `input` (15% white) | translucent lift | `oklch(1 0 0 / 15%)` | Text fields, selects, comboboxes, picker triggers (`bg-input/30`) |
| `foreground` | near white | `oklch(0.984 …)` | Primary body text |
| `muted-foreground` | gray-blue | `oklch(0.704 …)` | Labels, placeholders, secondary copy |
| `primary` | `#0A3D62` | `oklch(34.88% 0.082 246.06)` | Brand navy — buttons, active nav (light contexts) |
| `primary-dark-mode` | light blue | `oklch(0.93 0.03 246.06)` | **Readable blue text/icons on dark** — links, grid labels, nav accents |
| `primary-foreground` | white | — | Text on filled primary buttons |
| `accent` | same as muted | — | Hover fills on list rows, grid tiles, ghost controls |
| `border` | 10% white | `oklch(1 0 0 / 10%)` | Dividers, fieldsets, dashed upload borders (when border is kept) |
| `destructive` | `#f986a3` | — | Delete / error emphasis |
| `ring` | muted blue-gray | — | Focus rings |

\*Muted hex is illustrative; prefer Tailwind semantic classes over hardcoded hex except where noted below.

### Semantic money colors (dark)

| Meaning | Text | Background chips |
| --- | --- | --- |
| Income / positive | `text-teal-600 dark:text-teal-500` | `dark:bg-teal-950/40` |
| Expense / negative | `text-red-900 dark:text-red-700` | `dark:bg-red-950/40` |
| Transfer | `text-blue-900 dark:text-blue-400` | `dark:bg-blue-950/40` |
| Neutral metric | `text-primary dark:text-primary-dark-mode` | — |

Helpers: `getProgressColor()` in `src/lib/utils.ts`.

---

## Surface hierarchy

Darkest → lightest (for layering):

```
background  →  card  →  muted  →  input/30  →  accent (hover)
```

| Layer | Typical elements |
| --- | --- |
| `bg-background` | App canvas, stat tiles inside `bg-card` cards |
| `bg-card` | `Card`, modal panels, transaction rows, tabs list, bottom nav |
| `bg-muted` | Grid picker cells, account-creation inline form, switch rows, skeleton placeholders |
| `bg-input/30` | Inputs, selects, comboboxes, GridPicker trigger, inactive toggle pills |
| `hover:bg-accent/50` or `hover:bg-input/50` | List row hover, picker hover, upload drop zone |

**Rule:** A child surface should be **one step** lighter or darker than its parent — never the same as parent unless intentional flat layout.

---

## Component patterns

### Text inputs (`Input`, `Select`, `ComboBox`, textareas)

Shared dark treatment:

```tsx
dark:border-0 dark:bg-input/30 dark:shadow-none
dark:focus-visible:border-transparent  // Input, Select, ExpandableTextarea, NotesAutocomplete
```

| Component | File | Notes |
| --- | --- | --- |
| `Input` | `src/components/ui/input.tsx` | Base pattern |
| `SelectTrigger` | `src/components/ui/select.tsx` | + `dark:hover:bg-input/50` |
| `ComboBox` | `src/components/ui/combobox.tsx` | Use exported `comboboxInputClassName` (`px-4 py-3`, `min-h-10`) |
| `CategoryFilterComboBox` | `src/components/ui/category-filter-combobox.tsx` | Imports `comboboxInputClassName` |
| `ExpandableTextarea` | `src/components/ui/expandable-textarea.tsx` | Transfer/loan descriptions |
| `NotesAutocomplete` | `src/components/ui/notes-autocomplete.tsx` | Expense/income notes |

Auth inputs add instance override: `border-0 shadow-none focus-visible:ring-1` (`unified-auth-page.tsx`).

### Buttons

| Variant / use | Dark classes |
| --- | --- |
| `outline` | `dark:border-0 dark:bg-input/30 dark:shadow-none dark:hover:bg-input/50` |
| `ghost` picker triggers | `bg-input/30 hover:bg-input/50` (GridPicker) |
| Header secondary (AI Chat, Add Receipt) | `bg-card text-primary hover:bg-primary hover:text-white` |
| Primary CTA | `bg-primary text-primary-foreground` (unchanged) |
| Inactive toggle pill | `dark:bg-input/30 dark:text-muted-foreground dark:border-0 dark:hover:bg-input/50` |
| Active toggle pill | `bg-primary text-primary-foreground border-primary` |

### Cards & summary tiles

| Element | Classes |
| --- | --- |
| Standard `Card` | `bg-card` (default from `card.tsx`) + often `border-0 shadow-sm` |
| Budget summary outer card | `budgetSummaryCardSurfaceClassName` → `dark:bg-card` |
| Stat tile (Total Income, budget totals) | `statTileSurfaceClassName` → `dark:bg-background` (inset on card) |
| Optional ring on stat tiles | `dark:ring-1 dark:ring-border/40` when extra separation needed |

Constants: `src/components/dashboard/insights/summary-stat-tile.tsx`.

### Grid picker (category / account modal)

Constants in `GridPicker.tsx`:

| State | Dark classes |
| --- | --- |
| Default tile | `dark:border-0 dark:bg-muted dark:text-primary-dark-mode dark:hover:bg-accent` |
| Selected | `bg-primary text-primary-foreground dark:border-0` |
| Add new (dashed) | Same as default tile |
| Modal shell | `dark:bg-card` (`GridPickerModalShell`) |
| Trigger button | `variant="ghost"` + `bg-input/30 hover:bg-input/50` |

### Forms & misc

| Element | Dark classes |
| --- | --- |
| Inline creation form shell | `dark:border-0 dark:bg-muted` |
| Switch row (update balance) | `dark:border-0 dark:bg-muted` |
| File upload drop zone | `dark:border-border dark:hover:bg-muted/50`, muted icon/text |
| Transaction list row | `dark:bg-card dark:hover:bg-accent/50` |
| Search field | `dark:bg-card border-0` |
| Tab lists (add transaction) | `dark:bg-card dark:shadow-sm` |
| Links / emphasis text | `dark:text-primary-dark-mode` |

### Logo

| Context | Asset / component |
| --- | --- |
| Dark UI (nav, auth) | `<FintrLogo />` → `FINTR_LOGO_DARK_SRC` |
| Bootstrap / loading screens | `<LoadingFintrLogo />` — always white transparent SVG |
| Light/marketing | Remote PNG (`FINTR_LOGO_LIGHT_SRC`) |

---

## CSS utilities

`globals.css` remaps primary text on dark for readability:

- `.text-primary-dark-mode` → light blue token
- `.dark .text-primary` → same light blue (automatic remap)
- `.dark .text-primary/70`, `/80`, etc. → mixed from `primary-dark-mode`

Prefer `text-primary-dark-mode` explicitly for labels on `bg-muted` / `bg-card` when you need the light blue without relying on the global remap.

---

## Anti-patterns (avoid in dashboard UI)

| Avoid | Use instead |
| --- | --- |
| `bg-white` without `dark:bg-card` | `bg-card` or shared constant |
| `bg-gray-50`, `bg-[#f9f7f5]` without dark variant | `dark:bg-muted` or `dark:bg-background` |
| `border-gray-200` alone on dark | `dark:border-0` or `dark:border-border` |
| `text-gray-700` on dark | `text-foreground` or `text-muted-foreground` |
| `hover:bg-gray-50` on dark | `dark:hover:bg-muted/50` or `dark:hover:bg-accent` |
| Hardcoded light-only shadows | `dark:shadow-none` on flat inputs |
| Duplicating combobox classes | Import `comboboxInputClassName` |

Light-mode marketing pages (`landing-page/*`, public routes) may keep cream `#f9f7f5` — do not copy those patterns into dashboard forms.

---

## Checklist for new features

1. Use semantic tokens (`bg-card`, `text-muted-foreground`, etc.) — not raw grays.
2. Form controls: borderless dark + `bg-input/30`.
3. Nested content: step surface hierarchy (card → muted → input).
4. Interactive text on dark: `text-primary-dark-mode`.
5. Money values: teal / red semantic pair from table above.
6. Export repeated class strings as named constants (see `summary-stat-tile`, `GridPicker`, `combobox`).
7. If touching native chrome, update `theme-colors.ts` when `background` / `primary` / `card` change.

---

## Related files

| File | Purpose |
| --- | --- |
| `src/app/globals.css` | CSS variable definitions |
| `src/lib/theme-colors.ts` | Native Android/iOS hex |
| `src/components/theme-provider.tsx` | Theme wiring |
| `src/components/brand/fintr-logo.tsx` | Logo sources |
| `.ai/skills/fintr-dark-mode/SKILL.md` | Agent skill — read before new frontend UI |
