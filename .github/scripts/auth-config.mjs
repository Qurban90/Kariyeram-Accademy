// Supabase Auth ayarlarını Management API ilə yazır: OTP e-poçt şablonları, MFA (TOTP) və (verilibsə) SMTP.
// config.toml lokal mühit üçündür (test OTP nömrələri var), ona görə `supabase config push` işlədilmir.
// Sirlər yalnız mühit dəyişənlərindən oxunur və heç vaxt çap olunmur.
import { readFileSync } from 'node:fs'

const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref, SITE_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER } = process.env
if (!token || !ref) { console.error('SUPABASE_ACCESS_TOKEN və SUPABASE_PROJECT_REF lazımdır'); process.exit(2) }

const otp = readFileSync('supabase/templates/otp.html', 'utf8')
const emailChange = readFileSync('supabase/templates/email_change.html', 'utf8')
const body = {
  external_email_enabled: true,
  mailer_autoconfirm: false,
  mailer_otp_length: 6,
  mailer_otp_exp: 600,
  mailer_subjects_confirmation: 'Karyeram Accademy: təsdiq kodu',
  mailer_templates_confirmation_content: otp,
  mailer_subjects_magic_link: 'Karyeram Accademy: giriş kodu',
  mailer_templates_magic_link_content: otp,
  mailer_subjects_email_change: 'Karyeram Accademy: e-poçtu təsdiqləyin',
  mailer_templates_email_change_content: emailChange,
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
}
if (SITE_URL) body.site_url = SITE_URL
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  Object.assign(body, {
    smtp_host: SMTP_HOST, smtp_port: String(SMTP_PORT || 587), smtp_user: SMTP_USER, smtp_pass: SMTP_PASS,
    smtp_admin_email: SMTP_SENDER || SMTP_USER, smtp_sender_name: 'Karyeram Accademy',
    rate_limit_email_sent: 120,
  })
  console.log('SMTP: təyin olunur (host və göndərən verilib).')
} else {
  console.log('SMTP: sirlər verilməyib, Supabase-in daxili poçtu qalır (yalnız layihə üzvlərinə göndərir, saatda bir neçə məktub).')
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
if (!res.ok) { console.error(`Auth ayarları yazılmadı: HTTP ${res.status} ${(await res.text()).slice(0, 400)}`); process.exit(1) }
console.log(`Auth ayarları yazıldı: ${Object.keys(body).filter((k) => k !== 'smtp_pass' && !k.includes('content')).join(', ')}`)
