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
- Step 5: rolling ground (MAP → Noise): Bump height, Bump width, Detail,
  and Calm distance, how far past a hill's foot the small bumps stay
  smoothed out (its debug lines draw a blue ring where the calm ends).
  Hills ride on the big swells. MAP → View has the ground grid.
- Bike step A, the drop test (BIKE tab): a 180 kg bike + rider on two
  sprung, damped wheels with real gravity, suspension and tyre grip. No
  engine yet (that came in step B). R drops it where you look. Debug
  lines show the centre of mass, spring compression and force, the
  ground's push on each tyre, and the speed.
- Bike step B, engine in a straight line: spinning wheels with their own
  weight, a torque curve, one fixed gear, rev limiter, engine braking,
  front and rear brakes, and tyres that slip and slide past their grip.
  ↑ opens the throttle, ↓ brakes. Debug shows rpm, throttle, drive torque
  and each wheel's slip (red while sliding). No steering or crashes yet:
  a bike that flips over is dropped again.
- Bike step C, gears, clutch and sound: an automatic clutch (bites higher
  the more throttle, so wide open launches hard) and an automatic 5-speed
  that shifts late and quick like a rider would. Engine sound is made in
  the browser: a popping 4-stroke single that crackles off the throttle
  and stutters on the limiter (BIKE → Sound). A temporary wheelie &
  stoppie control eases the throttle and front brake so the bike doesn't
  loop over until the rider can lean (step E). Debug shows the gear, the
  clutch and an rpm bar with the shift point.
- Bike step D, steering and crashing: A/D steered through a virtual
  rider who countersteered like on a road bike (replaced: see Direct
  steering below). Space stamps on the rear brake and pulls the clutch, so the
  rear locks for a powerslide. ↓ / ↑ move the rider back (wheelies) or
  forward onto the bars. The bike can fall over: a rider or handlebar
  point touching the ground, or leaning past the crash lean, is a crash,
  and R picks it up (RIDER → Can crash turns crashing off). The camera
  now follows the bike; C switches to free-roam. RIDER → Assists has the
  temporary rider control: he eases the throttle and brakes to keep the
  wheels from looping, spinning or sliding out, sits forward in turns and
  holds the brakes rather than roll backwards. Debug shows lean, aimed
  lean and bars, where the rider's weight is, the body's contact points
  and each tyre's sideways slip. Every key can be changed on the
  CONTROLS tab.
- Direct steering (replaces step D's countersteering): A/D turn the bars
  straight away. Standing or slow they go all the way to the bar lock;
  faster, only as far as the tyres can hold the turn, so it doesn't slide
  out. The rider leans as far as the turn needs and holds the bike there,
  so it doesn't fall over by itself, on slopes too. BIKE → Steering has
  Bar lock (45°), Turn at speed (70 %: how tight it turns at speed, 100 %
  = right at the tyres' limit) and Most lean. Debug draws the bars, dim
  lines for how far they may turn at this speed, and the lean.

## Controls

| Key | What it does |
|---|---|
| ` (left of 1) | Show or hide the debug menu |
| Hold right mouse + drag | Look around (menu open or closed) |
| W / S | Throttle / both brakes |
| A / D | Turn left / right |
| Space | Rear brake (locks the rear: powerslide) |
| ↓ / ↑ | Rider back / forward |
| C | Switch camera: follow the bike or free-roam |
| R | Pick the bike up (follow) or drop it where you look (free-roam) |
| F | Free-roam: jump the camera behind the bike |
| W A S D, Space / Q, Shift | Free-roam: fly, up / down, faster |

Every key can be changed on the CONTROLS tab of the menu.

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
