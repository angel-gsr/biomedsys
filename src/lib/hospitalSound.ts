export type SoundAlert = { id: number; code: string; audience: "todos" | "biomedicos" }

// App notification patterns, not official hospital siren signals.
const melodies: Record<string, number[]> = {
  ambar: [520, 660, 520], azul: [880, 660, 880, 1040],
  cafe: [330, 440, 550], negro: [440, 880, 440, 880],
  rojo: [660, 990, 660, 990], rosa: [740, 880, 1100],
  verde: [440, 550, 660, 880], amarillo: [1000, 750, 500],
  blanco: [660, 520, 660], magenta: [550, 830, 550, 660],
  morado: [400, 600, 800], naranja: [600, 800, 1000],
  oro: [700, 900, 1050], plata: [1200, 800, 1200, 600],
}

export function hospitalSoundPattern(code: string, audience: SoundAlert["audience"]) {
  return { notes: melodies[code] || [660, 880, 660], duration: audience === "todos" ? 18 : 6, beat: audience === "todos" ? .4 : .5 }
}

export class HospitalSound {
  private context?: AudioContext
  private jobs = new Map<number, { nodes: Set<OscillatorNode>; end: number }>()
  async enable() {
    this.context ||= new AudioContext()
    await this.context.resume()
    if (this.context.state !== "running") throw new Error("Activa el sonido desde este botón para permitir la alerta audible.")
  }
  play(alert: SoundAlert) {
    const context = this.context
    if (!context || context.state !== "running") return false
    if (this.jobs.has(alert.id)) return true
    const pattern = hospitalSoundPattern(alert.code, alert.audience)
    // Queue different incidents rather than superimposing their sounds.
    const start = Math.max(context.currentTime, ...Array.from(this.jobs.values(), job => job.end))
    const job = { nodes: new Set<OscillatorNode>(), end: start + pattern.duration }
    this.jobs.set(alert.id, job)
    const noteLength = pattern.beat * .7
    for (let offset = 0, i = 0; offset + noteLength <= pattern.duration; offset += pattern.beat, i++) {
      const oscillator = context.createOscillator(), gain = context.createGain()
      const at = start + offset
      oscillator.type = "sine"; oscillator.frequency.value = pattern.notes[i % pattern.notes.length]
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.18, at + .02); gain.gain.exponentialRampToValueAtTime(.001, at + noteLength)
      oscillator.connect(gain); gain.connect(context.destination)
      job.nodes.add(oscillator)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); job.nodes.delete(oscillator); if (!job.nodes.size && this.jobs.get(alert.id) === job) this.jobs.delete(alert.id) }
      oscillator.start(at); oscillator.stop(at + noteLength)
    }
    return true
  }
  retain(activeIds: Set<number>) {
    for (const [id, job] of this.jobs) {
      if (activeIds.has(id)) continue
      job.nodes.forEach(node => { try { node.stop() } catch { /* Already stopped. */ } })
      this.jobs.delete(id)
    }
  }
  async stop() {
    this.retain(new Set())
    if (this.context) { const context = this.context; this.context = undefined; await context.close() }
  }
}
