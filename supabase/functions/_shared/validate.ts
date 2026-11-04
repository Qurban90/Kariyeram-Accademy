import { ApiError } from './errors.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Body = Record<string, unknown>

export function obj(v: unknown): Body {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ApiError('bad_request')
  return v as Body
}
export function uuid(b: Body, k: string): string {
  const v = b[k]
  if (typeof v !== 'string' || !UUID.test(v)) throw new ApiError(`bad_${k}`)
  return v.toLowerCase()
}
export function str(b: Body, k: string, min: number, max: number, opt = false): string | undefined {
  const v = b[k]
  if (v === undefined || v === null) {
    if (opt) return undefined
    throw new ApiError(`bad_${k}`)
  }
  if (typeof v !== 'string') throw new ApiError(`bad_${k}`)
  const t = v.trim()
  if (t.length < min || t.length > max) throw new ApiError(`bad_${k}`)
  return t
}
export function oneOf<T extends string>(b: Body, k: string, values: readonly T[], opt = false): T | undefined {
  const v = b[k]
  if ((v === undefined || v === null) && opt) return undefined
  if (typeof v !== 'string' || !values.includes(v as T)) throw new ApiError(`bad_${k}`)
  return v as T
}
export function int(b: Body, k: string, min: number, max: number, opt = false): number | undefined {
  const v = b[k]
  if ((v === undefined || v === null) && opt) return undefined
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new ApiError(`bad_${k}`)
  return v
}
export function bool(b: Body, k: string, opt = false): boolean | undefined {
  const v = b[k]
  if ((v === undefined || v === null) && opt) return undefined
  if (typeof v !== 'boolean') throw new ApiError(`bad_${k}`)
  return v
}
export function uuids(b: Body, k: string, max: number, opt = false): string[] | undefined {
  const v = b[k]
  if ((v === undefined || v === null) && opt) return undefined
  if (!Array.isArray(v) || v.length > max || !v.every((x) => typeof x === 'string' && UUID.test(x))) throw new ApiError(`bad_${k}`)
  return v as string[]
}
/** Cihaz ID-si: klientin yaratdığı təsadüfi ID (8–128 simvol, təhlükəsiz əlifba). */
export function device(b: Body): string {
  const v = b.device
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(v)) throw new ApiError('bad_device')
  return v
}
