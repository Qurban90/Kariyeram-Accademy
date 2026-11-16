/**
 * 3D məktəb dəhlizi (FR-050). Prosedur teksturalar (mərmər döşəmə, xalça, suvaq, taxta panel, tavan), mis nömrə lövhəcikləri,
 * divarlarda tablolar, sonda oxu zalının ikiqanadlı qapısı. Kölgə yoxdur (dəhlizdə nöqtəvi işıqların kölgəsi bahalıdır).
 * Vebdə '@react-three/fiber', native-də paketin "react-native" girişi avtomatik seçilir (expo-gl).
 * Tələbə dəhlizdə özü gəzir (Rig + WalkPad). Divarlarda qapı yerləri açıqdır: seçilən qapı açılanda arxasında
 * həmin sinfin (və ya oxu zalının) interyeri görünür və tələbə qapıdan içəri yeriyir.
 * Toxunula bilən əşyalar `userData.act` daşıyır: 'door:N', 'hall', 'board'.
 * Əlçatanlıq üçün eyni seçim menyudakı siyahı ilə də mümkündür (Corridor3D).
 */
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { Loading } from '../components/ui'
import { approach, corridorLength, CORRIDOR_WIDTH, DOOR_SPACING, doorSpots } from './layout'
import { Rig } from './Rig'
import { mat, plateTex, useSurfaces, type SurfaceKey } from './textures'
import { HallInterior, HALL_SURFACES } from './Auditorium'
import { RoomInterior, ROOM_SURFACES } from './StudyRoom'
import { CORRIDOR_BACK, HALL, HALL_TOP, ROOM, type PickFn, type Target, type Walker } from './walk'
import { HoledWall } from './walls'

export interface CorridorDoor { key: string; label?: string }

// Sinfin və zalın səthləri də burada hazırlanır: qapı açılanda interyer dərhal görünür, otağa keçid gözləmədən olur.
const NEEDED: SurfaceKey[] = [...new Set<SurfaceKey>(['marble', 'runner', 'plaster', 'grain', 'darkGrain', 'ceiling', 'window', 'cork', ...ROOM_SURFACES, ...HALL_SURFACES])]
const DOOR_OPEN = { width: 1.08, height: 2.3 } as const
const HALL_OPEN = { width: 2.3, height: 2.75 } as const
const H = 3.2

function makeMats() {
  return {
    leaf: new THREE.MeshStandardMaterial({ ...mat('grain', 1, 2), roughness: 0.5 }),
    frame: new THREE.MeshStandardMaterial({ ...mat('darkGrain', 1, 3), roughness: 0.55 }),
    hall: new THREE.MeshStandardMaterial({ ...mat('darkGrain', 1, 2), roughness: 0.45, color: '#d9b9a0' }),
    brass: new THREE.MeshStandardMaterial({ color: '#d4af5a', metalness: 0.85, roughness: 0.25 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe0da', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1 }),
    inside: new THREE.MeshStandardMaterial({ color: '#3a2a1a', emissive: '#ffcf8a', emissiveIntensity: 0.55 }),
    trim: new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.5 }),
    pot: new THREE.MeshStandardMaterial({ color: '#9a5a3a', roughness: 0.8 }),
    leafy: new THREE.MeshStandardMaterial({ color: '#4f7a45', roughness: 0.9 }),
    board: new THREE.MeshStandardMaterial({ color: '#1d3b2f', roughness: 0.9 }),
  }
}
let shared: ReturnType<typeof makeMats> | null = null
/** Sabit materiallar bir dəfə yaradılır və bütün qapılar arasında paylaşılır. */
function mats() {
  return (shared ??= makeMats())
}

