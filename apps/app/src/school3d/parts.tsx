/** 3D səhnələrin ortaq hissələri: avatar və bir çəkiliş çağırışı ilə çəkilən çoxsaylı qutular (InstancedMesh). */
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { paletteFor } from './layout'

/** Mövqe + ölçü ilə qutu (vahid qutu miqyaslanır). */
export interface BoxPart { p: [number, number, number]; s: [number, number, number] }

const unitBox = new THREE.BoxGeometry(1, 1, 1)

/**
 * Eyni materiallı bütün qutuları bir InstancedMesh ilə çəkir: 60 parta × 10 hissə = 1 çəkiliş çağırışı.
 * Zəif telefonda kadr sürəti əsasən çəkiliş çağırışlarının sayından asılıdır.
 */
export function Boxes({ parts, material, cast = true, receive = true }: { parts: BoxPart[]; material: THREE.Material; cast?: boolean; receive?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3()
    parts.forEach((b, i) => { m.setMatrixAt(i, mx.compose(pos.set(...b.p), q, sc.set(...b.s))) })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [parts])
  if (parts.length === 0) return null
  // Say dəyişəndə yeni obyekt lazımdır (InstancedMesh-in tutumu sabitdir).
  return <instancedMesh key={parts.length} ref={ref} args={[unitBox, material, parts.length]} castShadow={cast} receiveShadow={receive} />
}

/** Avatarın pozası: oturan tələbə və ya ayaq üstə müəllim. Avatar -Z istiqamətinə baxır. */
export function Avatar({ id, speaking, hand, me, host, standing }: {
  id: string; speaking: boolean; hand: boolean; me?: boolean; host?: boolean; standing?: boolean
}) {
  const pal = useMemo(() => paletteFor(id), [id])
  const mats = useMemo(() => ({
    shirt: new THREE.MeshStandardMaterial({ color: host ? '#2d3a4f' : pal.shirt, roughness: 0.85 }),
    skin: new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.6 }),
    hair: new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.9 }),
    pants: new THREE.MeshStandardMaterial({ color: '#2f3542', roughness: 0.9 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#1b1b1f', roughness: 0.5 }),
  }), [pal, host])
  useLayoutEffect(() => () => { Object.values(mats).forEach((m) => m.dispose()) }, [mats])

  const head = useRef<THREE.Group>(null)
  const rArm = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Mesh>(null)
  const marker = useRef<THREE.Mesh>(null)
  const seed = useMemo(() => (paletteFor(id).shirt.length * 7 + id.length) % 10, [id])
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime() + seed
    if (head.current) {
      // Danışanda baş yüngül tərpənir; susanda çox az "nəfəs" hərəkəti.
      head.current.rotation.x = speaking ? Math.sin(t * 7) * 0.06 : Math.sin(t * 0.8) * 0.02
      head.current.rotation.y = Math.sin(t * 0.37) * 0.08
    }
    if (rArm.current) {
      // X oxu ətrafında müsbət bucaq qolu irəli (-Z) və yuxarı qaldırır.
      const target = hand ? 2.9 : standing ? 0.15 : 1.25
      rArm.current.rotation.x += (target - rArm.current.rotation.x) * (1 - Math.exp(-8 * dt))
    }
    if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = speaking ? 0.5 + Math.sin(t * 8) * 0.2 : 0
    if (marker.current) { marker.current.rotation.y = t * 1.2; marker.current.position.y = (standing ? 1.95 : 1.5) + Math.sin(t * 2) * 0.03 }
  })

  const torsoY = standing ? 1.22 : 0.84
  const shoulderY = torsoY + 0.18
  const armRest = standing ? 0.15 : 1.25
  return (
    <group>
      {/* Gövdə və çiyinlər */}
      <mesh position={[0, torsoY, 0]} material={mats.shirt} castShadow><capsuleGeometry args={[0.17, 0.3, 6, 14]} /></mesh>
      <mesh position={[0, shoulderY - 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.shirt} castShadow><capsuleGeometry args={[0.07, 0.3, 4, 10]} /></mesh>
      {/* Baş, saç */}
      <group ref={head} position={[0, shoulderY + 0.06, 0]}>
        <mesh position={[0, 0.04, 0]} material={mats.skin}><cylinderGeometry args={[0.05, 0.06, 0.1, 10]} /></mesh>
        <mesh position={[0, 0.2, 0]} material={mats.skin} castShadow><sphereGeometry args={[0.13, 20, 16]} /></mesh>
        <mesh position={[0, 0.235, 0.012]} rotation={[0.25, 0, 0]} material={mats.hair}><sphereGeometry args={[0.138, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} /></mesh>
      </group>
      {/* Qollar: çiyindən asılır; sağ qol əl qaldırır */}
      <group position={[-0.24, shoulderY, 0]} rotation={[armRest, 0, 0.06]}>
        <mesh position={[0, -0.16, 0]} material={mats.shirt} castShadow><capsuleGeometry args={[0.05, 0.24, 4, 10]} /></mesh>
        <mesh position={[0, -0.33, 0]} material={mats.skin}><sphereGeometry args={[0.045, 10, 8]} /></mesh>
      </group>
      <group ref={rArm} position={[0.24, shoulderY, 0]} rotation={[armRest, 0, -0.06]}>
        <mesh position={[0, -0.16, 0]} material={mats.shirt} castShadow><capsuleGeometry args={[0.05, 0.24, 4, 10]} /></mesh>
        <mesh position={[0, -0.33, 0]} material={mats.skin}><sphereGeometry args={[0.045, 10, 8]} /></mesh>
      </group>
      {/* Ayaqlar */}
      {standing
        ? [-0.09, 0.09].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.5, 0]} material={mats.pants} castShadow><capsuleGeometry args={[0.075, 0.6, 4, 10]} /></mesh>
            <mesh position={[x, 0.05, -0.04]} material={mats.shoe}><boxGeometry args={[0.11, 0.08, 0.24]} /></mesh>
          </group>
        ))
        : [-0.09, 0.09].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.52, -0.16]} rotation={[Math.PI / 2, 0, 0]} material={mats.pants} castShadow><capsuleGeometry args={[0.075, 0.28, 4, 10]} /></mesh>
            <mesh position={[x, 0.27, -0.32]} material={mats.pants}><capsuleGeometry args={[0.065, 0.3, 4, 10]} /></mesh>
            <mesh position={[x, 0.04, -0.36]} material={mats.shoe}><boxGeometry args={[0.1, 0.07, 0.22]} /></mesh>
          </group>
        ))}
      {/* Danışanın ayağı altında yaşıl halqa */}
      <mesh ref={glow} position={[0, 0.015, standing ? 0 : -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.46, 40]} />
        <meshBasicMaterial color="#6cc28a" transparent opacity={0} depthWrite={false} />
      </mesh>
      {(me || host) && (
        <mesh ref={marker} position={[0, standing ? 1.95 : 1.5, 0]}>
          <octahedronGeometry args={[0.07, 0]} />
          <meshStandardMaterial color={host ? '#d4af5a' : '#ffffff'} emissive={host ? '#8a6510' : '#7a7a7a'} metalness={host ? 0.6 : 0} roughness={0.35} />
        </mesh>
      )}
    </group>
  )
}
