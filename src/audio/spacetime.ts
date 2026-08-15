/** Deep spacetime drone that reacts to mass, spin, and disk intensity. */
export class SpacetimeAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private oscs: OscillatorNode[] = []
  private gains: GainNode[] = []
  private lfo: OscillatorNode | null = null
  private lfoGain: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private started = false

  async start() {
    if (this.started) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctx()
    await this.ctx.resume()

    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 420
    this.filter.Q.value = 0.7
    this.filter.connect(this.master)
    this.master.connect(this.ctx.destination)

    const freqs = [38, 55, 82.5, 110, 165]
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator()
      const g = this.ctx!.createGain()
      o.type = i < 2 ? 'sine' : i < 4 ? 'triangle' : 'sine'
      o.frequency.value = f
      g.gain.value = i === 0 ? 0.22 : 0.06 / (i + 0.5)
      o.connect(g)
      g.connect(this.filter!)
      o.start()
      this.oscs.push(o)
      this.gains.push(g)
    })

    this.lfo = this.ctx.createOscillator()
    this.lfoGain = this.ctx.createGain()
    this.lfo.frequency.value = 0.07
    this.lfoGain.gain.value = 18
    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.oscs[0].frequency)
    this.lfo.start()

    const now = this.ctx.currentTime
    this.master.gain.linearRampToValueAtTime(0.55, now + 2.2)
    this.started = true
  }

  update(mass: number, spin: number, disk: number) {
    if (!this.ctx || !this.filter || !this.oscs.length) return
    const t = this.ctx.currentTime
    this.filter.frequency.setTargetAtTime(280 + mass * 180 + disk * 120, t, 0.25)
    this.oscs.forEach((o, i) => {
      const base = [38, 55, 82.5, 110, 165][i]
      o.frequency.setTargetAtTime(base * (0.92 + mass * 0.12 + spin * 0.08), t, 0.3)
    })
    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(0.05 + spin * 0.12, t, 0.4)
    }
    if (this.master) {
      this.master.gain.setTargetAtTime(0.25 + disk * 0.35, t, 0.35)
    }
  }

  async stop() {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setValueAtTime(this.master.gain.value, t)
    this.master.gain.linearRampToValueAtTime(0, t + 0.6)
    await new Promise((r) => setTimeout(r, 650))
    this.oscs.forEach((o) => {
      try {
        o.stop()
      } catch {
        /* already stopped */
      }
    })
    this.lfo?.stop()
    await this.ctx.close()
    this.ctx = null
    this.started = false
    this.oscs = []
    this.gains = []
  }
}
