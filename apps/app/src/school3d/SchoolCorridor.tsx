/**
 * 3D məktəb dəhlizi (FR-050). Aşağı poliqonlu, kölgəsiz, şəkilsiz: zəif cihazda da yüngül olsun.
 * Vebdə '@react-three/fiber', native-də paketin "react-native" girişi avtomatik seçilir (expo-gl).
 * Qapıya toxunanda kamera ora "yeriyir", sonra onSelect çağırılır. Əlçatanlıq üçün eyni seçim 2D siyahı ilə də mümkündür.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { approach, angleDelta, corridorLength, CORRIDOR_WIDTH, doorSpots, EYE_HEIGHT, standBefore } from './layout'

export interface CorridorDoor { key: string; color?: string; live?: boolean }

const WOOD = '#6b4a2f', FRAME = '#8a6342', BRASS = '#d4af5a', WALL = '#e7dcc4', FLOOR = '#7a5534', CEIL = '#f3ecdc', BOARD = '#1d3b2f'

function Door({ x, z, rotY, active, onPick }: { x: number; z: number; rotY: number; active: boolean; onPick: () => void }) {
  const leaf = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    // Seçilən qapı açılır.
    if (leaf.current) leaf.current.rotation.y = approach(leaf.current.rotation.y, active ? -1.2 : 0, dt, 4)
  })
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 1.15, 0]}><boxGeometry args={[1.25, 2.4, 0.08]} /><meshStandardMaterial color={FRAME} /></mesh>
      <group position={[-0.5, 0, 0.06]}>
        <mesh ref={leaf} position={[0, 1.1, 0]} onClick={(e) => { e.stopPropagation(); onPick() }}>
          <boxGeometry args={[1.0, 2.2, 0.06]} />
          <meshStandardMaterial color={active ? '#7d5638' : WOOD} />
        </mesh>
      </group>
      <mesh position={[0, 1.65, 0.1]}><boxGeometry args={[0.45, 0.35, 0.02]} /><meshStandardMaterial color="#b8d0c6" transparent opacity={0.7} /></mesh>
      <mesh position={[0, 2.5, 0.06]}><boxGeometry args={[0.6, 0.18, 0.03]} /><meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.35} /></mesh>
      <mesh position={[0.35, 1.05, 0.12]}><sphereGeometry args={[0.04, 12, 12]} /><meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.2} /></mesh>
    </group>
  )
}

function HallDoors({ z, active, live, onPick }: { z: number; active: boolean; live: boolean; onPick: () => void }) {
  const l = useRef<THREE.Group>(null), r = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (l.current) l.current.rotation.y = approach(l.current.rotation.y, active ? 1.1 : 0, dt, 3)
    if (r.current) r.current.rotation.y = approach(r.current.rotation.y, active ? -1.1 : 0, dt, 3)
  })
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 1.4, -0.05]}><boxGeometry args={[2.6, 2.9, 0.1]} /><meshStandardMaterial color={FRAME} /></mesh>
      <group ref={l} position={[-1.15, 0, 0.02]}>
        <mesh position={[0.57, 1.35, 0]} onClick={(e) => { e.stopPropagation(); onPick() }}><boxGeometry args={[1.12, 2.7, 0.07]} /><meshStandardMaterial color="#5a2f22" /></mesh>
      </group>
      <group ref={r} position={[1.15, 0, 0.02]}>
        <mesh position={[-0.57, 1.35, 0]} onClick={(e) => { e.stopPropagation(); onPick() }}><boxGeometry args={[1.12, 2.7, 0.07]} /><meshStandardMaterial color="#5a2f22" /></mesh>
      </group>
      <mesh position={[0, 3.05, 0.03]}><boxGeometry args={[1.4, 0.26, 0.04]} /><meshStandardMaterial color={live ? '#e36b5d' : BRASS} emissive={live ? '#a01e10' : '#000000'} /></mesh>
    </group>
  )
}

function Walker({ target }: { target: { x: number; z: number; yaw: number } | null }) {
  const { camera } = useThree()
  const yaw = useRef(0)
  useFrame((_, dt) => {
    const t = target ?? { x: 0, z: 3.2, yaw: 0 }
    camera.position.x = approach(camera.position.x, t.x, dt, 2.2)
    camera.position.z = approach(camera.position.z, t.z, dt, 2.2)
    camera.position.y = EYE_HEIGHT + Math.sin(performance.now() / 260) * 0.012 * Math.min(1, Math.abs(camera.position.z - t.z))
    yaw.current += angleDelta(yaw.current, t.yaw) * (1 - Math.exp(-3 * dt))
    camera.rotation.set(0, yaw.current, 0, 'YXZ')
  })
  return null
}

export function SchoolCorridor({ doors, selected, onPick, hallLive }: {
  doors: CorridorDoor[]; selected: number | 'hall' | null; onPick: (i: number | 'hall') => void; hallLive: boolean
}) {
  const spots = useMemo(() => doorSpots(doors.length), [doors.length])
  const len = corridorLength(doors.length)
  const target = selected === null ? null
    : selected === 'hall' ? { x: 0, z: -len + 2.2, yaw: 0 }
    : standBefore(spots[selected]!)
  const lights = useMemo(() => Array.from({ length: Math.ceil(len / 5) }, (_, i) => -i * 5), [len])

  return (
    <Canvas dpr={[1, 1.5]} camera={{ fov: 70, near: 0.05, far: 80, position: [0, EYE_HEIGHT, 3.2] }} gl={{ antialias: true, powerPreference: 'low-power' }}>
      <color attach="background" args={['#13261f']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#fff4dc', '#3b2a1c', 0.5]} />
      {lights.map((z) => (
        <group key={z}>
          <pointLight position={[0, 2.9, z]} intensity={6} distance={9} color="#fff1d0" />
          <mesh position={[0, 3.18, z]}><boxGeometry args={[0.8, 0.04, 0.3]} /><meshStandardMaterial color="#fffbe8" emissive="#fff3c4" emissiveIntensity={0.8} /></mesh>
        </group>
      ))}
      {/* Döşəmə, tavan, divarlar */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -len / 2 + 2]}><planeGeometry args={[CORRIDOR_WIDTH, len + 8]} /><meshStandardMaterial color={FLOOR} roughness={0.8} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3.2, -len / 2 + 2]}><planeGeometry args={[CORRIDOR_WIDTH, len + 8]} /><meshStandardMaterial color={CEIL} /></mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-CORRIDOR_WIDTH / 2, 1.6, -len / 2 + 2]}><planeGeometry args={[len + 8, 3.2]} /><meshStandardMaterial color={WALL} /></mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CORRIDOR_WIDTH / 2, 1.6, -len / 2 + 2]}><planeGeometry args={[len + 8, 3.2]} /><meshStandardMaterial color={WALL} /></mesh>
      <mesh position={[0, 1.6, -len - 0.2]}><planeGeometry args={[CORRIDOR_WIDTH, 3.2]} /><meshStandardMaterial color={WALL} /></mesh>
      {/* Paneller (taxta haşiyə) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (CORRIDOR_WIDTH / 2 - 0.03), 0.45, -len / 2 + 2]}><boxGeometry args={[0.04, 0.9, len + 8]} /><meshStandardMaterial color={FRAME} /></mesh>
      ))}
      {/* Girişdəki şərəf lövhəsi (sol divar) */}
      <group position={[-CORRIDOR_WIDTH / 2 + 0.05, 1.7, 1.2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh><boxGeometry args={[1.6, 1.0, 0.05]} /><meshStandardMaterial color={BRASS} metalness={0.5} roughness={0.4} /></mesh>
        <mesh position={[0, 0, 0.03]}><boxGeometry args={[1.45, 0.85, 0.02]} /><meshStandardMaterial color={BOARD} /></mesh>
      </group>
      {spots.map((s) => (
        <Door key={doors[s.index]!.key} x={s.x} z={s.z} rotY={s.rotY} active={selected === s.index} onPick={() => onPick(s.index)} />
      ))}
      <HallDoors z={-len} active={selected === 'hall'} live={hallLive} onPick={() => onPick('hall')} />
      <Walker target={target} />
    </Canvas>
  )
}
