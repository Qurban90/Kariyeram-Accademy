/**
 * 3D məktəb: tam ekran dəhliz. Tələbə joystiklə özü gəzir, istədiyi qapıya yaxınlaşıb içəri keçir.
 * Gec yüklənmə (three.js ayrıca paketdədir), WebGL xətasında sadə görünüşə qayıdış, menyuda əlçatan otaq siyahısı.
 */
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Button, Group, ListRow, Loading, P, Sheet } from '../components/ui'
import { t } from '../i18n/az'
import { use3dGuard } from '../lib/view3d'
import { colors } from '../theme'
import { finePointer, Hud, HudButton, useToast, Veil } from './Hud'
import { WalkPad } from './WalkPad'
import { corridorStand, corridorTargets, corridorThrough, corridorWalk, CORRIDOR_START, Walker, type PickFn } from './walk'

const SchoolCorridor = lazy(() => import('./SchoolCorridor').then((m) => ({ default: m.SchoolCorridor })))

export class GLBoundary extends Component<{ onFail: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: Error) { this.props.onFail(e) }
  render() { return this.state.failed ? null : this.props.children }
}

export interface DoorInfo { key: string; number: string; title: string; status?: string }

export function Corridor3D({ doors, hallLive, active, greeting, resume, onEnter, onGo, onSimple, onFail }: {
  doors: DoorInfo[]; hallLive: boolean
  /** Ekran fokusdadır (başqa səhifə açıq olanda çəkiliş dayanır). */
  active: boolean
  greeting: string
  resume?: { sub: string; onPress: () => void } | null
  onEnter: (key: string | 'hall') => void
  onGo: (where: 'diary' | 'board' | 'profile') => void
  /** Sadə (2D) görünüşə keçid. */
  onSimple: () => void
  onFail: () => void
}) {
  const n = doors.length
  const walker = useMemo(() => { const w = corridorWalk(n); return new Walker(CORRIDOR_START, w.areas, w.blocks) }, [n])
  const targets = useMemo(() => corridorTargets(n), [n])
  const pick = useRef<PickFn | null>(null)
  const [near, setNear] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | 'hall' | null>(null)
  const [menu, setMenu] = useState(false)
  // Telefonda yüngül rejimlə başlayır (az işıq, piksel sıxlığı 1): zəif cihazda donmasın.
  const [low, setLow] = useState(Platform.OS !== 'web')
  const guard = use3dGuard()
  const [coach, setCoach] = useState(true)
  const [toast, showToast] = useToast()
  const [veil, setVeil] = useState(true)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)) }
  /** Tələbənin içinə keçdiyi qapı (otaqdan qayıdanda həmin qapıdan çıxır). */
  const inside = useRef<string | null>(null)
  useEffect(() => { const id = setTimeout(() => setCoach(false), 7000); return () => { clearTimeout(id); timers.current.forEach(clearTimeout) } }, [])
  // Otaqdan qayıdanda: tələbə qapının o tayındadır, qapı açıqdır; dəhlizə çıxır və qapı arxasınca bağlanır.
  useEffect(() => {
    if (!active) return
    const id = inside.current
    if (id === null) { if (walker.mode === 'walk') setSelected(null); return }
    inside.current = null
    const s = corridorStand(id, n)
    walker.place({ ...corridorThrough(id, n), yaw: s.yaw + Math.PI })
    setVeil(false)
    walker.walkTo([s], undefined, () => setSelected(null), Walker.DOOR_SPEED)
  }, [active, walker, n])
  useEffect(() => { walker.frozen = menu }, [menu, walker])

  /** Hədəfə özü yeriyir, sonra əməl icra olunur (qapı açılır və içəri keçir). */
  const go = (id: string) => {
    if (walker.mode !== 'walk' || selected !== null) return
    setMenu(false)
    const s = corridorStand(id, n)
    walker.walkTo([s], s.yaw, () => {
      if (id === 'board') { onGo('board'); return }
      const key = id === 'hall' ? 'hall' : doors[Number(id)]?.key
      if (!key) return
      // Qapı açılır və arxasında otağın özü görünür; tələbə qapıdan içəri yeriyir, son addımlarda pərdə yumşaq enir.
      setSelected(id === 'hall' ? 'hall' : Number(id))
      later(650, () => {
        const th = corridorThrough(id, n)
        const ms = (Math.hypot(th.x - walker.x, th.z - walker.z) / Walker.DOOR_SPEED) * 1000
        walker.walkTo([th], undefined, () => { inside.current = id; onEnter(key) }, Walker.DOOR_SPEED)
        later(Math.max(0, ms - 430), () => setVeil(true))
      })
    })
  }
  const onTap = (nx: number, ny: number) => {
    const act = pick.current?.(nx, ny)
    if (!act) return
    go(act.startsWith('door:') ? act.slice(5) : act)
  }

  const nearDoor = near !== null && near !== 'hall' && near !== 'board' ? doors[Number(near)] : null
  const cta = selected !== null ? null
    : nearDoor ? { sub: `${nearDoor.number} · ${nearDoor.title}`, label: t.walk.enter, icon: 'door' as const }
    : near === 'hall' ? { sub: hallLive ? t.live.liveNow : t.hall.liveSub, label: t.hall.live, icon: 'door' as const }
    : near === 'board' ? { sub: t.hall.boardSub, label: t.hall.board, icon: 'compass' as const }
    : null

  return (
    <View style={st.wrap}>
      <View style={StyleSheet.absoluteFill} testID="corridor-3d">
        <GLBoundary onFail={onFail}>
          <Suspense fallback={<Loading label={t.walk.building} />}>
            {!guard.armed ? <Loading label={t.walk.building} /> : <SchoolCorridor doors={doors.map((d) => ({ key: d.key, label: d.number }))} selected={selected} hallLive={hallLive}
              walker={walker} targets={targets} onNear={setNear} pick={pick} low={low} active={active} onReady={() => { if (inside.current === null) setVeil(false); later(6000, guard.settle) }}
              onSlow={() => { setLow(true); showToast(t.walk.lowAuto) }} />}
          </Suspense>
        </GLBoundary>
      </View>
      <WalkPad walker={walker} onTap={onTap} enabled={active && !menu} testID="walk-pad" />
      <Hud hint={finePointer ? t.walk.hintKeys : t.walk.hintTouch} onMenu={() => setMenu(true)} toast={toast} showStick={coach && !finePointer}>
        {resume ? <HudButton testID="resume-test" ghost icon="stairs" sub={resume.sub} label={t.hall.resumeBtn} onPress={resume.onPress} /> : null}
        {cta ? <HudButton testID="hud-main" icon={cta.icon} sub={cta.sub} label={cta.label} onPress={() => near && go(near)} /> : null}
      </Hud>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={greeting} testID="school-menu">
        <P dim small>{t.walk.menuLead}</P>
        <Group>
          {doors.map((d, i) => (
            <ListRow key={d.key} testID={`door3d-${d.key}`} icon="door" title={`${d.number} · ${d.title}`} sub={d.status} onPress={() => go(String(i))} />
          ))}
          <ListRow testID="door3d-hall" icon="users" title={t.hall.live} sub={hallLive ? t.live.liveNow : t.hall.liveSub} onPress={() => go('hall')} />
        </Group>
        <Group>
          <ListRow icon="notebook" title={t.hall.diary} sub={t.hall.diarySub} onPress={() => { setMenu(false); onGo('diary') }} testID="go-diary" />
          <ListRow icon="trophy" title={t.hall.board} sub={t.hall.boardSub} onPress={() => { setMenu(false); onGo('board') }} testID="go-board" />
          <ListRow icon="user" title={t.hall.profile} sub={t.hall.profileSub} onPress={() => { setMenu(false); onGo('profile') }} testID="go-profile" />
        </Group>
        <View style={st.row}>
          <Button testID="toggle-low" small variant="ghost" style={{ flex: 1 }} label={low ? t.walk.lowOn : t.walk.lowOff} onPress={() => setLow(!low)} />
          <Button testID="toggle-3d" small variant="ghost" style={{ flex: 1 }} label={t.hall.view2d} onPress={() => { setMenu(false); onSimple() }} />
        </View>
        <P dim small>{t.walk.lowNote}</P>
      </Sheet>
      <Veil shown={veil} />
    </View>
  )
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.nightDeep },
  row: { flexDirection: 'row', gap: 12 },
})
