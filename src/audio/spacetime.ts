/** Deep spacetime drone that reacts to mass, spin, and disk intensity. */
const BASE_FREQS = [55, 82.5, 110, 165, 220, 330]

export class SpacetimeAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private makeup: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private oscs: OscillatorNode[] = []
  private gains: GainNode[] = []
  private lfo: OscillatorNode | null = null
  private lfoGain: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private presence: BiquadFilterNode | null = null
  private highpass: BiquadFilterNode | null = null
  private noise: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null
  private noiseFilter: BiquadFilterNode | null = null
  private started = false

  async start() {
    if (this.started) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctx()
    await this.ctx.resume()

    this.highpass = this.ctx.createBiquadFilter()
    this.highpass.type = 'highpass'
    this.highpass.frequency.value = 40
    this.highpass.Q.value = 0.7

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 1600
    this.filter.Q.value = 0.85
    this.filter.connect(this.highpass)

    this.presence = this.ctx.createBiquadFilter()
    this.presence.type = 'peaking'
    this.presence.frequency.value = 420
    this.presence.Q.value = 1.1
    this.presence.gain.value = 8
    this.highpass.connect(this.presence)

    this.compressor = this.ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -22
    this.compressor.knee.value = 18
    this.compressor.ratio.value = 6
    this.compressor.attack.value = 0.012
    this.compressor.release.value = 0.22
    this.presence.connect(this.compressor)

    this.makeup = this.ctx.createGain()
    this.makeup.gain.value = 1.55
    this.compressor.connect(this.makeup)

    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    this.makeup.connect(this.master)
    this.master.connect(this.ctx.destination)

    const types: OscillatorType[] = ['sine', 'sine', 'triangle', 'triangle', 'sawtooth', 'sine']
    const levels = [0.48, 0.34, 0.28, 0.2, 0.09, 0.12]

    BASE_FREQS.forEach((f, i) => {
      const o = this.ctx!.createOscillator()
      const g = this.ctx!.createGain()
      o.type = types[i]
      o.frequency.value = f
      o.detune.value = i % 2 === 0 ? -6 : 8
      g.gain.value = levels[i]
      o.connect(g)
      g.connect(this.filter!)
      o.start()
      this.oscs.push(o)
      this.gains.push(g)
    })

    this.lfo = this.ctx.createOscillator()
    this.lfoGain = this.ctx.createGain()
    this.lfo.frequency.value = 0.09
    this.lfoGain.gain.value = 14
    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.oscs[0].frequency)
    this.lfo.start()

    this.noiseFilter = this.ctx.createBiquadFilter()
    this.noiseFilter.type = 'bandpass'
    this.noiseFilter.frequency.value = 720
    this.noiseFilter.Q.value = 1.4
    this.noiseFilter.connect(this.filter)

    this.noiseGain = this.ctx.createGain()
    this.noiseGain.gain.value = 0.16
    this.noiseGain.connect(this.noiseFilter)

    this.noise = this.ctx.createBufferSource()
    this.noise.buffer = this.makeNoise(this.ctx)
    this.noise.loop = true
    this.noise.connect(this.noiseGain)
    this.noise.start()

    const now = this.ctx.currentTime
    this.master.gain.linearRampToValueAtTime(0.92, now + 1.1)
    this.started = true
  }

  update(mass: number, spin: number, disk: number) {
    if (!this.ctx || !this.filter || !this.oscs.length) return
    const t = this.ctx.currentTime
    this.filter.frequency.setTargetAtTime(1100 + mass * 520 + disk * 700, t, 0.22)
    this.oscs.forEach((o, i) => {
      o.frequency.setTargetAtTime(BASE_FREQS[i] * (0.94 + mass * 0.14 + spin * 0.1), t, 0.28)
    })
    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(0.06 + spin * 0.18, t, 0.35)
    }
    if (this.presence) {
      this.presence.gain.setTargetAtTime(6.5 + disk * 4, t, 0.3)
      this.presence.frequency.setTargetAtTime(360 + mass * 90, t, 0.3)
    }
    if (this.noiseGain && this.noiseFilter) {
      this.noiseGain.gain.setTargetAtTime(0.1 + disk * 0.22, t, 0.3)
      this.noiseFilter.frequency.setTargetAtTime(520 + disk * 480 + spin * 160, t, 0.28)
    }
    if (this.master) {
      this.master.gain.setTargetAtTime(0.72 + disk * 0.28, t, 0.28)
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
    try {
      this.lfo?.stop()
      this.noise?.stop()
    } catch {
      /* already stopped */
    }
    await this.ctx.close()
    this.ctx = null
    this.started = false
    this.oscs = []
    this.gains = []
    this.lfo = null
    this.noise = null
  }

  private makeNoise(ctx: AudioContext) {
    const length = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buffer
  }
}
