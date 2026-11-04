/** HS256 JWT (Web Crypto). Deno və Node 22-də eyni işləyir. Öz kriptoqrafiyamız yoxdur: yalnız standart HMAC-SHA256. */
const enc = new TextEncoder()

export function b64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? enc.encode(bytes) : bytes
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const keyCache = new Map<string, Promise<CryptoKey>>()
function hmacKey(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret)
  if (!k) {
    k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
    keyCache.set(secret, k)
  }
  return k
}

export async function signHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${head}.${body}`)))
  return `${head}.${body}.${b64url(sig)}`
}

export class JwtError extends Error {}

/** İmzanı sabit vaxtda yoxlayır (crypto.subtle.verify), alg=HS256 məcburidir, exp/nbf yoxlanır. */
export async function verifyHS256(token: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): Promise<Record<string, unknown>> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new JwtError('malformed')
  const [h, p, s] = parts as [string, string, string]
  let header: { alg?: string }
  let payload: Record<string, unknown>
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(h)))
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)))
  } catch {
    throw new JwtError('malformed')
  }
  if (header.alg !== 'HS256') throw new JwtError('bad_alg')
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlDecode(s), enc.encode(`${h}.${p}`))
  if (!ok) throw new JwtError('bad_signature')
  if (typeof payload.exp === 'number' && nowSec >= payload.exp + 10) throw new JwtError('expired')
  if (typeof payload.nbf === 'number' && nowSec < payload.nbf - 10) throw new JwtError('not_yet_valid')
  return payload
}

export async function sha256b64(data: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(data)))
  let s = ''
  for (const x of d) s += String.fromCharCode(x)
  return btoa(s)
}
