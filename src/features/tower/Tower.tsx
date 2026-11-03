import { motion, useReducedMotion } from 'motion/react'
import type { KeyboardEvent } from 'react'
import type { FloorStats } from '../../engine/tower'
import type { Slot } from '../../engine/leitner'

const CX = 126
const FH = 84
const ROOF = 100
const GROUND = 22
const COLS = 6

interface Props {
  floors: FloorStats[]
  lit: Set<string>
  doorOpen: boolean
  onFloor: (subjectId: string) => void
  onDoor: () => void
}

export function Tower({ floors, lit, doorOpen, onFloor, onDoor }: Props) {
  const reduce = useReducedMotion()
  const n = floors.length
  const H = ROOF + n * FH + GROUND
  const key = (e: KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  }

  return (
    <svg className="tower" viewBox={`0 0 360 ${H}`} role="group" aria-label="Qala">
      {/* komissiya otağı */}
      <g
        className="floor"
        data-tour="door"
        role="button"
        tabIndex={0}
        aria-label={doorOpen ? 'Komissiya otağı açıqdır' : 'Komissiya otağı bağlıdır'}
        onClick={onDoor}
        onKeyDown={(e) => key(e, onDoor)}
      >
        <rect x="0" y="0" width="360" height={ROOF} fill="transparent" />
        <polygon points={`${CX - 98},${ROOF} ${CX},14 ${CX + 98},${ROOF}`} fill="var(--stone-shade)" stroke="var(--stone-ink)" strokeWidth="2.5" />
        <line x1={CX} y1="14" x2={CX} y2="2" stroke="var(--stone-ink)" strokeWidth="2.5" />
        <polygon points={`${CX},2 ${CX + 22},8 ${CX},14`} fill="var(--crack)" stroke="var(--stone-ink)" strokeWidth="1.5" />
        <path
          d={`M${CX - 20},${ROOF} V${ROOF - 34} a20,20 0 0 1 40,0 V${ROOF}z`}
          fill={doorOpen ? 'var(--lamp)' : 'var(--window-off)'}
          stroke="var(--stone-ink)"
          strokeWidth="2.5"
          className={doorOpen ? 'glow' : undefined}
        />
        {!doorOpen && (
          <g>
            <rect x={CX - 8} y={ROOF - 28} width="16" height="13" fill="var(--stone)" stroke="var(--stone-ink)" strokeWidth="2" />
            <path d={`M${CX - 5},${ROOF - 28} v-4 a5,5 0 0 1 10,0 v4`} fill="none" stroke="var(--stone)" strokeWidth="2.5" />
          </g>
        )}
        <text className="flabel" x="250" y="52">Komissiya</text>
        <text className="fmeta" x="250" y="68">{doorOpen ? 'Qapı açıqdır' : 'Qapı bağlıdır'}</text>
      </g>

      {/* mərtəbələr: floors[0] ən aşağıdır */}
      {floors.map((f, i) => {
        const t = n - 1 - i
        const y = ROOF + t * FH
        const w = 222 - i * 14
        const x = CX - w / 2
        const bw = w / COLS
        const bh = FH / 2
        const open = () => onFloor(f.subject.id)
        const isLit = lit.has(f.subject.id)
        const pct = Math.round(f.fraction * 100)
        return (
          <g
            key={f.subject.id}
            className="floor"
            role="button"
            tabIndex={0}
            aria-label={`${f.subject.name}: ${pct} faiz, ${f.cracks} çat`}
            onClick={open}
            onKeyDown={(e) => key(e, open)}
          >
            <rect x="0" y={y} width="360" height={FH} fill="transparent" />
            {f.blocks.map((s, b) => (
              <Block key={`${f.subject.id}-${b}-${s}`} slot={s} x={x + (b % COLS) * bw + 0.75} y={y + (b < COLS ? 1 : 0) * bh + 0.75} w={bw - 1.5} h={bh - 1.5} tone={(b + i) % 2} delay={reduce ? 0 : b * 0.018} reduce={!!reduce} />
            ))}
            <path
              d={`M${CX - 17},${y + FH - 14} V${y + 36} a17,17 0 0 1 34,0 V${y + FH - 14}z`}
              fill={isLit ? 'var(--lamp)' : 'var(--window-off)'}
              stroke="var(--stone-ink)"
              strokeWidth="2.5"
              className={isLit ? 'glow' : undefined}
            />
            <line x1={x + w + 5} y1={y + 24} x2="244" y2={y + 24} stroke="var(--edge)" strokeWidth="1.5" strokeDasharray="3 3" />
            <text className="flabel" x="250" y={y + 28}>{f.subject.name}</text>
            <text className="fmeta" x="250" y={y + 45}>{pct}% · {f.cracks} çat</text>
          </g>
        )
      })}

      <rect x={CX - 126} y={ROOF + n * FH} width="252" height={GROUND} fill="var(--stone-ink)" />
    </svg>
  )
}

function Block({ slot, x, y, w, h, tone, delay, reduce }: { slot: Slot; x: number; y: number; w: number; h: number; tone: number; delay: number; reduce: boolean }) {
  if (slot === 'new') {
    return <rect x={x} y={y} width={w} height={h} fill="none" stroke="var(--edge)" strokeWidth="1.5" strokeDasharray="4 4" opacity=".7" />
  }
  const fill = slot === 'crack' ? 'var(--stone-shade)' : tone ? 'var(--stone)' : 'color-mix(in srgb, var(--stone) 88%, var(--stone-shade))'
  const drop = reduce ? {} : { initial: { y: -16, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { type: 'spring' as const, stiffness: 380, damping: 22, delay } }
  return (
    <motion.g {...drop}>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke="var(--stone-ink)" strokeWidth="2" />
      {slot === 'stone' && <line x1={x + 3} y1={y + 3} x2={x + w - 3} y2={y + 3} stroke="#fff" strokeOpacity=".28" strokeWidth="2" />}
      {slot === 'crack' && (
        <motion.path
          d={`M${x + w * 0.35},${y + 1} L${x + w * 0.55},${y + h * 0.35} L${x + w * 0.4},${y + h * 0.55} L${x + w * 0.68},${y + h - 1}`}
          fill="none"
          stroke="var(--crack)"
          strokeWidth="3"
          strokeLinejoin="miter"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: delay + 0.25 }}
        />
      )}
    </motion.g>
  )
}
