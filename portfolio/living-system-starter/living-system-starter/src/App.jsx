import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './components/Experience.jsx'
import Overlay from './components/Overlay.jsx'
import { useStore } from './store.js'
import { SECTION_COUNT } from './scrollData.js'

export default function App() {
  const setScroll = useStore((s) => s.setScroll)
  const setMouse = useStore((s) => s.setMouse)

  useEffect(() => {
    // --- scroll → normalized 0..1 target (smoothing happens in CameraRail) ---
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setScroll(max > 0 ? window.scrollY / max : 0)
    }
    // --- mouse → -1..1 for parallax ---
    const onMove = (e) => {
      setMouse(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      )
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onMove)
    }
  }, [setScroll, setMouse])

  return (
    <>
      <div className="canvas-wrap">
        <Canvas
          camera={{ fov: 42, near: 0.1, far: 200 }}
          dpr={[1, 1.75]} /* DPR cap — free performance on retina/mobile */
        >
          <Experience />
        </Canvas>
      </div>

      {/* Invisible spacer that creates the scroll range: one viewport per station. */}
      <div className="scroll-space" style={{ height: `${SECTION_COUNT * 100}vh` }} />

      <Overlay />
    </>
  )
}
