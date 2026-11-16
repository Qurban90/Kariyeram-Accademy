/**
 * Oturulan 3D məkan (fənn sinfi və ya oxu zalı): tam ekran səhnə. Tələbə qapıdan içəri yeriyir, özü gəzir, istədiyi yerə oturur
 * və pəncərə açılır (sinifdə mövzular, test, konspekt; zalda dərslərin siyahısı). Pəncərə bağlananda oturmuş qalır,
 * ətrafa baxa və ya ayağa qalxa bilər. Çıxanda qapı açılır, arxasında dəhliz görünür və tələbə qapıdan keçir.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '../components/Text'
import { Button, Icon, Loading, P, RoomTheme, Sheet, usePalette, useSheet } from '../components/ui'
import { t } from '../i18n/az'
import { colors as night, font, materials, radius, space, touch, type, type Palette } from '../theme'
import { GLBoundary } from './Corridor3D'
import { finePointer, Hud, HudButton, Rise, useToast, Veil } from './Hud'
import { WalkPad } from './WalkPad'
import { hallPlan, roomPlan, Walker, type Desk, type PickFn } from './walk'

const StudyRoom = lazy(() => import('./StudyRoom').then((m) => ({ default: m.StudyRoom })))
const HallWalk = lazy(() => import('./Auditorium').then((m) => ({ default: m.HallWalk })))

export function Room3D({ kind = 'room', roomNo, name, active, children, onExit, onSimple, onFail }: {
  /** 'room': fənn sinfi (partalar); 'hall': oxu zalı (pilləli auditoriya). */
  kind?: 'room' | 'hall'
  roomNo: string; name: string
  /** Ekran fokusdadır (test və ya dərs açıq olanda çəkiliş dayanır). */
  active: boolean
  /** Pəncərənin içi. */
  children: ReactNode
  onExit: () => void; onSimple: () => void; onFail: () => void
}) {
  const hall = kind === 'hall'
  const plan = useMemo(() => (hall ? hallPlan() : roomPlan()), [hall])
  const walker = useMemo(() => new Walker(plan.door, plan.walk.areas, plan.walk.blocks, plan.ground), [plan])
  const pick = useRef<PickFn | null>(null)
  const [near, setNear] = useState<string | null>(null)
  const [seat, setSeat] = useState<Desk | null>(null)
  // Qapıdan içəri addımlayana qədər idarə bağlıdır.
  const [busy, setBusy] = useState(true)
  const [veil, setVeil] = useState(true)
  const [win, setWin] = useState(false)
  const [menu, setMenu] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [low, setLow] = useState(false)
  const [coach, setCoach] = useState(true)
  const [toast, showToast] = useToast()
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)) }
  const entered = useRef(false)
  useEffect(() => { const id = setTimeout(() => setCoach(false), 9000); return () => { clearTimeout(id); timers.current.forEach(clearTimeout) } }, [])
  useEffect(() => { walker.frozen = win || menu }, [win, menu, walker])

  /** Səhnə ilk kadrını çəkəndə pərdə qalxır və tələbə qapıdan içəri bir neçə addım atır. */
  const onReady = () => {
    if (entered.current) return
    entered.current = true
    setVeil(false)
    walker.walkTo([plan.start], plan.start.yaw, () => setBusy(false), Walker.DOOR_SPEED)
  }

  const seatOf = (id: string | null): Desk | null => (id?.startsWith('desk:') ? plan.seats.find((d) => d.no === Number(id.slice(5))) ?? null : null)
  const nearDesk = seatOf(near)
  const seatLabel = (n: number) => (hall ? t.live.seat(n) : t.walk.desk(n))
  const sitAt = (d: Desk) => {
    if (walker.mode !== 'walk' || busy) return
    setMenu(false); setBusy(true)
    walker.walkTo(plan.route(walker, d), undefined, () => walker.sit(plan.seatAt(d), () => { setSeat(d); setBusy(false); setWin(true) }))
  }
  const closest = () => plan.seats.reduce((a, b) => (Math.hypot(b.x - walker.x, b.z - walker.z) < Math.hypot(a.x - walker.x, a.z - walker.z) ? b : a))
  const standUp = (then?: () => void) => {
    if (!seat || busy) return
    setWin(false); setBusy(true)
    walker.stand(seat.aisle, () => { setSeat(null); setBusy(false); then?.() })
  }
  /** Qapıya gedir və dəhlizə çıxır. Oturubsa əvvəl ayağa qalxır. */
  const exit = () => {
    if (busy) return
    setMenu(false)
    if (seat) standUp(walkOut)
    else walkOut()
  }
  // Yalnız oyunçunun canlı vəziyyətinə baxır (ayağa qalxandan sonra köhnə render-in dəyərləri ilə çağırıla bilər).
  const walkOut = () => {
    if (walker.mode !== 'walk') return
    setBusy(true)
    // Pilləli zalda aşağıdadırsa əvvəl ən yaxın keçidə keçir, keçidlə yuxarı meydançaya qalxır.
    const lane: { x: number; z: number }[] = []
    if (plan.ground && plan.ground(walker.x, walker.z) < plan.ground(plan.start.x, plan.start.z) - 0.01) {
      const ax = closest().aisle.x
      if (Math.abs(walker.x - ax) > 0.3) lane.push({ x: ax, z: walker.z })
      lane.push({ x: ax, z: plan.start.z })
    }
    walker.walkTo([...lane, { x: plan.door.x, z: plan.door.z - 0.35 }], Math.PI, () => {
      setExitOpen(true) // qapı açılır, arxasında dəhliz görünür
      later(650, () => {
        walker.walkTo([plan.outside], undefined, () => { onExit() }, Walker.DOOR_SPEED)
        later(520, () => setVeil(true))
      })
    })
  }
  const shelf = () => {
    if (!plan.shelf) return
    if (seat) { setWin(true); return }
    if (walker.mode !== 'walk' || busy) return
    setBusy(true)
    walker.walkTo(plan.shelf.path, plan.shelf.yaw, () => { setBusy(false); setWin(true) })
  }
  const onTap = (nx: number, ny: number) => {
    const act = pick.current?.(nx, ny)
    if (!act) return
    if (act === 'exit') exit()
    else if (act === 'shelf') shelf()
    else if (seat) setWin(true) // oturanda lövhəyə və ya partaya toxunmaq pəncərəni açır
    else if (act === 'board') sitAt(nearDesk ?? closest())
    else { const d = seatOf(act); if (d) sitAt(d) }
  }

  const hint = seat ? t.walk.seatedHint : hall ? t.walk.hallHint : finePointer ? t.walk.roomHintKeys : t.walk.roomHintTouch
  const sceneProps = {
    mark: busy ? null : nearDesk, seat, exitOpen, walker, targets: plan.targets, onNear: setNear, pick, low, active, onReady,
    onSlow: () => { setLow(true); showToast(t.walk.lowAuto) },
  }
  return (
    <View style={st.wrap}>
      <View style={StyleSheet.absoluteFill} testID={hall ? 'hall-3d' : 'room-3d'}>
        <GLBoundary onFail={onFail}>
          <Suspense fallback={<Loading label={t.walk.building} />}>
            {hall ? <HallWalk {...sceneProps} /> : <StudyRoom roomNo={roomNo} {...sceneProps} />}
          </Suspense>
        </GLBoundary>
      </View>
      <WalkPad walker={walker} onTap={onTap} enabled={active && !win && !menu} testID="room-pad" />
      {!win ? (
        <Hud menuTestID="room-menu-open" hint={hint} onMenu={() => setMenu(true)} toast={toast} showStick={coach && !finePointer && !seat && !busy}>
          {busy ? null : seat ? (<>
            <HudButton testID="stand-up" ghost icon="stairs" label={t.walk.stand} onPress={() => standUp()} />
            <HudButton testID="open-window" icon="book" sub={hall ? t.walk.hallWindowSub : t.walk.windowSub} label={t.walk.window} onPress={() => setWin(true)} />
          </>) : (<>
            {near === 'exit' ? <HudButton testID="exit-room" ghost icon="exit" label={t.walk.exit} onPress={exit} /> : null}
            {near === 'shelf' ? <HudButton testID="open-shelf" ghost icon="book" sub={t.walk.shelfSub} label={t.walk.shelf} onPress={shelf} /> : null}
            {nearDesk
              ? <HudButton testID="sit-desk" icon="door" sub={seatLabel(nearDesk.no)} label={t.walk.sit} onPress={() => sitAt(nearDesk)} />
              : <HudButton testID="sit-desk" icon="compass" sub={hall ? t.walk.nearestSeat : t.walk.nearestDesk} label={hall ? t.walk.goSeat : t.walk.goDesk} onPress={() => sitAt(closest())} />}
          </>)}
        </Hud>
      ) : null}

      <DeskWindow visible={win} keep={!!seat} kicker={`${hall ? t.hall.live : t.walk.room(roomNo)}${seat ? ` · ${seatLabel(seat.no)}` : ''}`} title={name} onClose={() => setWin(false)}>
        {children}
      </DeskWindow>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={hall ? name : `${roomNo} · ${name}`} testID="room-menu">
        <P dim small>{hall ? t.walk.hallMenuLead : t.walk.roomMenuLead}</P>
        <Button testID="menu-exit" icon="exit" label={t.walk.exit} onPress={exit} />
        <View style={st.row}>
          <Button testID="room-toggle-low" small variant="ghost" style={{ flex: 1 }} label={low ? t.walk.lowOn : t.walk.lowOff} onPress={() => setLow(!low)} />
          <Button testID="room-toggle-3d" small variant="ghost" style={{ flex: 1 }} label={t.hall.view2d} onPress={() => { setMenu(false); onSimple() }} />
        </View>
        <P dim small>{t.walk.lowNote}</P>
      </Sheet>
      <Veil shown={veil} />
    </View>
  )
}

