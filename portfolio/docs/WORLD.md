# The 3D world: architecture (sub-stage 1)

A single fixed canvas sits behind the whole page. The sections stay ordinary server-rendered HTML on top of it; the canvas is
decorative and hidden from assistive technology. As you scroll, one camera glides along a curve through six zones.

## Files

| File | Job |
|---|---|
| `src/lib/world/zones.ts` | The six zones: which sections each owns, and the camera pose for each. Edit this to move or add a zone. |
| `src/lib/world/rig-math.ts` | Pure maths: scroll position + measured zone layouts -> path parameter `u`. No DOM, no three.js. |
| `src/lib/world/rig-path.ts` | The two Catmull-Rom curves (camera position, look-at target) and sampling. |
| `src/components/world/useZoneLayouts.ts` | Measures where each zone really sits on the page and keeps it current. |
| `src/components/world/WorldCanvas.tsx` | The gate (who gets 3D), lazy loading, fallback handling. Mounted once in `app/page.tsx`. |
| `src/components/world/WorldScene.tsx` | The R3F canvas, theme, fog, and the zone content. |
| `src/components/world/scene/*` | Rig driver, render scheduler, route line, dust, the Signal zone, placeholder markers. |

## How scroll maps to the camera

The point at the centre of the viewport is tracked against each zone's measured range. While it is inside the middle half of a
zone the camera holds that zone's pose (`u` is an exact integer). Between zones it travels along the curve with easing.
Because layouts come from the real DOM, editing content in `/admin` (a longer section, a hidden section) keeps the camera aligned.
A zone with no section on the page is passed straight through.

## Who gets 3D

Everyone whose own settings allow it (`worldTier()` in `lib/world/capability.ts`):

- **full**: a desktop (fine pointer, 900 px or wider, 4+ GB, 4+ cores).
- **lite**: the same world on a lighter budget, for phones, tablets and modest hardware: fewer dust particles, stars and cars, a pixel-ratio
  ceiling of 1.25 (1.0 on very modest hardware), and the resolution governor still steps it down on its own if frames run slow.
- **off** (the fast 2D page, which is complete): reduced motion, data saver, `?lite`, no WebGL, software rendering.

`html[data-world="ready"]` is set when the 3D is showing. The assistant page and the admin backdrop still run their scenes on `full` only.

### On a phone (portrait)

The scene is composed for a landscape window, so a few things adapt (all pure functions of the screen, in `lib/world/tunnel-math.ts`):

- The lens widens from 42 to 64 degrees as the screen gets taller than it is wide (`baseFovFor`), so the corridor stays in view.
- The hero's origin node is placed over the in-flow lightweight orb (`data-orb-anchor`, see `RequestOriginZone`), at its position and size.
- The last stretch of the route turns the view toward the closing beacon, which sits right of the route (`RigDriver`).
- The Projects flight docks its text under the 3D below 1024 px wide (`narrowFactor`); the camera squares up to the rack and aims below it so it
  rides in the upper part of the screen (`StationsCamera`).
- The canvas is sized to the large viewport (`.world-host`), so the address bar sliding away never resizes it.

## Rendering cost

- `frameloop="demand"`: nothing draws unless asked. It draws every frame while you scroll or move the pointer, about 15 fps for
  10 seconds after the last input while the hero is on screen, and never otherwise.
- Zones far from the camera are not drawn at all.
- Procedural geometry only. No models, textures or HDR files.

## Tests

- `npm run test:world`: 19 checks of the maths and camera path, including 400 fuzzed layouts and hostile input.
- Browser checks (measurement accuracy, zone sync, anchor jumps, reload mid-page, content growth, resize, missing sections,
  idle CPU, fallbacks) live with the sub-stage 1 report.

## Things that live in the world

All procedural, all scroll- or clock-driven, all behind the page text (so none of them can cover content).

