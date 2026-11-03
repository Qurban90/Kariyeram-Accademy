import { useApp } from '../store/useApp'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx ??= new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Daş qoyulanda qısa "tak". */
function thud(freq: number, dur: number, vol: number) {
  const a = audio()
  if (!a) return
  const t = a.currentTime
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur)
}

export const fx = {
  stone() {
    const { sound, haptic } = useApp.getState().settings
    if (sound) thud(190, 0.14, 0.18)
    if (haptic) navigator.vibrate?.(18)
  },
  crack() {
    const { sound, haptic } = useApp.getState().settings
    if (sound) thud(95, 0.22, 0.2)
    if (haptic) navigator.vibrate?.([30, 40, 30])
  },
  tap() {
    if (useApp.getState().settings.haptic) navigator.vibrate?.(8)
  },
}
