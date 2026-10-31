# MotoX v2, step 1: flat map, flying camera, debug menu

Date: 2026-10-31. Status: design agreed in chat, waiting for the user's review of this file.

MotoX v2 is a fresh rebuild of the prototype (archived as Benko-E/MotoX-prototype).
In this version the user says how things look, behave and work; when something
is unclear, Claude asks instead of guessing.

## Goal

A flat square map you can fly over, with a debug menu on Esc that shows the
map's settings and their debug lines. Later steps shape the ground with
splines, so the ground is already stored as a grid of heights.

## Out of scope for this step

Bike, rider, physics (Rapier), splines, terrain shapes, camera settings, sound,
pausing. RIDER, BIKE and AI tabs exist but are empty.

## Tools

TypeScript, Vite, Three.js, Vitest. Fresh code, nothing copied from the prototype.
Vite builds into `docs/`, which GitHub Pages serves from `main`. `docs/` is wiped
on every build, so plans live in `plans/`.

## The menu

**Esc** shows and hides the menu. The game keeps running while it's open.

Built from small, separate pieces. Anything that holds content can hold any
other piece, so nested tabs, scrolling pages and more control types can be
added later without reworking the menu.

| Piece | What it does |
|---|---|
| Window | The menu's frame. Dragged by its title bar; remembers its position after a reload; always kept on screen, also when the browser is resized. |
| Tabs | A horizontal row of tab buttons along the top and one page per tab. A page can hold another Tabs (tabs within tabs). Top-level tabs: MAP, RIDER, BIKE, AI. |
| Page | Scrolls on its own when its content is taller than the window; the tab bar stays put. |
| Section | A heading (e.g. "Terrain") that collapses and expands on click. |
| Row | One setting: debug checkbox, then the setting's name (a plain label), then its control. Optional small note under or beside it (used for "real size"). |
| Control | Slider plus number box for now (drag or type an exact value). Later: switches, choice buttons, dropdowns, colour pickers; each a self-contained piece that fits in a row. |

Each row also has a way to reset that setting to its default, and the menu
has one "reset everything".

Plain HTML and CSS, styled as a readable game menu, not a developer tool.

### Settings list and store (separate from the menu)

- **Settings list:** each setting described once as data: id, name, control
  type, min, max, step, default, which tab and section it sits in, and whether
  it has debug lines. The menu builds its rows from this list.
- **Settings store:** holds current values and debug-checkbox states, tells
  listeners immediately when anything changes (while dragging, not on release),
  saves to the browser (localStorage) and loads on start. Reset per setting and
  for all. If saved data is missing or broken, defaults are used.

### Mouse and keyboard

- Menu closed: the mouse steers the camera (pointer lock).
- Menu open: the mouse is free (pointer lock released). The keyboard still
  flies the camera, except while typing in a number box.

## The ground

- A flat square centred on the world origin.
- Stored as a grid of heights (all 0 for now), ready for splines.
- **Map size:** slider 100 to 4,000 m, default 1,000 m.
- **Cell size:** slider 0.25 to 20 m, default 1 m.
- Cell count per side = map size ÷ cell size, rounded **up** to a whole number.
  The real map size is then count × cell size (1,000 m with 3 m cells → 334
  cells, 1,002 m). A note on the setting shows the real size and cell count.
- Changing either setting rebuilds the ground straight away.

## Debug lines

Shown while a setting's debug checkbox is ticked. Lines always draw on top of
the ground; labels stay a readable size at any distance.

- **Map size:** a bright outline round the map's edge and a label with the
  real size (e.g. "1,000 m") at the middle of each side.
- **Cell size:** the grid lines between cells, drawn by the graphics card as a
  pattern on the ground (a shader), not as separate line objects, so tiny cells
  on a big map stay fast. Lines fade out with distance instead of blurring to
  grey. A label such as "1 m cells · 1,000 × 1,000".

## Camera

- Starts above one corner of the map looking at the middle, whole map in view.
- WASD move, Space up, Ctrl down, Shift faster; mouse look while the menu is
  closed.
- No camera settings in the menu yet.

## Look

Plain sky colour, one sun, plain ground colour.

## Code layout

```
src/
  main.ts       starts everything
  ui/           window, tabs, page, section, row, controls
  settings/     settings list and store
  world/        ground grid (heights, cell count, real size)
  render/       ground drawing, debug lines, labels
  camera/       flying camera and input
tests/          mirrors src/ folders
```

Small files with one job each.

## Testing

Lean tests for the logic only, run per area (only the area that changed):

- store: save, load, reset, broken saved data falls back to defaults,
  listeners hear changes;
- ground: cell count rounds up, real size;
- menu: tabs switch pages, a tab page can hold tabs.

Before handing over, Claude opens the game in the browser, drags the menu,
changes both settings, checks the map and lines update and that typing in a
number box doesn't move the camera, and takes a screenshot.

## Publishing

Test → commit to `main` → build into `docs/` → push → tell the user it's done.
No checking the live site afterwards.
