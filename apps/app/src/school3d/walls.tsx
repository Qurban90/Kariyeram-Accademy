/**
 * Qapı yeri açıq olan divar və qapının o tayında görünən dəhliz parçası.
 * Divar bir bütöv müstəvi olsaydı qapı açılanda arxası görünməzdi; burada divar qapıların arasındakı parçalardan yığılır,
 * ona görə açıq qapıdan qonşu məkan (sinif, zal, dəhliz) həqiqətən görünür və tələbə qapıdan keçə bilir.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mat } from './textures'

/** Qapı yeri: mərkəz (divar boyunca), eni və hündürlüyü. */
export interface Opening { at: number; width: number; height: number }

function planeGeo(w: number, h: number, u0: number, u1: number, v0: number, v1: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.attributes.uv!
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i))
  return g
}

let cached: { wall: THREE.Material; panel: THREE.Material; rail: THREE.Material; cornice: THREE.Material } | null = null
function wallMats() {
  return (cached ??= {
    wall: new THREE.MeshStandardMaterial({ ...mat('plaster', 1, 1), roughness: 0.95, bumpScale: 0.6 }),
    panel: new THREE.MeshStandardMaterial({ ...mat('grain', 1, 1), roughness: 0.58 }),
    rail: new THREE.MeshStandardMaterial({ ...mat('darkGrain', 1, 3), roughness: 0.55 }),
    cornice: new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.5 }),
  })
}

/**
 * Lokal X boyunca `u0`-dan `u1`-ə uzanan, +Z-yə baxan divar: suvaq, aşağıda 1 m taxta panel, haşiyə, plintus və kornis.
 * Teksturanın sıxlığı metrlə sabitdir, ona görə parçaların birləşdiyi yer seçilmir.
 */
export function HoledWall({ u0, u1, height, openings = [], panel = true }: { u0: number; u1: number; height: number; openings?: Opening[]; panel?: boolean }) {
  const m = wallMats()
  const key = `${u0}:${u1}:${height}:${openings.map((o) => `${o.at},${o.width},${o.height}`).join('|')}`
  const parts = useMemo(() => {
    const ops = [...openings].sort((a, b) => a.at - b.at)
    const runs: [number, number][] = []
    let cur = u0
    for (const o of ops) { runs.push([cur, o.at - o.width / 2]); cur = o.at + o.width / 2 }
    runs.push([cur, u1])
    const solid = runs.filter(([a, b]) => b - a > 0.01)
    return {
      solid: solid.map(([a, b]) => ({ a, b, wall: planeGeo(b - a, height, a / 2.5, b / 2.5, 0, 1), panel: planeGeo(b - a, 1, a / 1.5, b / 1.5, 0, 1) })),
      lintels: ops.map((o) => ({ o, geo: planeGeo(o.width, height - o.height, (o.at - o.width / 2) / 2.5, (o.at + o.width / 2) / 2.5, o.height / height, 1) })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => () => { parts.solid.forEach((p) => { p.wall.dispose(); p.panel.dispose() }); parts.lintels.forEach((l) => l.geo.dispose()) }, [parts])
  return (
    <group>
      {parts.solid.map((p) => {
        const c = (p.a + p.b) / 2, len = p.b - p.a
        return (
          <group key={p.a}>
            <mesh geometry={p.wall} material={m.wall} position={[c, height / 2, 0]} receiveShadow />
            {panel ? (<>
              <mesh geometry={p.panel} material={m.panel} position={[c, 0.5, 0.006]} />
              <mesh position={[c, 1.02, 0.03]} material={m.rail}><boxGeometry args={[len, 0.05, 0.05]} /></mesh>
              <mesh position={[c, 0.06, 0.025]} material={m.rail}><boxGeometry args={[len, 0.12, 0.04]} /></mesh>
            </>) : null}
          </group>
        )
      })}
      {parts.lintels.map((l) => <mesh key={l.o.at} geometry={l.geo} material={m.wall} position={[l.o.at, (height + l.o.height) / 2, 0]} />)}
      <mesh position={[(u0 + u1) / 2, height - 0.06, 0.03]} material={m.cornice}><boxGeometry args={[u1 - u0, 0.12, 0.06]} /></mesh>
    </group>
  )
}

/**
 * Qapının o tayında görünən dəhliz parçası (sinifdən və ya zaldan çıxanda). Qapı lokal başlanğıcdadır və -Z-yə (otağa) baxır,
 * dəhliz +Z tərəfdədir. `along`: 'x' — dəhliz qapının qarşısından köndələn keçir (sinif); 'z' — qapıdan düz irəli uzanır (zal).
 */
export function CorridorStub({ along }: { along: 'x' | 'z' }) {
  const m = useMemo(() => ({
    floor: new THREE.MeshStandardMaterial({ ...mat('marble', 2, along === 'x' ? 5 : 6), roughness: 0.32, metalness: 0.05 }),
    runner: new THREE.MeshStandardMaterial({ ...mat('runner', 1, 5), roughness: 0.95 }),
    ceiling: new THREE.MeshStandardMaterial({ ...mat('ceiling', 3, 8), roughness: 1 }),
  }), [along])
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m])
  const W = 4, H = 3.2, L = along === 'x' ? 10 : 12
  // Dəhlizin öz oxu lokal Z-dir; köndələn halda 90° çevrilir.
  return (
    <group position={along === 'x' ? [0, 0, W / 2] : [0, 0, L / 2]} rotation={[0, along === 'x' ? Math.PI / 2 : 0, 0]} userData={{ noRay: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={m.floor}><planeGeometry args={[W, L]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} material={m.runner}><planeGeometry args={[1.5, L]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]} material={m.ceiling}><planeGeometry args={[W, L]} /></mesh>
      {/* Qarşı divar(lar): köndələn dəhlizdə qapının qarşısındakı divar, düz dəhlizdə hər iki yan divar. */}
      {(along === 'x' ? [-1] : [-1, 1]).map((s) => (
        <group key={s} position={[s * (W / 2), 0, 0]} rotation={[0, -s * Math.PI / 2, 0]}>
          <HoledWall u0={-L / 2} u1={L / 2} height={H} />
        </group>
      ))}
      <pointLight position={[0, H - 0.4, 0]} intensity={5} distance={9} decay={1.5} color="#ffeccc" />
      <mesh position={[0, H - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.28, 24]} /><meshStandardMaterial color="#fffbe8" emissive="#fff0c4" emissiveIntensity={1.4} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}
