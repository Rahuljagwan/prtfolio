import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../store.js'
import { cameraCurve, lookCurve, SECTION_COUNT } from '../scrollData.js'

/**
 * THE HEART OF THE WHOLE EXPERIENCE.
 *
 * scroll (raw)  --lerp-->  smooth  --curve.getPointAt-->  camera pos + lookAt
 *
 * Two rules that make it feel premium:
 * 1. NEVER bind camera directly to scroll. Always lerp toward it.
 * 2. Frame-rate independent lerp: 1 - exp(-k * delta), not a fixed 0.05.
 */
const SMOOTHING = 3.2 // higher = snappier, lower = floatier. Tune 2..5.
const PARALLAX = 0.55 // max sideways drift from mouse, in world units

export default function CameraRail() {
  const smoothT = useRef(0)
  const pos = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const parallax = useRef(new THREE.Vector2())

  useFrame((state, delta) => {
    const { scroll, mouse, setSmooth, setSection, section } =
      useStore.getState()

    // --- 1. smooth the scroll value (exp decay = same feel at any fps) ---
    const k = 1 - Math.exp(-SMOOTHING * delta)
    smoothT.current += (scroll - smoothT.current) * k
    setSmooth(smoothT.current)

    // --- 2. sample both curves ---
    const t = THREE.MathUtils.clamp(smoothT.current, 0, 1)
    cameraCurve.getPointAt(t, pos.current)
    lookCurve.getPointAt(t, look.current)

    // --- 3. mouse parallax (also lerped so it floats, not jitters) ---
    parallax.current.x += (mouse.x * PARALLAX - parallax.current.x) * k
    parallax.current.y += (-mouse.y * PARALLAX * 0.6 - parallax.current.y) * k

    state.camera.position.set(
      pos.current.x + parallax.current.x,
      pos.current.y + parallax.current.y,
      pos.current.z,
    )
    state.camera.lookAt(look.current)

    // --- 4. publish nearest section index (for overlay + HUD) ---
    const idx = Math.round(t * (SECTION_COUNT - 1))
    if (idx !== section) setSection(idx)
  })

  return null
}
