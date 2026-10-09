# Hyperframes Composition Brief: Fintr

## Objective
Create a short launch-style brag video for Fintr.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20.5 seconds

## Source Material
- Project root: fintr monorepo
- Primary files read: `PRODUCT.md`, `DESIGN.md`, `apps/fintr-fe/src/components/landing-page/hero-section.tsx`, `features-section.tsx`, `how-to-use.tsx`
- Product name: Fintr
- Tagline / strongest claim: Save more. Spend smarter. Afford the life you want.
- Key UI or visual moment to recreate: receipt capture resolving into a categorized line, then a dark month view of in, out, and net
- Copy that must appear verbatim:
  - Save more. Spend smarter.
  - Afford the life you want.
  - AI-POWERED PERSONAL FINANCE ASSISTANT

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium product film
- Interpretation: four scenes, long holds, soft fades, League Spartan, no parody
- Angle: A receipt becomes the month. The line is save more, spend smarter, afford the life you want.
- Hook: "Save more. Spend smarter."
- Outro / punchline: Fintr. Afford the life you want.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Roadmap features (goals, investments, affordability) that are not the live product

## Visual Identity
- Background: #FAF9F7 and #151921
- Text: #0A2540 on cream, #F4F1EA on #1E2433
- Accent: #0D9488
- Display font: League Spartan (local woff2)
- Body font: League Spartan
- Visual references from the project: landing eyebrow, teal proof bar, dark dashboard cards

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 4.6s — "Save more. Spend smarter."
2. Receipt — 7.7s — Cafe Luna, ₱248, Dining, Logged
3. Month — 5.2s — In, Out, Net, dining budget
4. Outro — 4.35s — Fintr, tagline, On the App Store

## Audio
- Audio role: warm bed
- Audio arc: fade in, stay low, fade under the name
- Music: happy-beats-business-moves-vol-9-by-ende-dot-app.mp3
- Music treatment: 0.45s fade in, peak gain 0.28, fade from 18.6s to 20.5s
- Music cue guidance: bundled vol-9 preset. Locks at 6.34s, 10.54s, 12.65s.
- Audio-reactive treatment: none
- Audio-coupled moments:
  - receipt fields — clicks
  - Logged — soft confirm
  - month stats — one light impact on the first number
- SFX selection guidance: low high-frequency-risk interface clicks; one light generic impact
- Exact SFX choice: click_003, click_002, click_005, impactGeneric_light_000
- Audio files: copied into `brag-output/composition/assets/`

## Hyperframes Instructions
Standalone composition. Local GSAP. No voiceover. No remote render. `npx hyperframes check` is the gate before render.
