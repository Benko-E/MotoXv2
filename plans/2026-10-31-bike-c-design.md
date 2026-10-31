# Bike step C design: gears, clutch, engine sound

Follows step B (plans/2026-10-31-bike-b-design.md). Goal: a dirtbike, not a
superbike or a car: punchy launches that can lift the front, late quick
shifts you can hear, a loud popping single-cylinder.

User's calls: clutch fully automatic (no key), gearbox fully automatic (no
keys), but shifting like a rider, not a smooth car automatic.

## Engine and clutch

- The engine is its own spinning part (0.04 kg·m²) with its own rpm.
- Automatic clutch: how hard it grips grows with engine rpm, from nothing
  at 1700 rpm to full grip at the "bite" rpm. Bite rpm rises with throttle:
  2000 rpm shut, 8000 rpm wide open. Full grip holds 100 N·m (twice peak).
  - Wide open from a standstill: the engine flares up until the clutch
    grips as hard as the engine pulls, then the bike launches hard (and can
    lift the front in 1st and 2nd).
  - Gentle throttle bites low and pulls away gently.
  - Near idle it lets go, so the engine never stalls.
- Clutch slipping: it passes its grip, the engine and the wheel turn at
  their own speeds. When their speeds meet and the grip is enough, it
  locks: the engine then turns with the rear wheel through the gearing.

## Gearbox (automatic, rider-style)

- 5 gears, overall ratios (engine turns per rear wheel turn), each a
  setting: 19, 15.2, 12.6, 10.9, 9.5. 5th tops out near 148 km/h.
- Up: when rpm passes the shift point. Wide open it's 10600 (right by the
  11000 limiter); at shut throttle 6500; in between in proportion. No
  upshifts while braking (unless about to over-rev).
- Down, one gear at a time, only if the lower gear lands well below its
  shift point:
  - under braking below 5000 rpm,
  - kick-down: throttle above 80 % below 6000 rpm,
  - anything below 3000 rpm.
- A shift takes 0.08 s: clutch open, no drive. Up-shifts cut the ignition
  (the clutch then drags rpm down to the new gear). Down-shifts blip the
  throttle. At least 0.3 s between shifts.

## Sound (made in the browser, no audio files)

- One bang every two engine turns (a 4-stroke single): a short thump
  through an exhaust resonance, so it pops at idle and blurs into a raspy
  buzz at high rpm. Each bang varies a little, so it's rough, not smooth.
- Louder and harsher with throttle (drive). Shut throttle: quieter, with
  random pops and crackles above 3000 rpm.
- Limiter: misses bangs (stutter). Shift: no bangs during the shift.
- BIKE tab → Sound: on/off and volume. Starts on the first key press
  (browsers need one before they play sound).

## Debug (Peak torque checkbox)

- Engine label: gear, clutch (locked / slipping / shifting), rpm,
  throttle, torque at the wheel.
- rpm bar under it, with a mark at the current up-shift point.

## Tests

- Idles at 1500 rpm in 1st at rest, no drive.
- Wide open from rest: the engine flares to a launch rpm with the clutch
  slipping, and drives the wheel.
- Up-shifts near the limiter wide open; earlier at part throttle.
- Down-shifts under braking and on kick-down; not within 0.3 s.
- Locked: the engine follows the wheel, and shut throttle brakes it.
- A whole bike, wide open on the flat, goes up through the gears.
