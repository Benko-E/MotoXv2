# Step 4 design: many hills from a seed

Agreed in chat on 2026-10-31. Replaces step 3's single hand-placed hill.

## What the user sees

MAP tab → new **Features** section:

- **Seed** (0–9999, default 1337) with a **🎲** button beside the name that
  picks a random seed. Sits above the feature tabs so later features
  (crater, valley, track) share it.
- A row of tabs under it. Only **Hill** exists now; other tabs are added
  when their feature is built (no empty tabs).

Hill tab, top to bottom (each shape setting has an indented
**Variation** row under it, 0–100 %, no checkbox of its own):

| Setting | Range | Default | Variation default |
|---|---|---|---|
| Count | 0–100 | 12 | — |
| Spacing (gap between hill feet) | 0–500 m | 40 m | — |
| Height | 1–200 m | 30 m | 40 % |
| Top size | 0–100 m | 8 m | 100 % |
| Run-up length | 5–1000 m | 120 m | 30 % |
| Run-up foot | 1–6 | 2.5 | 20 % |
| Run-up shoulder | 1–6 | 1.5 | 20 % |
| Run-down length | 5–1000 m | 50 m | 30 % |
| Run-down foot | 1–6 | 2 | 20 % |
| Run-down shoulder | 1–6 | 2.5 | 20 % |

Position and facing settings are gone: the generator picks them.

## Rolling a hill

- Value V with variation P %: each hill rolls V × (1 ± P/100), evenly
  spread. 40 m at 50 % gives 20–60 m; 0 % gives exactly 40 m.
- Rolled values never go below the setting's slider minimum.
- Facing is random, 0–359°.
- Each hill has its own random stream from (seed, hill number), so dragging
  a shape slider makes the hills grow and shrink in place instead of all
  jumping elsewhere. A separate stream per hill picks its position tries.

## Placing

- Footprint radius R = the hill's longest side or top, whichever is bigger.
- A hill is placed only if its whole footprint is inside the map and its
  foot is at least Spacing away from every other hill's foot
  (centre distance ≥ R1 + R2 + Spacing). Up to 50 tries per hill.
- Hills that don't fit are skipped. Count's note says
  "placed 9 of 12".
- Where hills meet, the higher ground wins (max), so allowing overlap
  later is a setting change, not a rebuild.

## Debug view

- **Count** checkbox: every hill shows its pole and red footprint outline;
  the hill nearest the camera also gets its B label and facing arrow.
- **Spacing** checkbox: a faint ring round each hill at R + Spacing/2, so
  two rings touch when hills sit at the minimum gap.
- Height, Top size, Run-up and Run-down checkboxes: the full step 3
  drawing (pole, profile curves, top ring, A/C/D labels) on the hill
  nearest the camera only, with that hill's own rolled numbers, including
  its foot and shoulder.

## Redrawing

When any hill setting, the seed or the map changes: the old hills' areas
are flattened, the new hills are baked in, and only chunks touching those
areas are rebuilt (at most once a frame).

## Later, not now

Overlap allowed (negative spacing), clearings around run-ups, other
features filling the gaps between hills.
