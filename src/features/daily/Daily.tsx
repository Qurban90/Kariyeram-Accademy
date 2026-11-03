import { useMemo, useState } from 'react'
import { pack } from '../../content'
import { dailyQuestion, dayKey, dayNumber, hashKey, weekKeys } from '../../engine/daily'
import { fx } from '../../engine/fx'
import { shuffleOptions } from '../../engine/queue'
import { shareCard, type Mark } from '../../engine/share'
import { rightLine, wrongLine } from '../../engine/usta'
import { go } from '../../router'
import { useApp } from '../../store/useApp'
import { Usta } from '../tour/Usta'

/** Hamıya eyni variant sırası üçün tarixdən toxumlanan təsadüfi say. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function Daily() {
  const key = dayKey()
  const daily = useApp((s) => s.daily)
  const theme = useApp((s) => s.settings.theme)
  const setDaily = useApp((s) => s.setDaily)
  const answer = useApp((s) => s.answer)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const q = dailyQuestion(pack.questions, key)
  const shuffled = useMemo(() => (q ? shuffleOptions(q, seeded(hashKey(key))) : null), [q, key])
  const result = daily[key]

  if (!q || !shuffled) {
    return (
      <div className="screen">
        <Usta>Bu gün üçün sual tapmadım.</Usta>
      </div>
    )
  }

  const choose = (idx: number) => {
    if (result) return
    const correct = idx === shuffled.answer
    setDaily(key, { correct, choice: idx })
    answer(q.id, q.subject, correct)
    if (correct) fx.stone()
    else fx.crack()
  }

  const week: Mark[] = weekKeys().map((k) => (daily[k] ? (daily[k].correct ? 'stone' : 'crack') : 'none'))
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const share = async () => {
    if (!result) return
    setBusy(true)
    try {
      const how = await shareCard({ dayNo: dayNumber(key), week, correct: result.correct }, dark)
      setMsg(how === 'shared' ? 'Paylaşıldı.' : 'Kart şəkil kimi yükləndi.')
    } catch {
      setMsg('Kartı hazırlamaq alınmadı.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <header className="topbar">
        <h1 style={{ fontSize: '1.3rem' }}>Günün sualı</h1>
        <span className="pill">Gün {dayNumber(key)}</span>
      </header>
      <div className="kicker">Hamıya eyni sual, bir cəhd</div>
      <div className="qtext">{q.text}</div>
      <div className="opts">
        {shuffled.options.map((t, k) => (
          <button key={k} className={`opt${result && k === shuffled.answer ? ' ok' : ''}${result && k === result.choice && !result.correct ? ' bad' : ''}`} onClick={() => choose(k)} disabled={!!result}>
            {t}
          </button>
        ))}
      </div>

      {result && (
        <div className="stack rise">
          <div className="slab hi">
            <b style={{ color: result.correct ? 'var(--good)' : 'var(--crack)' }}>{result.correct ? 'Düzdür' : `Düzgün cavab: ${shuffled.options[shuffled.answer]}`}</b>
            <p style={{ margin: '4px 0 0' }}>{q.explain}</p>
            {q.lawRef && <span className="ref">{q.lawRef}</span>}
          </div>
          <Usta>{result.correct ? rightLine(dayNumber(key)) : wrongLine(dayNumber(key))}</Usta>
          <div className="slab">
            <div className="kicker" style={{ marginBottom: 8 }}>Bu həftə</div>
            <div className="week" aria-label="Günün sualı həftə nəticələri">
              {week.map((m, i) => (
                <div key={i}>
                  <span className={`win${m !== 'none' ? ' on' : ''}`} style={m === 'crack' ? { background: 'var(--crack)' } : undefined} />
                </div>
              ))}
            </div>
          </div>
          <button className="btn lamp" onClick={share} disabled={busy}>Nəticə kartını paylaş</button>
          {msg && <div className="muted" role="status">{msg}</div>}
        </div>
      )}
      <button className="btn ghost" onClick={() => go('/')}>Qalaya qayıt</button>
    </div>
  )
}
