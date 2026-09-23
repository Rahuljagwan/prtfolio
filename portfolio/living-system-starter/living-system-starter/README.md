# The Living System — Grey-Box Starter (Week 1)

Portfolio-as-a-production-system. This is the **foundation skeleton**:
camera rail + scroll smoothing + instanced request particles + grey-box world.
Everything else (models, incident sequence, terminal) builds on top of this.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 and **scroll**. The camera rides a rail through
the system: browser → Nginx gate → pipeline → server district → monitoring
tower → DB vault → terminal.

## File map — what lives where

| File | Job |
|---|---|
| `src/scrollData.js` | ⭐ **Single source of truth.** Stations (camera pos + lookAt + card text). Tune the whole experience here. |
| `src/components/CameraRail.jsx` | Scroll → lerped `t` → `curve.getPointAt(t)`. The premium feel lives in this file. |
| `src/components/World.jsx` | Grey boxes with FINAL transforms. Week 3: swap each group for a glTF, keep positions. |
| `src/components/RequestParticles.jsx` | InstancedMesh heartbeat loop (1 draw call for 260 particles). |
| `src/components/Overlay.jsx` | DOM text cards + progress dots. Content is HTML, never 3D text. |
| `src/store.js` | Tiny zustand store: scroll, smooth, section, mouse. |

## Tuning knobs

- `SMOOTHING` in `CameraRail.jsx` — 2 = floaty, 5 = snappy.
- `PARALLAX` in `CameraRail.jsx` — mouse drift amount.
- Station `pos`/`look` in `scrollData.js` — reframe any section without touching other code.
- Particle `count` prop in `Experience.jsx` — halve it for low-tier devices later.

## Design rules already locked in

- Palette: bg `#0a0a12`, surfaces blue-grey, accents green `#3dffa0` + amber `#ffb347`. **Red is reserved for The Incident.**
- Flat shading + fog = diorama/blueprint look. Don't add more lights; bake in Blender later.
- DPR capped at 1.75, particles instanced, no bloom → runs on modest GPUs.

## Next steps (from the blueprint)

1. **Week 2** — richer particle behavior: reject blips at the gate (red deflect), per-building traffic highlight.
2. **Week 3** — Blender: model gate/district/conveyor as glTF (Draco), swap into `World.jsx` groups.
3. **Week 4** — Journey scroll-scrubbed animations (`AnimationMixer.setTime`), real project data in cards.
4. **Week 5** — ⭐ The Incident sequence (state in zustand: `incident: idle | alarm | reroute | recovered`).
5. **Week 6** — terminal contact form, sound (muted default), tier detection + 2D fallback, deploy.

## Verify it works

- Scroll fast then stop — the camera should glide to rest, never snap.
- Move the mouse on any section — gentle parallax drift.
- FPS: open devtools performance monitor; should hold 60 on a mid laptop.
