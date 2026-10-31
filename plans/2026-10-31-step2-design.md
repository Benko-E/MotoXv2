# MotoX v2, step 2: cell budget + LoD, with debug view

Date: 2026-10-31. Status: agreed in chat ("that seems right, do your thing").

## Goal

Keep the heightmap affordable at any map size, and draw the ground with
less detail far away (level of detail, LoD), with a debug view that shows
both. Ground stays flat; hills come next (`plans/2026-10-31-hills-idea.md`).

## Cell budget

- At most **4,096 cells per side** (≈ 17 M heights, ≈ 67 MB).
- The chosen cell size is kept in the settings. If the map is too big for it,
  the map uses the smallest allowed size (map size ÷ 4,096) instead, and the
  note says so, e.g. "limited to 0.98 m at this map size". Shrinking the map
  gives the chosen value back.
- The heightmap is now stored: (cells + 1)² heights, all 0 for now.
  `heightAt(x, z)` reads it with smooth (bilinear) blending between points.

## LoD

- The ground is real geometry, cut into **chunks of 64 × 64 cells** (edge
  chunks may be smaller when the cell count isn't a multiple of 64).
- Each chunk's detail level comes from its distance to the camera:
  level 0 (every cell) closer than **Detail distance**, then level 1 (every
  2nd point) up to 2×, level 2 (every 4th) up to 4×, and so on, down to one
  quad per chunk.
- New setting **Detail distance**: slider 25–2,000 m, step 25, default 150 m,
  with a debug checkbox (the LoD debug view).
- Each chunk has a **skirt**: a strip hanging down from its edges, so no gaps
  show where a detailed chunk meets a coarser one.
- Only the current level's shape is kept per chunk; switching level rebuilds it.

## Debug view (Detail distance checkbox)

- Chunks tinted by level: green (full), yellow, orange, red, then darker reds.
- Chunk borders drawn as lines on the ground.
- New on/off setting **Wireframe** (shows the real triangles).
- Live note on Detail distance: "chunks: N · triangles drawn: X".

## Menu

- MAP tab gets a second section **Detail** with Detail distance and Wireframe.
- New setting kind: on/off (toggle) row: empty debug column, name, switch.

## Testing

Lean, per area: budget and heightmap (world), toggle settings (settings, ui),
LoD level choice, chunk layout and chunk geometry (render maths as pure
functions). Browser check: tints and wireframe change with distance, borders,
note counts, 4,000 m map with small cells stays smooth.
