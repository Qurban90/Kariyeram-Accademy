import { useEffect, useRef, useState } from 'react'
import { pack } from '../../content'
import { floorStats, isDoorOpen, DOOR_THRESHOLD } from '../../engine/tower'
import { emptyLine } from '../../engine/usta'
import { go } from '../../router'
import { useApp } from '../../store/useApp'
import { Usta } from '../tour/Usta'
import { MEMBERS, scriptedEngine, VACANCIES, type Report, type Turn } from './engine'

interface Msg {
  me?: boolean
  member?: number
  text: string
}

export function Komissiya() {
  const recs = useApp((s) => s.recs)
  const floors = pack.subjects.map((s) => floorStats(s, pack.questions, recs, Date.now()))
  const open = isDoorOpen(floors)
  const [vac, setVac] = useState(0)
  const [phase, setPhase] = useState<'intro' | 'chat' | 'report'>('intro')

  if (!open && phase === 'intro') {
    return (
      <div className="screen">
        <h1 style={{ fontSize: '1.4rem' }}>Komissiya otağı</h1>
        <div className="door">
          <svg viewBox="0 0 120 130" width="150" role="img" aria-label="Bağlı qapı">
            <path d="M20 128V56a40 40 0 0 1 80 0v72z" fill="var(--window-off)" stroke="var(--stone-ink)" strokeWidth="4" />
            <rect x="46" y="64" width="28" height="24" fill="var(--stone)" stroke="var(--stone-ink)" strokeWidth="3" />
            <path d="M52 64V54a8 8 0 0 1 16 0v10" fill="none" stroke="var(--stone)" strokeWidth="5" />
          </svg>
        </div>
        <Usta>{emptyLine.doorLocked}</Usta>
        <div className="slab stack">
          {floors.map((f) => (
            <div key={f.subject.id}>
              <div className="row"><span>{f.subject.name}</span><b>{Math.round(f.fraction * 100)}% / {DOOR_THRESHOLD * 100}%</b></div>
              <div className="threshold" aria-hidden="true">
                <i style={{ width: `${Math.min(100, f.fraction * 100)}%` }} />
                <u style={{ left: `${DOOR_THRESHOLD * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <button className="btn lamp" onClick={() => go('/session?mode=daily')}>Bugünkü 5 dəqiqə</button>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div className="screen">
        <h1 style={{ fontSize: '1.4rem' }}>Komissiya otağı</h1>
        <Usta>{emptyLine.doorOpen}</Usta>
        <div className="stack">
          {VACANCIES.map((v, i) => (
            <button key={v} className="opt" style={i === vac ? { borderColor: 'var(--lamp)', background: 'var(--panel-hi)' } : undefined} aria-pressed={i === vac} onClick={() => setVac(i)}>
              <b>{v}</b><div className="muted" style={{ fontSize: '.85rem' }}>Nümunə vakansiya</div>
            </button>
          ))}
        </div>
        <div className="slab muted" style={{ fontSize: '.85rem' }}>
          Mətn rejimi. {scriptedEngine.label}: açar sözlərə baxır, real qiymətləndirmə deyil. Səs rejimi və AI sonrakı mərhələdədir.
        </div>
        <button className="btn lamp" onClick={() => setPhase('chat')}>Müsahibəyə başla</button>
      </div>
    )
  }

  return <Interview vacancy={VACANCIES[vac]} phase={phase} setPhase={setPhase} />
}

function Interview({ vacancy, phase, setPhase }: { vacancy: string; phase: 'intro' | 'chat' | 'report'; setPhase: (p: 'intro' | 'chat' | 'report') => void }) {
  const [turns] = useState<Turn[]>(() => scriptedEngine.turns(vacancy))
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [typing, setTyping] = useState(true)
  const [step, setStep] = useState(0)
  const [text, setText] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const t = setTimeout(() => {
      if (!alive.current) return
      setTyping(false)
      setMsgs([{ member: turns[0].member, text: turns[0].text }])
    }, 600)
    return () => {
      alive.current = false
      clearTimeout(t)
    }
  }, [turns])

  const send = (t: string) => {
    const v = t.trim()
    if (!v || typing || step >= turns.length) return
    const all = [...answers, v]
    setAnswers(all)
    setText('')
    const nextStep = step + 1
    setStep(nextStep)
    setMsgs((m) => [...m, { me: true, text: v }])
    if (nextStep < turns.length) {
      setTyping(true)
      setTimeout(() => {
        if (!alive.current) return
        setTyping(false)
        setMsgs((m) => [...m, { member: turns[nextStep].member, text: turns[nextStep].text }])
      }, 700)
    }
  }

  const finish = () => {
    setReport(scriptedEngine.report(answers))
    setPhase('report')
  }

  if (phase === 'report' && report) return <ReportView report={report} onAgain={() => setPhase('intro')} />

  const done = step >= turns.length
  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn sm ghost" onClick={() => setPhase('intro')} aria-label="Müsahibəni bağla">✕</button>
        <div style={{ textAlign: 'right' }}><b>{vacancy}</b><div className="muted" style={{ fontSize: '.8rem' }}>{MEMBERS.join(', ')}</div></div>
      </div>
      <div className="chat" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.me ? 'me' : `m${m.member}`} rise`}>
            {!m.me && <small>{MEMBERS[m.member ?? 0]}</small>}
            {m.text}
          </div>
        ))}
        {typing && <div className="muted" style={{ fontSize: '.85rem' }}>Komissiya yazır…</div>}
      </div>
      {done && !typing ? (
        <button className="btn lamp" onClick={finish}>Hesabatı gör</button>
      ) : (
        !typing && (
          <div className="stack">
            {turns[step].hints.map((h) => (
              <button key={h} className="opt" onClick={() => send(h)}>{h}</button>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); send(text) }} className="stack">
              <label className="sr" htmlFor="ans">Öz cavabın</label>
              <input id="ans" className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Öz cavabını yaz" />
              <button className="btn" type="submit" disabled={!text.trim()}>Göndər</button>
            </form>
          </div>
        )
      )}
    </div>
  )
}

function ReportView({ report, onAgain }: { report: Report; onAgain: () => void }) {
  const { lo, hi } = report.total
  return (
    <div className="screen">
      <h1 style={{ fontSize: '1.4rem' }}>Müsahibə hesabatı</h1>
      <span className="pill crack" style={{ alignSelf: 'flex-start' }}>Simulyasiyadır, rəsmi qiymət deyil</span>
      <div className="slab hi">
        <div className="kicker">Ümumi bal aralığı (20-dən)</div>
        <div style={{ fontFamily: 'var(--f-display)', fontSize: '2.4rem', fontWeight: 700 }}>{lo}–{hi}</div>
        <div className="muted" style={{ fontSize: '.9rem' }}>
          Keçid həddi {report.threshold}. {hi >= report.threshold ? 'Yuxarı hədd keçidə çatır.' : `Təxminən ${report.threshold - hi}–${report.threshold - lo} bal çatmır.`}
        </div>
      </div>
      <div className="slab stack">
        <b>4 meyar üzrə</b>
        {report.criteria.map((c) => (
          <div key={c.name}>
            <div className="row"><span>{c.name}</span><b>{c.lo === c.hi ? c.lo : `${c.lo}–${c.hi}`}</b></div>
            <div className="range" aria-hidden="true"><i style={{ left: `${((c.lo - 2) / 3) * 100}%`, width: `${Math.max(((c.hi - c.lo) / 3) * 100, 8)}%` }} /></div>
            <div className="scale"><span>2</span><span>3</span><span>4</span><span>5</span></div>
          </div>
        ))}
      </div>
      <div className="slab">
        <b>Nə etməli</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>{report.tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      <button className="btn lamp" onClick={onAgain}>Yenidən cəhd et</button>
      <button className="btn ghost" onClick={() => go('/')}>Qalaya qayıt</button>
    </div>
  )
}
