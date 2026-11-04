/**
 * Azərbaycan dilində tarix formatı. Intl-ə etibar etmirik: Chromium-un və bəzi Android ICU versiyalarının
 * az-AZ məlumatı natamamdır ("2026 M11 5" kimi çıxır). Vaxt cihazın yerli vaxtıdır.
 */
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'] as const
const WEEKDAYS = ['bazar', 'bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə', 'cümə axşamı', 'cümə', 'şənbə'] as const

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d))
const pad = (n: number) => String(n).padStart(2, '0')

/** "5 noyabr 2026" */
export function fmtDate(d: Date | string | number): string {
  const x = toDate(d)
  if (Number.isNaN(x.getTime())) return '—'
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`
}

/** "5 noyabr 2026, 17:09" */
export function fmtDateTime(d: Date | string | number): string {
  const x = toDate(d)
  if (Number.isNaN(x.getTime())) return '—'
  return `${fmtDate(x)}, ${pad(x.getHours())}:${pad(x.getMinutes())}`
}

/** "cümə axşamı, 5 noyabr, 17:09" (canlı dərs cədvəli üçün; il göstərilmir) */
export function fmtWhen(d: Date | string | number): string {
  const x = toDate(d)
  if (Number.isNaN(x.getTime())) return '—'
  return `${WEEKDAYS[x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}, ${pad(x.getHours())}:${pad(x.getMinutes())}`
}