function Door({ x, z, rotY, label, active, act, low }: { x: number; z: number; rotY: number; label: string; active: boolean; act: string; low: boolean }) {
  const m = mats()
  const leaf = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    // Seçilən qapı menteşə ətrafında içəri açılır.
    if (leaf.current) leaf.current.rotation.y = approach(leaf.current.rotation.y, active ? 1.25 : 0, dt, 4)
  })
  const plate = plateTex(label)
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]} userData={{ act }}>
      {/* Çərçivə (arxitrav) */}
      {[[-0.6, 1.15, 0.12, 2.36], [0.6, 1.15, 0.12, 2.36], [0, 2.36, 1.32, 0.14]].map(([px, py, w, h], i) => (
        <mesh key={i} position={[px!, py!, 0.03]} material={m.frame}><boxGeometry args={[w!, h!, 0.08]} /></mesh>
      ))}
      {/* Bağlı qapının arxası tünddür; seçilən qapının arxasında sinfin özü görünür (çıxış qapısı bu qapı ilə üst-üstə düşür). */}
      {active
        ? <group position={[-ROOM.doorX, 0, -ROOM.back - 0.02]}><RoomInterior low={low} roomNo={label} lights={false} /></group>
        : <mesh position={[0, 1.2, -0.3]} material={m.inside}><planeGeometry args={[1.5, 2.6]} /></mesh>}
      <group ref={leaf} position={[-0.54, 0, 0.04]}>
        <group position={[0.54, 0, 0]}>
          <mesh position={[0, 1.1, 0]} material={m.leaf}><boxGeometry args={[1.06, 2.2, 0.05]} /></mesh>
          {/* Panellər, şüşə, dəstək */}
          <mesh position={[0, 0.55, 0.03]} material={m.frame}><boxGeometry args={[0.78, 0.7, 0.015]} /></mesh>
          <mesh position={[0, 1.55, 0.028]} material={m.glass}><planeGeometry args={[0.5, 0.6]} /></mesh>
          <mesh position={[0.4, 1.05, 0.06]} rotation={[0, 0, Math.PI / 2]} material={m.brass}><cylinderGeometry args={[0.018, 0.018, 0.14, 10]} /></mesh>
          <mesh position={[0.4, 1.05, 0.035]} material={m.brass}><boxGeometry args={[0.05, 0.16, 0.012]} /></mesh>
        </group>
      </group>
      {/* Otaq nömrəsi lövhəciyi */}
      <mesh position={[0, 2.62, 0.04]}><planeGeometry args={[0.5, 0.19]} /><meshStandardMaterial map={plate} metalness={0.5} roughness={0.35} /></mesh>
    </group>
  )
}

function HallDoors({ z, active, live, low }: { z: number; active: boolean; live: boolean; low: boolean }) {
  const m = mats()
  const l = useRef<THREE.Group>(null), r = useRef<THREE.Group>(null), sign = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }, dt) => {
    if (l.current) l.current.rotation.y = approach(l.current.rotation.y, active ? 1.1 : 0, dt, 3)
    if (r.current) r.current.rotation.y = approach(r.current.rotation.y, active ? -1.1 : 0, dt, 3)
    if (sign.current) sign.current.emissiveIntensity = live ? 0.8 + Math.sin(clock.getElapsedTime() * 3) * 0.4 : 0
  })
  return (
    <group position={[0, 0, z]} userData={{ act: 'hall' }}>
      {[[-1.3, 1.5, 0.3, 3.0], [1.3, 1.5, 0.3, 3.0], [0, 2.875, 2.9, 0.25]].map(([px, py, w, h], i) => (
        <mesh key={i} position={[px!, py!, -0.02]} material={m.frame}><boxGeometry args={[w!, h!, 0.08]} /></mesh>
      ))}
      {/* Seçiləndə qapının arxasında zalın özü görünür: giriş yuxarı meydançadadır, ona görə zal aşağı sürüşdürülüb. */}
      {active
        ? <group position={[-HALL.doorX, -HALL_TOP, -HALL.back - 0.06]}><HallInterior low={low} lights={false} /></group>
        : <mesh position={[0, 1.4, -0.4]} material={m.inside}><planeGeometry args={[2.8, 3.0]} /></mesh>}
      {[[-1, l] as const, [1, r] as const].map(([s, ref]) => (
        <group key={s} ref={ref} position={[s * 1.15, 0, 0.03]}>
          <mesh position={[-s * 0.575, 1.37, 0]} material={m.hall}><boxGeometry args={[1.13, 2.74, 0.07]} /></mesh>
          <mesh position={[-s * 0.575, 0.75, 0.045]} material={m.frame}><boxGeometry args={[0.8, 0.9, 0.015]} /></mesh>
          <mesh position={[-s * 0.575, 1.95, 0.045]} material={m.frame}><boxGeometry args={[0.8, 1.0, 0.015]} /></mesh>
          <mesh position={[-s * 1.05, 1.35, 0.08]} material={m.brass}><boxGeometry args={[0.03, 0.5, 0.03]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 3.08, 0.04]}><planeGeometry args={[0.7, 0.26]} /><meshStandardMaterial map={plateTex('ZAL')} metalness={0.5} roughness={0.35} /></mesh>
      {/* "Canlı" işığı */}
      <mesh position={[0.6, 3.08, 0.05]}><sphereGeometry args={[0.06, 14, 10]} /><meshStandardMaterial ref={sign} color={live ? '#e36b5d' : '#5a3a35'} emissive="#ff3020" emissiveIntensity={0} /></mesh>
    </group>
  )
}

function Painting({ x, z, side, seed }: { x: number; z: number; side: 1 | -1; seed: number }) {
  const m = mats()
  return (
    <group position={[x, 1.75, z]} rotation={[0, side === 1 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh material={m.frame}><boxGeometry args={[1.0, 0.75, 0.05]} /></mesh>
      <mesh position={[0, 0, 0.028]}><planeGeometry args={[0.86, 0.61]} /><meshStandardMaterial map={mat('window').map} color={seed % 2 ? '#f2e4c8' : '#e4ecf0'} roughness={0.8} /></mesh>
    </group>
  )
}

function Plant({ x, z }: { x: number; z: number }) {
  const m = mats()
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.25, 0]} material={m.pot}><cylinderGeometry args={[0.2, 0.15, 0.5, 16]} /></mesh>
      {[[0, 0.75, 0, 0.3], [0.12, 0.95, 0.05, 0.22], [-0.1, 0.9, -0.06, 0.24], [0, 1.12, 0, 0.18]].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px!, py!, pz!]} material={m.leafy}><icosahedronGeometry args={[r!, 1]} /></mesh>
      ))}
    </group>
  )
}

