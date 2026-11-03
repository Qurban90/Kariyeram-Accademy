import { useState } from 'react'
import { pack } from '../../content'
import { dayKey, dayNumber, litDaysThisWeek, WEEK_GOAL, weekKeys } from '../../engine/daily'
import { buildQueue } from '../../engine/queue'
import { floorStats, isDoorOpen, totalCracks, type FloorStats } from '../../engine/tower'
import { greeting } from '../../engine/usta'
import { go } from '../../router'
import { useApp } from '../../store/useApp'
import { Logo } from '../Icons'
import { Usta } from '../tour/Usta'
import { Tower } from './Tower'

const DAYS = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B']

export function Home() {
  const recs = useApp((s) => s.recs)
  const days = useApp((s) => s.days)
  const dayFloors = useApp((s) => s.dayFloors)
  const daily = useApp((s) => s.daily)
  const [sheet, setSheet] = useState<FloorStats | null>(null)

  const now = Date.now()
  const today = dayKey()
  const floors = pack.subjects.map((s) => floorStats(s, pack.questions, recs, now))
  const cracks = totalCracks(floors)
  const stones = floors.reduce((a, f) => a + f.stones, 0)
  const doorOpen = isDoorOpen(floors)
  const lit = new Set(dayFloors[today] ?? [])
  const qCount = buildQueue('daily', pack.questions, recs, now).length
  const litDays = litDaysThisWeek(days)
  const studiedToday = (days[today] ?? 0) > 0
  const todaysDaily = daily[today]
  const line = greeting(new Date().getHours(), cracks, studiedToday, dayNumber(today))

  const openFloor = (id: string) => setSheet(floors.find((f) => f.subject.id === id) ?? null)

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand"><Logo />Pillə</div>
        <span className="kicker">{pack.stage}</span>
      </header>

      <Usta>{line}</Usta>

      <div className="tower-wrap" data-tour="tower">
        <Tower floors={floors} lit={lit} doorOpen={doorOpen} onFloor={openFloor} onDoor={() => go('/komissiya')} />
      </div>

      <div className="slab stats" data-tour="stats">
        <div className="stat"><b>{stones}</b><span>daş</span></div>
        <div className="stat"><b style={{ color: cracks ? 'var(--crack)' : undefined }}>{cracks}</b><span>çat</span></div>
        <div className="stat"><b>{litDays}/{WEEK_GOAL}</b><span>həftə hədəfi</span></div>
      </div>

      <div className="stack">
        <button className="btn lamp" onClick={() => go('/session?mode=daily')} disabled={qCount === 0}>
          Bugünkü 5 dəqiqə · {qCount} sual
        </button>
        {cracks > 0 && (
          <button className="btn" onClick={() => go('/session?mode=repair')}>
            Çatları təmir et ({cracks})
          </button>
        )}
      </div>

      <div className="slab hi">
        <div className="row">
          <div>
            <div className="kicker">Günün sualı</div>
            <div style={{ fontWeight: 600 }}>
              {todaysDaily ? (todaysDaily.correct ? 'Bu gün daş qoydun' : 'Bu gün çat açıldı') : 'Hamıya eyni sual. Bir cəhd.'}
            </div>
          </div>
          <button className="btn sm" onClick={() => go('/gun')}>{todaysDaily ? 'Kart' : 'Cavabla'}</button>
        </div>
      </div>

      <div className="slab" data-tour="week">
        <div className="row" style={{ marginBottom: 10 }}>
          <b>Bu həftənin pəncərələri</b>
          <span className="muted" style={{ fontSize: '.85rem' }}>5 gündən 4-ü kifayətdir</span>
        </div>
        <div className="week">
          {weekKeys().map((k, i) => (
            <div key={k}>
              <span className={`win${(days[k] ?? 0) > 0 ? ' on' : ''}${k === today ? ' today' : ''}`} />
              {DAYS[i]}
            </div>
          ))}
        </div>
      </div>

      {sheet && <FloorSheet floor={sheet} onClose={() => setSheet(null)} />}
    </div>
  )
}

function FloorSheet({ floor, onClose }: { floor: FloorStats; onClose: () => void }) {
  const f = floor
  return (
    <div className="tour" style={{ background: 'rgba(3,8,12,.6)' }} onClick={onClose}>
      <div className="slab hi rise" role="dialog" aria-label={f.subject.name} onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: 480, margin: '0 auto', borderRadius: '3px 3px 0 0', paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', display: 'grid', gap: 12 }}>
        <div className="row">
          <h2 style={{ fontSize: '1.25rem' }}>{f.subject.name}</h2>
          <button className="btn sm ghost" onClick={onClose}>Bağla</button>
        </div>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <span className="pill good">{f.stones} daş</span>
          <span className="pill crack">{f.cracks} çat</span>
          <span className="pill">{f.fresh} yeni</span>
        </div>
        <div>
          <div className="kicker">Konspekt</div>
          <p style={{ fontFamily: 'var(--f-voice)', margin: '4px 0 0' }}>{f.subject.note}</p>
        </div>
        <button className="btn lamp" onClick={() => go(`/session?mode=floor&subject=${f.subject.id}`)}>
          Bu mərtəbədən test
        </button>
      </div>
    </div>
  )
}
