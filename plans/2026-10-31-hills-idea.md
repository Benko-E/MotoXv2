# Hills idea (not built yet; comes after step 2)

Notes from the design chat, 2026-10-31. Pipeline: **hills (splines) → heightmap
→ drawn ground / physics / AI**. The heightmap is baked once whenever a setting
changes; everything else reads from it.

## One hill

Side view, drawn by the user:

```
                 C ___
               _-'  | '-.
            _-'     |    \
 A ______--'        B     '--__ D
```

- **B** is a pole at the hill's centre; **B–C** is the hill's height.
- **A–B** is the run-up: how far the hill reaches on one side and the shape of
  that slope (long, gentle).
- **B–D** is the run-down / fall-off on the other side (short, steep).
- **C** flatness: how big the flat/rounded top (the lip) is before the slopes.
- Each half's curve is swept round the pole, so the hill has a facing
  direction (A towards D).
- Seam fix (agreed): reach and slope shape change *smoothly* going round the
  pole (exactly A–B towards A, exactly B–D towards D, blended at the sides), so
  seen from above the hill is egg-shaped with no crease down its flanks.
- Settings per hill: everything that makes sense for the curve (roundness etc.).
- Used well, these hills are massive natural jumps. Debug: draw the flight
  path off the lip and tune slopes so landings match the fall (prototype lesson:
  landings feel best when the slope matches the fall angle).

## Placement

Procedural, controlled by settings like count, spacing and size ranges
(the readable replacement for noise wavelength/octaves). Typically about 4
complete hills on a normal map, more on big maps; count is just a setting
(baking cost is tiny: each hill only touches the cells within its reach).
Noise may add roughness on top, steered by the hills.

## Notes from the step 2 review (do these with the hills)

- Baking hills changes heights in place: the terrain needs a "heights
  changed" call (recompute chunk boxes, rebuild every chunk, redo borders and
  the label height), or a ground version number main.ts checks each frame.
- Normals at the outer map edge use a clamped neighbour, so the slope there
  reads at half strength (only visible on the border).
- Chunk border debug lines draw through hills (depthTest off); may confuse.
- The cell grid is projected straight down, so it stretches on steep faces.
- Consider extra detail near jump lips.