/** Dəhlizin girişi (oyunçunun arxasındakı divar): bağlı ikiqanadlı qapı və üstündə pəncərə. */
function Entrance({ z, wall }: { z: number; wall: THREE.Material }) {
  const m = mats()
  return (
    <group position={[0, 0, z]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, H / 2, 0]} material={wall}><planeGeometry args={[CORRIDOR_WIDTH, H]} /></mesh>
      <mesh position={[0, 1.3, 0.03]} material={m.frame}><boxGeometry args={[2.5, 2.6, 0.08]} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.56, 0, 0.08]}>
          <mesh position={[0, 1.24, 0]} material={m.hall}><boxGeometry args={[1.08, 2.44, 0.06]} /></mesh>
          <mesh position={[0, 1.7, 0.035]} material={m.glass}><planeGeometry args={[0.7, 1.0]} /></mesh>
          <mesh position={[0, 0.6, 0.035]} material={m.frame}><boxGeometry args={[0.76, 0.7, 0.015]} /></mesh>
          <mesh position={[-s * 0.42, 1.2, 0.07]} material={m.brass}><boxGeometry args={[0.03, 0.42, 0.03]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 2.86, 0.04]}><planeGeometry args={[2.3, 0.42]} /><meshBasicMaterial map={mat('window').map} toneMapped={false} color="#dfe8ea" /></mesh>
    </group>
  )
}

