/**
 * Palitra konteksti. Defolt: gecə (dəhliz, giriş). `RoomTheme` altındakı hər şey işıqlı sinif palitrası ilə çəkilir.
 * Komponentlər rəngi `usePalette()`, stilləri `useSheet(makeStyles)` ilə alır.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { colors, roomColors, type Palette } from '../theme'

const Ctx = createContext<Palette>(colors)

export const usePalette = (): Palette => useContext(Ctx)

export function RoomTheme({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={roomColors}>{children}</Ctx.Provider>
}

const cache = new WeakMap<object, Map<Palette, unknown>>()

/** Palitraya görə stil cədvəli; hər (cədvəl, palitra) cütü bir dəfə qurulur. */
export function useSheet<T>(make: (c: Palette) => T): T {
  const c = usePalette()
  let byPalette = cache.get(make)
  if (!byPalette) { byPalette = new Map(); cache.set(make, byPalette) }
  let sheet = byPalette.get(c) as T | undefined
  if (!sheet) { sheet = make(c); byPalette.set(c, sheet) }
  return sheet
}
