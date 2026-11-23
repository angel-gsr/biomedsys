import { afterEach, expect, it, vi } from "vitest"
import { HospitalSound, hospitalSoundPattern } from "./hospitalSound"
afterEach(() => vi.unstubAllGlobals())

it("uses distinct motifs for every code and longer general alerts", () => {
  const codes = ["ambar","azul","cafe","negro","rojo","rosa","verde","amarillo","blanco","magenta","morado","naranja","oro","plata"]
  expect(new Set(codes.map(code => JSON.stringify(hospitalSoundPattern(code,"todos").notes))).size).toBe(14)
  expect(hospitalSoundPattern("negro","todos").duration).toBe(18)
  expect(hospitalSoundPattern("azul","biomedicos").duration).toBe(6)
})

it("requires activation, queues different sounds and stops closed or muted alerts", async () => {
  const oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const close = vi.fn()
  vi.stubGlobal("AudioContext", class {
    state = "running"; currentTime = 10; destination = {}
    resume = vi.fn(); close = close
    createOscillator() { const oscillator = { type: "sine", frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }; oscillators.push(oscillator); return oscillator }
    createGain() { return { connect: vi.fn(), disconnect: vi.fn(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } } }
  })
  const sound = new HospitalSound()
  const general = { id: 1, code: "negro", audience: "todos" as const }, directed = { id: 2, code: "azul", audience: "biomedicos" as const }
  expect(sound.play(general)).toBe(false)
  await sound.enable()
  expect(sound.play(general)).toBe(true)
  const generalNodes = oscillators.length
  expect(generalNodes).toBeGreaterThan(20)
  sound.play(general)
  expect(oscillators).toHaveLength(generalNodes)
  sound.play(directed)
  expect(oscillators[generalNodes].start).toHaveBeenCalledWith(28)
  sound.retain(new Set([2]))
  expect(oscillators[0].stop).toHaveBeenLastCalledWith()
  expect(oscillators[generalNodes].stop).toHaveBeenCalledTimes(1)
  await sound.stop()
  expect(oscillators[generalNodes].stop).toHaveBeenLastCalledWith()
  expect(close).toHaveBeenCalledOnce()
})
