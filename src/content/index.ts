import type { Pack } from './schema'
import { samplePack } from './sample'

/**
 * Real məzmun `content/pack.json` faylıdır (gitignored, repo public olduğu üçün).
 * Fayl yoxdursa nümunə məzmun istifadə olunur.
 */
const real = import.meta.glob('../../content/pack.json', { eager: true, import: 'default' }) as Record<string, Pack>

export const pack: Pack = Object.values(real)[0] ?? samplePack
export const isSample = Object.values(real).length === 0
export type { Pack, Question, Subject, QStatus } from './schema'
