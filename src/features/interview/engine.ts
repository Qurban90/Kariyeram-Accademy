import criteria from './criteria.json'

export const VACANCIES = ['Baş məsləhətçi', 'Aparıcı məsləhətçi', 'Mütəxəssis']
export const MEMBERS = ['Sədr', 'Üzv 1', 'Üzv 2']

export interface Turn {
  member: number
  text: string
  hints: string[]
}

export interface Report {
  criteria: { name: string; lo: number; hi: number }[]
  total: { lo: number; hi: number }
  threshold: number
  tips: string[]
}

/**
 * Müsahibə mühərriki interfeysi. İndi ssenari mühərriki işləyir,
 * sonra `LlmEngine` eyni interfeysi həyata keçirəcək.
 */
export interface InterviewEngine {
  id: string
  label: string
  turns(vacancy: string): Turn[]
  report(answers: string[]): Report
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const { min, max } = criteria.scale

export const scriptedEngine: InterviewEngine = {
  id: 'scripted',
  label: 'Ssenari mühərriki (AI deyil)',
  turns: (vacancy) => [
    { member: 0, text: `“${vacancy}” vəzifəsi üçün özünüzü təqdim edin və niyə müraciət etdiyinizi deyin.`, hints: ['Bu sahədə təcrübəm var və dövlət xidmətinə marağım böyükdür.', 'Hazırlıq keçmişəm və öyrənməyə hazıram.'] },
    { member: 1, text: 'Bu vəzifədə qarşılaşa biləcəyiniz çətin bir qərarı necə verərdiniz?', hints: ['Faktları toplayar, qanuna baxar və rəhbərimlə məsləhətləşərdim.', 'Tez qərar verib nəticəni izah edərdim.'] },
    { member: 2, text: 'Qanunvericilikdə dəyişiklik olsa, işinizdə necə uyğunlaşardınız?', hints: ['Rəsmi mənbədən yeni redaksiyanı oxuyar və iş qaydalarımı yeniləyərdim.', 'Həmkarlarımdan soruşardım.'] },
  ],
  report(answers) {
    const text = answers.join(' ').toLowerCase()
    const words = answers.reduce((a, t) => a + t.trim().split(/\s+/).filter(Boolean).length, 0)
    const avg = answers.length ? words / answers.length : 0
    const rows = criteria.criteria.map((c) => {
      const hits = c.keywords.filter((k) => text.includes(k)).length
      const s = clamp(min + Math.min(2, hits) + (avg >= 14 ? 1 : 0), min, max)
      return { name: c.name, lo: clamp(s - 1, min, max), hi: s }
    })
    const total = { lo: rows.reduce((a, r) => a + r.lo, 0), hi: rows.reduce((a, r) => a + r.hi, 0) }
    const weakest = [...rows].sort((a, b) => a.hi - b.hi)[0]
    const tips: string[] = []
    if (avg < 10) tips.push('Cavablar qısadır. Hər cavaba bir konkret təcrübə nümunəsi əlavə et.')
    if (!/(qanun|maddə|məcəllə|konstitusiya)/.test(text)) tips.push('Qanuna və ya qaydaya istinad etmək bilik balını yüksəldər.')
    if (weakest) tips.push(`Ən zəif meyar: ${weakest.name}.`)
    return { criteria: rows, total, threshold: criteria.threshold, tips }
  },
}
