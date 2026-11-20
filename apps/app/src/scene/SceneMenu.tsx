/**
 * Səhnənin menyusu: gündəlik, şərəf lövhəsi, kabinet, görünüş seçimi və girişi yenidən göstərmək.
 * Səhnədə əsas yol iki-üç toxunuşdur; qalan hər şey bura yığılıb ki, ekran sadə qalsın.
 */
import { router } from 'expo-router'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet } from 'react-native'
import { Icon } from '../components/Icon'
import { Group, ListRow, P, SelectRow, Sheet } from '../components/ui'
import { t } from '../i18n/az'
import { useViewMode } from '../lib/view3d'
import { colors, radius, touch } from '../theme'

export function SceneMenu({ onReplay, light }: { onReplay?: () => void; light?: boolean }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useViewMode()
  const go = (path: string) => { setOpen(false); router.push(path as never) }
  return (
    <>
      <Pressable testID="scene-menu" onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t.scene.menu} hitSlop={6}
        style={({ pressed }) => [st.btn, light && st.btnLight, pressed && { opacity: 0.8 }]}>
        <Icon name="sliders" size={20} color={light ? colors.ivory : colors.ivory} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t.scene.menu} testID="scene-menu-sheet">
        <Group>
          <ListRow icon="notebook" title={t.hall.diary} sub={t.hall.diarySub} onPress={() => go('/diary')} testID="menu-diary" />
          <ListRow icon="trophy" title={t.hall.board} sub={t.hall.boardSub} onPress={() => go('/board')} testID="menu-board" />
          <ListRow icon="user" title={t.hall.profile} sub={t.hall.profileSub} onPress={() => go('/profile')} testID="menu-profile" />
          {onReplay ? <ListRow icon="repeat" title={t.scene.replay} onPress={() => { setOpen(false); onReplay() }} testID="menu-replay" /> : null}
        </Group>
        <P dim small>{t.hall.rooms}</P>
        <Group>
          <SelectRow testID="mode-scene" title={t.scene.scene} sub={t.scene.sceneSub} selected={mode === 'scene'} onPress={() => { setMode('scene'); setOpen(false) }} />
          <SelectRow testID="mode-simple" title={t.scene.simple} sub={t.scene.simpleSub} selected={mode === 'simple'} onPress={() => { setMode('simple'); setOpen(false) }} />
          {Platform.OS === 'web' ? (
            <SelectRow testID="mode-3d" title={t.scene.walk3d} sub={t.scene.walk3dSub} selected={mode === '3d'} onPress={() => { setMode('3d'); setOpen(false) }} />
          ) : null}
        </Group>
      </Sheet>
    </>
  )
}

const st = StyleSheet.create({
  btn: {
    width: touch, height: touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,10,9,0.55)', borderWidth: 1, borderColor: colors.line,
  },
  btnLight: { backgroundColor: 'rgba(30,18,8,0.45)', borderColor: 'transparent' },
})