- **Helicopter** (`scene/Helicopter.tsx`, maths in `lib/world/heli-math.ts`): parked on the About section's helipad (the rings
  in `FoundationZone`, whose centre is `HELI.PAD`). Rotors spool up and it lifts off as the end of About scrolls by (`local` of
  the About zone), then leads the camera down the whole route (above the route line, on the axis the camera itself flies, so it
  clears whatever the camera clears) and ends circling the beacon. Everything about the path is a number in `HELI`; the flight
  was checked against the deployment cards, the project racks, the tower nodes, the city gates and the beacon (closest approach
  to each is positive), so if you move any of those, move the helicopter's lane with it.
- **City traffic** (`scene/CityTraffic.tsx`): light trails in two lanes either side of the route along the ground, clear of the
  gates (pillars at 3) and buildings (2.9 or more).
- **Beacon satellites** (`scene/BeaconSatellites.tsx`): three satellites on tilted orbits inside radius 4.4 of the beacon, inside
  the helicopter's circling radius (about 5.3).
- **Couriers** (in `scene/DeploymentsZone.tsx`): one small drone per tether, gliding between the route and its card.
- The ambient ones (traffic, satellites, couriers) go through `ambient.ts`, so they run at a calm 25 fps and stop once the page
  has been still for a while.

## Sound

Everything audible is synthesised live with the Web Audio API (`lib/audio/engine.ts`): no audio files. It is **off until a visitor turns it on**
(the speaker in the navbar; the choice is remembered, and a remembered "on" resumes at the first click, key or touch, because a browser allows
nothing before a gesture). The engine itself is only fetched at idle, so a visitor who never turns it on pays a few hundred bytes (`lib/audio/store.ts`).

- **Palette**: all of it is D major, so nothing can clash. Chimes are bells (a sine and inharmonic partials, into a synthetic room); under the
  journey is a slow string-like pad with one chord per zone, cross-fading as you travel, and a filtered-noise "air" that changes character
  from zone to zone and opens up with scroll speed.
- **Send a request**: a press and launch, a rush and a rising hum for the journey, one note for each of the five stages it passes (the hero
  guide lights the same ones at the same moments), and a bright "200 OK" chord on arrival. Same clock: `REQUEST_TRAVEL_SECONDS`.
- **Helicopter**: a small synth built the way a real one sounds. The rotor is a loop of discrete blade slaps (a low thump carried by its upper
  harmonics so small speakers still hear it, a pitched slap, a noise crack, a whomp, and the tail rotor's buzz), with the two blades not quite
  alike and every revolution a little different. It is played at a rate that follows rotor speed, so spooling up speeds the beat and lifts the pitch
  together, as a real rotor does, and Doppler rides on the same number. Under it: an engine rumble, a turbine whine (1.1 to 3.4 kHz as it spools,
  with vibrato) and the hiss of the rotor tips. Distance from the camera drives its level, brightness and echo (`heliMix` in `lib/audio/mix.ts`:
  about -5 dB at the pad, -15 dB at 18 units, -21 dB at 30), the rotor bites harder as it lifts and in fast flight, and it is panned to where it is
  on screen. It fades by itself once the world has stopped drawing. Measured offline: about 85% of the rotor's energy is above 180 Hz (what a
  laptop or phone speaker can play), and the gaps between slaps are about 20 dB deep.
- **Places**: a note on entering each zone, a rush and a chime through each gate (CI amber and softer, CD green and brighter), cars passing in the
  city, couriers handing over in Deployments, a sonar ping from the beacon, a sweep and a note between projects in the flight, the incident
  sequence (alert, reroute, restart, nominal), the stages of the Journey, theme changes (a falling chime into the dark, a rising one into the
  light), links (a rush as long as the camera's own move), the palette, the terminal (typed keys), and hover, click on every control.
- **Wiring**: the 3D world writes `lib/audio/state.ts` (where the camera is, the helicopter's rotor speed, distance and screen position); any
  component can ask for a sound with `cue()` from `lib/audio/cues.ts` (a window event, so it never imports the engine). The `SoundController`
  turns the page's own events into sounds. `npm run test:audio` checks the mix maths.

## Adding or changing a zone

1. Edit its entry in `zones.ts` (sections and camera pose).
2. Build its environment as a component under `scene/` and add it in `WorldScene.tsx`, hiding it when the camera is far
   (see `ZoneMarkers.tsx` for the pattern).
