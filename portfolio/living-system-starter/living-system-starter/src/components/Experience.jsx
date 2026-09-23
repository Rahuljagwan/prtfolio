import * as THREE from 'three'
import CameraRail from './CameraRail.jsx'
import World from './World.jsx'
import RequestParticles from './RequestParticles.jsx'

/**
 * Scene root: fog + lights + world + particles + camera rail.
 * Lighting is deliberately simple (1 dir + ambient + hemi) —
 * final look comes from baked lightmaps in Week 3, not from adding lights here.
 */
export default function Experience() {
  return (
    <>
      <color attach="background" args={['#0a0a12']} />
      <fog attach="fog" args={['#0a0a12', 30, 75]} />

      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#4a4a70', '#12121e', 0.8]} />
      <directionalLight
        position={[10, 18, 8]}
        intensity={1.6}
        color="#cfd6ff"
      />

      <World />
      <RequestParticles count={260} />
      <CameraRail />
    </>
  )
}
