import { useStore } from '../store.js'
import { STATIONS, SECTION_COUNT } from '../scrollData.js'

/**
 * DOM overlay — the text layer.
 * 3D text is expensive and blurry; real content lives in HTML on top.
 * Cards fade in when their station is the active one.
 */
export default function Overlay() {
  const section = useStore((s) => s.section)

  return (
    <>
      <div className="overlay">
        {STATIONS.map((st, i) => (
          <div
            key={st.id}
            className={`section-card ${i === section ? 'visible' : ''}`}
            data-side={st.side}
          >
            <div className="kicker">{st.kicker}</div>
            <h2>{st.title}</h2>
            <p>{st.body}</p>
          </div>
        ))}
      </div>

      {/* progress dots */}
      <div className="hud-progress">
        {Array.from({ length: SECTION_COUNT }, (_, i) => (
          <div key={i} className={`dot ${i === section ? 'active' : ''}`} />
        ))}
      </div>

      {section === 0 && <div className="scroll-hint">Scroll to enter the system</div>}
    </>
  )
}
