/** Birinci şəxs kamerası (Canvas içində): oyunçunun vəziyyətini kameraya köçürür, toxunulan əşyanı tapır. */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { nearest, type PickFn, type Target, type Walker } from './walk'

/** Kameranı oyunçuya bağlayır, yaxındakı hədəfi izləyir, kadr sürəti aşağıdırsa xəbər verir. */
export function Rig({ walker, targets, onNear, pick, onSlow, onReady }: {
  walker: Walker; targets: readonly Target[]; onNear: (id: string | null) => void
  pick: MutableRefObject<PickFn | null>; onSlow?: () => void
  /** Səhnə ilk kadrlarını çəkəndə (keçid pərdəsini qaldırmaq üçün). */
  onReady?: () => void
}) {
  const { camera, size, scene, raycaster } = useThree()
  const last = useRef<string | null>(null)
  const perf = useRef({ n: 0, acc: 0, told: false })
  const tick = useRef(0)

  // Şaquli ekranda üfüqi baxış bucağı dar qalmasın: şaquli bucaq ekranın nisbətinə görə böyüyür.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const asp = size.width / Math.max(1, size.height)
    const fov = asp < 1 ? Math.max(64, Math.min(92, (2 * Math.atan(Math.tan((78 * Math.PI) / 360) / asp) * 180) / Math.PI)) : 66
    cam.fov = fov
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height])

  useEffect(() => {
    const v = new THREE.Vector2()
    pick.current = (nx, ny) => {
      raycaster.setFromCamera(v.set(nx, ny), camera)
      raycaster.far = 40
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        let o: THREE.Object3D | null = hit.object
        if (o.userData.noRay) continue
        while (o) { if (typeof o.userData.act === 'string') return o.userData.act; o = o.parent }
        return null // qarşıda divar və ya başqa əşya var
      }
      return null
    }
    return () => { pick.current = null }
  }, [camera, scene, raycaster, pick])

  // Veb E2E oyunçunun yerini buradan oxuyur (yalnız mövqe və rejim; məxfi məlumat yoxdur).
  useEffect(() => {
    if (typeof document === 'undefined') return
    const g = globalThis as { __karyeramWalker?: Walker }
    // Dəhliz və sinif eyni vaxtda yaddaşda ola bilər: sinif bağlananda əvvəlki (dəhliz) oyunçusu qayıdır.
    const prev = g.__karyeramWalker
    g.__karyeramWalker = walker
    return () => { if (g.__karyeramWalker === walker) g.__karyeramWalker = prev }
  }, [walker])

  useFrame((_, delta) => {
    // Zəif cihazda (10 kadr/san-ə qədər) yeriş sürəti düşmür; daha aşağıda addım məhdudlaşır ki, divardan keçməsin.
    const dt = Math.min(delta, 0.1)
    walker.update(dt)
    const bob = walker.moving ? Math.sin(walker.phase) * 0.02 * walker.moving : 0
    camera.position.set(walker.x, walker.eye + walker.floor + bob, walker.z)
    camera.rotation.set(walker.pitch, walker.yaw, 0, 'YXZ')
    if (tick.current === 2) onReady?.()
    if (++tick.current % 6 === 0) {
      const id = walker.mode === 'walk' ? nearest(walker.pose, targets)?.id ?? null : null
      if (id !== last.current) { last.current = id; onNear(id) }
    }
    const p = perf.current
    if (!p.told && onSlow) {
      p.n++; p.acc += delta
      // İlk 150 kadrın ortalaması 29 kadr/san-dən aşağıdırsa yüngül rejim təklif olunur.
      if (p.n === 150) { p.told = true; if (p.acc / 150 > 0.034) onSlow() }
    }
  })
  return null
}
