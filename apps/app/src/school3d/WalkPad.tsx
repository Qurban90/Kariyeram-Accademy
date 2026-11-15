/**
 * Giriş qatı (Canvas-ın üstündə şəffaf sahə). Telefonda ekranın sol yarısı joystikdir (yerimək), sağ yarısı baxışdır;
 * qısa toxunuş əşyanı seçir. Kompüterdə W A S D / oxlar yeridir, siçanla sürüşdürmək baxışı çevirir.
 * Vebdə Pointer Events (çox barmaq, siçan), native-də toxunma hadisələri işlənir.
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import type { Walker } from './walk'

interface Touch { mover: boolean; sx: number; sy: number; x: number; y: number; t: number; moved: number }
const STICK_R = 50

/** Qısa toxunuşda `onTap` NDC koordinatı ilə çağırılır. */
export function WalkPad({ walker, onTap, enabled = true, testID }: {
  walker: Walker; onTap: (nx: number, ny: number) => void; enabled?: boolean; testID?: string
}) {
  const ref = useRef<ComponentRef<typeof View>>(null)
  const size = useRef({ w: 1, h: 1 })
  const origin = useRef({ x: 0, y: 0 })
  const touches = useRef(new Map<number, Touch>())
  const [stick, setStick] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null)
  const live = useRef({ enabled, onTap })
  live.current = { enabled, onTap }

  const api = useRef({
    begin(id: number, x: number, y: number, mouse: boolean) {
      if (!live.current.enabled) return
      const mover = !mouse && x < size.current.w * 0.45 && walker.mode === 'walk' && ![...touches.current.values()].some((t) => t.mover)
      touches.current.set(id, { mover, sx: x, sy: y, x, y, t: Date.now(), moved: 0 })
      if (mover) setStick({ x, y, kx: 0, ky: 0 })
    },
    move(id: number, x: number, y: number) {
      const p = touches.current.get(id)
      if (!p) return
      const dx = x - p.x, dy = y - p.y
      p.x = x; p.y = y; p.moved += Math.abs(dx) + Math.abs(dy)
      if (p.mover) {
        const vx = Math.max(-1, Math.min(1, (x - p.sx) / STICK_R)), vy = Math.max(-1, Math.min(1, (y - p.sy) / STICK_R))
        walker.stick.x = vx; walker.stick.y = vy
        setStick({ x: p.sx, y: p.sy, kx: vx, ky: vy })
      } else walker.look(dx, dy)
    },
    end(id: number) {
      const p = touches.current.get(id)
      if (!p) return
      touches.current.delete(id)
      if (p.mover) { walker.stick.x = 0; walker.stick.y = 0; setStick(null) }
      if (p.moved < 10 && Date.now() - p.t < 420 && live.current.enabled) {
        live.current.onTap((p.x / size.current.w) * 2 - 1, -(p.y / size.current.h) * 2 + 1)
      }
    },
    reset() {
      touches.current.clear()
      walker.stick.x = 0; walker.stick.y = 0
      walker.keys.fwd = 0; walker.keys.side = 0; walker.keys.turn = 0
      setStick(null)
    },
  }).current

  useEffect(() => { if (!enabled) api.reset() }, [enabled, api])
  useEffect(() => () => api.reset(), [api])

  // Veb: Pointer Events və klaviatura.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const el = ref.current as unknown as HTMLElement | null
    if (!el?.addEventListener) return
    const rel = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const down = (e: PointerEvent) => {
      try { el.setPointerCapture(e.pointerId) } catch { /* köhnə brauzer */ }
      const p = rel(e)
      api.begin(e.pointerId, p.x, p.y, e.pointerType === 'mouse')
    }
    const move = (e: PointerEvent) => { const p = rel(e); api.move(e.pointerId, p.x, p.y) }
    const up = (e: PointerEvent) => api.end(e.pointerId)
    const menu = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('contextmenu', menu)
    const held = new Set<string>()
    const sync = () => {
      const on = (...k: string[]) => (k.some((x) => held.has(x)) ? 1 : 0)
      walker.keys.fwd = on('w', 'arrowup') - on('s', 'arrowdown')
      walker.keys.side = on('d') - on('a')
      walker.keys.turn = on('arrowleft') - on('arrowright')
    }
    const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) }
    const kd = (e: KeyboardEvent) => { if (typing(e) || !live.current.enabled) return; held.add(e.key.toLowerCase()); sync() }
    const ku = (e: KeyboardEvent) => { held.delete(e.key.toLowerCase()); sync() }
    const blur = () => { held.clear(); sync() }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur)
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('contextmenu', menu)
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur)
      held.clear(); sync()
    }
  }, [api, walker])

  // Native: bir cavabdeh görünüş bütün barmaqları alır (joystik və baxış eyni vaxtda işləyir).
  const native = Platform.OS === 'web' ? {} : {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderStart: (e: GestureResponderEvent) => {
      for (const t of e.nativeEvent.changedTouches) if (!touches.current.has(Number(t.identifier))) api.begin(Number(t.identifier), t.pageX - origin.current.x, t.pageY - origin.current.y, false)
    },
    onResponderMove: (e: GestureResponderEvent) => {
      for (const t of e.nativeEvent.touches) api.move(Number(t.identifier), t.pageX - origin.current.x, t.pageY - origin.current.y)
    },
    onResponderEnd: (e: GestureResponderEvent) => { for (const t of e.nativeEvent.changedTouches) api.end(Number(t.identifier)) },
    onResponderRelease: () => { for (const id of [...touches.current.keys()]) api.end(id) },
    onResponderTerminate: () => api.reset(),
  }
  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: Math.max(1, e.nativeEvent.layout.width), h: Math.max(1, e.nativeEvent.layout.height) }
    const node = ref.current as unknown as { measureInWindow?: (cb: (x: number, y: number) => void) => void } | null
    node?.measureInWindow?.((x, y) => { origin.current = { x: x || 0, y: y || 0 } })
  }

  return (
    <View ref={ref} testID={testID} onLayout={onLayout} style={st.pad} {...native}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {stick ? (
        <View pointerEvents="none" style={[st.stick, { left: stick.x - 60, top: stick.y - 60 }]}>
          <View style={[st.knob, { transform: [{ translateX: stick.kx * 34 }, { translateY: stick.ky * 34 }] }]} />
        </View>
      ) : null}
    </View>
  )
}

const st = StyleSheet.create({
  // touchAction: brauzer sürüşdürməni səhifə sürüşməsi saymasın.
  pad: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...(Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none', cursor: 'grab' } as object) : null) },
  stick: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(246,237,224,0.38)', backgroundColor: 'rgba(246,237,224,0.07)', alignItems: 'center', justifyContent: 'center' },
  knob: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(246,237,224,0.36)', borderWidth: 2, borderColor: 'rgba(246,237,224,0.62)' },
})
