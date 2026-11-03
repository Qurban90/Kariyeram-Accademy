import { useMemo, useState } from 'react'
import { pack, type Question } from '../../content'
import { slotState } from '../../engine/leitner'
import { fx } from '../../engine/fx'
import { buildQueue, shuffleOptions, type Mode } from '../../engine/queue'
import { endLine, rightLine, wrongLine } from '../../engine/usta'
import { go } from '../../router'
import { useApp } from '../../store/useApp'
import { Usta } from '../tour/Usta'

interface Item {
  q: Question
  options: string[]
  answer: number
}

type Outcome = 'stone' | 'repaired' | 'cracked' | 'kept'

export function Session({ mode, subject }: { mode: Mode; subject?: string }) {
  const answer = useApp((s) => s.answer)
  const favs = useApp((s) => s.favs)
  const toggleFav = useApp((s) => s.toggleFav)

  // Növbə sessiya başlayanda bir dəfə qurulur ki, cavablar onu dəyişməsin.
  const items = useMemo<Item[]>(() => {
    const { recs } = useApp.getState()
    return buildQueue(mode, pack.questions, recs, Date.now(), { subject }).map((q) => ({ q, ...shuffleOptions(q) }))
  }, [mode, subject])

  const [i, setI] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const [log, setLog] = useState<Outcome[]>([])
  const [done, setDone] = useState(false)

  if (items.length === 0) {
    return (
      <div className="screen">
        <Usta>{mode === 'repair' ? 'Divarda çat yoxdur. Gözümə yaxşı görünür.' : 'Bu mərtəbədə hələ sual yoxdur.'}</Usta>
        <button className="btn" onClick={() => go('/')}>Qalaya qayıt</button>
      </div>
    )
  }

  if (done) return <End log={log} />

  const it = items[i]
  const answered = pick !== null
  const ok = answered && pick === it.answer

  const choose = (idx: number) => {
    if (answered) return
    const correct = idx === it.answer
    const before = slotState(useApp.getState().recs[it.q.id], Date.now())
    answer(it.q.id, it.q.subject, correct)
    setPick(idx)
    setLog((l) => [...l, !correct ? 'cracked' : before === 'crack' ? 'repaired' : before === 'new' ? 'stone' : 'kept'])
    if (correct) fx.stone()
    else fx.crack()
  }

  const next = () => {
    if (i + 1 >= items.length) {
      setDone(true)
      return
    }
    setI(i + 1)
    setPick(null)
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn sm ghost" onClick={() => go('/')} aria-label="Sessiyanı bağla">✕</button>
        <div className="progress" aria-label={`${i + 1} / ${items.length}`}>
          {items.map((_, k) => (
            <i key={k} className={k < log.length ? (log[k] === 'cracked' ? 'bad' : 'done') : k === i ? 'cur' : ''} />
          ))}
        </div>
        <button className={`fav${favs.includes(it.q.id) ? ' on' : ''}`} onClick={() => toggleFav(it.q.id)} aria-pressed={favs.includes(it.q.id)} aria-label="Sevimlilərə əlavə et">★</button>
      </div>

      <div className="kicker">{pack.subjects.find((s) => s.id === it.q.subject)?.name} · {it.q.topic}</div>
      <div className="qtext rise" key={it.q.id}>{it.q.text}</div>

      <div className="opts">
        {it.options.map((t, k) => (
          <button key={k} className={`opt${answered && k === it.answer ? ' ok' : ''}${answered && k === pick && !ok ? ' bad' : ''}`} onClick={() => choose(k)} disabled={answered}>
            {t}
          </button>
        ))}
      </div>

      {answered && (
        <div className="stack rise">
          <div className="slab hi">
            <b style={{ color: ok ? 'var(--good)' : 'var(--crack)' }}>{ok ? 'Düzdür' : `Düzgün cavab: ${it.options[it.answer]}`}</b>
            <p style={{ margin: '4px 0 0' }}>{it.q.explain}</p>
            {it.q.lawRef && <span className="ref">{it.q.lawRef}</span>}
          </div>
          <Usta>{ok ? rightLine(i + it.q.version) : wrongLine(i + it.q.version)}</Usta>
          <button className="btn lamp" onClick={next}>{i + 1 >= items.length ? 'Bitir' : 'Növbəti'}</button>
        </div>
      )}
    </div>
  )
}

function End({ log }: { log: Outcome[] }) {
  const stones = log.filter((x) => x === 'stone').length
  const repaired = log.filter((x) => x === 'repaired').length
  const cracked = log.filter((x) => x === 'cracked').length
  return (
    <div className="screen">
      <h1 style={{ fontSize: '1.6rem', marginTop: 8 }}>Seans bitdi</h1>
      <div className="slab stats">
        <div className="stat"><b>{stones}</b><span>yeni daş</span></div>
        <div className="stat"><b>{repaired}</b><span>çat təmir</span></div>
        <div className="stat"><b style={{ color: cracked ? 'var(--crack)' : undefined }}>{cracked}</b><span>yeni çat</span></div>
      </div>
      <Usta>{endLine(stones, repaired, cracked, log.length)}</Usta>
      <div className="stack">
        <button className="btn lamp" onClick={() => go('/')}>Qalaya qayıt</button>
        {cracked > 0 && <button className="btn" onClick={() => go('/session?mode=repair')}>Çatları indi təmir et</button>}
      </div>
    </div>
  )
}
