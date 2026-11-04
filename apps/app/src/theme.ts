/** Vizual dil: yaşıl lövhə, təbaşir, mis lövhəciklər, taxta. Kontrast WCAG AA (mətn ≥ 4.5:1) üçün seçilib. */
export const colors = {
  board: '#13261f',        // əsas fon (lövhə)
  boardDeep: '#0c1a15',
  boardLine: '#2a4a3d',
  panel: '#1b3329',
  chalk: '#f1ece0',        // əsas mətn
  chalkDim: '#b9c4bb',     // ikinci dərəcəli mətn (board üzərində 7.9:1)
  brass: '#d4af5a',        // vurğu, düymə
  brassDeep: '#a8873a',
  wood: '#6b4a2f',
  woodLight: '#8a6342',
  ok: '#6cc28a',
  bad: '#e36b5d',
  warn: '#e8b04a',
  trap: '#c792ea',         // tələli sual
  ink: '#10201a',          // mis düymə üzərində mətn
  overlay: 'rgba(5,12,9,0.72)',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const
export const font = {
  title: 26, h2: 20, h3: 17, body: 16, small: 14, tiny: 12,
  serif: 'Georgia' as const,
} as const
/** Toxunma hədəfi ən azı 44×44 (iOS HIG, WCAG 2.5.5). */
export const touch = 44
