# MotoX

A browser motocross game in the spirit of Motocross Madness 1 and 2.
This is the second, rebuilt version.

**Play:** https://benko-e.github.io/MotoX/

## Where it's at

Step 1: a flat map you can fly over, with a debug menu for its settings.

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
