/**
 * Prosedur teksturaları THREE.DataTexture-a çevirir və keşləyir.
 * Generasiya JS-də gedir; zəif telefonda ana axını uzun bloklamamaq üçün teksturalar bir-bir, aralarda nəfəs verməklə hazırlanır
 * (useSurfaces). Native-də böyük teksturalar 256 pikseldir (Hermes-də JIT yoxdur), vebdə 512.
 */
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as THREE from 'three'
import { crumb } from '../lib/diag'
import * as G from './texgen'

const WEB = Platform.OS === 'web'
// Native-də generasiya Hermes-də JIT-siz gedir: ölçülər dörd dəfə az pikseldir, yoxsa açılış on saniyələrlə uzanır.
const BIG = WEB ? 512 : 128
const MID = WEB ? 256 : 128

const MAKERS = {
  planks: () => G.woodPlanks(BIG),
  plaster: () => G.plaster(MID),
  grain: () => G.woodGrain(MID),
  darkGrain: () => G.woodGrain(MID, 29, '#7a4e2c', '#3e2512'),
  marble: () => G.marbleTiles(BIG),
  runner: () => G.runner(WEB ? 128 : 64, MID),
  ceiling: () => G.ceilingTiles(MID),
  board: () => G.chalkboard(BIG, Math.round(BIG * 0.5625)),
  cork: () => G.cork(128),
  window: () => G.windowView(128, 192),
} satisfies Record<string, () => G.Surface>

export type SurfaceKey = keyof typeof MAKERS
export interface Mat { map: THREE.DataTexture; bumpMap?: THREE.DataTexture }

const surfaces = new Map<string, G.Surface>()
const textures = new Map<string, THREE.DataTexture>()

function toTexture(p: G.Pixels, srgb: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(p.data, p.width, p.height, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

function surface(key: SurfaceKey): G.Surface {
  let s = surfaces.get(key)
  if (!s) { s = MAKERS[key](); surfaces.set(key, s) }
  return s
}

/**
 * Təkrarlanma (repeat) teksturanın xassəsidir, ona görə hər (səth, repeat) cütü üçün ayrıca obyekt saxlanılır;
 * piksel massivi isə ortaqdır (yaddaşda bir dəfə).
 */
export function mat(key: SurfaceKey, rx = 1, ry = 1): Mat {
  const id = `${key}:${rx}:${ry}`
  const s = surface(key)
  let map = textures.get(id)
  if (!map) { map = toTexture(s.color, true); map.repeat.set(rx, ry); textures.set(id, map) }
  let bumpMap: THREE.DataTexture | undefined
  // Qabarıqlıq xəritəsi native-də buraxılır (əlavə tekstura və şeyder hesabı).
  if (s.bump && WEB) {
    bumpMap = textures.get(id + ':b')
    if (!bumpMap) { bumpMap = toTexture(s.bump, false); bumpMap.repeat.set(rx, ry); textures.set(id + ':b', bumpMap) }
  }
  return bumpMap ? { map, bumpMap } : { map }
}

/** Otaq nömrəsi lövhəciyi (mətnə görə keşlənir). */
export function plateTex(text: string): THREE.DataTexture {
  const id = `plate:${text}`
  let t = textures.get(id)
  if (!t) {
    t = toTexture(G.plate(text).color, true)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    textures.set(id, t)
  }
  return t
}

// Aralarda bir kadrlıq fasilə: yüklənmə göstəricisi dönməyə davam etsin.
const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 24))

/** Lazım olan səthləri bir-bir hazırlayır; hamısı hazır olanda true qaytarır. İkinci açılışda dərhal hazırdır (keş). */
export function useSurfaces(keys: SurfaceKey[]): boolean {
  const missing = keys.filter((k) => !surfaces.has(k))
  const [ready, setReady] = useState(missing.length === 0)
  const sig = keys.join(',')
  useEffect(() => {
    if (ready) return
    let alive = true
    void (async () => {
      for (const k of sig.split(',') as SurfaceKey[]) {
        if (!alive) return
        if (!surfaces.has(k)) { surface(k); await yieldFrame() }
      }
      if (alive) { crumb('gl_surfaces_ready', sig.split(',').length); setReady(true) }
    })()
    return () => { alive = false }
  }, [sig, ready])
  return ready
}