/**
 * Partada açılan pəncərə: taxta çərçivəli vərəq. Telefonda aşağıdan qalxır, enli ekranda mərkəzdə dayanır.
 * `keep`: bağlı olanda da içi yaddaşda qalır (seçilmiş mövzular itməsin).
 */
function DeskWindow({ visible, keep, kicker, title, onClose, children }: {
  visible: boolean; keep: boolean; kicker: string; title: string; onClose: () => void; children: ReactNode
}) {
  const { width } = useWindowDimensions()
  const ins = useSafeAreaInsets()
  const wide = width >= 720
  if (!visible && !keep) return null
  return (
    <View style={[StyleSheet.absoluteFill, st.scrim, wide ? { justifyContent: 'center', alignItems: 'center', padding: space.xl } : { justifyContent: 'flex-end' }, !visible && { display: 'none' }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
      {visible ? (
        <Rise style={[st.frame, wide ? st.frameWide : [st.frameNarrow, { paddingBottom: 0 }]]}>
          <RoomTheme><WindowBody kicker={kicker} title={title} onClose={onClose} bottom={wide ? 0 : ins.bottom}>{children}</WindowBody></RoomTheme>
        </Rise>
      ) : (
        <View style={st.frame}><RoomTheme><WindowBody kicker={kicker} title={title} onClose={onClose} bottom={0}>{children}</WindowBody></RoomTheme></View>
      )}
    </View>
  )
}

function WindowBody({ kicker, title, onClose, bottom, children }: { kicker: string; title: string; onClose: () => void; bottom: number; children: ReactNode }) {
  const colors = usePalette()
  const s = useSheet(makeW)
  return (
    <View testID="desk-window" style={s.paper} role="dialog" aria-modal aria-label={title} accessibilityViewIsModal>
      <View style={s.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.kicker}>{kicker}</Text>
          <Text style={s.title} accessibilityRole="header" numberOfLines={2}>{title}</Text>
        </View>
        <Pressable testID="window-close" accessibilityRole="button" accessibilityLabel={t.common.close} onPress={onClose} hitSlop={8}
          style={({ pressed }) => [s.close, pressed && { backgroundColor: colors.line }]}>
          <Icon name="x" size={18} color={colors.ivoryDim} />
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl + bottom }} style={{ flexShrink: 1 }}>
        {children}
      </ScrollView>
    </View>
  )
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: night.nightDeep },
  row: { flexDirection: 'row', gap: 12 },
  scrim: { backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 12%, rgba(0,0,0,0.5) 100%)' },
  // Taxta çərçivə: sinifdəki lövhənin çərçivəsi ilə eyni ağac.
  frame: {
    maxHeight: '86%', padding: 6, backgroundColor: materials.walnut,
    backgroundImage: `linear-gradient(175deg, ${materials.walnutLight} 0%, ${materials.walnut} 40%, ${materials.walnutDeep} 100%)`,
    boxShadow: '0px -12px 44px rgba(0,0,0,0.55)',
  },
  frameNarrow: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, width: '100%' },
  frameWide: { borderRadius: radius.lg + 4, width: '100%', maxWidth: 580 },
})

const makeW = (c: Palette) => StyleSheet.create({
  paper: { flexShrink: 1, backgroundColor: c.night, borderRadius: radius.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  kicker: { color: c.goldBright, fontSize: font.tiny, letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: type.bold },
  title: { color: c.ivory, fontFamily: type.displayBold, fontSize: font.h2, lineHeight: 27 },
  close: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceHi },
})
