# Gesture guide (Motion / Framer Motion)

**Note:** The upstream [claudedesignskills motion-framer skill](https://github.com/freshtechbro/claudedesignskills/tree/main/.claude/skills/motion-framer) only ships `api_reference.md` in `references/`. This file is a **concise companion** for pointer, keyboard, drag, and in-view gestures. See also `SKILL.md` and `api_reference.md`.

## Declarative gesture props

| Prop | When it runs |
|------|----------------|
| `whileHover` | Pointer is over the element (desktop / trackpad). |
| `whileTap` | Primary button pressed (mouse) or touch active. |
| `whileFocus` | Element has focus (keyboard / a11y). |
| `whileDrag` | `drag` is enabled and user is dragging. |
| `whileInView` | Intersection with viewport (scroll-driven). |

Each accepts a target object **or** a variant name string if `variants` is defined.

## Imperative gesture events

- **Hover:** `onHoverStart`, `onHoverEnd`
- **Tap:** `onTap`, `onTapStart`, `onTapCancel` (cancel when the pointer leaves before release)
- **Drag:** `onDragStart`, `onDrag`, `onDragEnd`
- **Viewport:** `onViewportEnter`, `onViewportLeave`

`info` / event payloads include `point`, `offset`, and `velocity` for drag/tap where applicable (`SKILL.md` tables).

## Drag checklist

```tsx
<motion.div
  drag
  dragConstraints={{ left: 0, right: 300 }} // or ref to parent
  dragElastic={0.12}
  dragMomentum={false}
  whileDrag={{ scale: 1.02, cursor: "grabbing" }}
/>
```

- Axis lock: `drag="x"` | `drag="y"`.
- **Parent bounds:** put `ref` on the container, pass `dragConstraints={ref}`.
- **Snap back:** `dragSnapToOrigin` for rubber-band return.

## Tap vs click

- `whileTap` / `onTap*` are pointer-centric and work well for **motion** feedback.
- Still use `type="button"` and normal `onClick` for form semantics when needed; combine both if required.

## Hover + nested content

Parent can drive child states with shared variant labels:

```tsx
<motion.article variants={card} initial="rest" whileHover="hover">
  <motion.h2 variants={heading}>Title</motion.h2>
</motion.article>
```

Use `variants` on descendants so `hover` propagates predictably.

## `whileInView` / viewport

```tsx
<motion.section
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.35, margin: "0px 0px -80px 0px" }}
/>
```

- `once` avoids replay on scroll back.
- `amount` is fraction visible (`0`–`1`) or `"some"` / `"all"`.

## Accessibility: reduced motion

```tsx
import { useReducedMotion } from "framer-motion"

const reduce = useReducedMotion()

<motion.div
  animate={{ x: 40 }}
  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320 }}
/>
```

Prefer shortening duration and removing large parallax for `prefers-reduced-motion`.

## Performance notes

- Favor **transform** and **opacity** in gesture targets.
- Heavy `whileHover` filters (big `boxShadow`, `filter`) can be costly; keep short durations or simplify off-hover.

## See also

- `api_reference.md` — full prop list for gestures and drag.
- `SKILL.md` — worked examples (drag constraints, tap + hover combos, scroll lists).
