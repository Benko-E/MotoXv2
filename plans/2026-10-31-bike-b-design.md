# Bike step B design: engine in a straight line

Follows step A (plans/2026-10-31-bike-a-design.md). Goal: feel weight going
up and down hills, and feel the rear wheel spin, without a speedometer.
Still no steering (step D) and one fixed gear (gears, clutch and sound are
step C).

## Wheels spin

Each wheel is now its own spinning body with its own speed of rotation.

- Wheel inertia: front 0.9, rear 1.0 kg·m².
- The rear also carries the engine's spinning parts through the gearing:
  engine inertia (0.04 kg·m²) × gear ratio². With ratio 10 that's 4 kg·m²
  more, so the rear wheel is heavy to spin up, like a real bike in gear.
- The wheels are drawn with a stripe so you can see them turn.

## Tyre: sticks, then slips

Builds on step A's sticking tyre. The tyre's tread moves with the wheel's
rotation; the ground under it moves with the bike. The difference is slip.

- While gripping, the tyre acts like a stiff spring plus damper on the slip
  (in both directions, one friction circle).
- It can push at most grip × load. Past that it slides, and while sliding
  it can only push slide grip × load (80 % of grip by default), until the
  slip settles again. That drop is what makes wheelspin "break loose".
- The force spins the wheel back: drive torque pushes the wheel, the ground
  pushes back, and the difference changes how fast the wheel turns. This
  is solved so it can't jitter at our 1/500 s step.

## Engine (one fixed gear for now)

- Torque curve over rpm, scaled by Peak torque (50 N·m):
  1500 rpm 60 %, 3000 rpm 72 %, 5000 rpm 88 %, 7500 rpm 100 %,
  9500 rpm 92 %, 11000 rpm 78 %.
- Engine rpm = rear wheel speed × gear ratio (10), never below idle
  (1500 rpm). No clutch yet: at a standstill it pulls with its idle torque.
- Rev limiter at 11000 rpm (setting): no drive torque above it.
- Off the throttle: engine braking, up to 12 N·m at the limiter, less at
  lower rpm.
- Drive torque at the rear wheel = engine torque × throttle × ratio × 0.9
  (chain and gearbox losses).

## Brakes

- Brake torque on each wheel, front up to 600 N·m, rear up to 300 N·m
  (settings). Brakes can stop a wheel completely (lock it), and a locked
  wheel skids.

## Controls

- ↑ throttle: opens over 0.25 s, closes over 0.15 s when released.
- ↓ both brakes, over 0.1 s.
- The temporary push key from step A is gone.

## Debug view (BIKE tab checkboxes)

- Peak torque: label with rpm, throttle %, and drive torque at the wheel.
- Grip: as before, the ground's push on each tyre, plus each wheel's slip
  (e.g. "rear slip 35 %"), red while sliding.
- Speed label stays.

## Tests

- A bike rolling with no throttle spins its wheels up to match the ground.
- Full throttle from a standstill on flat ground speeds it up, with little
  rear slip at normal grip.
- At low grip the rear wheel spins much faster than the ground goes by.
- Full throttle uphill is slower than on the flat; downhill faster.
- Off the throttle the engine slows it faster than coasting in neutral
  would (rolling resistance only).
- The rev limiter caps top speed at limiter ÷ ratio × wheel radius.
- Full brakes stop it, and hold it on a 30° slope.
