import { useEffect, useRef, useState } from 'react'
import { SpacetimeAudio } from './audio/spacetime'
import { useBlackHole, type HorizonParams } from './hooks/useBlackHole'

const DEFAULTS: HorizonParams = {
  mass: 1.25,
  disk: 1.0,
  spin: 0.75,
  bloom: 0.9,
  quality: 0.8,
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paramsRef = useRef<HorizonParams>({ ...DEFAULTS })
  const audioRef = useRef<SpacetimeAudio | null>(null)
  const [entered, setEntered] = useState(false)
  const [mass, setMass] = useState(DEFAULTS.mass)
  const [disk, setDisk] = useState(DEFAULTS.disk)
  const [spin, setSpin] = useState(DEFAULTS.spin)
  const [bloom, setBloom] = useState(DEFAULTS.bloom)
  const [soundOn, setSoundOn] = useState(true)
  const [hint, setHint] = useState(true)

  useBlackHole(canvasRef, paramsRef, true)

  useEffect(() => {
    paramsRef.current = { mass, disk, spin, bloom, quality: DEFAULTS.quality }
    audioRef.current?.update(mass, spin, disk)
  }, [mass, disk, spin, bloom])

  useEffect(() => {
    if (!entered || !hint) return
    const id = window.setTimeout(() => setHint(false), 5200)
    return () => clearTimeout(id)
  }, [entered, hint])

  useEffect(() => {
    return () => {
      void audioRef.current?.stop()
    }
  }, [])

  const enter = async () => {
    setEntered(true)
    if (!audioRef.current) audioRef.current = new SpacetimeAudio()
    if (soundOn) {
      await audioRef.current.start()
      audioRef.current.update(mass, spin, disk)
    }
  }

  const toggleSound = async () => {
    if (!audioRef.current) audioRef.current = new SpacetimeAudio()
    if (soundOn) {
      await audioRef.current.stop()
      audioRef.current = new SpacetimeAudio()
      setSoundOn(false)
    } else {
      await audioRef.current.start()
      audioRef.current.update(mass, spin, disk)
      setSoundOn(true)
    }
  }

  return (
    <div className={`app${entered ? ' is-live' : ''}`}>
      <canvas ref={canvasRef} className="void" aria-hidden />

      <div className="atmosphere" aria-hidden />

      {!entered ? (
        <header className="gate">
          <p className="brand">Event Horizon</p>
          <h1 className="line">
            A black hole that runs
            <em> in your browser.</em>
          </h1>
          <p className="sub">
            Real-time gravitational lensing, a living accretion disk, and a spacetime drone —
            no install, no server, just light bending.
          </p>
          <div className="cta">
            <button type="button" className="enter" onClick={() => void enter()}>
              Cross the horizon
            </button>
            <label className="sound-opt">
              <input
                type="checkbox"
                checked={soundOn}
                onChange={(e) => setSoundOn(e.target.checked)}
              />
              With sound
            </label>
          </div>
        </header>
      ) : (
        <>
          <div className={`hint${hint ? '' : ' is-gone'}`} role="status">
            Drag to orbit · twist the dials · listen to the void
          </div>

          <aside className="panel" aria-label="Spacetime controls">
            <p className="panel-brand">Event Horizon</p>
            <label className="dial">
              <span>Mass</span>
              <input
                type="range"
                min={0.4}
                max={2.2}
                step={0.01}
                value={mass}
                onChange={(e) => setMass(Number(e.target.value))}
              />
            </label>
            <label className="dial">
              <span>Disk</span>
              <input
                type="range"
                min={0}
                max={1.6}
                step={0.01}
                value={disk}
                onChange={(e) => setDisk(Number(e.target.value))}
              />
            </label>
            <label className="dial">
              <span>Spin</span>
              <input
                type="range"
                min={0}
                max={1.4}
                step={0.01}
                value={spin}
                onChange={(e) => setSpin(Number(e.target.value))}
              />
            </label>
            <label className="dial">
              <span>Bloom</span>
              <input
                type="range"
                min={0}
                max={1.6}
                step={0.01}
                value={bloom}
                onChange={(e) => setBloom(Number(e.target.value))}
              />
            </label>
            <button type="button" className="ghost" onClick={() => void toggleSound()}>
              {soundOn ? 'Mute drone' : 'Hear the void'}
            </button>
          </aside>
        </>
      )}

      <footer className="credit">
        <span>GPU raymarch · Schwarzschild-inspired lensing</span>
        <a href="https://github.com/calap0309/event-horizon" target="_blank" rel="noreferrer">
          Source
        </a>
      </footer>
    </div>
  )
}