export function SchoolCorridor({ doors, selected, hallLive, walker, targets, onNear, pick, onSlow, onReady, low, active }: {
  doors: CorridorDoor[]; selected: number | 'hall' | null; hallLive: boolean
  walker: Walker; targets: readonly Target[]; onNear: (id: string | null) => void; pick: MutableRefObject<PickFn | null>
  onSlow: () => void; onReady?: () => void
  /** Yüngül rejim: piksel sıxlığı 1, işıqların yarısı. */
  low: boolean
  /** Ekran görünmürsə (başqa səhifə açıqdır) çəkiliş dayanır. */
  active: boolean
}) {
  const ready = useSurfaces(NEEDED)
  const spots = useMemo(() => doorSpots(doors.length), [doors.length])
  const len = corridorLength(doors.length)
  const L = len + 8, zc = -len / 2 + 2
  const lights = useMemo(() => Array.from({ length: Math.ceil(len / 4.5) + 1 }, (_, i) => 1.5 - i * 4.5), [len])
  const paintings = useMemo(() => {
    const pairs = Math.ceil(doors.length / 2)
    return Array.from({ length: pairs }, (_, i) => -3 - i * DOOR_SPACING - DOOR_SPACING / 2).filter((z) => z > -len + 1.5)
  }, [doors.length, len])

  const surf = useMemo(() => {
    if (!ready) return null
    const w = CORRIDOR_WIDTH
    return {
      floor: new THREE.MeshStandardMaterial({ ...mat('marble', w / 2, Math.round(L / 2)), roughness: 0.32, metalness: 0.05, bumpScale: 1.2 }),
      runner: new THREE.MeshStandardMaterial({ ...mat('runner', 1, Math.round(L / 2)), roughness: 0.95 }),
      endWall: new THREE.MeshStandardMaterial({ ...mat('plaster', 2, 1), roughness: 0.95 }),
      ceiling: new THREE.MeshStandardMaterial({ ...mat('ceiling', Math.round(w / 1.2), Math.round(L / 1.2)), roughness: 1 }),
    }
  }, [ready, L])
  useEffect(() => () => { if (surf) Object.values(surf).forEach((x) => x.dispose()) }, [surf])

  if (!surf) return <Loading />
  const m = mats()
  const W = CORRIDOR_WIDTH
  return (
    <Canvas frameloop={active ? 'always' : 'never'} dpr={low ? 1 : [1, 1.5]} camera={{ fov: 70, near: 0.05, far: 80, position: [walker.x, walker.eye, walker.z] }} gl={{ antialias: !low, powerPreference: 'low-power' }}>
      <color attach="background" args={['#1a140e']} />
      <fog attach="fog" args={['#1a140e', 14, 34]} />
      <ambientLight intensity={0.32} />
      <hemisphereLight args={['#fff4dc', '#4a3624', 0.5]} />
      {lights.map((z, i) => (
        <group key={z}>
          {!low || i % 2 === 0 ? <pointLight position={[0, H - 0.35, z]} intensity={low ? 7 : 4.5} distance={low ? 12 : 8} decay={1.5} color="#ffeccc" /> : null}
          <mesh position={[0, H - 0.01, z]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.28, 24]} /><meshStandardMaterial color="#fffbe8" emissive="#fff0c4" emissiveIntensity={1.4} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
      {/* Döşəmə, xalça, tavan, divarlar */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, zc]} material={surf.floor}><planeGeometry args={[W, L]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, zc + 1]} material={surf.runner}><planeGeometry args={[1.5, L - 2]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, zc]} material={surf.ceiling}><planeGeometry args={[W, L]} /></mesh>
      {/* Yan divarlar: lokal ox divar boyuncadır (u = s·z), qapıların yeri açıqdır */}
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[s * W / 2, 0, 0]} rotation={[0, -s * Math.PI / 2, 0]}>
          <HoledWall u0={s === 1 ? -len - 0.2 : -CORRIDOR_BACK} u1={s === 1 ? CORRIDOR_BACK : len + 0.2} height={H}
            openings={spots.filter((d) => d.side === s).map((d) => ({ at: s * d.z, ...DOOR_OPEN }))} />
        </group>
      ))}
      <group position={[0, 0, -len - 0.06]}><HoledWall u0={-W / 2} u1={W / 2} height={H} openings={[{ at: 0, ...HALL_OPEN }]} /></group>
      {/* Girişdəki şərəf lövhəsi (sol divar) */}
      <group position={[-W / 2 + 0.04, 1.75, 1.2]} rotation={[0, Math.PI / 2, 0]} userData={{ act: 'board' }}>
        <mesh material={m.brass}><boxGeometry args={[1.6, 1.0, 0.05]} /></mesh>
        <mesh position={[0, 0, 0.03]} material={m.board}><planeGeometry args={[1.45, 0.85]} /></mesh>
        {[0.25, 0.08, -0.09, -0.26].map((y, i) => (
          <mesh key={y} position={[-0.1 + (i % 2) * 0.05, y, 0.035]} material={m.brass}><planeGeometry args={[1.0 - i * 0.12, 0.05]} /></mesh>
        ))}
      </group>
      {/* Elan lövhəsi (sağ divar) */}
      <group position={[W / 2 - 0.04, 1.7, 1.2]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={m.frame}><boxGeometry args={[1.3, 0.9, 0.04]} /></mesh>
        <mesh position={[0, 0, 0.025]}><planeGeometry args={[1.18, 0.78]} /><meshStandardMaterial {...mat('cork')} roughness={1} /></mesh>
        <mesh position={[-0.25, 0.08, 0.03]} rotation={[0, 0, 0.06]}><planeGeometry args={[0.36, 0.46]} /><meshStandardMaterial color="#fffbea" /></mesh>
        <mesh position={[0.25, -0.05, 0.03]} rotation={[0, 0, -0.05]}><planeGeometry args={[0.34, 0.4]} /><meshStandardMaterial color="#e3f0ff" /></mesh>
      </group>
      <Plant x={-W / 2 + 0.35} z={2.6} />
      <Plant x={W / 2 - 0.35} z={2.6} />
      {paintings.flatMap((z, i) => [
        <Painting key={`l${z}`} x={-W / 2 + 0.03} z={z} side={-1} seed={i} />,
        <Painting key={`r${z}`} x={W / 2 - 0.03} z={z} side={1} seed={i + 1} />,
      ])}
      {spots.map((s) => (
        <Door key={doors[s.index]!.key} x={s.x} z={s.z} rotY={s.rotY} label={doors[s.index]!.label ?? ''} active={selected === s.index} act={`door:${s.index}`} low={low} />
      ))}
      <HallDoors z={-len} active={selected === 'hall'} live={hallLive} low={low} />
      <Entrance z={CORRIDOR_BACK} wall={surf.endWall} />
      <Rig walker={walker} targets={targets} onNear={onNear} pick={pick} onSlow={onSlow} onReady={onReady} />
    </Canvas>
  )
}
