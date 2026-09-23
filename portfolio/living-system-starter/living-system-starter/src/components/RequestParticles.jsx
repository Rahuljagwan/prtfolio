import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * THE HEARTBEAT — glowing request particles flowing
 * browser → gate → servers → database → back. Forever.
 *
 * One InstancedMesh = one draw call for ALL particles.
 * Each instance gets a random offset + speed + lateral jitter,
 * so 260 particles feel like organic traffic, not a train.
 */

// The request path through the world (closed loop = requests + responses)
const requestPath = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-14, 1.0, 6),    // browser node
    new THREE.Vector3(-11, 1.1, 3),
    new THREE.Vector3(-8, 1.3, 0.2),   // through the Nginx gate
    new THREE.Vector3(-4, 0.9, -1),
    new THREE.Vector3(0, 1.0, -2.2),   // server district
    new THREE.Vector3(4, 0.9, -3),
    new THREE.Vector3(8, 1.4, -4),     // db vault
    new THREE.Vector3(10.5, 0.7, 0),   // response path (swings back)
    new THREE.Vector3(4, 0.6, 3.5),
    new THREE.Vector3(-6, 0.8, 5.2),
  ],
  true, // closed loop
  'centripetal',
)

const dummy = new THREE.Object3D()

export default function RequestParticles({ count = 260 }) {
  const meshRef = useRef()

  // Per-instance randomness, computed once
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      offset: Math.random(),                    // where on the loop it starts
      speed: 0.014 + Math.random() * 0.02,      // loop fraction per second
      jitter: new THREE.Vector3(
        (Math.random() - 0.5) * 0.7,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.7,
      ),
      scale: 0.5 + Math.random() * 0.9,
    }))
  }, [count])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = clock.elapsedTime

    for (let i = 0; i < count; i++) {
      const p = particles[i]
      const u = (p.offset + t * p.speed) % 1
      requestPath.getPointAt(u, dummy.position)
      dummy.position.add(p.jitter)
      // subtle pulse so the stream shimmers
      const s = p.scale * (0.85 + 0.15 * Math.sin(t * 3 + i))
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} frustumCulled={false}>
      <icosahedronGeometry args={[0.06, 0]} />
      <meshStandardMaterial
        color="#3dffa0"
        emissive="#3dffa0"
        emissiveIntensity={2.2}
        toneMapped={false} /* keeps the green punchy without bloom */
      />
    </instancedMesh>
  )
}
