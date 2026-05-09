# Variant patterns (Motion / Framer Motion)

**Note:** The upstream [claudedesignskills motion-framer skill](https://github.com/freshtechbro/claudedesignskills/tree/main/.claude/skills/motion-framer) only ships `api_reference.md` in `references/`. This file is a **concise companion** maintained in-repo so agents can jump straight to orchestration patterns. See also `SKILL.md` and `api_reference.md`.

## Why variants

- Name states (`hidden`, `visible`, `exit`) instead of duplicating `animate` objects everywhere.
- **Propagation:** children with their own `variants` respond when the parent runs `initial` / `animate` / `exit` if they share variant keys.

## Minimal pattern

```tsx
const box = {
  rest: { scale: 1, opacity: 1 },
  hover: { scale: 1.05 },
  tap: { scale: 0.98 },
}

<motion.button
  variants={box}
  initial="rest"
  whileHover="hover"
  whileTap="tap"
/>
```

## Container + children (stagger)

```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map((id) => (
    <motion.li key={id} variants={item} />
  ))}
</motion.ul>
```

## Exit orchestration with `AnimatePresence`

- Wrap conditional trees in `<AnimatePresence mode="wait" | "sync" | "popLayout">` when using `exit` on children.
- Each list item **must** have a stable `key`.
- Parent can use `exit` with `when: "afterChildren"` and `staggerDirection: -1` for reverse stagger on leave (see `SKILL.md`).

## `transition` inside variants

Per-state transitions:

```tsx
const v = {
  hidden: { opacity: 0, transition: { duration: 0.2 } },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}
```

Per-property transitions inside `animate` targets still work; gesture props (`whileHover`) can embed their own `transition` for press/hover lifecycles.

## Orchestration keywords (`when`)

Inside a variant’s `transition`:

- `when: "beforeChildren"` — run parent first, then children.
- `when: "afterChildren"` — useful for coordinated exits.

Combine with `staggerChildren` / `delayChildren` for menus, step reveals, and route-level groups.

## Layout + variants

- `layout` on list rows works well with `AnimatePresence` for FLIP-style reordering.
- Prefer **transform** targets (`x`, `y`, `scale`) inside variants for GPU-friendly motion; avoid animating `width`/`top` unless necessary.

## Pitfalls

1. **Child without `variants`** — it will not stagger; add `variants={item}` (can reuse the same object).
2. **String `animate` without matching keys** — child keys must exist on the parent’s variant object or use `custom` prop for dynamic variants.
3. **Duplicate transition config** — gesture end uses root `transition`; put fast transitions **inside** `whileTap` / `whileHover` when they should differ from `animate`.

## See also

- `api_reference.md` — `Variants` type and `transition` shapes.
- `SKILL.md` — full examples, springs, layoutId, scroll triggers.
