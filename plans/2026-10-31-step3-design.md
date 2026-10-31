# MotoX v2, step 3: one hill + "Copy changes"

Date: 2026-10-31. The user: "let's first make sure the one hill looks good…
go ahead". Shape details were left to Claude; the user tunes in the game.
Background: `plans/2026-10-31-hills-idea.md`.

## Copy changes

- Title bar button **Copy changes**, left of Reset all.
- Copies the settings whose value differs from the default, as JSON
  (`{"hillHeight": 42, "wireframe": true}`), to the clipboard. The button
  briefly reads "Copied 3" (or "No changes"). The user pastes it to Claude,
  who makes those the new defaults.

## The hill

One hill, placed and shaped by settings (MAP tab, section **Hill**).

| Setting | Meaning | Range | Default |
|---|---|---|---|
| Position X / Position Z | where the pole (B) stands | −2000…2000 m | 0 / 0 |
| Facing | direction from A towards D (0° = north, clockwise) | 0…359° | 0 |
| Height | B–C, the pole's height | 1…200 m | 30 |
| Top size | radius of the flat top around the pole | 0…100 m | 8 |
| Run-up length | B to A: how far the gentle side reaches | 5…1000 m | 120 |
| Run-up foot | how gradually the run-up starts at A (1 = sharp corner, 6 = very soft) | 1…6 | 2.5 |
| Run-up shoulder | how rounded the run-up is near the top | 1…6 | 1.5 |
| Run-down length | B to D: how far the steep side reaches | 5…1000 m | 50 |
| Run-down foot | as above, D side | 1…6 | 2 |
| Run-down shoulder | as above, D side | 1…6 | 2.5 |

### Shape

- Distance r from the pole, in the flat ground plane. Up to **Top size**
  the hill is at full height. From there to the foot it follows a profile
  curve, `f(u) = uᵃ / (uᵃ + (1 − u)ᵇ)`: u goes 0 at the foot to 1 at the top
  edge, a = foot, b = shoulder. a = b = 1 is a straight cone slope; bigger a
  makes the bottom gentler; bigger b makes the top rounder.
- Round the pole, the side's numbers blend smoothly: straight towards A
  exactly the run-up numbers, straight towards D exactly the run-down
  numbers, and in between a blend weighted by `(1 + cos angle) / 2`. No
  seam; from above the footprint is egg-shaped.
- The hill is added onto the ground heights (flat 0 for now).

### Baking

- Changing any hill setting bakes it into the heightmap (once per frame at
  most), and only the chunks inside the old and new footprint are rebuilt.
- Normals at the outer map edge use a one-sided slope (step 2 review note).

## Debug view (each setting's checkbox shows its own lines)

- Position: a post at B on the ground with a "B" label.
- Facing: an arrow on the ground through B, from the A side to the D side.
- Height: the pole B–C with "C · 30 m".
- Top size: a ring round the flat top.
- Run-up length / foot / shoulder: the run-up profile curve drawn in the
  world (the user's red line, along the facing line from B to A), "A ·
  120 m" at the foot, and the run-up half of the footprint outline.
- Run-down settings: the same for the D side.

Debug defaults: on for all hill settings, so the first view shows the
drawing from the user's picture.

## Testing

Lean, per area: profile endpoints and shape; hill height at the pole, top
edge, feet and beyond; no seam round the sides; baking matches the shape and
reports the changed area; changed-from-defaults. Browser check: the hill
looks like the picture, sliders reshape it live, LoD has no slits on the
slopes.
