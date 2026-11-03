import { isSample } from '../../content'
import { useInstall } from '../../install'
import { go } from '../../router'
import { useApp, type Settings } from '../../store/useApp'

export function Profile() {
  const settings = useApp((s) => s.settings)
  const set = useApp((s) => s.setSetting)
  const replay = useApp((s) => s.replayTour)
  const reset = useApp((s) => s.reset)
  const favs = useApp((s) => s.favs.length)
  const inst = useInstall()

  const Toggle = ({ k, title, sub }: { k: 'sound' | 'haptic'; title: string; sub: string }) => (
    <div className="tog">
      <div><b>{title}</b><div className="muted" style={{ fontSize: '.85rem' }}>{sub}</div></div>
      <button className="sw" aria-pressed={settings[k]} aria-label={title} onClick={() => set(k, !settings[k])} />
    </div>
  )

  const themes: [Settings['theme'], string][] = [['auto', 'Avto'], ['dark', 'Gecə'], ['light', 'Gündüz']]

  return (
    <div className="screen">
      <h1 style={{ fontSize: '1.4rem' }}>Profil</h1>

      <div className="slab">
        <Toggle k="sound" title="Səs" sub="Daş qoyulanda qısa səs" />
        <Toggle k="haptic" title="Titrəyiş" sub="Telefonda yumşaq geri bildirim" />
        <div className="tog">
          <div><b>Mövzu</b></div>
          <div className="seg" role="group" aria-label="Mövzu">
            {themes.map(([v, l]) => <button key={v} aria-pressed={settings.theme === v} onClick={() => set('theme', v)}>{l}</button>)}
          </div>
        </div>
        <div className="tog">
          <div><b>Yazı ölçüsü</b><div className="muted" style={{ fontSize: '.85rem' }}>{Math.round(settings.fontScale * 100)}%</div></div>
          <div className="seg" role="group" aria-label="Yazı ölçüsü">
            <button onClick={() => set('fontScale', Math.max(0.85, +(settings.fontScale - 0.1).toFixed(2)))} aria-label="Kiçilt">A−</button>
            <button onClick={() => set('fontScale', Math.min(1.4, +(settings.fontScale + 0.1).toFixed(2)))} aria-label="Böyüt">A+</button>
          </div>
        </div>
      </div>

      <div className="slab">
        <div className="tog">
          <div>
            <b>Xatırlatma vaxtı</b>
            <div className="muted" style={{ fontSize: '.85rem' }}>Saxlanılır. Telefona göndərmək üçün server lazımdır, növbəti mərhələdə qoşulacaq.</div>
          </div>
          <input className="field" type="time" aria-label="Xatırlatma vaxtı" style={{ width: 118 }} value={settings.reminder ?? ''} onChange={(e) => set('reminder', e.target.value || null)} />
        </div>
        <div className="tog">
          <div><b>Sevimli suallar</b><div className="muted" style={{ fontSize: '.85rem' }}>{favs} sual</div></div>
        </div>
        <div className="tog">
          <div><b>Tətbiqi quraşdır</b><div className="muted" style={{ fontSize: '.85rem' }}>{inst.standalone ? 'Artıq quraşdırılıb' : inst.canInstall ? 'Ana ekrana əlavə et, oflayn da işləyir' : 'Brauzer menyusundan “Ana ekrana əlavə et” seç'}</div></div>
          {inst.canInstall && <button className="btn sm lamp" onClick={() => void inst.install()}>Quraşdır</button>}
        </div>
      </div>

      <div className="stack">
        <button className="btn" onClick={() => { replay(); go('/') }}>Turu yenidən göstər</button>
        <button className="btn ghost" onClick={() => { if (window.confirm('Bütün irəliləyiş silinsin?')) reset() }}>İrəliləyişi sıfırla</button>
      </div>

      {isSample && <div className="slab muted" style={{ fontSize: '.85rem' }}>Hazırda nümunə məzmun göstərilir. Real suallar deyil.</div>}
    </div>
  )
}
