# Direct steering (replaces bike step D's countersteering)

Step D steered through a virtual rider who countersteered like a road bike:
bars capped at 35°, taken over by the rider above walking pace, and a lean
controller that could let the bike fall over riding straight on a slope. It
drove "like a monorail". This swaps it for direct steering, closer to the
first prototype, while keeping the tyre, engine and crash physics.

## How it works

- **Bars:** A/D turn the bars to `input × barLimit(speed)`.
  `barLimit = min(barLock, atan(wheelbase × grip × g × turnAtSpeed / speed²))`:
  at bar angle a the bike circles at radius wheelbase ÷ tan(a), so this caps
  the sideways pull at `turnAtSpeed` of what the tyres hold. The bars swing
  to their limit in 0.25 s at any speed (slower in degrees per second when
  fast, because flicking them at speed slid the front).
- **Lean:** the rider aims for the lean the bars' turn needs,
  `atan(speed² × tan(bars) ÷ wheelbase ÷ g)`, capped at Most lean. It comes
  from the bars, not from how the bike is actually turning, because using
  the measured turn fed on itself (a lean that turned the bike asked for
  more lean): that was the straight-line slope fall.
- **Balance:** on the ground a PD "hand" (20000 N·m/rad, 1500 N·m·s/rad,
  at most 4000 N·m) holds the lean at the aim. It rolls the bike about where
  the tyres touch the ground, not about its middle; rolling about the middle
  shoved the tyres sideways and slid them out at speed. In the air it does
  nothing. It replaces the foot dab and the Can-crash-off hand.

## Settings (BIKE → Steering)

| Setting | Default | |
|---|---|---|
| Bar lock | 45° | how far the bars go slow or standing |
| Turn at speed | 70 % | how tight at speed; 100 % = right at the tyres' limit |
| Most lean | 35° | moved here from RIDER |

Most bar angle and Foot-down speed (RIDER) are gone.

## Tests

`tests/physics/steering.test.ts`: full lock standing still, the lock
setting, tight circle at walking pace, leaning into turns at 43 km/h both
ways, smaller bars and no sideways slide at 8/15/25 m/s, never past most
lean, letting go straightens up, riding straight up/down/across rolling
slopes stays upright (failed before: 36° of lean), W+D from standstill.
