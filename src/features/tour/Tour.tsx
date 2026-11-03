import { useEffect, useLayoutEffect, useState } from 'react'
import { useApp } from '../../store/useApp'
import { UstaAvatar } from './Usta'

const STEPS = [
  { id: 'tower', title: 'Salam, mən Ustayam', text: 'Bu qalanı birlikdə tikəcəyik. Hər mərtəbə bir fənndir, mərtəbəyə toxunsan konspekt və test açılır.' },
  { id: 'tower', title: 'Düz cavab daş qoyur', text: 'Hər düzgün cavab qalaya bir daş əlavə edir. Daşlar yuxarı qalxdıqca sən hazırlaşırsan.' },
  { id: 'stats', title: 'Unudulan mövzu çat açır', text: 'Bir müddətdən sonra unudulan və ya yanlış cavablanan mövzu divarda çat açır. Çatı təmir etmək “Səhvlərim” deməkdir.' },
  { id: 'door', title: 'Yuxarıda komissiya otağı var', text: 'Qapı hər mərtəbə yarıya çatanda açılır. İçəridə müsahibə məşqi gözləyir.' },
  { id: 'week', title: 'Gündə beş dəqiqə kifayətdir', text: 'Hər gün bir pəncərə yanır. Həftədə dörd pəncərə hədəfdir, ara günləri cəza deyil.' },
]

interface Box { top: number; left: number; width: number; height: number }

export function Tour() {
  const finish = useApp((s) => s.finishTour)
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const step = STEPS[i]

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`)
    if (!el) { setBox(null); return }
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step.id, i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish])

  const last = i === STEPS.length - 1
  const below = box ? box.top + box.height / 2 < window.innerHeight / 2 : false
  const pos = box && below ? { top: Math.min(box.top + box.height + 14, window.innerHeight - 250) } : { bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tətbiqə giriş turu">
      {box && <div className="tour-hole" style={box} />}
      <div className="slab hi tour-card rise" style={pos} key={i}>
        <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12 }}>
          <UstaAvatar />
          <div>
            <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>{step.title}</h2>
            <p style={{ fontFamily: 'var(--f-voice)', margin: 0 }}>{step.text}</p>
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <div className="tour-dots" aria-hidden="true">{STEPS.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm ghost" onClick={finish}>Keç</button>
            <button className="btn sm lamp" onClick={() => (last ? finish() : setI(i + 1))}>{last ? 'Başlayaq' : 'Növbəti'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
