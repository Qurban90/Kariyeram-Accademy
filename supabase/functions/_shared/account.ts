import { ApiError, unwrap } from './errors.ts'
import type { Db } from './handlers.ts'

export interface AdminDeps {
  deleteAuthUser(userId: string): Promise<void>
  /** GoTrue qadağası (null = götür). */
  setBan(userId: string, hours: number | null): Promise<void>
}

export const consent = async (db: Db, user: string, docs: string[], displayName?: string) =>
  unwrap(await db.rpc<Record<string, unknown>>('accept_consents', { p_user: user, p_docs: docs, p_display_name: displayName ?? null }))

export const revoke = async (db: Db, user: string, doc: string) => unwrap(await db.rpc<Record<string, unknown>>('revoke_consent', { p_user: user, p_doc: doc }))

export const exportData = async (db: Db, user: string) => db.rpc<Record<string, unknown>>('export_my_data', { p_user: user })

/** Hesab silinməsi: təsdiq sözü məcburidir (təsadüfi kliklə silinmə olmasın). Audit, sonra auth istifadəçisi (kaskad). */
export async function deleteAccount(db: Db, admin: AdminDeps, user: string, confirm: string) {
  if (confirm !== 'SİL') throw new ApiError('confirm_required')
  unwrap(await db.rpc<Record<string, unknown>>('prepare_account_deletion', { p_user: user }))
  await admin.deleteAuthUser(user)
  return { deleted: true }
}
