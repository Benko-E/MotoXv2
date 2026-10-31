# MotoX

A browser motocross game in the spirit of Motocross Madness 1 and 2.
This is the second, rebuilt version.

**Play:** https://benko-e.github.io/MotoX/

## Where it's at

- Step 1: a flat map you can fly over, with a debug menu for its settings.
- Step 2: a cell budget (at most 4,096 cells per side) and level of detail:
  the ground is drawn in chunks that get coarser with distance. MAP → Detail
  has the Detail distance (tick it to tint chunks by detail level) and
  Wireframe.
- Step 3: one hand-tuned hill (MAP → Hill): position, facing, height, flat
  top, and a run-up and run-down side, each with length, foot and shoulder.
  Its debug lines draw the pole, the profile curves and the A/B/C/D points.
  **Copy changes** (top right of the menu) copies every setting you changed
  from its default, so it can be pasted back to become the new default.
- Step 4: many hills from a seed (MAP → Features → Hill). Seed with a 🎲
  reroll, Count, Spacing, and each shape setting with a ± Variation under
  it. Debug lines show every hill's pole, footprint and spacing ring; the
  hill nearest the camera gets the full drawing with its own numbers.

## Controls

| Key | What it does |
|---|---|
| ` (left of 1) | Show or hide the debug menu |
| Hold right mouse + drag | Look around (menu open or closed) |
| W A S D | Fly forward, left, back, right |
| Space / C | Fly up / down |
| Shift | Fly faster |

The menu can be dragged by its title bar. Each setting row has a checkbox
for its debug lines, a slider and a number box. Settings and the menu's
position are remembered.

## Run it on your own computer

```
npm install
npm run dev     # opens on http://localhost:5174
npm test        # automatic checks (or npx vitest run tests/<area>)
npm run build   # builds the site into docs/, which GitHub Pages serves
```

The design and build plans for each step are in [`plans/`](plans/).

The first prototype is archived at
[Benko-E/MotoX-prototype](https://github.com/Benko-E/MotoX-prototype)
(playable at https://benko-e.github.io/MotoX-prototype/).
