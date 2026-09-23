import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

/**
 * GREY-BOX WORLD — every mesh here is a placeholder with the FINAL
 * position/scale. In Week 3 you replace each group with a glTF model,
 * keeping the same transforms. Do not skip this stage: layout + camera
 * framing get locked here, models come later.
 *
 * Layout map (top view):
 *
 *   browser(-14,6)  →  GATE(-8,0)  →  DISTRICT(0,-2)  →  VAULT(8,-4)
 *                         │
 *                    CONVEYOR (z=7, x:-8..4)      TOWER(2,-10)
 *                                                 TERMINAL(12,6)
 */

const SURFACE = '#2c2c42'
const SURFACE_LIGHT = '#3a3a56'
const ACCENT = '#3dffa0'
const WARN = '#ffb347'

function Box({ position, scale, color = SURFACE, ...props }) {
  return (
    <mesh position={position} scale={scale} {...props}>
      <boxGeometry />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  )
}

/** Little blinking status LED — the world's "alive" tell. */
function Led({ position, color = ACCENT, speed = 1 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const b = (Math.sin(clock.elapsedTime * 2.4 * speed + position[0] * 5) + 1) / 2
    ref.current.material.emissiveIntensity = 0.4 + b * 2.2
  })
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.07, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
    </mesh>
  )
}

function BrowserNode() {
  return (
    <group position={[-14, 0, 6]}>
      <Box position={[0, 1, 0]} scale={[1.4, 1, 0.2]} color={SURFACE_LIGHT} />
      <Box position={[0, 0.25, 0]} scale={[0.3, 0.5, 0.2]} />
      <Led position={[0, 1, 0.15]} />
    </group>
  )
}

function NginxGate() {
  return (
    <group position={[-8, 0, 0]}>
      {/* two pillars + lintel = the gate every request passes through */}
      <Box position={[-1.6, 1.5, 0]} scale={[0.7, 3, 0.7]} />
      <Box position={[1.6, 1.5, 0]} scale={[0.7, 3, 0.7]} />
      <Box position={[0, 3.2, 0]} scale={[4.4, 0.5, 0.9]} color={SURFACE_LIGHT} />
      {/* rotating beacon */}
      <Beacon position={[0, 3.8, 0]} />
    </group>
  )
}

function Beacon({ position }) {
  const ref = useRef()
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 1.2
  })
  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.35]} />
      <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.4} flatShading />
    </mesh>
  )
}

function ServerDistrict() {
  // heights vary = city skyline feel; each becomes a project building later
  const buildings = [
    [-1.8, 0, -1, 1.2, 2.6],
    [0, 0, -2.2, 1.4, 3.4],
    [1.9, 0, -1.2, 1.1, 2.0],
    [-0.9, 0, -3.6, 1.0, 1.8],
    [1.2, 0, -3.9, 1.3, 2.9],
  ]
  return (
    <group>
      {buildings.map(([x, , z, w, h], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box position={[0, h / 2, 0]} scale={[w, h, w]} />
          <Led position={[0, h + 0.12, 0]} speed={0.7 + i * 0.3} />
        </group>
      ))}
    </group>
  )
}

function Conveyor() {
  // belt + 4 pipeline stations: commit → build → test → deploy
  const stations = [-6.5, -3, 0.5, 4]
  return (
    <group position={[0, 0, 7]}>
      <Box position={[-1.25, 0.3, 0]} scale={[11.5, 0.25, 1.1]} color={SURFACE_LIGHT} />
      {stations.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <Box position={[0, 0.9, -0.9]} scale={[0.9, 1.4, 0.5]} />
          <Led position={[0, 1.75, -0.9]} color={i === 2 ? WARN : ACCENT} speed={1.4} />
        </group>
      ))}
    </group>
  )
}

function MonitoringTower() {
  return (
    <group position={[2, 0, -10]}>
      <Box position={[0, 2.2, 0]} scale={[0.9, 4.4, 0.9]} />
      <Box position={[0, 4.8, 0]} scale={[2.4, 1.4, 1.6]} color={SURFACE_LIGHT} />
      <Led position={[0.9, 5.4, 0.5]} speed={2} />
      <Led position={[-0.9, 5.4, 0.5]} color={WARN} speed={1.1} />
    </group>
  )
}

function DbVault() {
  return (
    <group position={[8, 0, -4]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[1.3, 1.5, 2.2, 10]} />
        <meshStandardMaterial color={SURFACE} flatShading />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[0.9, 1.3, 0.5, 10]} />
        <meshStandardMaterial color={SURFACE_LIGHT} flatShading />
      </mesh>
      <Led position={[0, 2.75, 0]} speed={0.5} />
    </group>
  )
}

function Terminal() {
  return (
    <group position={[12, 0, 6]}>
      <Box position={[0, 0.5, 0]} scale={[1.8, 1, 1.2]} />
      <Box position={[0, 1.45, -0.2]} scale={[1.6, 1, 0.15]} color="#101018" />
      <Led position={[0.6, 1.45, -0.1]} speed={3} />
    </group>
  )
}

export default function World() {
  return (
    <group>
      {/* ground + grid — the "blueprint" floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#0d0d17" />
      </mesh>
      <gridHelper args={[120, 60, '#22223a', '#15152a']} />

      <BrowserNode />
      <NginxGate />
      <ServerDistrict />
      <Conveyor />
      <MonitoringTower />
      <DbVault />
      <Terminal />
    </group>
  )
}
