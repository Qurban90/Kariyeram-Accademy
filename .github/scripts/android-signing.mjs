#!/usr/bin/env node
/**
 * Android release imzası və R8/minify konfiqurasiyası (expo prebuild-dən SONRA işləyir).
 * İstifadə: node .github/scripts/android-signing.mjs <pilot|store> <signed:1|0>
 *
 * - signed=1: app/build.gradle(.kts) üçün signingConfigs.release əlavə olunur (keystore faylı
 *   workflow-da açılıb: apps/app/android/app/release.keystore). Parollar fayla YAZILMIR —
 *   Gradle konfiqurasiyasında System.getenv(...) oxunur (workflow addımının env-indən).
 * - store: minifyEnabled/shrinkResources TRUE + proguard-rules.pro (workflow qaydaları əlavə edir).
 * - pilot: minifyEnabled/shrinkResources FALSE (əvvəlki sed addımının əvəzi).
 * - store + signed=0 workflow-da rədd olunur; burada da təhlükəsizlik üçün yoxlanılır.
 * apps/app/** faylları CI-də yaradılan (prebuild) layihədə dəyişilir — repoda olan apps/app mənbəyinə toxunulmur.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const mode = process.argv[2]
const signed = process.argv[3] === '1'
if (!['pilot', 'store'].includes(mode)) { console.error(`Naməlum rejim: ${mode}`); process.exit(1) }
if (mode === 'store' && !signed) { console.error('::error::store yığımı release imzası tələb edir (ANDROID_KEYSTORE_* sirləri).'); process.exit(1) }

const groovyPath = 'apps/app/android/app/build.gradle'
const ktsPath = 'apps/app/android/app/build.gradle.kts'
const kts = !existsSync(groovyPath) && existsSync(ktsPath)
const file = kts ? ktsPath : groovyPath
if (!existsSync(file)) { console.error(`::error::${file} tapılmadı — expo prebuild işləyibmi?`); process.exit(1) }
let src = readFileSync(file, 'utf8')
const fail = (msg) => { console.error(`::error::android-signing: ${msg} (${file})`); process.exit(1) }

// 1) signingConfigs.release — android { blokunun içinə, birinci səviyyədə.
if (signed && !src.includes('release.keystore')) {
  const a = src.match(/\bandroid\s*\{/)
  if (!a) fail('"android {" bloku tapılmadı')
  const at = a.index + a[0].length
  const block = kts
    ? `
    signingConfigs {
        create("release") {
            storeFile = file("release.keystore")
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
        }
    }`
    : `
    signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }`
  src = src.slice(0, at) + block + src.slice(at)
}

// 2) buildTypes.release bloku: imza + proguard (store). Mövcud "signingConfig signingConfigs.debug"
//    sətri ƏVƏZ OLUNUR — Groovy-də sonuncu təyinat qalib gəlir, ona görə əlavə etməklə kifayətlənmək olmaz.
const bt = src.match(/\bbuildTypes\s*\{/)
if (!bt) fail('"buildTypes {" bloku tapılmadı')
const btStart = bt.index + bt[0].length
// KTS-də iki forma olur: `release {` və ya `getByName("release") {` / `named("release") {`.
const rel = src.slice(btStart).match(/\b(?:release|getByName\(\s*"release"\s*\)|named\(\s*"release"\s*\))\s*\{/)
if (!rel) fail('buildTypes içində release bloku tapılmadı')
const relAt = btStart + rel.index + rel[0].length
const blockEnd = (s, start) => {
  let depth = 1
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}' && --depth === 0) return i
  }
  return -1
}
const relEnd = blockEnd(src, relAt)
if (relEnd < 0) fail('release blokunun bağlanan mötərizəsi tapılmadı')
let body = src.slice(relAt, relEnd)
if (signed) {
  const line = kts ? 'signingConfig = signingConfigs.getByName("release")' : 'signingConfig signingConfigs.release'
  if (/^\s*signingConfig\s*[=\s]/m.test(body)) body = body.replace(/^(\s*)signingConfig\s*[=\s].*$/m, `$1${line}`)
  else body = `\n            ${line}` + body
}
if (mode === 'store' && !body.includes('proguard-rules.pro')) {
  body += (kts
    ? '\n            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")'
    : "\n            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'") + '\n        '
}
src = src.slice(0, relAt) + body + src.slice(relEnd)

// 3) minify/shrink: store=true, pilot=false (köhnə workflow-dakı sed ilə eyni sahələr).
const v = mode === 'store'
src = src
  .replace(/^(\s*)minifyEnabled .*$/gm, `$1minifyEnabled ${v}`)
  .replace(/^(\s*)shrinkResources .*$/gm, `$1shrinkResources ${v}`)
  .replace(/^(\s*)isMinifyEnabled = .*$/gm, `$1isMinifyEnabled = ${v}`)
  .replace(/^(\s*)isShrinkResources = .*$/gm, `$1isShrinkResources = ${v}`)

writeFileSync(file, src)
console.log(`android-signing: rejim=${mode}, imza=${signed ? 'release' : 'debug (pilot)'}, minify=${v}`)
for (const line of src.split('\n')) {
  if (/minifyEnabled|shrinkResources|isMinifyEnabled|isShrinkResources|signingConfig|proguardFiles|storeFile/.test(line)) console.log('  ' + line.trim())
}