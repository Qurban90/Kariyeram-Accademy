/**
 * Sual bankının CSV idxalı (Excel → "CSV UTF-8" kimi saxla). Saf funksiyalar: parse + validasiya.
 * Sütunlar (başlıq sırası vacib deyil, böyük-kiçik hərf və diakritik fərq etmir):
 *   fenn, movzu, sual, A, B, C, D, E, F, duzgun, izah, izah_A..izah_F, cetinlik, tele, istinad
 */
export interface QuestionDraft {
  subject: string
  topic: string
  stem: string
  options: string[]
  answerIndex: number
  explanation: string
  optionExplanations: string[]
  level: 1 | 2 | 3
  trap: boolean
  lawRef: string | null
}
export interface ImportIssue { row: number; message: string }
export interface ImportResult { questions: QuestionDraft[]; errors: ImportIssue[]; warnings: ImportIssue[] }

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

/** RFC 4180 CSV: dırnaqlar, sətir içində yeni sətir, "" qaçışı, BOM. Ayırıcı avtomatik: ; və ya , (Excel regional ayarı). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], field = '', q = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"' && field === '') q = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (q) throw new Error('CSV: bağlanmamış dırnaq')
  row.push(field)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

/** Başlıq normallaşdırma: "Fənn" → "fenn", "İzah A" → "izah_a", "Çətinlik" → "cetinlik". */
export function normHeader(h: string): string {
  const map: Record<string, string> = { ə: 'e', ı: 'i', i̇: 'i', ö: 'o', ü: 'u', ş: 's', ç: 'c', ğ: 'g' }
  return h.trim().toLocaleLowerCase('az').replace(/[əıöüşçğ]|i̇/g, (m) => map[m] ?? m).replace(/[\s-]+/g, '_')
}

function parseLevel(v: string): 1 | 2 | 3 | null {
  const x = normHeader(v)
  if (x === '' ) return 2
  if (x === '1' || x === 'asan') return 1
  if (x === '2' || x === 'orta') return 2
  if (x === '3' || x === 'cetin') return 3
  return null
}
function parseBool(v: string): boolean | null {
  const x = normHeader(v)
  if (x === '' || x === 'xeyr' || x === 'yox' || x === '0' || x === 'false') return false
  if (x === 'beli' || x === 'he' || x === '1' || x === 'true' || x === 'x') return true
  return null
}

export function validateRows(rows: string[][]): ImportResult {
  const errors: ImportIssue[] = [], warnings: ImportIssue[] = [], questions: QuestionDraft[] = []
  if (rows.length < 2) return { questions, errors: [{ row: 1, message: 'Fayl boşdur və ya yalnız başlıq var' }], warnings }
  const head = rows[0]!.map(normHeader)
  const col = (name: string) => head.indexOf(name)
  for (const req of ['fenn', 'movzu', 'sual', 'a', 'b', 'duzgun']) {
    if (col(req) < 0) errors.push({ row: 1, message: `Sütun yoxdur: ${req}` })
  }
  if (errors.length) return { questions, errors, warnings }
  const seen = new Map<string, number>()

  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2
    const get = (name: string) => { const k = col(name); return k < 0 ? '' : (r[k] ?? '').trim() }
    const errs: string[] = []
    const subject = get('fenn'), topic = get('movzu'), stem = get('sual')
    if (!/^[a-z0-9-]{1,40}$/.test(subject)) errs.push('fenn: fənn kodu olmalıdır (məs. informatika, az-dili)')
    if (!topic || topic.length > 120) errs.push('movzu: boş və ya çox uzun')
    if (!stem) errs.push('sual: boşdur')
    if (stem.length > 4000) errs.push('sual: 4000 simvoldan uzundur')
    const raw = LETTERS.map((l) => get(l.toLowerCase()))
    const last = raw.reduce((m, v, k) => (v ? k : m), -1)
    if (raw.slice(0, last + 1).some((v) => !v)) errs.push('variantlar arasında boş xana var (A, B, C... ardıcıl olmalıdır)')
    const options = raw.slice(0, last + 1)
    if (options.length < 2) errs.push('ən azı 2 variant lazımdır')
    if (new Set(options.map((o) => o.toLocaleLowerCase('az'))).size !== options.length) errs.push('eyni mətnli variantlar var')
    const letter = get('duzgun').toUpperCase().replace('Ə', 'E')
    const answerIndex = LETTERS.indexOf(letter as (typeof LETTERS)[number])
    if (answerIndex < 0 || answerIndex >= options.length) errs.push(`duzgun: "${get('duzgun')}" mövcud variant hərfi deyil`)
    const level = parseLevel(get('cetinlik'))
    if (level === null) errs.push('cetinlik: 1/2/3 və ya asan/orta/çətin')
    const trap = parseBool(get('tele'))
    if (trap === null) errs.push('tele: bəli/xeyr')
    const optionExplanations = options.map((_, k) => get(`izah_${LETTERS[k]!.toLowerCase()}`))
    const explanation = get('izah')
    const key = `${subject}|${topic}|${stem.toLocaleLowerCase('az')}`
    if (seen.has(key)) errs.push(`təkrar sual (sətir ${seen.get(key)})`)

    if (errs.length) { errs.forEach((m) => errors.push({ row: rowNo, message: m })); return }
    seen.set(key, rowNo)
    if (!explanation) warnings.push({ row: rowNo, message: 'ümumi izah yoxdur' })
    const missing = optionExplanations.filter((x) => !x).length
    if (missing) warnings.push({ row: rowNo, message: `${missing} variantın izahı yoxdur` })
    questions.push({ subject, topic, stem, options, answerIndex, explanation, optionExplanations, level: level!, trap: trap!, lawRef: get('istinad') || null })
  })
  return { questions, errors, warnings }
}
