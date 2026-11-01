# Bike step D design: steering, cornering grip, crashing

Follows step C (plans/2026-10-31-bike-c-design.md). User's calls: A/D ask
for a turn and a virtual rider steers the bars (countersteering); the bike
can fall over, with a switch; WASD rides, C switches the camera; keys can
be rebound.

## Steering (virtual rider)

- Front wheel steers about the bike's up axis. Bars: + = right. Most
  35° (setting), moving at most 4 rad/s.
- The tyres already grip sideways (step A's sticking tyre, one friction
  circle), so a steered front wheel pushes the bike round, and a leaned
  bike's round tyre touches the ground off-centre, so lean and turning
  balance like a real bike. No extra turning forces.
- The rider:
  - A/D (eased in over 0.12 s) set a target lean: input × most lean (50°,
    setting), fading in from walking pace up to about 8 m/s.
  - He steers the bars to get it: the sideways pull a steady turn at that
    lean needs (g·tan lean), plus a correction for lean error and lean
    speed, turned into a bar angle for the speed and wheelbase. To lean
    into a turn the correction steers the other way first: countersteer.
  - Slow (under 2.5 m/s, setting "foot-down speed"): the bars follow A/D
    directly and he dabs a foot to stay upright.
- The step A upright assist is gone.

## Crashing (RIDER → Can crash, default on)

- Body contact points: footpegs, engine bottom, fenders (scrape, no
  crash), handlebar ends, rider's shoulders and head (crash). Each pushes
  out of the ground (spring + damper) with sliding friction.
- Can crash on: a rider point touching the ground, or leaning past 70°,
  is a crash. The rider lets go: no throttle, brakes or steering, bars
  straighten, no foot. R picks the bike up where it lies.
- Can crash off: an invisible hand stops the lean at the most-lean
  setting; the rider never lets go.

## Rider weight (↑ / ↓, eased over 0.3 s)

- ↓ moves the rider 0.3 m back and a bit down; ↑ 0.24 m forward onto the
  bars. The whole bike's centre of mass moves by rider ÷ total of that,
  so the load on each wheel changes for real.
- The temporary wheelie & stoppie control stays as a switch.

## Keys (CONTROLS tab, every one rebindable)

W throttle · S both brakes · A/D turn · Space rear brake (locks the rear:
powerslide starter) · ↑/↓ rider weight · C camera · R pick up (follow
camera) / drop where you look (free-roam) · F camera behind the bike.
Free-roam flying: WASD, Space up, Q down (rebindable too).

## Camera

C switches between free-roam and a simple follow camera behind the bike.
WASD flies only in free-roam. Step F brings the real chase camera.

## Debug

- RIDER → Most lean: target vs actual lean label, bars angle line on the
  front wheel.
- BIKE → Grip: each tyre's sideways slip angle with the slip label, red
  while sliding.
- RIDER → Rider reach: a marker where the rider's weight sits.
- RIDER → Can crash: the body contact points, red while touching.

## Tests

- Straight at 10 m/s with no input it stays up and on course for 5 s.
- Holding D at speed turns right at about the target lean; letting go
  stands it back up.
- Starting a turn steers the other way first (countersteer).
- At walking pace A turns the bars directly and it stays up.
- Rider back puts less load on the front at rest; forward more.
- Space locks the rear only.
- Laid on its side it rests on its body points; with Can crash on it's
  crashed, and pickUp() stands it back up.
- Can crash off: hard turns never lean past the most-lean setting.

## Changes while building

- Most lean defaults to 35° (not 50°): at grip 1 a 50° lean is past what
  the tyres hold, so it washed out.
- The tyre has a round crown (7 cm), so leaned over it touches down off
  the hub's line; a wheel-sized ball made leaning lazy.
- Space also pulls the clutch, or the engine keeps the rear turning.
- The rider sits forward while turning (keeps the front loaded), and the
  bars go straight while the front wheel is off the ground.
- He never asks the tyres for more sideways pull than their grip.
- Rider control (temporary, RIDER → Assists) grew: besides the wheelie
  and stoppie limits, it eases the throttle when the rear spins up in a
  lean or either tyre slides sideways, and the brakes (S) to what the
  lean leaves grip for. Rolling backwards with no throttle he holds the
  brakes. Full S at full lean above about 60 km/h can still crash.
- After a shift the clutch feeds back in over 0.1 s, so the shift
  doesn't kick the rear loose mid-corner.
- A fallen bike rolling back onto its wheels: the suspension fades in
  over the last 6° before 60° of lean and its damper goes by how fast the
  wheel closes on the ground, so it can't be flung (it once ran to NaN).
- Free-roam fly down moved to Q, because C switches camera.
- Known: jumping while leaned has no air control yet (step E), so the
  bike keeps rolling in the air and often lands crashed.
- After review: upside down always counts as crashed (even with Can
  crash off, where the invisible hand couldn't tell which way to push);
  the head and shoulder points move with the rider's weight shift;
  letting go of Space feeds the clutch back in too; rolling-back braking
  is part of rider control; a key row waits for one key at a time and
  stops waiting on ` , leaving the window or closing the menu; a key used
  twice in the same mode gets an "also …" note.
