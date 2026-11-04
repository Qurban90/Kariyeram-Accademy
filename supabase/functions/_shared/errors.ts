export class ApiError extends Error {
  constructor(public code: string, public status = 400) {
    super(code)
  }
}

/** Server biznes xətası kodundan HTTP statusu. */
export function statusFor(code: string): number {
  if (['suspended', 'device_not_active', 'forbidden', 'banned', 'consent_required'].includes(code)) return 403
  if (['daily_limit', 'rate_limited', 'too_many_attempts'].includes(code)) return 429
  if (['not_found', 'no_profile', 'no_questions', 'no_mistakes', 'no_venue'].includes(code)) return 404
  if (['session_closed', 'out_of_order', 'full', 'too_early', 'code_used', 'bad_transition'].includes(code)) return 409
  return 400
}

export function unwrap<T extends Record<string, unknown>>(r: T): T {
  if (r && typeof r === 'object' && 'error' in r && r.error) {
    const code = String(r.error)
    throw new ApiError(code, statusFor(code))
  }
  return r
}
