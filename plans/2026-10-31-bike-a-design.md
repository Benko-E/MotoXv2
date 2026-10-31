# Bike step A design: drop test

Agreed in chat on 2026-10-31: a believable bike built from real physics,
one system at a time (A drop test, B engine in a straight line, C gears and
sound, D steering and balance, E rider lean and air control, F chase
camera). Visuals don't matter; the systems do. Our own physics code, no
engine library: the ground is a heightmap and the tyre/drivetrain model has
to be ours either way.

## What step A does

The bike is a solid body hanging on two spring-and-damper wheels. You drop
it, it lands, bounces, settles into its sag, and sits tilted on slopes.
No engine yet: a temporary push key rolls it, and it rolls down hills by
itself.

## Physics clock

Physics runs in fixed steps of 1/500 s, however fast the screen draws. At
most 0.1 s of physics catches up per frame (after a stall it slows down
rather than jumping).

## The body

- Mass: bike 105 kg + rider 75 kg (settings).
- Shape for turning inertia: a box 0.8 m wide, 1.2 m tall, 2.1 m long.
- Moves and rotates freely in 3D; gravity 9.81 m/s².
- Nose is local −z (like the scale dummy and the hills' facing).

## Suspension (each wheel)

- Mounted on the body 0.74 m ahead of and behind the centre of mass,
  0.1 m below it; the wheel hangs straight down along the body's up axis.
- Travel 0.30 m (setting). Spring: front 9 kN/m, rear 10 kN/m; damping
  700 N·s/m each (settings). That gives about a third of the travel as sag
  with the rider on.
- Past full travel a very stiff bump stop takes over.
- Wheel radius: front 0.36 m, rear 0.34 m.

## Tyre contact (step A version)

- Where a wheel touches the ground, the spring force pushes the body.
- Sideways the tyre grips hard (no sliding sideways, up to grip × load).
- Along the wheel it rolls freely, with rolling resistance 0.02 × load.
- Brake key: both wheels resist rolling, up to grip × load. Grip
  (friction coefficient) 1.0, a setting.
- Wheels don't spin as separate bodies yet (step B).

## Staying upright (temporary)

A real bike balances by steering; that's step D. Until then an "upright
assist" twists the body back to vertical around its long axis, like
invisible training wheels.

## Controls

- ↑ pushes the bike forward (600 N, a setting), a stand-in for the engine.
- ↓ brakes.
- R drops the bike from the Drop height (3 m, a setting) at the spot the
  camera is looking at (or the map centre), facing the camera's way.
- F jumps the camera behind the bike (as with the scale dummy, which the
  bike replaces).

## Debug view (BIKE tab, each setting's checkbox)

- Mass: a marker at the centre of mass, label with total mass.
- Springs: a bar per wheel showing how far the suspension is compressed
  (green → red at the bump stop), with the spring force in N.
- Grip: arrows at each contact point for the ground's push (normal +
  friction).
- Push: label with speed in km/h.

## Tests

- Dropped on flat ground it comes to rest, upright, with each spring
  compressed by about its share of the weight ÷ stiffness.
- A drop from 10 m stays finite and settles.
- On a slope with the brake held it stays put; without it, it rolls
  downhill and speeds up.
- Pushing on flat ground accelerates at about push ÷ mass.
- The physics clock gives the same result however the frame time is
  split.
