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

Desktop-class devices only: fine pointer, at least 900 px wide, motion allowed, not data-saver, 4+ GB memory and 4+ cores.
Everyone else (phones, tablets, reduced motion, `?lite`, no WebGL, software rendering) keeps the fast 2D page, which is complete.
`html[data-world="ready"]` is set when the 3D is showing.

## Rendering cost

- `frameloop="demand"`: nothing draws unless asked. It draws every frame while you scroll or move the pointer, about 15 fps for
  10 seconds after the last input while the hero is on screen, and never otherwise.
- Zones far from the camera are not drawn at all.
- Procedural geometry only. No models, textures or HDR files.

## Tests

- `npm run test:world`: 19 checks of the maths and camera path, including 400 fuzzed layouts and hostile input.
- Browser checks (measurement accuracy, zone sync, anchor jumps, reload mid-page, content growth, resize, missing sections,
  idle CPU, fallbacks) live with the sub-stage 1 report.

## Adding or changing a zone

1. Edit its entry in `zones.ts` (sections and camera pose).
2. Build its environment as a component under `scene/` and add it in `WorldScene.tsx`, hiding it when the camera is far
   (see `ZoneMarkers.tsx` for the pattern).
