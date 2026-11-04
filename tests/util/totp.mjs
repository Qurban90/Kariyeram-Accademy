/** RFC 6238 TOTP (SHA-1, 30 s, 6 rəqəm): testlərdə autentifikator tətbiqini təqlid edir. */
import { createHmac } from 'node:crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** @param {string} secret base32 @param {number} [at] ms */
export function totp(secret, at = Date.now()) {
  let bits = ''
  for (const c of secret.replace(/=+$/, '').toUpperCase()) {
    const v = B32.indexOf(c)
    if (v < 0) throw new Error('base32 deyil')
    bits += v.toString(2).padStart(5, '0')
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)))
  const ctr = Buffer.alloc(8)
  ctr.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)))
  const h = createHmac('sha1', key).update(ctr).digest()
  const o = h[h.length - 1] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}
